/* global describe, beforeEach, cy, it */

const periodoVazio = () => ({
  pedidos: 0,
  itens: 0,
  total: 0,
  ticketMedio: 0,
  maisVendidos: [],
});

const dashboardFixture = (page) => ({
  taxasCartao: { cartao_credito: 0, cartao_debito: 0 },
  periodos: { dia: periodoVazio(), semana: periodoVazio(), mes: periodoVazio() },
  comandasAbertas: 0,
  clientesCadastrados: 25,
  clientesRecentes: [],
  pedidosHoje: [],
  vendasHoje: { pedidos: 0, itens: 0, total: 0, recebido: 0, pendente: 0 },
  relatorioMes: {
    periodo: '01/01/2026 a 31/01/2026',
    pedidos: 0,
    vendas: 0,
    itens: 0,
    total: 0,
    recebido: 0,
    pendente: 0,
    ticketMedio: 0,
    status: {},
    pagamentos: [],
    taxasCartao: 0,
    produtos: [],
    clientes: 0,
    vendasPorDia: [],
    vendasPorTipo: { mesa: 0, balcao: 0 },
    descontosQuantidade: { total: 0, produtos: [] },
  },
  relatorioClientes: {
    periodo: '01/01/2026 a 31/01/2026',
    totalCadastrados: 25,
    clientesComCompra: 0,
    totalVendido: 0,
    totalRecebido: 0,
    totalPendente: 0,
    clientes: [{ id: `cliente-${page}`, nome: `Cliente ${page}`, telefone: '', pedidos: 0, total: 0, recebido: 0, pendente: 0 }],
  },
  pagination: { page, pageSize: 10, total: 25, totalPages: 3, hasPreviousPage: page > 1, hasNextPage: page < 3 },
  range: { dataInicio: '2026-01-01', dataFim: '2026-01-31' },
  insights: {},
});

describe('Dashboard pagination and retained URL filters', () => {
  beforeEach(() => {
    cy.intercept({ method: 'GET', pathname: '/api/dashboard' }, (request) => {
      const page = Number(request.query.page || 1);
      request.reply({ statusCode: 200, body: dashboardFixture(page) });
    }).as('dashboard');
  });

  it('paginates on the server and retains date and unrelated filters in the URL', () => {
    cy.visit('/tests/fixtures/dashboard-pagination.html?dataInicio=2026-01-01&dataFim=2026-01-31&page=2&pageSize=10&segmento=vip');

    cy.wait('@dashboard').its('request.query').should('include', {
      dataInicio: '2026-01-01',
      dataFim: '2026-01-31',
      page: '2',
      pageSize: '10',
      segmento: 'vip',
    });
    cy.contains('.dashboard-customer', 'Cliente 2').should('be.visible');
    cy.get('.paginacao').contains('button', 'Próxima').click();
    cy.wait('@dashboard').its('request.query.page').should('eq', '3');
    cy.location('search').should('include', 'dataInicio=2026-01-01')
      .and('include', 'dataFim=2026-01-31')
      .and('include', 'page=3')
      .and('include', 'pageSize=10')
      .and('include', 'segmento=vip');
  });

  it('resets the page after changing the date range and retains filters when switching tabs', () => {
    cy.visit('/tests/fixtures/dashboard-pagination.html?dataInicio=2026-01-01&dataFim=2026-01-31&page=2&pageSize=10&segmento=vip');
    cy.wait('@dashboard');
    cy.get('[aria-label="Início do relatório"]').clear().type('2026-01-15');
    cy.wait('@dashboard');
    cy.wait('@dashboard').its('request.query').should('include', {
      dataInicio: '2026-01-15',
      dataFim: '2026-01-31',
      page: '1',
      pageSize: '10',
      segmento: 'vip',
    });
    cy.get('.dashboard-tabs').contains('button', 'Produção').click();
    cy.location('search').should('include', 'aba=producao')
      .and('include', 'dataInicio=2026-01-15')
      .and('include', 'dataFim=2026-01-31')
      .and('include', 'segmento=vip');
  });

  it('normalizes invalid URL page values before requesting data', () => {
    cy.visit('/tests/fixtures/dashboard-pagination.html?page=0&pageSize=1000&segmento=vip');
    cy.wait('@dashboard').its('request.query').should('include', {
      page: '1',
      pageSize: '20',
      segmento: 'vip',
    });
    cy.location('search').should('include', 'page=1')
      .and('include', 'pageSize=20')
      .and('include', 'segmento=vip');
  });
});
