const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const User = require('../../models/User');
const Customer = require('../../models/Customer');
const Order = require('../../models/Order');
const Product = require('../../models/Product');

const jwtSecret = process.env.JWT_SECRET || 'restaurante-pdv-secret-key';

let adminToken;
let product;

beforeEach(async () => {
  const admin = await User.create({ username: 'dashboard-admin', password: '1234', role: 'admin' });
  adminToken = jwt.sign({ id: admin._id, username: admin.username, role: admin.role }, jwtSecret, { expiresIn: '1h' });
  product = await Product.create({
    codigo: 'DASH-1',
    nome: 'Café',
    preco: 10,
    tipo: 'venda',
    categoria: 'Bebidas Quentes',
    estoque: 10,
  });
});

const createOrder = ({ customer, date, total, paymentDate = date, status = 'pago' }) => Order.create({
  itens: [{ produtoId: product._id, nome: 'Café', precoUnitario: total, quantidade: 1 }],
  subtotal: total,
  total,
  clienteId: customer?._id,
  clienteNome: customer?.nome,
  status,
  pagamentos: [{ tipo: 'dinheiro', valorRecebido: total, dataPagamento: new Date(paymentDate) }],
  atendente: 'admin',
  createdAt: new Date(date),
  updatedAt: new Date(date),
});

describe('GET /api/dashboard reports and pagination', () => {
  test('applies an inclusive São Paulo date range to sales and customer totals', async () => {
    const customer = await Customer.create({ nome: 'Ana', telefone: '11999990000' });
    await createOrder({
      customer,
      date: '2026-01-01T03:00:00.000Z',
      total: 25,
      paymentDate: '2026-01-01T03:00:00.000Z',
    });
    await createOrder({
      customer,
      date: '2026-01-02T03:00:00.000Z',
      total: 100,
    });
    await createOrder({
      customer,
      date: '2025-12-31T02:59:59.999Z',
      total: 50,
    });
    await createOrder({
      date: '2025-12-15T12:00:00.000Z',
      paymentDate: '2026-01-01T03:00:00.000Z',
      total: 40,
    });

    const response = await request(app)
      .get('/api/dashboard?dataInicio=2026-01-01&dataFim=2026-01-01')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.range).toEqual({ dataInicio: '2026-01-01', dataFim: '2026-01-01' });
    expect(response.body.relatorioMes).toMatchObject({ pedidos: 1, vendas: 1, total: 25, recebido: 65 });
    expect(response.body.relatorioClientes).toMatchObject({
      totalCadastrados: 1,
      clientesComCompra: 1,
      totalVendido: 25,
      totalRecebido: 25,
    });
    expect(response.body.relatorioClientes.clientes[0]).toMatchObject({ nome: 'Ana', pedidos: 1, total: 25 });
  });

  test('paginates customers on the server and reports stable totals', async () => {
    await Customer.create([{ nome: 'Ana' }, { nome: 'Bia' }, { nome: 'Caio' }]);

    const response = await request(app)
      .get('/api/dashboard?page=2&limit=2&sort=nome&order=asc&dataInicio=2026-01-01&dataFim=2026-01-31')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.relatorioClientes.clientes.map((customer) => customer.nome)).toEqual(['Caio']);
    expect(response.body.pagination).toEqual({
      page: 2,
      pageSize: 2,
      total: 3,
      totalPages: 2,
      hasPreviousPage: true,
      hasNextPage: false,
    });
  });

  test.each([
    '/api/dashboard?dataInicio=2026-02-30&dataFim=2026-03-01',
    '/api/dashboard?dataInicio=2026-03-02&dataFim=2026-03-01',
    '/api/dashboard?page=0',
    '/api/dashboard?pageSize=101',
    '/api/dashboard?sort=total',
  ])('rejects invalid report or pagination parameters: %s', async (url) => {
    const response = await request(app).get(url).set('Authorization', `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(400);
    expect(response.body.msg).toBeTruthy();
  });
});
