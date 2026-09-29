import { useEffect, useState } from 'react';
import api from '../services/api.jsx';
import { useToast } from '../components/Toast.jsx';
import EmptyState from '../components/EmptyState.jsx';

const units = ['kg', 'L', 'un'];
const decimalStep = (unit) => unit === 'un' ? '0.01' : '0.001';
const decimalMinimum = (unit) => unit === 'un' ? 0.01 : 0.001;
const newItem = () => ({ produtoId: '', valorTotal: '', qtdEmbalagens: '1', conteudoPorEmbalagem: '', unidadeConteudo: 'un' });
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const money = (value) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const categoriasVenda = ['Bebidas Quentes', 'Bebidas geladas', 'Salgados', 'Doces', 'Congelados', 'Sorvetes', 'Pratos na Hora', 'Outros'];
const formatQuantidade = (valor, unidade) => `${Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${unidade}`;
const formatCustoUnitario = (valor, unidade) => `R$ ${Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/${unidade}`;
const newSupply = () => ({ tipoProduto: 'insumo', nome: '', precoCompra: '', precoVenda: '', conteudoPorEmbalagem: '1', unidadeConteudo: 'un', estoqueEmbalagens: '0', rendimentoPorReceita: '1' });
const getInsumoMeta = (produto = {}) => {
  const unidadeConteudo = produto.unidadeConteudo || 'un';
  const unidadeCompra = produto.unidadeCompra || unidadeConteudo;
  const precoCompra = Number(produto.precoCompra ?? 0);
  const conteudoPorEmbalagem = Number(produto.conteudoPorEmbalagem ?? 1);
  const custoUnitarioBase = Number(produto.custoUnitarioBase ?? (precoCompra && conteudoPorEmbalagem ? (precoCompra / conteudoPorEmbalagem) : 0));
  const quantidadeDisponivel = Number(produto.estoqueInsumosTotal ?? ((Number(produto.estoqueInsumos ?? produto.estoqueEmbalagens ?? 0) * conteudoPorEmbalagem) || 0));

  return { unidadeConteudo, unidadeCompra, precoCompra, conteudoPorEmbalagem, custoUnitarioBase, quantidadeDisponivel };
};
const getNextProductCode = (productList) => {
  const maxNumber = productList.reduce((higher, product) => {
    const codeValue = Number(String(product.codigo || '').replace(/\D/g, ''));
    return Number.isFinite(codeValue) && codeValue > higher ? codeValue : higher;
  }, 99900);
  return String(Math.max(99900, maxNumber + 1));
};

