import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';

const formatMoney = (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;

const formasPagamento = [
  { tipo: 'pix', rotulo: 'Pix', icone: '⚡' },
  { tipo: 'dinheiro', rotulo: 'Dinheiro', icone: '💵' },
  { tipo: 'credito_loja', rotulo: 'Cartão', icone: '💳' },
];

export default function PDV() {
  const { user } = useAuth();
  const [produtos, setProdutos] = useState([]);
  const [itens, setItens] = useState([]);
  const [cliente, setCliente] = useState('');
  const [observacao, setObservacao] = useState('');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [carregandoProdutos, setCarregandoProdutos] = useState(true);
  const [erroProdutos, setErroProdutos] = useState('');
  const [msg, setMsg] = useState('');
  const [msgTipo, setMsgTipo] = useState('success');

  const buscarProdutos = useCallback(async () => {
    try {
      const { data } = await api.get('/produtos?tipo=venda&ativo=true');
      setProdutos(data || []);
      setErroProdutos('');
    } catch (error) {
      // Detalhe tecnico apenas no console; a tela mostra mensagem amigavel.
      console.error('Falha ao carregar produtos do PDV:', error);
      setProdutos([]);
      setErroProdutos('Não foi possível carregar os produtos.');
    } finally {
      setCarregandoProdutos(false);
    }
  }, []);

  useEffect(() => {
    // O agendamento evita a renderizacao em cascata do primeiro carregamento.
    const inicial = window.setTimeout(buscarProdutos, 0);
    return () => window.clearTimeout(inicial);
  }, [buscarProdutos]);

  const tentarNovamente = () => {
    setCarregandoProdutos(true);
    buscarProdutos();
  };

  const aviso = (texto, tipo = 'success') => {
    setMsg(texto);
    setMsgTipo(tipo);
    window.setTimeout(() => setMsg(''), 3500);
  };

  const adicionarItem = (produto) => {
    const existente = itens.find((i) => i.produtoId === produto._id);
    if (existente) {
      setItens(itens.map((i) =>
        i.produtoId === produto._id
          ? { ...i, quantidade: i.quantidade + 1 }
          : i
      ));
    } else {
      setItens([...itens, {
        produtoId: produto._id,
        nome: produto.nome,
        precoUnitario: produto.preco,
        quantidade: 1,
        unidadeVenda: produto.unidadeVenda || 'un',
        tipoVenda: produto.tipoVenda || 'unidade',
        pesoPorUnidade: produto.pesoPorUnidade || 0,
        unidadePeso: produto.unidadePeso || 'kg',
      }]);
    }
    setMsg('');
  };

  const removerItem = (index) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const alterarQuantidade = (index, valor) => {
    const novo = Math.max(0.001, Number(valor) || 0.001);
    setItens(itens.map((i, idx) => idx === index ? { ...i, quantidade: novo } : i));
  };

  const total = itens.reduce((soma, item) => soma + item.precoUnitario * item.quantidade, 0);
  const totalItens = itens.reduce((soma, item) => soma + Number(item.quantidade || 0), 0);

  const finalizarPedido = async (formaPagamento) => {
    if (!itens.length) return;
    setLoading(true);
    setMsg('');
    try {
      await api.post('/orders', {
        itens,
        clienteNome: cliente || undefined,
        observacao,
        atendente: user?.username || 'Operador',
        tipoAtendimento: 'balcao',
        pagamentos: [{ tipo: formaPagamento, valorRecebido: total, quitado: true }],
      });
      aviso('Pedido finalizado com sucesso!');
      setItens([]);
      setCliente('');
      setObservacao('');
    } catch (e) {
      console.error(e);
      setMsg('Erro ao finalizar pedido.');
      setMsgTipo('error');
    } finally {
      setLoading(false);
    }
  };

  const termo = busca.trim().toLowerCase();
  const produtosFiltrados = termo
    ? produtos.filter((p) => `${p.nome || ''} ${p.codigo || ''}`.toLowerCase().includes(termo))
    : produtos;

  return (
    <div className="pdv-page">
      <header className="page-heading">
        <div className="page-heading__title">
          <h1>Atendimento</h1>
          <p>Monte o pedido, informe o cliente e escolha a forma de pagamento.</p>
        </div>
        <span className="pdv-counter">
          {totalItens} {totalItens === 1 ? 'item' : 'itens'}
        </span>
      </header>

      <div className="pdv-grid">
        {/* ---------------- PRODUTOS ---------------- */}
        <section className="card pdv-panel" aria-labelledby="pdv-produtos-titulo">
          <div className="card__header">
            <h2 className="card-title" id="pdv-produtos-titulo">Produtos</h2>
            <span className="badge badge--neutral">{produtosFiltrados.length}</span>
          </div>

          <div className="field">
            <label className="label" htmlFor="pdv-busca">Buscar produto</label>
            <input
              id="pdv-busca"
              type="search"
              placeholder="Código ou nome do produto"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </div>

          {msg && (
            <div
              className={`alert alert--${msgTipo}`}
              role={msgTipo === 'error' ? 'alert' : 'status'}
              aria-live={msgTipo === 'error' ? 'assertive' : 'polite'}
            >
              <span>{msg}</span>
            </div>
          )}

          {carregandoProdutos ? (
            <div className="state" role="status" aria-live="polite">
              <span className="state__text">Carregando produtos...</span>
            </div>
          ) : erroProdutos ? (
            <div className="state state--error" role="alert">
              <span className="state__icon" aria-hidden="true">⚠️</span>
              <span className="state__title">Lista indisponível</span>
              <span className="state__text">{erroProdutos}</span>
              <div className="state__actions">
                <button type="button" className="btn-secondary" onClick={tentarNovamente}>Tentar novamente</button>
              </div>
            </div>
          ) : produtosFiltrados.length === 0 ? (
            <div className="state">
              <span className="state__icon" aria-hidden="true">🛒</span>
              <span className="state__title">Nenhum produto disponível</span>
              <span className="state__text">
                {termo
                  ? 'Nenhum produto corresponde à busca. Tente outro termo.'
                  : 'Cadastre produtos no menu para começar a atender.'}
              </span>
              {!termo && (
                <div className="state__actions">
                  <a className="btn-primary" href="/produtos">Cadastrar produto</a>
                </div>
              )}
            </div>
          ) : (
            <ul className="pdv-product-list">
              {produtosFiltrados.map((p) => (
                <li key={p._id} className="pdv-product-list__item">
                  <button type="button" className="pdv-product" onClick={() => adicionarItem(p)}>
                    <span className="pdv-product__text">
                      <span className="pdv-product__name">{p.nome}</span>
                      <span className="pdv-product__code">Código {p.codigo}</span>
                    </span>
                    <span className="pdv-product__price">
                      {formatMoney(p.preco)}
                      {p.unidadeVenda && p.unidadeVenda !== 'un' ? `/${p.unidadeVenda}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------------- PEDIDO ---------------- */}
        <section className="card pdv-panel pdv-order" aria-labelledby="pdv-pedido-titulo">
          <div className="card__header">
            <h2 className="card-title" id="pdv-pedido-titulo">Pedido</h2>
            <span className="badge badge--neutral">{itens.length} {itens.length === 1 ? 'linha' : 'linhas'}</span>
          </div>

          {itens.length === 0 ? (
            <div className="state">
              <span className="state__icon" aria-hidden="true">🧾</span>
              <span className="state__title">Pedido vazio</span>
              <span className="state__text">Toque em um produto para adicionar itens ao pedido.</span>
            </div>
          ) : (
            <ul className="pdv-cart">
              {itens.map((item, idx) => (
                <li key={idx} className="pdv-cart__item">
                  <div className="pdv-cart__info">
                    <span className="pdv-cart__name">{item.nome}</span>
                    <span className="pdv-cart__meta">
                      {formatMoney(item.precoUnitario)} · {item.unidadeVenda}
                    </span>
                  </div>

                  <div className="pdv-cart__controls">
                    <div className="qty">
                      <button
                        type="button"
                        className="qty__btn"
                        onClick={() => alterarQuantidade(idx, item.quantidade - 1)}
                        aria-label={`Diminuir quantidade de ${item.nome}`}
                      >
                        −
                      </button>
                      <input
                        className="qty__input"
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={item.quantidade}
                        onChange={(event) => alterarQuantidade(idx, event.target.value)}
                        aria-label={`Quantidade de ${item.nome}`}
                      />
                      <button
                        type="button"
                        className="qty__btn"
                        onClick={() => alterarQuantidade(idx, item.quantidade + 1)}
                        aria-label={`Aumentar quantidade de ${item.nome}`}
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      className="pdv-cart__remove"
                      onClick={() => removerItem(idx)}
                      aria-label={`Remover ${item.nome} do pedido`}
                    >
                      Remover
                    </button>
                  </div>

                  <span className="pdv-cart__total">{formatMoney(item.precoUnitario * item.quantidade)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="pdv-summary">
            <div className="field">
              <label className="label" htmlFor="pdv-cliente">Nome do cliente</label>
              <input
                id="pdv-cliente"
                type="text"
                placeholder="Opcional"
                value={cliente}
                onChange={(event) => setCliente(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="pdv-observacao">Observação</label>
              <input
                id="pdv-observacao"
                type="text"
                placeholder="Opcional"
                value={observacao}
                onChange={(event) => setObservacao(event.target.value)}
              />
            </div>

            <div className="pdv-total">
              <span className="pdv-total__label">Total do pedido</span>
              <strong className="pdv-total__value">{formatMoney(total)}</strong>
            </div>
          </div>

          <div className="pdv-payments">
            <span className="label">Forma de pagamento</span>
            <div className="pdv-payments__grid">
              {formasPagamento.map((forma) => (
                <button
                  key={forma.tipo}
                  type="button"
                  className="btn-primary pdv-payment"
                  onClick={() => finalizarPedido(forma.tipo)}
                  disabled={loading || !itens.length}
                >
                  <span aria-hidden="true">{forma.icone}</span>
                  <span>{forma.rotulo}</span>
                </button>
              ))}
            </div>
            {loading && <p className="pdv-payments__status" role="status" aria-live="polite">Registrando pedido...</p>}
          </div>
        </section>
      </div>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .pdv-page { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; max-width: 100%; }
  .pdv-page, .pdv-page * { box-sizing: border-box; }

  .pdv-counter {
    display: inline-flex; align-items: center; padding: 4px 12px;
    border-radius: var(--radius-pill); background: var(--color-primary-bg);
    color: var(--color-primary-hover); font-size: 12px; font-weight: 700; white-space: nowrap;
  }

  .pdv-grid {
    display: grid; grid-template-columns: 1fr; gap: var(--space-2);
    min-width: 0; width: 100%;
  }
  .pdv-grid > * { min-width: 0; max-width: 100%; }

  .pdv-panel { min-width: 0; overflow: hidden; }

  /* ---- Lista de produtos ---- */
  .pdv-product-list {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--space-1); margin: 0; padding: 0; list-style: none;
  }
  .pdv-product-list__item { min-width: 0; display: flex; }

  .pdv-product {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-1);
    width: 100%; min-width: 0; min-height: 56px; padding: 10px var(--space-2);
    text-align: left; background: var(--color-card);
    border: 1px solid var(--color-border); border-radius: var(--radius-sm);
    color: var(--color-text); font-family: inherit; cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }
  .pdv-product:hover { border-color: var(--color-primary); background: var(--color-page); }
  .pdv-product__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .pdv-product__name { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
  .pdv-product__code { font-size: 12px; color: var(--color-text-secondary-aa); font-family: var(--font-mono); }
  .pdv-product__price {
    font-size: 14px; font-weight: 700; color: var(--color-primary-hover);
    font-variant-numeric: tabular-nums; white-space: nowrap; flex-shrink: 0;
  }

  /* ---- Carrinho ---- */
  .pdv-cart { display: grid; gap: var(--space-1); margin: 0; padding: 0; list-style: none; }
  .pdv-cart__item {
    display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px var(--space-1);
    padding: var(--space-1); min-width: 0;
    background: var(--color-page); border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  }
  .pdv-cart__info { display: flex; flex-direction: column; gap: 2px; min-width: 0; grid-column: 1; }
  .pdv-cart__name { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
  .pdv-cart__meta { font-size: 12px; color: var(--color-text-secondary-aa); }
  .pdv-cart__controls {
    grid-column: 1 / -1; display: flex; align-items: center; gap: var(--space-1); flex-wrap: wrap; min-width: 0;
  }
  .pdv-cart__total {
    grid-column: 2; grid-row: 1; justify-self: end; align-self: start;
    font-size: 14px; font-weight: 700; color: var(--color-primary-hover);
    font-variant-numeric: tabular-nums; white-space: nowrap;
  }
  .pdv-cart__remove {
    min-height: var(--control-height); padding: 0 16px;
    background: transparent; border: 1px solid var(--error-border);
    border-radius: var(--radius-sm); color: var(--color-error-dark);
    font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .pdv-cart__remove:hover { background: var(--color-error-bg); }

  .qty { display: inline-flex; align-items: stretch; border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden; }
  .qty__btn {
    width: var(--touch-target); min-height: var(--control-height); padding: 0;
    background: var(--color-card); border: 0; color: var(--color-text);
    font-size: 18px; font-weight: 700; line-height: 1; cursor: pointer;
  }
  .qty__btn:hover { background: var(--color-surface-muted); }
  .qty__input {
    width: 64px; min-height: var(--control-height); height: var(--control-height);
    padding: 0 6px; text-align: center;
    border: 0; border-left: 1px solid var(--color-border); border-right: 1px solid var(--color-border);
    border-radius: 0; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums;
  }
  .qty__input:focus { box-shadow: inset 0 0 0 2px var(--color-primary); }

  /* ---- Resumo ---- */
  .pdv-summary {
    display: flex; flex-direction: column; gap: var(--space-1);
    padding: var(--space-2); min-width: 0;
    background: var(--color-page); border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  }
  .pdv-total {
    display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-1); flex-wrap: wrap;
    padding-top: var(--space-1); border-top: 1px solid var(--color-border);
  }
  .pdv-total__label { font-size: 14px; font-weight: 600; color: var(--color-text); }
  .pdv-total__value {
    font-size: 24px; font-weight: 700; color: var(--color-primary-hover);
    font-variant-numeric: tabular-nums; overflow-wrap: anywhere;
  }

  /* ---- Pagamento ---- */
  .pdv-payments { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .pdv-payments__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-1); }
  .pdv-payment { width: 100%; min-width: 0; }
  .pdv-payments__status { margin: 0; font-size: 12px; color: var(--color-text-secondary-aa); text-align: center; }

  @media (min-width: 900px) {
    .pdv-grid { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); align-items: start; }
    .pdv-order { position: sticky; top: 24px; }
  }

  @media (max-width: 899px) {
    .pdv-grid { grid-template-columns: minmax(0, 1fr); }
    .pdv-order { position: static; }
  }

  @media (max-width: 560px) {
    .pdv-product-list { grid-template-columns: minmax(0, 1fr); }
    .pdv-payments__grid { grid-template-columns: minmax(0, 1fr); }
    .pdv-cart__controls { flex-direction: column; align-items: stretch; }
    .qty { width: 100%; }
    .qty__btn { flex: 1 1 0; }
    .qty__input { flex: 1 1 auto; width: auto; }
    .pdv-cart__remove { width: 100%; }
    .pdv-total__value { font-size: 20px; }
  }
`;
