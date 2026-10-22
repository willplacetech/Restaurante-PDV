const MODOS_PREPARACAO = ['sob_demanda', 'lote'];
const TIPOS_LEGADOS_PREPARACAO = ['coz', 'producao'];

const inferirModoOperacional = (produto = {}) => {
  if (MODOS_PREPARACAO.includes(produto.modoOperacional)) return produto.modoOperacional;

  const modos = new Set();
  if (produto.tipoProduto === 'coz' || produto.aFazer === true) modos.add('sob_demanda');
  if (produto.tipoProduto === 'producao' || produto.producaoPropria === true) modos.add('lote');
  if (produto.tipoProduto === 'revenda' && modos.size) return null;
  return modos.size === 1 ? [...modos][0] : null;
};

const descreverTipoPreparacao = (produto = {}) => {
  const modoOperacional = inferirModoOperacional(produto);
  if (modoOperacional) return { tipoProduto: 'preparacao', modoOperacional, preparacaoPendente: false };
  if (produto.tipoProduto === 'revenda' && !produto.aFazer && !produto.producaoPropria) {
    return { tipoProduto: 'revenda', modoOperacional: null, preparacaoPendente: false };
  }
  return { tipoProduto: null, modoOperacional: null, preparacaoPendente: true };
};

const resolverTipoProdutoVenda = (produto = {}, novo = false) => {
  const descricao = descreverTipoPreparacao(produto);
  if (descricao.tipoProduto === 'preparacao') return descricao;
  if (descricao.tipoProduto === 'revenda') return descricao;
  if (novo && !produto.tipoProduto && !produto.aFazer && !produto.producaoPropria) {
    return { tipoProduto: 'revenda', modoOperacional: null, preparacaoPendente: false };
  }
  return null;
};

const ehPreparacao = (produto = {}) => Boolean(inferirModoOperacional(produto))
  || produto.tipoProduto === 'preparacao'
  || TIPOS_LEGADOS_PREPARACAO.includes(produto.tipoProduto)
  || produto.aFazer === true
  || produto.producaoPropria === true;

module.exports = { MODOS_PREPARACAO, inferirModoOperacional, descreverTipoPreparacao, resolverTipoProdutoVenda, ehPreparacao };
