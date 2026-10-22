const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Entregador = require('../../models/Entregador');
const DeliveryOrder = require('../../models/DeliveryOrder');

const jwtSecret = process.env.JWT_SECRET || 'restaurante-pdv-secret-key';
const app = express();
app.use(express.json());
app.use('/api/delivery', require('../../routes/delivery'));

const tokenFor = user => jwt.sign(
  { id: user._id, role: user.role },
  jwtSecret,
  { expiresIn: '1h' }
);

const criarUsuario = (username, fields = {}) => User.create({
  username,
  password: '1234',
  role: 'entregador',
  name: username,
  ...fields,
});

const criarEntregador = async (username = 'motorista', fields = {}) => {
  const usuario = await criarUsuario(username, fields.usuario || {});
  const entregador = await Entregador.create({
    nome: username,
    telefone: '11999999999',
    senha: '12345678',
    usuarioId: usuario._id,
    ...fields.perfil,
  });
  return { usuario, entregador };
};

const criarPedido = (fields = {}) => DeliveryOrder.create({
  origem: {
    tipo: 'cliente',
    nomeCliente: 'Cliente teste',
    endereco: { rua: 'Rua A', numero: '10' },
  },
  itens: [],
  valorTotal: 25,
  ...fields,
});

const postarComo = (path, body, user) => request(app)
  .post(path)
  .set('Authorization', `Bearer ${tokenFor(user)}`)
  .send(body);

