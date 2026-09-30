const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Comanda = require('../models/Comanda');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { obterTaxasCartao, calcularPagamento } = require('../utils/taxasCartao');
const { precoPorUnidade } = require('../utils/pesoProduto');
const { normalizarEstoqueLegado, produtoControlaPeso, dadosMovimentoEstoque } = require('../utils/estoqueProduto');
const { calcularPrecoComDesconto } = require('../utils/descontosQuantidade');

const router = express.Router();
const permiteFracionar = (product) => !Number(product?.pesoPorUnidade) && (Boolean(product?.vendidoFracionado) || ['kg', 'L'].includes(product?.unidadeVenda));
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

async function buildOrderItems(rawItems, session) {
  if (!Array.isArray(rawItems) || !rawItems.length) throw new Error('O pedido precisa ter pelo menos um item');
  const totals = new Map();
  for (const item of rawItems) {
    const quantity = Number(item.quantidade);
    if (!mongoose.isValidObjectId(item.produtoId) || !Number.isFinite(quantity) || quantity < 0.001) throw new Error('Item de pedido inválido');
    totals.set(String(item.produtoId), (totals.get(String(item.produtoId)) || 0) + quantity);
  }
  const products = await Product.find({ _id: { $in: [...totals.keys()] } }).session(session);
  const byId = new Map(products.map((product) => [product.id, product]));
  const quantidadesPorProduto = new Map(totals);
  totals.clear();
  const items = rawItems.map((item) => {
    const product = byId.get(String(item.produtoId));
    const vendaPorPeso = produtoControlaPeso(product) && item.tipoVenda === 'peso';
    const pesoVendidoKg = vendaPorPeso ? Number(item.pesoVendidoKg) : 0;
    const quantity = vendaPorPeso ? 1 : Number(item.quantidade);
    if (!product) throw new Error('Produto não encontrado');
    if (vendaPorPeso && (!Number.isFinite(pesoVendidoKg) || pesoVendidoKg <= 0)) throw new Error('Informe o peso vendido');
    if (!permiteFracionar(product) && !Number.isInteger(quantity)) throw new Error(`O produto "${product.nome}" é vendido somente por unidade`);
    normalizarEstoqueLegado(product);
    const movimento = dadosMovimentoEstoque(product, { quantidade: quantity, tipoVenda: vendaPorPeso ? 'peso' : undefined, pesoVendidoKg });
    const atual = totals.get(String(item.produtoId));
    totals.set(String(item.produtoId), { pecas: (typeof atual === 'number' ? atual : atual?.pecas || 0) + movimento.pecas, pesoKg: (typeof atual === 'number' ? 0 : atual?.pesoKg || 0) + movimento.pesoKg });
    const precoNormal = vendaPorPeso ? money(pesoVendidoKg * Number(product.preco || 0)) : precoPorUnidade(product);
    const pricing = vendaPorPeso ? { precoUnitario: precoNormal, precoNormal, economiaTotal: 0, faixaAplicada: null } : calcularPrecoComDesconto(product, quantidadesPorProduto.get(String(product._id)), precoNormal);
    return { produtoId: product.id, codigo: product.codigo, nome: product.nome, precoUnitario: pricing.precoUnitario, precoUnitarioOriginal: pricing.precoNormal, descontoQuantidade: pricing.economiaUnitario, economiaQuantidade: pricing.economiaTotal, faixaDescontoQuantidade: pricing.faixaAplicada?.quantidadeMinima, quantidade: quantity, quantidadePecas: vendaPorPeso ? 0 : quantity, pesoVendidoKg: vendaPorPeso ? pesoVendidoKg : undefined, tipoVenda: vendaPorPeso ? 'peso' : (produtoControlaPeso(product) ? 'inteiro' : 'unidade'), unidadeVenda: product.unidadeVenda, pesoPorUnidade: product.pesoPorUnidade, unidadePeso: product.unidadePeso };
  });
  for (const [productId, quantity] of totals) {
    const product = byId.get(productId);
    if (product.isModified('estoque') || product.isModified('estoquePesoKg')) await product.save({ session });
    const movimento = typeof quantity === 'number' ? { pecas: quantity, pesoKg: 0 } : quantity;
    const filtro = produtoControlaPeso(product)
      ? { _id: productId, estoque: { $gte: movimento.pecas }, estoquePesoKg: { $gte: movimento.pesoKg } }
      : { _id: productId, estoque: { $gte: movimento.pecas } };
    const inc = produtoControlaPeso(product)
      ? { $inc: { estoque: -movimento.pecas, estoquePesoKg: -movimento.pesoKg } }
      : { $inc: { estoque: -movimento.pecas } };
    const updated = await Product.findOneAndUpdate(filtro, inc, { new: true, session });
    if (!updated) throw new Error(`Estoque insuficiente para "${byId.get(productId)?.nome || productId}"`);
  }
  return items;
}

