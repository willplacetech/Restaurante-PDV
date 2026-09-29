import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api.jsx';
import { useToast } from '../components/Toast.jsx';
import EmptyState from '../components/EmptyState.jsx';
import CollapsibleSection from '../components/CollapsibleSection.jsx';

const categoriasVenda = ['Bebidas Quentes', 'Bebidas geladas', 'Salgados', 'Doces', 'Congelados', 'Sorvetes', 'Pratos na Hora', 'Outros'];
const filtrosTipo = ['Todos', 'Estoque de Venda', 'Estoque de Insumos'];
const units = ['kg', 'L', 'un'];
const decimalStep = (unidade) => unidade === 'un' ? '0.01' : '0.001';
const decimalMinimum = (unidade) => unidade === 'un' ? 0.01 : 0.001;

const vazio = {
  codigo: '',
  nome: '',
  ncm: '',
  marcaReferencia: '',
  tipo: 'venda',
  unidade: 'kg',
  tipoProduto: 'revenda',
  usavelEmReceita: false,
  categoria: 'Bebidas Quentes',
  preco: '',
  descontosPorQuantidade: [],
  grupoDesconto: { nome: '', quantidadeMinima: '', precoPromocional: '', ativo: false },
  precoCompra: '',
  unidadeCompra: 'kg',
  conteudoPorEmbalagem: 1,
  unidadeConteudo: 'kg',
  estoqueEmbalagens: '',
  estoqueConteudoAberto: 0,
  estoqueMinimoEmbalagens: '',
  rendimentoPorUnidadeCompra: '',
  custo: '',
  custoCalculado: null,
  dataUltimoCalculo: null,
  fonteCalculo: 'indisponivel',
  estoque: '',
  estoqueInsumos: '',
  unidadeVenda: 'un',
  vendidoFracionado: false,
  aFazer: false,
  fichaTecnica: [],
  permitirVendaSemInsumo: false,
  producaoPropria: false,
  ativo: true,
};