describe('delivery account mapping', () => {
  test('creates a profile linked to an existing eligible User and lists its mapping', async () => {
    const admin = await User.create({ username: 'admin-link', password: '1234', role: 'admin' });
    const usuario = await criarUsuario('conta-motorista');

    const created = await postarComo('/api/delivery/entregadores', {
      nome: 'Motorista',
      telefone: '11999999999',
      senha: '12345678',
      usuarioId: usuario._id,
    }, admin);

    expect(created.status).toBe(201);
    expect(String(created.body.usuarioId)).toBe(String(usuario._id));
    expect(String(created.body._id)).not.toBe(String(usuario._id));
    const listed = await request(app)
      .get('/api/delivery/entregadores')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);
    expect(String(listed.body[0].usuarioId._id)).toBe(String(usuario._id));
    expect(listed.body[0].usuarioId.username).toBe('conta-motorista');
  });

  test.each([
    ['missing', null, 'Selecione uma conta de entregador válida'],
    ['invalid-id', 'not-an-object-id', 'Selecione uma conta de entregador válida'],
  ])('rejects %s account identifiers when creating a profile', async (_case, usuarioId, expectedMessage) => {
    const admin = await User.create({ username: `admin-${_case}`, password: '1234', role: 'admin' });
    const response = await postarComo('/api/delivery/entregadores', {
      nome: 'Sem conta',
      telefone: '11999999999',
      senha: '12345678',
      ...(usuarioId === null ? {} : { usuarioId }),
    }, admin);

    expect(response.status).toBe(400);
    expect(response.body.msg).toBe(expectedMessage);
  });

  test.each([
    ['wrong-role', { role: 'admin', active: true }, 'conta-admin'],
    ['inactive', { role: 'entregador', active: false }, 'conta-inativa'],
  ])('rejects %s accounts for delivery profiles', async (_case, fields, username) => {
    const admin = await User.create({ username: `admin-${_case}`, password: '1234', role: 'admin' });
    const usuario = await criarUsuario(username, fields);

    const response = await postarComo('/api/delivery/entregadores', {
      nome: username,
      telefone: '11999999999',
      senha: '12345678',
      usuarioId: usuario._id,
    }, admin);

    expect(response.status).toBe(400);
    expect(await Entregador.countDocuments()).toBe(0);
  });

  test('available accounts omit inactive, wrong-role, and already linked users', async () => {
    const admin = await User.create({ username: 'admin-available', password: '1234', role: 'admin' });
    const { usuario: linked } = await criarEntregador('linked-user');
    const available = await criarUsuario('available-user');
    await criarUsuario('inactive-user', { active: false });
    await criarUsuario('admin-user', { role: 'admin' });

    const response = await request(app)
      .get('/api/delivery/entregadores/usuarios-disponiveis')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(response.status).toBe(200);
    expect(response.body.map(user => String(user._id))).toEqual([String(available._id)]);
    expect(response.body.map(user => String(user._id))).not.toContain(String(linked._id));
  });

  test('prevents duplicate account links on create and update', async () => {
    const admin = await User.create({ username: 'admin-duplicate', password: '1234', role: 'admin' });
    const { usuario } = await criarEntregador('first-profile');
    const second = await Entregador.create({
      nome: 'Segundo perfil',
      telefone: '11888888888',
      senha: '12345678',
    });
    const body = { nome: 'Duplicado', telefone: '11777777777', senha: '12345678', usuarioId: usuario._id };

    const createResponse = await postarComo('/api/delivery/entregadores', body, admin);
    const updateResponse = await request(app)
      .put(`/api/delivery/entregadores/${second._id}`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({ usuarioId: usuario._id });

    expect(createResponse.status).toBe(400);
    expect(updateResponse.status).toBe(400);
    expect((await Entregador.findById(second._id)).usuarioId).toBeUndefined();
  });

  test('updates legacy profile fields without deleting its existing association', async () => {
    const admin = await User.create({ username: 'admin-preserve', password: '1234', role: 'admin' });
    const { usuario, entregador } = await criarEntregador('preserved-link');

    const response = await request(app)
      .put(`/api/delivery/entregadores/${entregador._id}`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({ nome: 'Nome atualizado' });

    expect(response.status).toBe(200);
    const saved = await Entregador.findById(entregador._id);
    expect(saved.nome).toBe('Nome atualizado');
    expect(String(saved.usuarioId)).toBe(String(usuario._id));
  });
});

describe('delivery order transitions and authorization', () => {
  test('dispatch validates active linked delivery profiles and records history', async () => {
    const admin = await User.create({ username: 'admin-dispatch', password: '1234', role: 'admin' });
    const { entregador } = await criarEntregador('assigned-driver');
    const pedido = await criarPedido({ status: 'pronto' });

    const response = await postarComo(`/api/delivery/pedidos/${pedido._id}/despachar`, {
      entregadorId: entregador._id,
    }, admin);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('despachado');
    expect(String(response.body.entregadorId)).toBe(String(entregador._id));
    expect(response.body.statusHistorico).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: 'pronto' })])
    );
    const saved = await DeliveryOrder.findById(pedido._id);
    expect(saved.status).toBe('despachado');
    expect(String(saved.entregadorId)).toBe(String(entregador._id));
  });

  test('follows the valid preparation, dispatch, travel, and delivery sequence', async () => {
    const admin = await User.create({ username: 'admin-valid-flow', password: '1234', role: 'admin' });
    const { usuario, entregador } = await criarEntregador('driver-valid-flow');
    const order = await criarPedido();

    const ready = await postarComo(`/api/delivery/pedidos/${order._id}/pronto`, {}, admin);
    const dispatched = await postarComo(`/api/delivery/pedidos/${order._id}/despachar`, {
      entregadorId: entregador._id,
    }, admin);
    const traveling = await postarComo(`/api/delivery/pedidos/${order._id}/status`, {
      novoStatus: 'a_caminho',
    }, usuario);
    const delivered = await postarComo(`/api/delivery/pedidos/${order._id}/status`, {
      novoStatus: 'entregue',
    }, usuario);

    expect([ready.status, dispatched.status, traveling.status, delivered.status]).toEqual([200, 200, 200, 200]);
    expect(delivered.body.status).toBe('entregue');
    expect(delivered.body.statusHistorico.map(event => event.status)).toEqual([
      'pendente',
      'pronto',
      'despachado',
      'a_caminho',
    ]);
  });

  test.each([
    ['unlinked profile', { perfil: {} }, true],
    ['inactive profile', { perfil: { ativo: false } }, false],
    ['inactive account', { usuario: { active: false } }, false],
  ])('rejects dispatch to an %s', async (_case, fields, omitLink) => {
    const admin = await User.create({ username: `admin-${_case.replace(/\s/g, '-')}`, password: '1234', role: 'admin' });
    let profile;
    if (omitLink) {
      profile = await Entregador.create({ nome: 'Sem conta', telefone: '11999999999', senha: '12345678' });
    } else {
      ({ entregador: profile } = await criarEntregador(`driver-${_case.replace(/\s/g, '-')}`, fields));
    }
    const pedido = await criarPedido({ status: 'pronto' });

    const response = await postarComo(`/api/delivery/pedidos/${pedido._id}/despachar`, {
      entregadorId: profile._id,
    }, admin);

    expect(response.status).toBe(400);
    expect((await DeliveryOrder.findById(pedido._id)).status).toBe('pronto');
    expect((await DeliveryOrder.findById(pedido._id)).entregadorId).toBeUndefined();
  });

  test('delivery account lists only orders assigned to its mapped profile, ignoring caller filter', async () => {
    const { usuario, entregador } = await criarEntregador('mapped-driver');
    const ownOrder = await criarPedido({ entregadorId: entregador._id });
    await criarPedido({ entregadorId: new mongoose.Types.ObjectId() });

    const response = await request(app)
      .get('/api/delivery/pedidos')
      .query({ entregadorId: new mongoose.Types.ObjectId() })
      .set('Authorization', `Bearer ${tokenFor(usuario)}`);

    expect(response.status).toBe(200);
    expect(response.body.map(order => order._id)).toEqual([String(ownOrder._id)]);
  });

  test.each([
    ['/pronto', {}],
    ['/cancelar', { motivo: 'Não é meu pedido' }],
    ['/status', { novoStatus: 'entregue' }],
    ['/enviar-whatsapp', {}],
  ])('delivery account cannot update or inspect an order assigned to another profile via %s', async (path, body) => {
    const { usuario } = await criarEntregador(`driver-${path.slice(1)}`);
    const order = await criarPedido({ entregadorId: new mongoose.Types.ObjectId() });

    const response = await postarComo(`/api/delivery/pedidos/${order._id}${path}`, body, usuario);

    expect(response.status).toBe(404);
    expect((await DeliveryOrder.findById(order._id)).status).toBe('pendente');
  });

  test('mapped driver can update its assigned order status', async () => {
    const { usuario, entregador } = await criarEntregador('driver-own-update');
    const order = await criarPedido({ entregadorId: entregador._id, status: 'despachado' });

    const response = await postarComo(`/api/delivery/pedidos/${order._id}/status`, {
      novoStatus: 'a_caminho',
    }, usuario);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('a_caminho');
    expect(response.body.statusHistorico).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: 'despachado' })])
    );
  });

  test.each([
    ['/pronto', 'pronto', {}],
    ['/despachar', 'pendente', { entregadorId: new mongoose.Types.ObjectId() }],
    ['/cancelar', 'entregue', { motivo: 'Tarde demais' }],
    ['/status', 'pendente', { novoStatus: 'entregue' }],
    ['/status', 'cancelado', { novoStatus: 'pendente' }],
  ])('rejects illegal transition via %s from %s without changing history', async (path, status, body) => {
    const admin = await User.create({ username: `admin-illegal-${status}-${path.slice(1)}`, password: '1234', role: 'admin' });
    const order = await criarPedido({ status });

    const response = await postarComo(`/api/delivery/pedidos/${order._id}${path}`, body, admin);

    expect(response.status).toBe(409);
    const saved = await DeliveryOrder.findById(order._id);
    expect(saved.status).toBe(status);
    expect(saved.statusHistorico).toHaveLength(0);
  });

  test('status endpoint rejects unknown values without changing an order', async () => {
    const admin = await User.create({ username: 'admin-invalid-status', password: '1234', role: 'admin' });
    const order = await criarPedido();
    const response = await postarComo(`/api/delivery/pedidos/${order._id}/status`, { novoStatus: 'unknown' }, admin);

    expect(response.status).toBe(400);
    expect((await DeliveryOrder.findById(order._id)).status).toBe('pendente');
  });

  test('competing transitions use compare-and-set so only one status and history update wins', async () => {
    const admin = await User.create({ username: 'admin-concurrent', password: '1234', role: 'admin' });
    const order = await criarPedido();

    const responses = await Promise.all([
      postarComo(`/api/delivery/pedidos/${order._id}/pronto`, {}, admin),
      postarComo(`/api/delivery/pedidos/${order._id}/cancelar`, { motivo: 'Concorrência' }, admin),
    ]);

    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    const saved = await DeliveryOrder.findById(order._id);
    expect(['pronto', 'cancelado']).toContain(saved.status);
    expect(saved.statusHistorico).toHaveLength(1);
    expect(saved.statusHistorico[0].status).toBe('pendente');
  });
});
