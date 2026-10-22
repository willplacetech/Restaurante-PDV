const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const User = require('../../models/User');
const Product = require('../../models/Product');

const jwtSecret = process.env.JWT_SECRET || 'restaurante-pdv-secret-key';

describe('Preparação unificada', () => {
  let token;
  let insumo;

  beforeEach(async () => {
    const admin = await User.create({ username: 'preparacao-admin', password: '1234', role: 'admin' });
    token = jwt.sign({ id: admin._id, username: admin.username, role: admin.role }, jwtSecret, { expiresIn: '1h' });
    insumo = await Product.create({
      codigo: 'PREP-INSUMO',
      nome: 'Farinha',
      tipo: 'insumo',
      categoria: 'Insumos',
      unidade: 'kg',
      preco: 0,
      precoCompra: 10,
      unidadeCompra: 'kg',
      unidadeConteudo: 'kg',
      conteudoPorEmbalagem: 1,
      estoque: 10,
      estoqueInsumos: 10,
      estoqueEmbalagens: 10,
      custoUnitarioBase: 10,
      usavelEmReceita: true,
    });
  });

  const criarPreparacao = (codigo, nome, modoOperacional, rendimentoPorReceita = 1) => request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      codigo,
      nome,
      tipo: 'venda',
      tipoProduto: 'preparacao',
      modoOperacional,
      rendimentoPorReceita,
      categoria: 'Doces',
      preco: 5,
      estoque: modoOperacional === 'sob_demanda' ? 0 : 0,
      unidadeVenda: 'un',
    });

  test('cadastra preparação sob demanda, consome insumo, entra na cozinha e estorna no cancelamento', async () => {
    const criado = await criarPreparacao('PREP-001', 'Bolo sob demanda', 'sob_demanda');
    expect(criado.statusCode).toBe(201);
    expect(criado.body.tipoProduto).toBe('preparacao');
    expect(criado.body.modoOperacional).toBe('sob_demanda');

    const vendaDireta = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ itens: [{ produtoId: criado.body._id, quantidade: 1 }] });
    expect(vendaDireta.statusCode).toBe(400);
    expect(vendaDireta.body.msg).toMatch(/comanda/i);

    const receita = await request(app)
      .post('/api/production/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Bolo sob demanda',
        produtoId: criado.body._id,
        rendimento: 1,
        unidadeRendimento: 'un',
        ingredientes: [{ produtoId: insumo.id, quantidade: 0.5, unidade: 'kg' }],
      });
    expect(receita.statusCode).toBe(201);
    expect(receita.body.tipoFicha).toBe('preparacao');
    expect(receita.body.modoOperacional).toBe('sob_demanda');

    const comanda = await request(app)
      .post('/api/comandas')
      .set('Authorization', `Bearer ${token}`)
      .send({ itens: [{ produtoId: criado.body._id, quantidade: 1 }] });
    expect(comanda.statusCode).toBe(201);
    expect(comanda.body.itens[0].aFazer).toBe(true);
    const ingredienteAposVenda = await Product.findById(insumo._id);
    expect(ingredienteAposVenda.estoqueEmbalagens).toBe(9);
    expect(ingredienteAposVenda.estoqueConteudoAberto).toBe(0.5);

    const fila = await request(app)
      .get('/api/comandas/cozinha')
      .set('Authorization', `Bearer ${token}`);
    expect(fila.body[0].itens[0].nome).toBe('Bolo sob demanda');

    const cancelada = await request(app)
      .patch(`/api/comandas/${comanda.body._id}/cancelar`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancelada.statusCode).toBe(200);
    const ingredienteEstornado = await Product.findById(insumo._id);
    expect(ingredienteEstornado.estoqueEmbalagens).toBe(10);
    expect(ingredienteEstornado.estoqueConteudoAberto).toBe(0);
  });

  test('cadastra preparação em lote, produz rendimento, vende estoque pronto e mantém insumos', async () => {
    const criado = await criarPreparacao('PREP-002', 'Bolo em lote', 'lote', 4);
    expect(criado.statusCode).toBe(201);
    expect(criado.body.tipoProduto).toBe('preparacao');
    expect(criado.body.modoOperacional).toBe('lote');

    const receita = await request(app)
      .post('/api/production/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Bolo em lote',
        produtoId: criado.body._id,
        rendimento: 4,
        unidadeRendimento: 'un',
        ingredientes: [{ produtoId: insumo.id, quantidade: 2, unidade: 'kg' }],
      });
    expect(receita.statusCode).toBe(201);
    expect(receita.body.modoOperacional).toBe('lote');

    const producao = await request(app)
      .post('/api/production/produce')
      .set('Authorization', `Bearer ${token}`)
      .send({ receitas: [{ receitaId: receita.body._id, quantidade: 1 }] });
    expect(producao.statusCode).toBe(201);
    expect(Number((await Product.findById(criado.body._id)).estoque)).toBe(4);
    expect(Number((await Product.findById(insumo._id)).estoqueEmbalagens)).toBe(8);

    const comanda = await request(app)
      .post('/api/comandas')
      .set('Authorization', `Bearer ${token}`)
      .send({ itens: [{ produtoId: criado.body._id, quantidade: 1 }] });
    expect(comanda.statusCode).toBe(201);
    expect(comanda.body.itens[0].aFazer).toBe(false);
    expect(Number((await Product.findById(criado.body._id)).estoque)).toBe(3);
    expect(Number((await Product.findById(insumo._id)).estoqueEmbalagens)).toBe(8);
  });

  test('recusa modo ausente/inválido e deixa produto legado ambíguo para resolução explícita', async () => {
    const semModo = await criarPreparacao('PREP-003', 'Sem modo', undefined);
    expect(semModo.statusCode).toBe(400);

    const modoInvalido = await criarPreparacao('PREP-004', 'Modo inválido', 'quando_der');
    expect(modoInvalido.statusCode).toBe(400);

    const [legado] = await Product.collection.insertOne({
      codigo: 'PREP-LEGADO',
      nome: 'Legado sem classificação',
      tipo: 'venda',
      categoria: 'Outros',
      preco: 5,
      estoque: 2,
      aFazer: false,
      producaoPropria: false,
    }).then((result) => [result.insertedId]);
    const legadoConfiavel = await Product.collection.insertOne({
      codigo: 'PREP-LEGADO-COZ',
      nome: 'Prato à la carte',
      tipo: 'venda',
      tipoProduto: 'coz',
      categoria: 'Pratos na Hora',
      preco: 8,
      estoque: 0,
      aFazer: true,
      producaoPropria: false,
    });

    const migracao = await request(app)
      .post('/api/products/migracoes/normalizar-registros-legados')
      .set('Authorization', `Bearer ${token}`);
    expect(migracao.statusCode).toBe(200);
    expect(migracao.body.preparacoesConvertidas).toBe(1);
    expect(migracao.body.pendentesResolucao.some((item) => item.id === String(legado))).toBe(true);
    const modoMigrado = await Product.findById(legadoConfiavel.insertedId).lean();
    expect(modoMigrado.tipoProduto).toBe('preparacao');
    expect(modoMigrado.modoOperacional).toBe('sob_demanda');

    const listado = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`);
    const pendente = listado.body.find((product) => String(product._id) === String(legado));
    expect(pendente.tipoProduto).toBeNull();
    expect(pendente.modoOperacional).toBeNull();
    expect(pendente.preparacaoPendente).toBe(true);

    const resolvido = await request(app)
      .put(`/api/products/${legado}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tipoProduto: 'preparacao', modoOperacional: 'lote' });
    expect(resolvido.statusCode).toBe(200);
    expect(resolvido.body.modoOperacional).toBe('lote');
  });
});