export default function Purchases() {
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [form, setForm] = useState({ fornecedor: '', numeroNF: '', data: today(), metodoCusteio: 'media_ponderada', itens: [newItem()] });
  const [supplyForm, setSupplyForm] = useState(newSupply());
  const [supplyModalOpen, setSupplyModalOpen] = useState(false);
  const [supplyTargetIndex, setSupplyTargetIndex] = useState(null);
  const [savingSupply, setSavingSupply] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedPurchaseId, setExpandedPurchaseId] = useState(null);
  const [aba, setAba] = useState('entrada');
  const { showToast } = useToast();

  const load = async () => {
    try {
      const [productsResponse, purchasesResponse] = await Promise.all([api.get('/products'), api.get('/compras')]);
      setProducts(productsResponse.data || []);
      setPurchases(purchasesResponse.data || []);
    } catch (error) {
      showToast(error.response?.data?.msg || 'Não foi possível carregar as compras', 'error');
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [productsResponse, purchasesResponse] = await Promise.all([api.get('/products'), api.get('/compras')]);
        setProducts(productsResponse.data || []);
        setPurchases(purchasesResponse.data || []);
      } catch (error) {
        showToast(error.response?.data?.msg || 'Não foi possível carregar as compras', 'error');
      }
    };
    loadInitialData();
  }, [showToast]);

  const updateItem = (index, field, value) => {
    setForm((current) => ({ ...current, itens: current.itens.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  };

  const addItem = () => setForm((current) => ({ ...current, itens: [...current.itens, newItem()] }));
  const removeItem = (index) => setForm((current) => ({ ...current, itens: current.itens.length === 1 ? current.itens : current.itens.filter((_, itemIndex) => itemIndex !== index) }));

  const focusNextInput = (itemIndex) => {
    setTimeout(() => {
      const itemNode = document.querySelectorAll('.purchase-item')[itemIndex];
      const input = itemNode?.querySelector('input[type="number"]');
      if (input) input.focus();
    }, 0);
  };

  const openSupplyModal = (itemIndex = null) => {
    setSupplyTargetIndex(itemIndex);
    setSupplyForm(newSupply());
    setSupplyModalOpen(true);
  };

  const saveSupply = async (event) => {
    event.preventDefault();
    const nome = supplyForm.nome.trim();
    const tipoProduto = supplyForm.tipoProduto || 'insumo';
    const precoCompra = Number(supplyForm.precoCompra);
    const precoVenda = Number(supplyForm.precoVenda);
    const conteudoPorEmbalagem = Number(supplyForm.conteudoPorEmbalagem);

    if (!nome) return showToast('Informe o nome do insumo', 'warning');
    if (!Number.isFinite(precoCompra) || precoCompra < 0) return showToast('Informe um preço de compra válido', 'warning');
    if (tipoProduto !== 'insumo' && (!Number.isFinite(precoVenda) || precoVenda < 0)) return showToast('Informe um preço de venda válido', 'warning');
    if (!Number.isFinite(conteudoPorEmbalagem) || conteudoPorEmbalagem < 0) return showToast('Informe um conteúdo de embalagem válido', 'warning');

    const produtoExistente = products.find((product) => String(product.nome || '').trim().toLowerCase() === nome.toLowerCase());
    if (produtoExistente) {
      const fallbackIndex = supplyTargetIndex ?? form.itens.findIndex((item) => !item.produtoId);
      const targetIndex = fallbackIndex >= 0 ? fallbackIndex : 0;
      updateItem(targetIndex, 'produtoId', produtoExistente._id);
      setSupplyModalOpen(false);
      setSupplyTargetIndex(null);
      focusNextInput(targetIndex);
      showToast(`Já existe um insumo com este nome. ${produtoExistente.nome} foi selecionado automaticamente.`, 'warning');
      return;
    }

    setSavingSupply(true);
    try {
      const codigo = getNextProductCode(products);
      const unidadeConteudo = supplyForm.unidadeConteudo || 'un';
      const custoUnitarioBase = Number(precoCompra && conteudoPorEmbalagem ? (precoCompra / conteudoPorEmbalagem) : 0);
      const response = await api.post('/products', {
        codigo,
        nome,
        tipo: tipoProduto === 'insumo' ? 'insumo' : 'venda',
        tipoProduto: tipoProduto === 'insumo' ? undefined : tipoProduto,
        aFazer: tipoProduto === 'coz',
        producaoPropria: tipoProduto === 'producao',
        categoria: tipoProduto === 'insumo' ? 'Insumos' : (tipoProduto === 'coz' ? 'Pratos na Hora' : 'Outros'),
        preco: tipoProduto === 'insumo' ? 0 : precoVenda,
        precoCompra: tipoProduto === 'insumo' ? precoCompra : undefined,
        conteudoPorEmbalagem,
        unidadeConteudo,
        unidadeCompra: unidadeConteudo,
        custoUnitarioBase,
        estoque: tipoProduto === 'coz' ? 0 : Number(supplyForm.estoqueEmbalagens || 0),
        estoqueEmbalagens: tipoProduto === 'insumo' ? Number(supplyForm.estoqueEmbalagens || 0) : undefined,
        rendimentoPorReceita: tipoProduto === 'producao' ? Number(supplyForm.rendimentoPorReceita || 1) : 1,
        usavelEmReceita: false,
        ativo: true,
      });
      const newProduct = response.data;
      setProducts((current) => [...current, newProduct].sort((a, b) => a.nome.localeCompare(b.nome)));
      if (tipoProduto !== 'insumo') {
        setSupplyModalOpen(false);
        setSupplyTargetIndex(null);
        showToast(`${nome} cadastrado. Produtos que não são insumos não entram como item de compra.`, 'success');
        return;
      }
      const fallbackIndex = supplyTargetIndex ?? form.itens.findIndex((item) => !item.produtoId);
      const targetIndex = fallbackIndex >= 0 ? fallbackIndex : 0;
      updateItem(targetIndex, 'produtoId', newProduct._id);
      setSupplyModalOpen(false);
      setSupplyTargetIndex(null);
      focusNextInput(targetIndex);
      showToast('Insumo cadastrado e selecionado na compra', 'success');
    } catch (error) {
      const validationMessage = error.response?.data?.errors?.map((item) => item.msg).join('; ');
      showToast(error.response?.data?.msg || validationMessage || 'Não foi possível cadastrar o insumo', 'error');
    } finally {
      setSavingSupply(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const itens = form.itens.map((item) => ({ ...item, valorTotal: Number(item.valorTotal), qtdEmbalagens: Number(item.qtdEmbalagens), conteudoPorEmbalagem: Number(item.conteudoPorEmbalagem) }));
      await api.post('/compras', { ...form, itens });
      showToast('Compra registrada e estoque atualizado', 'success');
      setForm({ fornecedor: '', numeroNF: '', data: today(), metodoCusteio: 'media_ponderada', itens: [newItem()] });
      await load();
    } catch (error) {
      showToast(error.response?.data?.msg || 'Não foi possível registrar a compra', 'error');
    } finally {
      setSaving(false);
    }
  };

  return <div className="purchases-page">
    <header className="page-heading">
      <div>
        <span className="eyebrow">Produção / Compras</span>
        <h1>Compras</h1>
        <p>Registre entradas de insumos e atualize o custo pelo recebimento.</p>
      </div>
    </header>

    <div className="area-tabs" role="tablist" aria-label="Seções de compras">
      <button type="button" role="tab" aria-selected={aba === 'entrada'} className={aba === 'entrada' ? 'active' : ''} onClick={() => setAba('entrada')}>Lançar entrada</button>
      <button type="button" role="tab" aria-selected={aba === 'historico'} className={aba === 'historico' ? 'active' : ''} onClick={() => setAba('historico')}>Histórico de compras</button>
    </div>

    {aba === 'entrada' ? (
    <form className="purchases-form card" onSubmit={submit}>
      <div className="card__header">
        <h2 className="card-title">Nova entrada de compra</h2>
      </div>
      <div className="purchases-grid">
        <label className="field">Fornecedor<input required value={form.fornecedor} onChange={(event) => setForm({ ...form, fornecedor: event.target.value })} /></label>
        <label className="field">Número da NF<input required value={form.numeroNF} onChange={(event) => setForm({ ...form, numeroNF: event.target.value })} /></label>
        <label className="field">Data<input required type="date" value={form.data} onChange={(event) => setForm({ ...form, data: event.target.value })} /></label>
        <label className="field">Atualização de custo<select value={form.metodoCusteio} onChange={(event) => setForm({ ...form, metodoCusteio: event.target.value })}><option value="media_ponderada">Média ponderada</option><option value="ultimo_preco">Último preço</option></select></label>
      </div>
      <div className="purchases-section-heading"><h2 className="card-title">Itens da compra</h2><button type="button" className="btn-secondary" onClick={addItem}>Adicionar item</button></div>
      <div className="purchase-items">{form.itens.map((item, index) => {
        const unidadeConteudo = item.unidadeConteudo || 'un';
        const total = Number(item.qtdEmbalagens || 0) * Number(item.conteudoPorEmbalagem || 0);
        const unitCost = Number(item.valorTotal || 0) / (total || 1);
        const produtoSelecionado = products.find((product) => String(product._id) === String(item.produtoId));
        const metaProduto = getInsumoMeta(produtoSelecionado || { unidadeConteudo, precoCompra: item.valorTotal, conteudoPorEmbalagem: item.conteudoPorEmbalagem || 1, custoUnitarioBase: unitCost, estoqueInsumos: item.qtdEmbalagens || 0 });
        const unidadeExibicao = metaProduto.unidadeConteudo || unidadeConteudo;
        const valorUnitario = Number(metaProduto.custoUnitarioBase || unitCost || 0);
        return <div className="purchase-item card" key={`purchase-item-${index}`}>
          <label className="purchase-product-field field">Produto comprado<div className="purchase-product-input-group"><select required aria-label={`Produto comprado, item ${index + 1}`} value={item.produtoId} onChange={(event) => updateItem(index, 'produtoId', event.target.value)}><option value="">Selecione</option>{products.map((product) => <option key={product._id} value={product._id}>{product.nome} [{product.tipo === 'insumo' ? 'Insumo' : 'Revenda'}]</option>)}</select><button type="button" className="btn-secondary purchase-new-supply-button" onClick={() => openSupplyModal(index)}>➕ Novo Produto</button></div></label>
          <label className="field">Valor total<input required type="number" min="0.01" step="0.01" value={item.valorTotal} onChange={(event) => updateItem(index, 'valorTotal', event.target.value)} /></label>
          <label className="field">Qtd. embalagens<input required type="number" min="1" step="1" value={item.qtdEmbalagens} onChange={(event) => updateItem(index, 'qtdEmbalagens', event.target.value)} /></label>
          <label className="field">Quantidade<input required type="number" min={decimalMinimum(item.unidadeConteudo)} step={decimalStep(item.unidadeConteudo)} value={item.conteudoPorEmbalagem} onChange={(event) => updateItem(index, 'conteudoPorEmbalagem', event.target.value)} /></label>
          <label className="field">Unidade<select required aria-label={`Unidade do item ${index + 1}`} value={item.unidadeConteudo} onChange={(event) => updateItem(index, 'unidadeConteudo', event.target.value)}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
          <div className="purchase-calculation"><span>Total: <strong>{formatQuantidade(total, unidadeExibicao)}</strong></span><span>Custo unitário: <strong>{formatCustoUnitario(valorUnitario, unidadeExibicao)}</strong></span></div>
          <button type="button" className="btn-danger" onClick={() => removeItem(index)} disabled={form.itens.length === 1}>Remover</button>
        </div>;
      })}</div>
      <div className="btn-row"><button className="btn-primary" disabled={saving}>{saving ? 'Registrando...' : 'Registrar compra'}</button></div>
    </form>
    ) : (
    <section className="purchases-history card">
      <div className="card__header">
        <h2 className="card-title">Histórico de compras</h2>
        <span className="badge badge--neutral">{purchases.length} {purchases.length === 1 ? 'registro' : 'registros'}</span>
      </div>
      {purchases.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="Nenhuma compra registrada"
          description="Assim que você lançar a primeira entrada de insumos, o histórico aparece aqui."
        >
          <button type="button" className="btn-primary" onClick={() => setAba('entrada')}>Lançar entrada</button>
        </EmptyState>
      ) : purchases.map((purchase) => {
        const isExpanded = expandedPurchaseId === purchase._id;
        const itens = purchase.itens || [];
        return (
          <article key={purchase._id} className={`purchase-history-card${isExpanded ? ' expanded' : ''}`}>
            <button type="button" className="purchase-history-header" aria-expanded={isExpanded} onClick={() => setExpandedPurchaseId(isExpanded ? null : purchase._id)}>
              <span>
                <strong>{purchase.fornecedor}</strong>
                <small>NF {purchase.numeroNF} · {new Date(purchase.data).toLocaleDateString('pt-BR')}</small>
              </span>
              <span className="purchase-history-summary">
                <b>{money(purchase.valorTotal)}</b>
                <svg className="expand-icon" data-open={isExpanded ? 'true' : 'false'} width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
            {isExpanded && (
              <div className="purchase-history-details">
                <div className="table-wrap">
                <table className="purchase-items-table">
                  <caption className="visually-hidden">Itens da compra {purchase.numeroNF}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Produto</th>
                      <th scope="col" className="num">Qtd. embalagens</th>
                      <th scope="col" className="num">Conteúdo/emb.</th>
                      <th scope="col">Unidade</th>
                      <th scope="col" className="num">Qtd. total</th>
                      <th scope="col" className="num">Valor total</th>
                      <th scope="col" className="num">Custo unit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item, index) => {
                      const produto = item.produtoId || {};
                      const quantidadeTotal = Number(item.qtdEmbalagens || 0) * Number(item.conteudoPorEmbalagem || 0);
                      const custoUnitario = quantidadeTotal > 0 ? Number(item.valorTotal || 0) / quantidadeTotal : 0;
                      return (
                        <tr key={index}>
                          <td>{produto.nome || '—'}</td>
                          <td className="num">{Number(item.qtdEmbalagens || 0).toLocaleString('pt-BR')}</td>
                          <td className="num">{Number(item.conteudoPorEmbalagem || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</td>
                          <td>{item.unidadeConteudo || 'un'}</td>
                          <td className="num">{quantidadeTotal.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</td>
                          <td className="num">{money(item.valorTotal)}</td>
                          <td className="num">{custoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/{item.unidadeConteudo || 'un'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                <div className="purchase-history-footer">
                  <span><strong>Método de custeio:</strong> {purchase.metodoCusteio === 'media_ponderada' ? 'Média ponderada' : 'Último preço'}</span>
                  <span><strong>Data da compra:</strong> {new Date(purchase.data).toLocaleDateString('pt-BR')}</span>
                  {purchase.createdBy && <span><strong>Registrado por:</strong> {purchase.createdBy.username || purchase.createdBy}</span>}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </section>
    )}
    {supplyModalOpen && <div className="purchase-supply-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSupplyModalOpen(false); }}>
      <form onSubmit={saveSupply} className="purchase-supply-modal" role="dialog" aria-modal="true" aria-labelledby="new-supply-title">
        <div className="purchase-supply-modal-header"><div><h2 id="new-supply-title">➕ Novo Produto</h2><p>Cadastre o insumo e continue o lançamento da compra.</p></div><button type="button" className="purchase-supply-button purchase-supply-close" onClick={() => setSupplyModalOpen(false)} aria-label="Fechar modal">×</button></div>
        <div className="purchase-supply-grid">
          <label className="purchase-supply-field full">Tipo de produto<select value={supplyForm.tipoProduto} onChange={(event) => setSupplyForm({ ...supplyForm, tipoProduto: event.target.value })}><option value="insumo">Insumo</option><option value="revenda">Revenda</option></select></label>
          <label className="purchase-supply-field full">Nome *<input required value={supplyForm.nome} onChange={(event) => setSupplyForm({ ...supplyForm, nome: event.target.value })} placeholder="Ex.: Farinha de trigo" /></label>
          <label className="purchase-supply-field">Categoria<select value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })}>{categoriasVenda.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
                  </select></label>
          <label className="purchase-supply-field">Unidade
            <select value={supplyForm.unidadeConteudo} onChange={(event) => setSupplyForm({ ...supplyForm, unidadeConteudo: event.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
        </div>
        <div className="purchase-supply-note">⚠️ Campos completos como estoque mínimo, marca e demais dados do produto podem ser editados depois em Cadastro → Insumos.</div>
        <div className="purchase-supply-actions"><button type="button" className="purchase-supply-button purchase-supply-button-secondary" onClick={() => setSupplyModalOpen(false)}>Cancelar</button><button type="submit" className="purchase-supply-button purchase-supply-button-primary" disabled={savingSupply}>{savingSupply ? 'Salvando...' : 'Salvar e continuar'}</button></div>
      </form>
    </div>}
    <style>{styles}</style>
    <style>{modalStyles}</style>
  </div>;
}

const styles = `
  .purchases-page { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
  .purchases-page, .purchases-page * { box-sizing: border-box; }

  .purchases-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-1); }
  .purchases-grid > * { min-width: 0; }

  .purchases-section-heading {
    display: flex; align-items: center; justify-content: space-between;
    gap: var(--space-1); flex-wrap: wrap; margin: var(--space-2) 0 var(--space-1);
  }

  .purchase-items { display: grid; gap: var(--space-1); }
  .purchase-item {
    display: grid; grid-template-columns: minmax(0, 1.6fr) repeat(4, minmax(0, 1fr));
    gap: var(--space-1); padding: var(--space-2);
    background: var(--color-page);
  }
  .purchase-item > * { min-width: 0; }

  .purchase-product-field { grid-column: 1 / -1; }
  .purchase-product-input-group { display: flex; gap: var(--space-1); align-items: stretch; }
  .purchase-product-input-group > * { min-width: 0; }
  .purchase-product-input-group select { flex: 1 1 auto; }
  .purchase-new-supply-button { flex-shrink: 0; white-space: nowrap; }

  .purchase-calculation {
    grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: var(--space-2);
    font-size: 12px; color: var(--color-text-secondary-aa);
  }
  .purchase-calculation strong { color: var(--color-primary-hover); font-weight: 700; }

  .purchases-history { gap: var(--space-1); }
  .purchase-history-card {
    border: 1px solid var(--color-border); border-radius: var(--radius-sm);
    background: var(--color-page); overflow: hidden;
  }
  .purchase-history-header {
    display: flex; align-items: center; justify-content: space-between;
    gap: var(--space-1); width: 100%; min-width: 0;
    padding: var(--space-1) var(--space-2);
    background: transparent; border: 0; color: var(--color-text);
    font-family: inherit; text-align: left; cursor: pointer;
  }
  .purchase-history-header:hover { background: var(--color-surface-muted); }
  .purchase-history-header > span:first-child { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .purchase-history-header strong { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
  .purchase-history-header small { font-size: 12px; color: var(--color-text-secondary-aa); }

  .purchase-history-summary { display: flex; align-items: center; gap: var(--space-1); flex-shrink: 0; }
  .purchase-history-summary b { font-size: 16px; font-weight: 700; color: var(--color-primary-hover); font-variant-numeric: tabular-nums; }
  .expand-icon { color: var(--color-text-secondary-aa); transition: transform 0.15s ease; }
  .expand-icon[data-open='true'] { transform: rotate(90deg); }

  .purchase-history-details { padding: 0 var(--space-2) var(--space-2); border-top: 1px solid var(--color-border); }
  .purchase-items-table { margin-top: var(--space-1); }

  .purchase-history-footer {
    display: flex; flex-wrap: wrap; gap: var(--space-2);
    margin-top: var(--space-1); padding-top: var(--space-1);
    border-top: 1px solid var(--color-border);
    font-size: 12px; color: var(--color-text-secondary-aa);
  }
  .purchase-history-footer strong { color: var(--color-text); }

  @media (max-width: 900px) {
    .purchases-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .purchase-item { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  @media (max-width: 560px) {
    .purchases-grid { grid-template-columns: minmax(0, 1fr); }
    .purchase-item { grid-template-columns: minmax(0, 1fr); }
    .purchase-product-input-group { flex-direction: column; }
    .purchase-new-supply-button { width: 100%; }
    .purchase-calculation { display: grid; gap: 4px; }
  }
`;

const modalStyles = `
  .purchase-supply-modal-backdrop {
    position: fixed; inset: 0; z-index: 10000;
    display: grid; place-items: center; padding: var(--space-2);
    background: rgba(61, 47, 35, 0.45);
  }
  .purchase-supply-modal {
    width: min(560px, 100%); max-height: 90vh; overflow-y: auto;
    padding: var(--space-3); box-sizing: border-box;
    background: var(--color-card); color: var(--color-text);
    border: 1px solid var(--color-border); border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
  }
  .purchase-supply-modal-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: var(--space-2); margin-bottom: var(--space-2);
  }
  .purchase-supply-modal-header h2 { margin: 0; font-size: 16px; font-weight: 600; }
  .purchase-supply-modal-header p { margin: 4px 0 0; font-size: 12px; color: var(--color-text-secondary-aa); }

  .purchase-supply-close {
    display: inline-flex; align-items: center; justify-content: center;
    width: var(--touch-target); height: var(--touch-target); min-height: var(--touch-target);
    padding: 0; flex-shrink: 0;
    background: transparent; border: 1px solid var(--color-border);
    border-radius: var(--radius-sm); color: var(--color-text); font-size: 22px; line-height: 1; cursor: pointer;
  }
  .purchase-supply-close:hover { background: var(--color-surface-muted); }

  .purchase-supply-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-1); }
  .purchase-supply-grid > * { min-width: 0; }
  .purchase-supply-field.full { grid-column: 1 / -1; }

  .purchase-supply-note {
    margin-top: var(--space-2); padding: var(--space-1) var(--space-2);
    background: var(--color-warning-bg); border: 1px solid var(--color-warning-border);
    border-left: 3px solid var(--color-warning); border-radius: var(--radius-sm);
    font-size: 12px; color: var(--color-warning-dark);
  }
  .purchase-supply-actions { display: flex; justify-content: flex-end; gap: var(--space-1); margin-top: var(--space-2); }

  @media (max-width: 560px) {
    .purchase-supply-modal-backdrop { align-items: flex-end; padding: var(--space-1); }
    .purchase-supply-modal { max-height: calc(100vh - 16px); padding: var(--space-2); }
    .purchase-supply-grid { grid-template-columns: minmax(0, 1fr); }
    .purchase-supply-field.full { grid-column: auto; }
    .purchase-supply-actions { display: grid; grid-template-columns: minmax(0, 1fr); }
    .purchase-supply-actions button { width: 100%; }
  }
`;
