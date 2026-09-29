import { useEffect, useState, useCallback } from 'react';
import api from '../services/api.jsx';

const formatTime = (value) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const formatQuantity = (item) => `${Number(item.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${item.unidadeVenda || 'un'}`;

export default function Kitchen() {
  const [comandas, setComandas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  const buscarComandas = useCallback(async () => {
    try {
      const response = await api.get('/comandas/cozinha');
      setComandas(response.data || []);
      setErro(false);
    } catch (error) {
      // Detalhe tecnico fica apenas no console; a tela mostra mensagem amigavel.
      console.error('Falha ao carregar comandas da cozinha:', error);
      setComandas([]);
      setErro(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // O agendamento evita a renderizacao em cascata do primeiro carregamento.
    const inicial = window.setTimeout(buscarComandas, 0);
    const interval = window.setInterval(buscarComandas, 15000);
    return () => {
      window.clearTimeout(inicial);
      window.clearInterval(interval);
    };
  }, [buscarComandas]);

  const tentarNovamente = () => {
    setLoading(true);
    buscarComandas();
  };

  const totalItens = comandas.reduce((total, comanda) => total + (comanda.itens?.length || 0), 0);

  return (
    <div className="kitchen-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Produção do momento</span>
          <h1>Cozinha</h1>
          <p>Itens marcados como A Fazer nas comandas em aberto.</p>
        </div>
        <span className="badge badge--primary">{totalItens} {totalItens === 1 ? 'item' : 'itens'}</span>
      </header>

      {loading ? (
        <div className="card">
          <div className="state" role="status" aria-live="polite">
            <span className="state__text">Carregando comandas...</span>
          </div>
        </div>
      ) : erro ? (
        <div className="card">
          <div className="state state--error" role="alert" aria-live="assertive">
            <span className="state__icon" aria-hidden="true">⚠️</span>
            <span className="state__title">Não foi possível carregar os pedidos da cozinha</span>
            <span className="state__text">
              Verifique a conexão e tente novamente. Os detalhes técnicos foram registrados no console.
            </span>
            <div className="state__actions">
              <button type="button" className="btn-primary" onClick={tentarNovamente}>Tentar novamente</button>
            </div>
          </div>
        </div>
      ) : comandas.length === 0 ? (
        <div className="card">
          <div className="state">
            <span className="state__icon" aria-hidden="true">🍳</span>
            <span className="state__title">Nenhum preparo pendente</span>
            <span className="state__text">Novos itens A Fazer aparecerão aqui automaticamente.</span>
          </div>
        </div>
      ) : (
        <div className="kitchen-grid">
          {comandas.map((comanda) => (
            <article className="card kitchen-card" key={comanda._id}>
              <div className="kitchen-card__head">
                <div className="row" style={{ gap: 8 }}>
                  <span className="badge badge--neutral">
                    <span aria-hidden="true">{comanda.tipoAtendimento === 'balcao' ? '📦' : '🪑'}</span>
                    {comanda.tipoAtendimento === 'balcao' ? 'Balcão' : `Mesa ${comanda.mesa || '—'}`}
                  </span>
                  <span className="kitchen-card__numero">#{comanda.numero}</span>
                </div>
                <time className="muted">{formatTime(comanda.createdAt)}</time>
              </div>

              <p className="kitchen-card__cliente">{comanda.clienteNome || 'Cliente não identificado'}</p>

              <ul className="kitchen-items">
                {(comanda.itens || []).map((item) => (
                  <li className="kitchen-item" key={item._id}>
                    <span className="kitchen-item__qtd">{formatQuantity(item)}</span>
                    <span className="kitchen-item__nome">{item.nome}</span>
                    {item.modificadores?.length ? <span className="kitchen-item__mods">{item.modificadores.join(' · ')}</span> : null}
                  </li>
                ))}
              </ul>

              {comanda.observacao && (
                <p className="kitchen-note"><strong>Observação:</strong> {comanda.observacao}</p>
              )}

              <p className="kitchen-pending">
                <span className="dot" aria-hidden="true" />
                {comanda.tipoAtendimento === 'balcao'
                  ? `Balcão · ${comanda.statusBalcao || 'aguardando'}`
                  : 'Pendente até concluir a comanda'}
              </p>
            </article>
          ))}
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .kitchen-page { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
  .kitchen-page, .kitchen-page * { box-sizing: border-box; }

  .kitchen-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--space-2);
  }
  .kitchen-grid > * { min-width: 0; }

  .kitchen-card { gap: var(--space-1); }
  .kitchen-card__head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-1); flex-wrap: wrap; }
  .kitchen-card__numero { font-size: 16px; font-weight: 700; color: var(--color-primary-hover); }
  .kitchen-card__cliente { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-text); overflow-wrap: anywhere; }

  .kitchen-items { display: grid; gap: var(--space-1); margin: 0; padding: 0; list-style: none; }
  .kitchen-item {
    display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px var(--space-1);
    padding: 10px var(--space-1); min-width: 0;
    background: var(--color-page); border-radius: var(--radius-sm);
  }
  .kitchen-item__qtd { font-size: 14px; font-weight: 700; color: var(--color-primary-hover); white-space: nowrap; }
  .kitchen-item__nome { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
  .kitchen-item__mods { grid-column: 2; font-size: 12px; color: var(--color-text-secondary-aa); }

  .kitchen-note {
    margin: 0; padding: 10px var(--space-1); font-size: 12px; color: var(--color-text);
    background: var(--color-warning-bg); border-left: 3px solid var(--color-warning); border-radius: var(--radius-sm);
    overflow-wrap: anywhere;
  }

  .kitchen-pending {
    display: flex; align-items: center; gap: 8px; margin: 0;
    font-size: 12px; font-weight: 600; color: var(--color-warning-dark);
  }
  .kitchen-pending .dot { background: var(--color-warning); }
`;