export default function Products() {
  const [searchParams] = useSearchParams();
  const [produtos, setProdutos] = useState([]);
  const [fichas, setFichas] = useState([]);
  // O parametro ?tipo=insumo ja entra no estado inicial do formulario.
  const [form, setForm] = useState(() => (
    searchParams.get('tipo') === 'insumo'
      ? { ...vazio, tipo: 'insumo', categoria: 'Insumos' }
      : vazio
  ));
  const [editing, setEditing] = useState(null);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [filtroFicha, setFiltroFicha] = useState('Todos');
  const formularioRef = useRef(null);
  const { showToast } = useToast();
  const fichaProduto = fichas.find((ficha) => String(ficha.produtoId?._id || ficha.produtoId) === String(editing?._id));
  const calculoDireto = form.tipo === 'insumo' || (form.tipo === 'venda' && form.tipoProduto === 'revenda');
  const precoCompraAtual = Number(form.precoCompra);
  const conteudoAtual = Number(form.conteudoPorEmbalagem);
  const custoCompraAtual = calculoDireto && precoCompraAtual > 0 && conteudoAtual > 0 ? precoCompraAtual / conteudoAtual : null;
  const custoPersistido = form.fonteCalculo === 'insumo' && Number.isFinite(Number(form.custoCalculado)) ? Number(form.custoCalculado) : null;
  const custoExibido = calculoDireto ? custoCompraAtual : custoPersistido;
  const custoDisponivel = custoExibido !== null;
  const precoVendaDisponivel = form.tipo === 'venda' && Number(form.preco) > 0;
  const lucroDisponivel = custoDisponivel && precoVendaDisponivel;
  const lucro = lucroDisponivel ? Number(form.preco) - Number(custoExibido) : null;
  const margem = lucroDisponivel && Number(form.preco) > 0 ? (lucro / Number(form.preco)) * 100 : null;
  const dinheiro = (valor) => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dataCusto = form.dataUltimoCalculo ? new Date(form.dataUltimoCalculo) : null;
  const custoAtualizadoEm = dataCusto && !Number.isNaN(dataCusto.getTime())
    ? dataCusto.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;

  const carregar = async () => {
    const [productsResponse, recipesResponse] = await Promise.all([api.get('/products'), api.get('/production/recipes')]);
    setProdutos(productsResponse.data);
    setFichas(recipesResponse.data || []);
  };

  useEffect(() => {
    const carregarInicial = async () => { await carregar(); };
    carregarInicial();
  }, []);

  useEffect(() => {
    if (!editing && produtos.length > 0) {
      const maiorCodigo = produtos.reduce((maior, atual) => {
        const codigo = Number(atual.codigo) || 0;
        return codigo > maior ? codigo : maior;
      }, 0);
      queueMicrotask(() => setForm((prev) => ({ ...prev, codigo: String(maiorCodigo + 1) })));
    }
  }, [produtos, editing]);

  const codigoJaExiste = (codigo, idEdicao = null) => produtos.some((produto) => String(produto.codigo) === String(codigo) && produto._id !== idEdicao);

  const limparCampoNumerico = (valor) => {
    if (valor === '' || valor === null || valor === undefined) return undefined;
    const num = Number(valor);
    if (num < 0) return undefined;
    return num;
  };

  const resumoInsumo = form.tipo === 'insumo' ? (() => {
    const unidade = form.unidade || form.unidadeCompra || 'kg';
    const conteudo = Number(form.conteudoPorEmbalagem) || 0;
    const embalagens = Number(form.estoqueEmbalagens) || 0;
    const aberto = Number(form.estoqueConteudoAberto) || 0;
    const fatores = { kg: 1, L: 1, un: 1 };
    const fator = fatores[unidade] || 1;
    const conteudoBase = conteudo * fator;
    const totalBase = (embalagens * conteudoBase) + (aberto * fator);
    const precoCompra = Number(form.precoCompra) || 0;
    const custoBase = precoCompra > 0 && conteudoBase > 0 ? precoCompra / conteudoBase : 0;
    const ePeso = unidade === 'kg';
    const eVolume = unidade === 'L';
    const eUnidade = unidade === 'un';
    return {
      total: totalBase / fator,
      totalBase,
      unidadeConteudo: unidade,
      totalKg: ePeso ? totalBase / 1000 : undefined,
      custoUnitarioBase: custoBase,
      custoPorKg: ePeso ? custoBase : undefined,
      custoPor100g: undefined,
      custoPorGrama: undefined,
      custoPorLitro: eVolume ? custoBase : undefined,
      custoPor100ml: undefined,
      custoPorUnidade: eUnidade ? custoBase : undefined,
    };
  })() : null;

  const submit = async (event) => {
    event.preventDefault();
    const tipo = form.tipo;
    if (!form.nome || form.nome.trim() === '') {
      showToast('⚠️ O nome do produto é obrigatório.', 'warning');
      return;
    }
    if (editing) {
      const precoEdicao = Number(form.preco);
      if (Number.isNaN(precoEdicao) || precoEdicao < 0) {
        showToast('⚠️ O preço do produto deve ser um número maior ou igual a zero.', 'warning');
        return;
      }
    } else if (tipo === 'venda' && (!form.preco || Number(form.preco) <= 0)) {
      showToast('⚠️ O preço de venda é obrigatório para produtos à venda.', 'warning');
      return;
    }
    if (codigoJaExiste(form.codigo, editing?._id)) {
      showToast('⚠️ Código já cadastrado. Escolha outro.', 'warning');
      return;
    }

    if (tipo === 'venda') {
      const descontos = (form.descontosPorQuantidade || []).map((faixa) => ({ quantidadeMinima: Number(faixa.quantidadeMinima), precoUnitario: Number(faixa.precoUnitario), ativo: faixa.ativo !== false }));
      for (let indice = 0; indice < descontos.length; indice += 1) {
        const anterior = descontos[indice - 1];
        if (!Number.isInteger(descontos[indice].quantidadeMinima) || descontos[indice].quantidadeMinima < 1 || descontos[indice].precoUnitario < 0 || (anterior && (descontos[indice].quantidadeMinima <= anterior.quantidadeMinima || descontos[indice].precoUnitario >= anterior.precoUnitario))) {
          showToast('⚠️ As faixas devem ter quantidade crescente e preço decrescente.', 'warning');
          return;
        }
        if (descontos[indice].precoUnitario >= Number(form.preco || 0)) {
          showToast('⚠️ O preço promocional deve ser menor que o preço normal.', 'warning');
          return;
        }
      }
    }
    if (tipo === 'venda') {
      const gd = form.grupoDesconto;
      if (gd && gd.nome && gd.ativo !== false) {
        if (!Number.isInteger(Number(gd.quantidadeMinima)) || Number(gd.quantidadeMinima) < 1) {
          showToast('⚠️ Quantidade mínima do grupo deve ser um inteiro positivo.', 'warning');
          return;
        }
        if (Number(gd.precoPromocional) < 0) {
          showToast('⚠️ Preço promocional do grupo não pode ser negativo.', 'warning');
          return;
        }
        if (Number(gd.precoPromocional) >= Number(form.preco || 0)) {
          showToast('⚠️ O preço promocional do grupo deve ser menor que o preço normal.', 'warning');
          return;
        }
      }
    }
    if (tipo === 'insumo' || form.usavelEmReceita) {
      if (Number(form.conteudoPorEmbalagem || 0) <= 0) { showToast('⚠️ Conteúdo da embalagem deve ser maior que zero.', 'warning'); return; }
      if (tipo === 'insumo' && Number(form.estoqueEmbalagens || 0) < 0) { showToast('⚠️ Quantidade de embalagens não pode ser negativa.', 'warning'); return; }
      if (!editing && (tipo === 'insumo' || form.usavelEmReceita) && (!form.precoCompra || Number(form.precoCompra) <= 0)) { showToast('⚠️ Preço de compra é obrigatório para produtos usados em receitas.', 'warning'); return; }
    }
    const unidadeFormulario = form.unidade === 'l' ? 'L' : (units.includes(form.unidade) ? form.unidade : 'un');
    const unidadeCompraFormulario = form.unidadeCompra === 'l' ? 'L' : (units.includes(form.unidadeCompra) ? form.unidadeCompra : unidadeFormulario);
    const unidadeVendaFormulario = form.unidadeVenda === 'l' ? 'L' : (units.includes(form.unidadeVenda) ? form.unidadeVenda : 'un');
    const rendimentoInformado = Number(form.rendimentoPorUnidadeCompra);
    const rendimentoFormulario = Number.isFinite(rendimentoInformado) && rendimentoInformado > 0 ? rendimentoInformado : 1;
    const payload = {
      ...form,
      codigo: editing ? editing.codigo : form.codigo,
      tipo,
      unidade: unidadeFormulario,
      quantidade: limparCampoNumerico(form.conteudoPorEmbalagem) ?? 1,
      rendimento: rendimentoFormulario,
      tipoProduto: tipo === 'venda' ? form.tipoProduto : undefined,
      rendimentoPorReceita: tipo === 'venda' && form.tipoProduto === 'producao' ? Number(form.rendimentoPorReceita || 1) : 1,
      estoque: tipo === 'insumo' ? limparCampoNumerico(form.estoqueEmbalagens) ?? 0 : (form.aFazer ? 0 : limparCampoNumerico(form.estoque) ?? 0),
      estoqueInsumos: tipo === 'insumo' ? limparCampoNumerico(form.estoqueEmbalagens) ?? 0 : (form.usavelEmReceita ? limparCampoNumerico(form.estoqueInsumos) ?? 0 : undefined),
      estoqueEmbalagens: tipo === 'insumo' ? limparCampoNumerico(form.estoqueEmbalagens) ?? 0 : undefined,
      estoqueMinimoEmbalagens: tipo === 'insumo' ? limparCampoNumerico(form.estoqueMinimoEmbalagens) ?? 0 : undefined,
      conteudoPorEmbalagem: limparCampoNumerico(form.conteudoPorEmbalagem) ?? 0,
      estoqueConteudoAberto: tipo === 'insumo' ? limparCampoNumerico(form.estoqueConteudoAberto) ?? 0 : undefined,
      categoria: tipo === 'insumo' ? 'Insumos' : (form.categoria || 'Outros'),
      preco: tipo === 'venda' ? limparCampoNumerico(form.preco) : undefined,
      precoVenda: tipo === 'venda' ? limparCampoNumerico(form.preco) : undefined,
      descontosPorQuantidade: tipo === 'venda' ? form.descontosPorQuantidade : [],
      grupoDesconto: tipo === 'venda' && form.grupoDesconto?.nome ? {
        nome: String(form.grupoDesconto.nome).trim(),
        quantidadeMinima: Number(form.grupoDesconto.quantidadeMinima),
        precoPromocional: Number(form.grupoDesconto.precoPromocional),
        ativo: Boolean(form.grupoDesconto.ativo),
      } : undefined,
      precoCompra: limparCampoNumerico(form.precoCompra) ?? 0,
      custoUnitarioBase: calculoDireto && custoCompraAtual !== null ? custoCompraAtual : undefined,
      usavelEmReceita: tipo === 'insumo' || Boolean(form.usavelEmReceita),
      unidadeVenda: unidadeVendaFormulario,
      unidadeCompra: unidadeCompraFormulario,
      unidadeConteudo: unidadeFormulario,
      rendimentoPorUnidadeCompra: Number(form.rendimentoPorUnidadeCompra || 0),
      ativo: Boolean(form.ativo),
      permitirVendaSemInsumo: Boolean(form.permitirVendaSemInsumo),
      fichaTecnica: tipo === 'venda' && form.aFazer ? form.fichaTecnica.map((item) => ({ produtoId: item.produtoId?._id || item.produtoId, quantidade: Number(item.quantidade), unidade: item.unidade })) : [],
    };
    try {
      const salvar = (dados) => editing ? api.put(`/products/${editing._id}`, dados) : api.post('/products', dados);
      try {
        await salvar(payload);
      } catch (error) {
        const divergencia = error.response?.data?.divergencia;
        if (!editing || !error.response?.data?.requireConfirmation || !divergencia || !window.confirm(`${error.response.data.msg}\n\n${divergencia.mensagem}\n\nDeseja salvar mesmo assim?`)) throw error;
        await salvar({ ...payload, confirmarDivergenciaCusto: true });
      }
      showToast(editing ? '✅ Produto atualizado!' : '✅ Produto cadastrado!', 'success');
      setForm(vazio);
      setEditing(null);
      carregar();
    } catch (error) {
      const validationMessage = error.response?.data?.errors?.map((item) => `${item.path || 'campo'}: ${item.msg}`).join('; ');
      showToast(error.response?.data?.error || error.response?.data?.msg || validationMessage || '❌ Não foi possível salvar o produto', 'error');
    }
  };

  const editarProduto = (produto) => {
    setEditing(produto);
    const unidadesDiretas = units;
    const unidadeCompra = produto.unidadeCompra === 'l' ? 'L' : (produto.unidade || produto.unidadeCompra || 'kg');
    const isDireta = unidadesDiretas.includes(unidadeCompra);
    const conteudoPorEmbalagem = isDireta ? (Number(produto.conteudoPorEmbalagem) || 1) : (produto.conteudoPorEmbalagem ?? '');
    const unidadeConteudo = produto.unidade === 'l' ? 'L' : (produto.unidadeConteudo || (isDireta ? unidadeCompra : 'kg'));
    setForm({
      codigo: produto.codigo,
      nome: produto.nome,
      ncm: produto.ncm || '',
      marcaReferencia: produto.marcaReferencia || '',
      tipo: produto.tipo || (produto.controladoComoInsumo ? 'insumo' : 'venda'),
      usavelEmReceita: Boolean(produto.usavelEmReceita),
      categoria: produto.categoria || 'Bebidas Quentes',
      preco: produto.preco ?? '',
      descontosPorQuantidade: produto.descontosPorQuantidade || [],
      grupoDesconto: produto.grupoDesconto || { nome: '', quantidadeMinima: '', precoPromocional: '', ativo: false },
      precoCompra: produto.precoCompra ?? '',
      unidadeCompra: unidadeCompra,
      unidade: produto.unidade || unidadeCompra,
      conteudoPorEmbalagem: conteudoPorEmbalagem,
      unidadeConteudo: unidadeConteudo,
      estoqueEmbalagens: produto.estoqueEmbalagens ?? produto.estoqueInsumos ?? '',
      estoqueInsumos: produto.estoqueInsumos ?? '',
      estoqueConteudoAberto: produto.estoqueConteudoAberto ?? 0,
      estoqueMinimoEmbalagens: produto.estoqueMinimoEmbalagens ?? produto.estoqueMinimoInsumos ?? '',
      rendimentoPorUnidadeCompra: produto.rendimentoPorUnidadeCompra ?? '',
      custo: produto.custoUnitario ?? produto.custo ?? '',
      custoCalculado: produto.custoCalculado ?? null,
      dataUltimoCalculo: produto.dataUltimoCalculo || null,
      fonteCalculo: produto.fonteCalculo || 'indisponivel',
      estoque: produto.tipo === 'insumo' ? (produto.estoqueInsumos ?? '') : (produto.estoque ?? ''),
      unidadeVenda: produto.unidadeVenda || 'un',
      vendidoFracionado: Boolean(produto.vendidoFracionado),
      aFazer: Boolean(produto.aFazer),
      tipoProduto: produto.tipoProduto || (produto.aFazer ? 'coz' : produto.producaoPropria ? 'producao' : 'revenda'),
      rendimentoPorReceita: produto.rendimentoPorReceita || 1,
      fichaTecnica: produto.fichaTecnica || [],
      permitirVendaSemInsumo: Boolean(produto.permitirVendaSemInsumo),
      producaoPropria: Boolean(produto.producaoPropria),
      ativo: produto.ativo !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remover = async (id) => {
    if (!window.confirm('Excluir este produto?')) return;
    try {
      await api.delete(`/products/${id}`);
      showToast('Produto removido', 'warning');
      carregar();
    } catch (error) {
      showToast(error.response?.data?.msg || 'Não foi possível excluir o produto', 'error');
    }
  };

  const cancelar = () => {
    setEditing(null);
    setForm(vazio);
  };

  const filtrados = produtos.filter((produto) => {
    const tipoOk = filtroTipo === 'Todos' || (filtroTipo === 'Estoque de Venda' ? produto.tipo === 'venda' : produto.tipo === 'insumo');
    const categoriaOk = filtroCategoria === 'Todos' || (produto.categoria === filtroCategoria);
    const possuiFicha = fichas.some((ficha) => String(ficha.produtoId?._id || ficha.produtoId) === String(produto._id));
    const fichaSelecionada = fichas.find((ficha) => String(ficha._id) === String(filtroFicha));
    const ingredientesDaFicha = new Set((fichaSelecionada?.ingredientes || []).map((item) => String(item.produtoId?._id || item.produtoId)));
    const fichaOk = filtroFicha === 'Todos'
      || (filtroFicha === 'Sem ficha' && !possuiFicha)
      || ingredientesDaFicha.has(String(produto._id));
    const textoOk = [produto.nome, produto.codigo].join(' ').toLowerCase().includes(filtroTexto.toLowerCase());
    return tipoOk && categoriaOk && fichaOk && textoOk;
  });

  const focarFormulario = () => {
    formularioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    formularioRef.current?.querySelector('input, select, button')?.focus({ preventScroll: true });
  };

  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <h1>Cadastro de produtos</h1>
          <p>Produtos à venda e insumos ficam em grupos diferentes.</p>
        </div>
        <div className="btn-row">
          <button type="button" className="btn-primary" onClick={focarFormulario}>
            <span aria-hidden="true">＋</span>
            <span>Novo produto</span>
          </button>
        </div>
      </header>

      {/* ================= FORMULÁRIO ================= */}
      <section className="card" ref={formularioRef} aria-labelledby="produto-form-titulo">
        <div className="card__header">
          <h2 className="card-title" id="produto-form-titulo">
            {editing ? 'Editar produto' : 'Novo produto'}
          </h2>
          {editing && <span className="badge badge--primary">Editando</span>}
        </div>

        <form onSubmit={submit}>
          <div className="stack">
            {/* ---------- Campos essenciais ---------- */}
            <div className="product-form-grid">
              <fieldset className="product-type-field field--full">
                <legend className="label">Tipo de produto *</legend>
                <div className="product-radio-group">
                  <label className="radio">
                    <input className="product-radio" type="radio" name="tipoProduto" value="revenda" checked={form.tipo === 'venda' && form.tipoProduto === 'revenda'} onChange={() => setForm({ ...form, tipo: 'venda', tipoProduto: 'revenda', categoria: 'Bebidas Quentes', aFazer: false, producaoPropria: false })} />
                    <span>Revenda</span>
                  </label>
                  <label className="radio">
                    <input className="product-radio" type="radio" name="tipoProduto" value="coz" checked={form.tipo === 'venda' && form.tipoProduto === 'coz'} onChange={() => setForm({ ...form, tipo: 'venda', tipoProduto: 'coz', categoria: 'Pratos na Hora', estoque: 0, aFazer: true, producaoPropria: false })} />
                    <span>Coz — na hora</span>
                  </label>
                  <label className="radio">
                    <input className="product-radio" type="radio" name="tipoProduto" value="producao" checked={form.tipo === 'venda' && form.tipoProduto === 'producao'} onChange={() => setForm({ ...form, tipo: 'venda', tipoProduto: 'producao', categoria: 'Outros', aFazer: false, producaoPropria: true })} />
                    <span>Produção própria — lote</span>
                  </label>
                  <label className="radio">
                    <input className="product-radio" type="radio" name="tipoProduto" value="insumo" checked={form.tipo === 'insumo'} onChange={() => setForm({ ...form, tipo: 'insumo', tipoProduto: 'revenda', categoria: 'Insumos', aFazer: false, producaoPropria: false })} />
                    <span>Insumo / Matéria-prima</span>
                  </label>
                </div>
              </fieldset>

              <label className="field">
                <span className="label">Código {editing && <small>(bloqueado)</small>}</span>
                <input
                  value={form.codigo}
                  readOnly={Boolean(editing)}
                  onChange={(event) => { if (!editing) setForm({ ...form, codigo: event.target.value }); }}
                  style={editing ? { background: 'var(--color-surface-muted)', cursor: 'not-allowed' } : undefined}
                />
              </label>

              <label className="field">
                <span className="label">Nome *</span>
                <input value={form.nome} required onChange={(event) => setForm({ ...form, nome: event.target.value })} />
              </label>

              <label className="field">
                <span className="label">Categoria</span>
                <select value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })}>
                  {(form.tipo === 'venda' ? categoriasVenda : ['Insumos', ...categoriasVenda])
                    .map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
                </select>
              </label>

              {form.tipo === 'venda' && (
                <label className="field">
                  <span className="label">Preço de venda (R$) *</span>
                  <input type="number" step="0.01" min={0} value={form.preco} required onChange={(event) => setForm({ ...form, preco: event.target.value })} />
                </label>
              )}

              {form.tipo === 'venda' && form.tipoProduto !== 'coz' && (
                <label className="field">
                  <span className="label">Estoque atual</span>
                  <input type="number" step="0.001" min={0} value={form.estoque} onChange={(event) => setForm({ ...form, estoque: event.target.value })} />
                </label>
              )}

              {form.tipo === 'venda' && (
                <>
                  <label className="field">
                    <span className="label">Unidade de compra</span>
                    <select value={form.unidadeCompra} onChange={(event) => setForm({ ...form, unidade: event.target.value, unidadeCompra: event.target.value, unidadeConteudo: event.target.value })}>
                      {units.map((unidade) => <option key={unidade} value={unidade}>{unidade}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">Unidade de venda</span>
                    <select value={form.unidadeVenda} onChange={(event) => setForm({ ...form, unidadeVenda: event.target.value })}>
                      {units.map((unidade) => <option key={unidade} value={unidade}>{unidade}</option>)}
                    </select>
                  </label>
                </>
              )}

              {form.tipo === 'venda' && form.tipoProduto === 'coz' && (
                <div className="coz-stock-notice field--full">
                  <strong>Coz não possui estoque próprio</strong>
                  <span>Disponibilidade calculada pela ficha técnica e pelos insumos disponíveis.</span>
                </div>
              )}

              {form.tipo === 'venda' && form.tipoProduto === 'producao' && (
                <label className="field">
                  <span className="label">Rendimento por ficha técnica *</span>
                  <input required type="number" min="0.001" step="0.001" value={form.rendimentoPorReceita || 1} onChange={(event) => setForm({ ...form, rendimentoPorReceita: event.target.value })} />
                  <small className="hint">Quantas unidades saem de uma fornada.</small>
                </label>
              )}
            </div>

            {/* ---------- Resumo de custo ---------- */}
            {form.tipo === 'venda' && (
              <div className="product-cost-summary">
                <div className="product-summary-grid">
                  <div className="summary-card">
                    <span className="summary-card__label">Custo unitário base</span>
                    <strong className="summary-card__value">{custoDisponivel ? dinheiro(custoExibido) : '—'}</strong>
                  </div>
                  <div className="summary-card">
                    <span className="summary-card__label">Preço de venda</span>
                    <strong className="summary-card__value">{precoVendaDisponivel ? dinheiro(form.preco) : '—'}</strong>
                  </div>
                  <div className={`summary-card ${lucroDisponivel && lucro < 0 ? 'summary-card--error' : 'summary-card--success'}`}>
                    <span className="summary-card__label">Lucro (R$)</span>
                    <strong className="summary-card__value">{lucroDisponivel ? dinheiro(lucro) : '—'}</strong>
                  </div>
                  <div className={`summary-card ${lucroDisponivel && lucro < 0 ? 'summary-card--error' : ''}`}>
                    <span className="summary-card__label">Margem</span>
                    <strong className="summary-card__value">{lucroDisponivel ? `${margem.toFixed(1)}%` : '—'}</strong>
                  </div>
                </div>
                {!custoDisponivel && (
                  <p className="hint">
                    {calculoDireto && conteudoAtual <= 0
                      ? 'Quantidade por embalagem deve ser maior que zero.'
                      : calculoDireto ? 'Sem preço de compra.' : 'Sem ficha técnica ou custo calculado.'}
                  </p>
                )}
                {custoAtualizadoEm && <p className="hint">Custo atualizado em {custoAtualizadoEm}</p>}
                {lucroDisponivel && lucro < 0 && (
                  <p className="alert alert--error"><span aria-hidden="true">⚠️</span><span>Lucro negativo. Revise o preço ou o custo.</span></p>
                )}
              </div>
            )}

            {/* ---------- INCLUSO: compra e custo ---------- */}
            {form.tipo === 'venda' && form.tipoProduto === 'revenda' && (
              <CollapsibleSection title="Compra e custo" description="Preço pago e conteúdo da embalagem" icon="💰" defaultOpen={editing}>
                <div className="product-form-grid">
                  <label className="field">
                    <span className="label">Preço de compra (R$)</span>
                    <input type="number" step="0.01" min={0} value={form.precoCompra} onChange={(event) => setForm({ ...form, precoCompra: event.target.value })} />
                  </label>
                  <label className="field">
                    <span className="label">Conteúdo por embalagem</span>
                    <input type="number" step="0.001" min={0} value={form.conteudoPorEmbalagem} onChange={(event) => setForm({ ...form, conteudoPorEmbalagem: event.target.value })} />
                    <small className="hint">Quantidade de unidades comprada na embalagem.</small>
                  </label>
                </div>
              </CollapsibleSection>
            )}

            {/* ---------- Cozinha / ficha técnica ---------- */}
            {form.tipo === 'venda' && (form.tipoProduto === 'coz' || form.tipoProduto === 'producao') && (
              <CollapsibleSection title="Ficha técnica" description="Custo, rendimento e disponibilidade" icon="📋">
                <div className="stack">
                  {form.tipoProduto === 'coz' && (
                    <div className="coz-recipe-panel">
                      {fichaProduto ? (
                        <>
                          <span>Custo/unidade: <b>{`R$ ${Number(fichaProduto.custoPorUnidade || 0).toFixed(2).replace('.', ',')}`}</b></span>
                          <span>Disponível: <b>{Number(fichaProduto.disponibilidade?.quantidade || 0)} {fichaProduto.unidadeRendimento}</b></span>
                          <small>Ingrediente limitante: {fichaProduto.disponibilidade?.limitante || 'nenhum'}</small>
                        </>
                      ) : (
                        <span>Este produto ainda não tem ficha técnica. Crie-a em Produção para liberar a disponibilidade.</span>
                      )}
                      <Link className="coz-recipe-link" to={`/producao/fichas?produto=${editing?._id || ''}`}>
                        {fichaProduto ? 'Editar ficha técnica' : 'Criar ficha técnica'}
                      </Link>
                    </div>
                  )}
                  {form.tipoProduto === 'producao' && (
                    <div className="coz-recipe-panel">
                      <span>Este produto é produzido internamente e usa uma ficha técnica para controlar o custo e o rendimento.</span>
                      <Link className="coz-recipe-link" to={`/producao/fichas?produto=${editing?._id || ''}`}>Gerenciar ficha técnica</Link>
                    </div>
                  )}
                  {fichaProduto?.ingredientes?.length > 0 && (
                    <div className="ficha-ingredientes">
                      <strong>Custos da ficha técnica</strong>
                      {fichaProduto.ingredientes.map((item, indice) => (
                        <div className="ficha-ingrediente" key={`${item.produtoId?._id || item.produtoId}-${indice}`}>
                          <span>
                            <span aria-hidden="true">{item.custoDisponivel ? '✅' : '⚠️'}</span>{' '}
                            {item.produtoId?.nome || 'Insumo'} · {item.quantidade} {item.unidade}
                          </span>
                          <strong>{item.custoDisponivel ? dinheiro(item.custoItem) : 'Indisponível'}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* ---------- Descontos e promoções ---------- */}
            {form.tipo === 'venda' && (
              <CollapsibleSection
                title="Descontos e promoções"
                description="Faixas por quantidade e desconto por grupo"
                icon="🏷️"
                defaultOpen={editing}
              >
                <div className="stack">
                  <div className="collapsible__block">
                    <div className="card__header">
                      <strong>Desconto por quantidade</strong>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setForm({ ...form, descontosPorQuantidade: [...(form.descontosPorQuantidade || []), { quantidadeMinima: '', precoUnitario: '', ativo: true }] })}
                      >
                        Adicionar faixa
                      </button>
                    </div>

                    {(form.descontosPorQuantidade || []).map((faixa, indice) => (
                      <div className="quantity-discount-row" key={`desconto-${indice}`}>
                        <label className="field">
                          <span className="label">A partir de</span>
                          <input type="number" min={1} step={1} value={faixa.quantidadeMinima} onChange={(event) => setForm({ ...form, descontosPorQuantidade: form.descontosPorQuantidade.map((item, itemIndex) => itemIndex === indice ? { ...item, quantidadeMinima: event.target.value } : item) })} />
                        </label>
                        <label className="field">
                          <span className="label">Preço unitário (R$)</span>
                          <input type="number" min={0} step="0.01" value={faixa.precoUnitario} onChange={(event) => setForm({ ...form, descontosPorQuantidade: form.descontosPorQuantidade.map((item, itemIndex) => itemIndex === indice ? { ...item, precoUnitario: event.target.value } : item) })} />
                        </label>
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => setForm({ ...form, descontosPorQuantidade: form.descontosPorQuantidade.filter((_, itemIndex) => itemIndex !== indice) })}
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                    {!form.descontosPorQuantidade?.length && <p className="hint">Nenhuma faixa promocional cadastrada.</p>}
                  </div>

                  <div className="collapsible__block">
                    <div className="card__header">
                      <strong>Desconto por grupo</strong>
                      <label className="checkbox">
                        <input type="checkbox" checked={Boolean(form.grupoDesconto?.ativo)} onChange={(e) => setForm({ ...form, grupoDesconto: { ...(form.grupoDesconto || { nome: '', quantidadeMinima: '', precoPromocional: '', ativo: false }), ativo: e.target.checked } })} />
                        <span>Ativo</span>
                      </label>
                    </div>
                    <p className="hint">
                      Produtos com o <strong>mesmo nome de grupo</strong> e <strong>mesma categoria</strong> somam as quantidades.
                      Quando o total atingir a quantidade mínima, todos ganham o preço promocional.
                    </p>
                    <div className="product-form-grid product-form-grid--3">
                      <label className="field">
                        <span className="label">Nome do grupo</span>
                        <input type="text" placeholder="ex: Cookies" value={form.grupoDesconto?.nome || ''} onChange={(e) => setForm({ ...form, grupoDesconto: { ...(form.grupoDesconto || { quantidadeMinima: '', precoPromocional: '', ativo: false }), nome: e.target.value } })} />
                      </label>
                      <label className="field">
                        <span className="label">Quantidade mínima</span>
                        <input type="number" min={1} step={1} value={form.grupoDesconto?.quantidadeMinima || ''} onChange={(e) => setForm({ ...form, grupoDesconto: { ...(form.grupoDesconto || { nome: '', precoPromocional: '', ativo: false }), quantidadeMinima: e.target.value } })} />
                      </label>
                      <label className="field">
                        <span className="label">Preço promocional (R$)</span>
                        <input type="number" min={0} step="0.01" value={form.grupoDesconto?.precoPromocional || ''} onChange={(e) => setForm({ ...form, grupoDesconto: { ...(form.grupoDesconto || { nome: '', quantidadeMinima: '', ativo: false }), precoPromocional: e.target.value } })} />
                      </label>
                    </div>
                    {form.grupoDesconto?.nome && (
                      <p className="badge badge--success"><span className="dot" aria-hidden="true" />Produtos com grupo “{form.grupoDesconto.nome}” vão somar para este desconto.</p>
                    )}
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {/* ---------- COMPRA (insumo) ---------- */}
            {form.tipo === 'insumo' && (
              <CollapsibleSection title="Compra e embalagem" description="Preço, conteúdo e quantidade de embalagens" icon="📦" defaultOpen>
                <div className="product-form-grid">
                  <label className="field">
                    <span className="label">Preço de compra por embalagem (R$) *</span>
                    <input type="number" step="0.01" min={0} value={form.precoCompra} required onChange={(event) => setForm({ ...form, precoCompra: event.target.value })} />
                  </label>
                  <label className="field">
                    <span className="label">Tipo de embalagem *</span>
                    <select
                      value={form.unidadeCompra}
                      onChange={(event) => setForm({ ...form, unidade: event.target.value, unidadeCompra: event.target.value, conteudoPorEmbalagem: 1, unidadeConteudo: event.target.value })}
                    >
                      {units.map((unidade) => <option key={unidade} value={unidade}>{unidade}</option>)}
                    </select>
                    <small className="hint">Unidade em que você compra.</small>
                  </label>
                  <label className="field">
                    <span className="label">Conteúdo da embalagem *</span>
                    <div className="product-input-with-unit">
                      <input type="number" step={decimalStep(form.unidade)} min={decimalMinimum(form.unidade)} required value={form.conteudoPorEmbalagem} onChange={(event) => setForm({ ...form, quantidade: event.target.value, conteudoPorEmbalagem: event.target.value })} />
                      <select value={form.unidade} onChange={(event) => setForm({ ...form, unidade: event.target.value, unidadeCompra: event.target.value, unidadeConteudo: event.target.value })}>
                        {units.map((unidade) => <option key={unidade}>{unidade}</option>)}
                      </select>
                    </div>
                    <small className="hint">Quanto tem dentro de cada embalagem.</small>
                  </label>
                  <label className="field">
                    <span className="label">Quantidade de embalagens em estoque *</span>
                    <input type="number" step="0.001" min={0} value={form.estoqueEmbalagens} required onChange={(event) => setForm({ ...form, estoqueEmbalagens: event.target.value })} />
                  </label>
                  <label className="field">
                    <span className="label">Estoque mínimo ({form.unidadeConteudo})</span>
                    <input type="number" step="0.001" min={0} value={form.estoqueMinimoEmbalagens} onChange={(event) => setForm({ ...form, estoqueMinimoEmbalagens: event.target.value })} />
                    <small className="hint">Mínimo em unidade de conteúdo.</small>
                  </label>
                </div>
              </CollapsibleSection>
            )}

            {form.tipo === 'insumo' && (
              <div className="product-summary-section">
                <strong className="card-title">Resumo automático</strong>
                <div className="product-summary-grid">
                  <div className="summary-card">
                    <span className="summary-card__label">Estoque total</span>
                    <strong className="summary-card__value">
                      {(resumoInsumo?.total || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {resumoInsumo?.unidadeConteudo || form.unidadeCompra}
                    </strong>
                  </div>
                  <div className="summary-card">
                    <span className="summary-card__label">Custo por kg</span>
                    <strong className="summary-card__value">
                      R$ {(resumoInsumo?.custoPorKg || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div className="summary-card">
                    <span className="summary-card__label">Custo por 100g</span>
                    <strong className="summary-card__value">
                      R$ {(resumoInsumo?.custoPor100g || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div className="summary-card">
                    <span className="summary-card__label">Custo por grama</span>
                    <strong className="summary-card__value">
                      R$ {(resumoInsumo?.custoPorGrama || 0).toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                    </strong>
                  </div>
                  <div className="summary-card">
                    <span className="summary-card__label">Custo por unidade base</span>
                    <strong className="summary-card__value">
                      R$ {(resumoInsumo?.custoUnitarioBase || 0).toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })} / {resumoInsumo?.unidadeConteudo || form.unidadeCompra}
                    </strong>
                  </div>
                </div>
                {resumoInsumo?.esgotado && <p className="alert alert--error"><span aria-hidden="true">⚠️</span><span>Estoque esgotado.</span></p>}
                {resumoInsumo?.abaixoMinimo && <p className="alert alert--warning"><span aria-hidden="true">⚠️</span><span>Abaixo do estoque mínimo.</span></p>}
              </div>
            )}

            {/* ---------- Avançado ---------- */}
            <CollapsibleSection title="Configurações avançadas" description="Fiscal, uso em receitas, venda fracionada e status" icon="⚙️">
              <div className="product-form-grid">
                {form.tipo === 'venda' && (
                  <label className="field">
                    <span className="label">NCM <small>(opcional, padrão 21069090)</small></span>
                    <input inputMode="numeric" maxLength={8} value={form.ncm} onChange={(event) => setForm({ ...form, ncm: event.target.value.replace(/\D/g, '').slice(0, 8) })} />
                  </label>
                )}

                {form.tipo === 'insumo' && (
                  <label className="field">
                    <span className="label">Marca / Referência <small>(opcional)</small></span>
                    <input value={form.marcaReferencia} onChange={(event) => setForm({ ...form, marcaReferencia: event.target.value })} />
                  </label>
                )}

                {form.tipo === 'venda' && (
                  <>
                    <label className="checkbox">
                      <input className="product-checkbox" type="checkbox" checked={Boolean(form.usavelEmReceita)} onChange={(event) => setForm({ ...form, usavelEmReceita: event.target.checked })} />
                      <span>Também usar como ingrediente em fichas técnicas</span>
                    </label>

                    {form.usavelEmReceita && (
                      <>
                        <label className="field">
                          <span className="label">Preço de compra (R$) *</span>
                          <input type="number" step="0.01" min={0.01} required value={form.precoCompra} onChange={(event) => setForm({ ...form, precoCompra: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="label">Conteúdo por embalagem *</span>
                          <input type="number" step="0.001" min={0.001} required value={form.conteudoPorEmbalagem} onChange={(event) => setForm({ ...form, conteudoPorEmbalagem: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="label">Unidade do conteúdo</span>
                          <select value={form.unidade} onChange={(event) => setForm({ ...form, unidade: event.target.value, unidadeCompra: event.target.value, unidadeConteudo: event.target.value })}>
                            {units.map((unidade) => <option key={unidade}>{unidade}</option>)}
                          </select>
                        </label>
                        <label className="field">
                          <span className="label">Estoque de insumos <small>para uso em receitas</small></span>
                          <input type="number" step="0.001" min={0} value={form.estoqueInsumos} onChange={(event) => setForm({ ...form, estoqueInsumos: event.target.value })} />
                        </label>
                      </>
                    )}

                    <label className="checkbox">
                      <input className="product-checkbox" type="checkbox" checked={Boolean(form.permitirVendaSemInsumo)} onChange={(event) => setForm({ ...form, permitirVendaSemInsumo: event.target.checked })} />
                      <span>Permitir venda mesmo sem insumo disponível</span>
                    </label>

                    <label className="checkbox">
                      <input className="product-checkbox" type="checkbox" checked={form.vendidoFracionado} onChange={(event) => setForm({ ...form, vendidoFracionado: event.target.checked })} />
                      <span>Permitir venda fracionada</span>
                    </label>
                  </>
                )}

                <label className="checkbox">
                  <input className="product-checkbox" type="checkbox" checked={form.ativo} onChange={(event) => setForm({ ...form, ativo: event.target.checked })} />
                  <span>Produto ativo</span>
                </label>
              </div>
            </CollapsibleSection>

            <div className="btn-row btn-row--stretch">
              <button type="submit" className="btn-primary">{editing ? 'Atualizar produto' : 'Cadastrar produto'}</button>
              {editing && <button type="button" className="btn-secondary" onClick={cancelar}>Cancelar</button>}
            </div>
          </div>
        </form>
      </section>

      {/* ================= LISTAGEM ================= */}
      <section className="card" aria-labelledby="produtos-lista-titulo">
        <div className="card__header">
          <h2 className="card-title" id="produtos-lista-titulo">Produtos</h2>
          <span className="badge badge--neutral">{filtrados.length} {filtrados.length === 1 ? 'item' : 'itens'}</span>
        </div>

        <div className="product-filters">
          <div className="field">
            <label className="label" htmlFor="produtos-filtro-texto">Buscar</label>
            <input
              id="produtos-filtro-texto"
              type="search"
              value={filtroTexto}
              onChange={(event) => setFiltroTexto(event.target.value)}
              placeholder="Nome ou código"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="produtos-filtro-categoria">Categoria</label>
            <select id="produtos-filtro-categoria" value={filtroCategoria} onChange={(event) => setFiltroCategoria(event.target.value)}>
              <option value="Todos">Todas as categorias</option>
              {categoriasVenda.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
            </select>
          </div>

          <div className="field">
            <label className="label" htmlFor="produtos-filtro-ficha">Ficha técnica</label>
            <select id="produtos-filtro-ficha" value={filtroFicha} onChange={(event) => setFiltroFicha(event.target.value)}>
              <option value="Todos">Todas as fichas</option>
              <option value="Sem ficha">Sem ficha técnica</option>
              {fichas.map((ficha) => <option key={ficha._id} value={ficha._id}>{ficha.produtoId?.nome || ficha.nome}</option>)}
            </select>
          </div>
        </div>

        <div className="filter-chips" role="group" aria-label="Filtrar por tipo de estoque">
          {filtrosTipo.map((tipo) => (
            <button
              key={tipo}
              type="button"
              className="filter-chip"
              aria-pressed={filtroTipo === tipo}
              onClick={() => setFiltroTipo(tipo)}
            >
              {tipo}
            </button>
          ))}
        </div>

        {filtrados.length === 0 ? (
          <EmptyState
            icon="📦"
            title={produtos.length === 0 ? 'Nenhum produto cadastrado' : 'Nenhum produto nesta visão'}
            description={produtos.length === 0
              ? 'Cadastre o primeiro item do cardápio ou registre insumos para a produção.'
              : 'Ajuste os filtros para ver outros produtos.'}
          >
            <button type="button" className="btn-primary" onClick={focarFormulario}>
              Cadastrar produto
            </button>
          </EmptyState>
        ) : (
          <div className="product-admin-grid">
            {filtrados.map((produto) => (
              <article key={produto._id} className="product-admin-card">
                <div>
                  <span className={`badge ${produto.tipo === 'insumo' ? 'badge--neutral' : 'badge--primary'}`}>
                    {produto.tipo === 'insumo' ? 'Insumo' : 'Venda'}
                  </span>
                  <h3 className="product-admin-card__name">{produto.nome}</h3>
                  <span className="product-code">Código {produto.codigo}</span>
                </div>
                <div className="product-admin-footer">
                  <div className="product-admin-footer__data">
                    {produto.tipo === 'insumo' ? (() => {
                      const unidadeConteudo = produto.unidadeConteudo || 'un';
                      const unidadeCompra = produto.unidade || produto.unidadeCompra || 'un';
                      const precoCompra = Number(produto.precoCompra ?? produto.resumoInsumo?.precoPorEmbalagem ?? 0);
                      const conteudoPorEmbalagem = Number(produto.conteudoPorEmbalagem ?? produto.resumoInsumo?.conteudoPorEmbalagem ?? 1);
                      const custoUnitarioBase = Number(produto.custoUnitarioBase ?? produto.resumoInsumo?.custoUnitarioBase ?? (precoCompra && conteudoPorEmbalagem ? (precoCompra / conteudoPorEmbalagem) : 0));
                      const quantidadeDisponivel = Number(produto.estoqueInsumosTotal ?? produto.resumoInsumo?.total ?? ((Number(produto.estoqueInsumos ?? produto.estoqueEmbalagens ?? 0) * conteudoPorEmbalagem) || 0));

                      return (
                        <>
                          <strong className="product-admin-footer__price">{dinheiro(precoCompra)}</strong>
                          <span className="product-admin-footer__label">Compra · {unidadeCompra}</span>
                          <span className={produto.resumoInsumo?.abaixoMinimo || produto.resumoInsumo?.esgotado ? 'low-stock' : 'product-admin-footer__label'}>
                            {quantidadeDisponivel.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {unidadeConteudo} disponíveis
                          </span>
                          <span className="product-admin-footer__label">Contém: {conteudoPorEmbalagem.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {unidadeConteudo} por {unidadeCompra}</span>
                          <span className="product-admin-footer__label">Custo: {dinheiro(custoUnitarioBase)}/{unidadeConteudo}</span>
                        </>
                      );
                    })() : (() => {
                      const preco = Number(produto.preco || 0);
                      const custoDireto = produto.precoCompra > 0 && Number(produto.conteudoPorEmbalagem || 0) > 0
                        ? Number(produto.precoCompra) / Number(produto.conteudoPorEmbalagem)
                        : null;
                      const custoCalculado = produto.fonteCalculo === 'insumo' && Number.isFinite(Number(produto.custoCalculado))
                        ? Number(produto.custoCalculado)
                        : null;
                      const custo = custoCalculado ?? custoDireto;
                      const custoDisponivel = custo !== null;
                      const lucroProduto = custoDisponivel && preco > 0 ? preco - custo : null;
                      return (
                        <>
                          <strong className="product-admin-footer__price">{dinheiro(preco)}</strong>
                          <span className="product-admin-footer__label">Categoria: {produto.categoria}</span>
                          <span className={Number(produto.estoque || 0) <= 5 ? 'low-stock' : 'product-admin-footer__label'}>
                            {(Number(produto.estoque) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} em estoque
                          </span>
                          <span className="product-admin-footer__label">Custo: {custoDisponivel ? dinheiro(custo) : 'Indisponível'}</span>
                          <span className={lucroProduto !== null && lucroProduto < 0 ? 'low-stock' : 'product-admin-footer__label'}>
                            Lucro: {lucroProduto !== null ? `${dinheiro(lucroProduto)} (${((lucroProduto / preco) * 100).toFixed(1)}%)` : 'Indisponível'}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="product-card-actions">
                    <button type="button" className="btn-secondary" onClick={() => editarProduto(produto)}>Editar</button>
                    <button type="button" className="btn-danger" onClick={() => remover(produto._id)}>Excluir</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .page, .page * { box-sizing: border-box; }

  .product-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); align-items: start; }
  .product-form-grid > * { min-width: 0; }
  .product-form-grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }

  .product-form-grid .label { display: flex; align-items: baseline; gap: 4px; }
  .product-form-grid .label small { font-size: 12px; font-weight: 400; color: var(--color-text-secondary); }

  .product-radio-group { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
  .product-radio-group .radio { min-height: 32px; font-weight: 600; }

  .product-cost-summary,
  .product-summary-section {
    display: grid; gap: var(--space-1);
    padding: var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm);
    background: var(--color-page);
  }
  .product-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--space-1); }
  .product-summary-grid .summary-card { box-shadow: none; }

  .collapsible__block { display: grid; gap: var(--space-1); }
  .collapsible__block + .collapsible__block { padding-top: var(--space-2); border-top: 1px solid var(--color-border); }

  .quantity-discount-row {
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    gap: var(--space-1); align-items: end;
  }
  .quantity-discount-row > * { min-width: 0; }

  .coz-stock-notice {
    display: grid; gap: 4px; padding: var(--space-1);
    border: 1px solid var(--accent-border); border-radius: var(--radius-sm);
    background: var(--color-primary-bg); color: var(--color-primary-hover); font-size: 14px;
  }
  .coz-stock-notice span { font-size: 12px; color: var(--color-text-secondary-aa); }

  .coz-recipe-panel {
    display: grid; gap: var(--space-1); padding: var(--space-1);
    border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-page);
  }
  .coz-recipe-panel > span, .coz-recipe-panel > small { font-size: 12px; color: var(--color-text-secondary-aa); }
  .coz-recipe-panel b { color: var(--color-primary-hover); font-weight: 700; }
  .coz-recipe-link { width: fit-content; font-size: 14px; font-weight: 600; }

  .ficha-ingredientes { display: grid; gap: var(--space-1); }
  .ficha-ingrediente {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-1);
    padding: 8px var(--space-1); background: var(--color-page); border-radius: var(--radius-sm); font-size: 14px;
  }
  .ficha-ingrediente strong { color: var(--color-primary-hover); white-space: nowrap; }

  .product-filters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-1); }
  .product-filters > * { min-width: 0; }

  .filter-chips { display: flex; flex-wrap: wrap; gap: var(--space-1); }
  .filter-chip {
    min-height: var(--control-height); padding: 0 var(--space-2);
    background: var(--color-card); border: 1px solid var(--color-border);
    border-radius: var(--radius-pill); color: var(--color-text-secondary-aa);
    font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .filter-chip[aria-pressed='true'] { background: var(--color-primary); border-color: var(--color-primary); color: #ffffff; }
  .filter-chip:hover { border-color: var(--color-primary); }

  .product-admin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-2); }
  .product-admin-grid > * { min-width: 0; }

  .product-admin-card {
    display: flex; flex-direction: column; gap: var(--space-1);
    min-width: 0; padding: var(--space-2);
    background: var(--color-card); border: 1px solid var(--color-border);
    border-radius: var(--radius-md); box-shadow: var(--shadow-sm);
  }
  .product-admin-card__name { margin: 0; font-size: 16px; font-weight: 600; overflow-wrap: anywhere; }
  .product-code { font-size: 12px; color: var(--color-text-secondary-aa); font-family: var(--font-mono); }

  .product-admin-footer { display: flex; flex-direction: column; gap: var(--space-1); margin-top: auto; }
  .product-admin-footer__data { display: grid; gap: 2px; }
  .product-admin-footer__price { font-size: 20px; font-weight: 700; color: var(--color-primary-hover); font-variant-numeric: tabular-nums; }
  .product-admin-footer__label { font-size: 12px; color: var(--color-text-secondary-aa); }
  .low-stock { font-size: 12px; font-weight: 700; color: var(--color-error-dark); }

  .product-card-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-1); }

  @media (max-width: 900px) {
    .product-filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  @media (max-width: 640px) {
    .product-form-grid,
    .product-form-grid--3,
    .product-filters,
    .product-summary-grid,
    .product-admin-grid { grid-template-columns: minmax(0, 1fr); }
    .quantity-discount-row { grid-template-columns: minmax(0, 1fr); }
    .quantity-discount-row button { width: 100%; }
  }
`;
