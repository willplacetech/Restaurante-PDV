/// <reference types="cypress" />

// Spec temporário de validação: identidade visual, responsividade e acessibilidade.

const LARGURAS = [320, 375, 390, 768, 1280, 1440];

const semOverflowHorizontal = (win) => {
  const doc = win.document.documentElement;
  return doc.scrollWidth <= doc.clientWidth + 1;
};

describe('Identidade visual e responsividade', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', () => false);
  });

  it('login: sem overflow horizontal em todas as larguras exigidas', () => {
    LARGURAS.forEach((largura) => {
      cy.viewport(largura, 800);
      cy.visit('/login');
      cy.get('.login-shell').should('exist');
      cy.window().then((win) => {
        expect(semOverflowHorizontal(win), `overflow em ${largura}px`).to.eq(true);
      });
    });
  });

  it('login: apenas um CTA de instalacao e nenhum botao de tema escuro', () => {
    cy.viewport(1280, 800);
    cy.visit('/login');
    cy.contains(/instalar aplicativo/i).should('have.length.at.most', 1);
    cy.get('button').each((botao) => {
      const texto = (botao.text() || '').toLowerCase();
      const titulo = (botao.attr('title') || '').toLowerCase();
      expect(texto).to.not.include('modo escuro');
      expect(texto).to.not.include('modo claro');
      expect(titulo).to.not.include('escuro');
    });
  });

  it('login: senha e password e o erro usa role=alert', () => {
    cy.viewport(1280, 800);
    cy.visit('/login');
    cy.get('input[type="password"]').should('exist');
    cy.get('label[for="login-usuario"]').should('exist');
    cy.get('label[for="login-senha"]').should('exist');
    cy.get('.login-error').should('have.attr', 'role', 'alert');
  });

  it('login: paleta fixa aplicada (terracota no botao primario)', () => {
    cy.viewport(1280, 800);
    cy.visit('/login');
    cy.get('.login-submit').should('have.css', 'background-color', 'rgb(160, 82, 45)');
  });

  it('tokens da paleta fixa estao definidos', () => {
    cy.viewport(1280, 800);
    cy.visit('/login');
    cy.window().then((win) => {
      const estilo = win.getComputedStyle(win.document.documentElement);
      const esperado = {
        '--color-page': 'rgb(247, 243, 236)',
        '--color-card': 'rgb(255, 255, 255)',
        '--color-border': 'rgb(232, 223, 210)',
        '--color-text': 'rgb(61, 47, 35)',
        '--color-primary': 'rgb(160, 82, 45)',
        '--color-primary-hover': 'rgb(139, 69, 19)',
        '--color-success': 'rgb(90, 140, 90)',
        '--color-warning': 'rgb(200, 147, 47)',
        '--color-error': 'rgb(176, 74, 58)',
        '--color-info': 'rgb(107, 143, 163)',
      };
      Object.entries(esperado).forEach(([token, valor]) => {
        expect(estilo.getPropertyValue(token).trim(), token).to.eq(valor);
      });
    });
  });

  it('tema escuro nao e aplicado em data-theme', () => {
    cy.viewport(1280, 800);
    cy.visit('/login');
    cy.get('html').should('not.have.attr', 'data-theme', 'dark');
  });
});
