const { inferirModoOperacional, descreverTipoPreparacao } = require('../../utils/preparationMode');

describe('modo operacional de Preparação', () => {
  test.each([
    [{ tipoProduto: 'coz' }, 'sob_demanda'],
    [{ tipoProduto: 'producao' }, 'lote'],
    [{ aFazer: true }, 'sob_demanda'],
    [{ producaoPropria: true }, 'lote'],
    [{ tipoProduto: 'preparacao', modoOperacional: 'lote' }, 'lote'],
  ])('infere o modo de evidências explícitas %j', (produto, expected) => {
    expect(inferirModoOperacional(produto)).toBe(expected);
  });

  test.each([
    [{ tipoProduto: 'coz', producaoPropria: true }],
    [{ tipoProduto: 'producao', aFazer: true }],
    [{ aFazer: true, producaoPropria: true }],
    [{ tipoProduto: 'preparacao' }],
    [{ tipoProduto: undefined, aFazer: false, producaoPropria: false }],
  ])('não infere modo de evidências ausentes ou conflitantes %j', (produto) => {
    expect(inferirModoOperacional(produto)).toBeNull();
  });

  test('serializa legado comprovado como Preparação e marca somente a ambiguidade', () => {
    expect(descreverTipoPreparacao({ tipoProduto: 'coz' })).toEqual({
      tipoProduto: 'preparacao',
      modoOperacional: 'sob_demanda',
      preparacaoPendente: false,
    });
    expect(descreverTipoPreparacao({ tipoProduto: undefined, aFazer: false, producaoPropria: false })).toEqual({
      tipoProduto: null,
      modoOperacional: null,
      preparacaoPendente: true,
    });
  });
});
