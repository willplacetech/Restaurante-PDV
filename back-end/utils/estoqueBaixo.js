function listarEstoqueBaixo(produtos) {
  return produtos
    .filter((p) => {
      let qtdAtual = 0;
      let minimo = 0;
      let unidade = p.unidadeVenda || 'un';

      if (p.tipo === 'insumo') {
        qtdAtual = Number(p.estoqueEmbalagens ?? p.estoqueInsumos ?? p.estoque ?? 0);
        minimo = Number(p.estoqueMinimoEmbalagens ?? p.estoqueMinimoBase ?? p.estoqueMinimo ?? 0);
        unidade = 'embalagem(ns)';
      } else if (p.produtoControlaPeso?.(p)) {
        qtdAtual = Number(p.estoquePesoAtualKg?.(p) ?? 0);
        minimo = Number(p.estoqueMinimo ?? 0);
        unidade = 'kg';
      } else {
        qtdAtual = Number(p.estoque ?? 0);
        minimo = Number(p.estoqueMinimo ?? 0);
        unidade = p.unidadeVenda || 'un';
      }

      return qtdAtual <= minimo && minimo > 0;
    })
    .map((produto) => {
      let qtdAtual = 0;
      let minimo = 0;
      let unidade = produto.unidadeVenda || 'un';

      if (produto.tipo === 'insumo') {
        qtdAtual = Number(produto.estoqueEmbalagens ?? produto.estoqueInsumos ?? produto.estoque ?? 0);
        minimo = Number(produto.estoqueMinimoEmbalagens ?? produto.estoqueMinimoBase ?? produto.estoqueMinimo ?? 0);
        unidade = 'embalagem(ns)';
      } else if (produto.produtoControlaPeso?.(produto)) {
        qtdAtual = Number(produto.estoquePesoAtualKg?.(produto) ?? 0);
        minimo = Number(produto.estoqueMinimo ?? 0);
        unidade = 'kg';
      } else {
        qtdAtual = Number(produto.estoque ?? 0);
        minimo = Number(produto.estoqueMinimo ?? 0);
        unidade = produto.unidadeVenda || 'un';
      }

      return { produto, qtdAtual, minimo, unidade };
    })
    .sort((a, b) => a.qtdAtual - b.qtdAtual);
}

module.exports = { listarEstoqueBaixo };