// POST /api/vendas - cria venda com verificação de duplicata via idTemporario
router.post('/', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  const { idTemporario, ...vendaData } = req.body;

  // Se veio idTemporario, verifica se já existe venda com esse id
  if (idTemporario) {
    const existing = await Order.findOne({ idTemporario });
    if (existing) {
      console.log('[Vendas] Duplicata detectada para idTemporario:', idTemporario, '- retornando venda existente');
      return res.json({ ...existing.toObject(), duplicata: true });
    }
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const items = await buildOrderItems(vendaData.itens, session);
    const subtotal = money(items.reduce((sum, item) => sum + item.precoUnitario * item.quantidade, 0));
    const discount = money(vendaData.desconto || 0);
    if (discount < 0 || discount > subtotal) throw new Error('Desconto inválido');

    const order = new Order({
      itens: items,
      subtotal,
      desconto: discount,
      total: money(subtotal - discount),
      clienteId: vendaData.clienteId || undefined,
      clienteNome: vendaData.clienteNome || 'Cliente não identificado',
      clienteTelefone: vendaData.clienteTelefone || '',
      atendente: vendaData.atendente || req.user.username,
      comandaId: vendaData.comandaId || undefined,
      tipoAtendimento: vendaData.tipoAtendimento || 'balcao',
      observacao: vendaData.observacao,
      idTemporario: idTemporario || undefined,
      pagamentos: [{
        tipo: vendaData.formaPagamento || 'dinheiro',
        valorRecebido: vendaData.valorRecebido || vendaData.total,
        ...calcularPagamento(vendaData.formaPagamento || 'dinheiro', vendaData.valorRecebido || vendaData.total, await obterTaxasCartao()),
        dataPagamento: new Date(),
        quitado: true,
        observacao: vendaData.observacaoPagamento,
      }],
      status: 'pago',
    });

    await order.save({ session });

    // Se há comanda, atualiza status
    if (vendaData.comandaId) {
      const comanda = await Comanda.findById(vendaData.comandaId).session(session);
      if (comanda) {
        comanda.status = 'fechada';
        comanda.pedidoId = order._id;
        await comanda.save({ session });
      }
    }

    await session.commitTransaction();
    res.status(201).json({ ...order.toObject(), duplicata: false });
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error('[Vendas] Erro ao criar venda:', err);
    res.status(400).json({ msg: err.message });
  } finally {
    await session.endSession();
  }
});

// GET /api/vendas - lista vendas (alias para orders com filtro pago)
router.get('/', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  try {
    const { inicio, fim, clienteId } = req.query;
    const filter = { status: 'pago' };
    if (clienteId) filter.clienteId = clienteId;
    if (inicio && fim) filter.createdAt = { $gte: new Date(inicio), $lte: new Date(new Date(fim).setHours(23, 59, 59)) };
    const vendas = await Order.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json(vendas);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;