/* global describe, beforeEach, cy, it */

describe('Acesso de entregador pelo login', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/login');
  });

  it('exibe o link para o painel de entregador', () => {
    cy.contains('a', 'Acesso do entregador')
      .should('have.attr', 'href', '/entregador');
  });

  it('encaminha o entregador autenticado ao painel de entregas', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 200,
      body: {
        token: 'courier-token',
        user: {
          id: 'courier-1',
          name: 'Entregador',
          username: 'entregador',
          role: 'entregador',
        },
      },
    }).as('loginCourier');
    cy.intercept('GET', '/api/delivery/pedidos', {
      statusCode: 200,
      body: [],
    }).as('courierOrders');

    cy.contains('a', 'Acesso do entregador').click();
    cy.location('pathname').should('eq', '/login');
    cy.get('input[name="username"]').type('entregador');
    cy.get('input[name="password"]').type('senha-teste');
    cy.get('button[type="submit"]').click();

    cy.wait('@loginCourier');
    cy.wait('@courierOrders');
    cy.location('pathname').should('eq', '/entregador');
    cy.contains('MINHAS ENTREGAS').should('be.visible');
  });

  it('mantém usuários de equipe no PDV', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 200,
      body: {
        token: 'staff-token',
        user: {
          id: 'staff-1',
          name: 'Atendente',
          username: 'atendente',
          role: 'atendente',
        },
      },
    }).as('loginStaff');

    cy.get('input[name="username"]').type('atendente');
    cy.get('input[name="password"]').type('senha-teste');
    cy.get('button[type="submit"]').click();

    cy.wait('@loginStaff');
    cy.location('pathname').should('eq', '/pdv');
  });
});
