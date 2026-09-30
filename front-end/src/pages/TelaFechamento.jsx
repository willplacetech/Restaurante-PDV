import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { useFilaOffline } from '../hooks/useFilaOffline';
import StatusConexao from '../components/StatusConexao';

const formatMoney = (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;

const FORMAS_PAGAMENTO = [
  { tipo: 'dinheiro', rotulo: 'Dinheiro', icone: '💵' },
  { tipo: 'pix', rotulo: 'Pix', icone: '⚡' },
  { tipo: 'credito_loja', rotulo: 'Cartão', icone: '💳' },
];

export default function TelaFechamento() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { addToQueue, isOnline } = useFilaOffline();

  const [comanda, setComanda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagando, setPagando] = useState(false);
  const [pagamentoSelecionado, setPagamentoSelecionado] = useState(null);
  const [valorRecebido, setValorRecebido] = useState('');
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    const carregarComanda = async () => {
      try {
        const res = await api.get(`/comandas/${id}`);
        setComanda(res.data);
      } catch (err) {
        console.error('Erro ao carregar comanda:', err);
        showToast('Erro ao carregar comanda', 'error');
        navigate('/atendimento/mesas');
      } finally {
        setLoading(false);
      }
    };
    carregarComanda();
  }, [id, navigate, showToast]);

  const total = comanda ? Number(comanda.total || 0) : 0;
  const saldoDevedor = total - (comanda?.pago || 0);
  const troco = pagamentoSelecionado === 'dinheiro' ? Math.max(0, Number(valorRecebido || 0) - total) : 0;

  const handlePagamento = async (forma) => {
    if (saldoDevedor <= 0) return;
    if (forma.tipo === 'dinheiro' && Number(valorRecebido) < saldoDevedor) {
      showToast('Valor recebido deve ser maior ou igual ao total', 'error');
      return;
    }

    setPagando(true);
    try {
      const vendaData = {
        comandaId: id,
        itens: comanda.itens || [],
        total: total,
        formaPagamento: forma.tipo,
        valorRecebido: forma.tipo === 'dinheiro' ? Number(valorRecebido) : total,
        observacao,
        atendente: user?.username,
      };

      if (!isOnline) {
        const idTemporario = addToQueue(vendaData);
        showToast(`✅ Sem internet — venda salva! (${idTemporario}) Envia automaticamente quando voltar.`, 'success');
        navigate('/atendimento/mesas');
        return;
      }

      await api.post('/vendas', { ...vendaData, idTemporario: `tmp_${Date.now()}` });
      showToast('Venda finalizada com sucesso!', 'success');
      navigate('/atendimento/mesas');
    } catch (err) {
      console.error('Erro ao finalizar venda:', err);
      if (err.response?.status === 409) {
        showToast('Venda já processada (duplicata evitada)', 'warning');
        navigate('/atendimento/mesas');
      } else {
        showToast(err.response?.data?.msg || 'Erro ao finalizar venda', 'error');
      }
    } finally {
      setPagando(false);
    }
  };

  if (loading) {
    return (
      <div className="fechamento-loading" role="status" aria-live="polite">
        <div className="spinner"></div>
        <p>Carregando comanda...</p>
      </div>
    );
  }

  if (!comanda) return null;

  return (
    <div className="fechamento-page">
      <StatusConexao />

      <header className="page-heading">
        <div>
          <h1>💰 Fechamento</h1>
          <p>Comanda #{comanda.numero} • {comanda.clienteNome || 'Cliente não identificado'}</p>
        </div>
      </header>

      <div className="fechamento-grid">
        <section className="card fechamento-resumo" aria-labelledby="resumo-titulo">
          <h2 className="card-title" id="resumo-titulo">Resumo</h2>

          <ul className="fechamento-itens">
            {(comanda.itens || []).map((item, idx) => (
              <li key={idx} className="fechamento-item">
                <div className="fechamento-item__info">
                  <span className="fechamento-item__nome">{item.nome}</span>
                  <span className="fechamento-item__meta">
                    {item.quantidade}x {formatMoney(item.precoUnitario)}
                  </span>
                </div>
                <span className="fechamento-item__total">
                  {formatMoney(item.precoUnitario * item.quantidade)}
                </span>
              </li>
            ))}
          </ul>

          <div className="fechamento-totais">
            <div className="fechamento-total__linha">
              <span>Subtotal</span>
              <span>{formatMoney(comanda.subtotal || total)}</span>
            </div>
            {(comanda.desconto || 0) > 0 && (
              <div className="fechamento-total__linha fechamento-total__desconto">
                <span>Desconto</span>
                <span>-{formatMoney(comanda.desconto)}</span>
              </div>
            )}
            <div className="fechamento-total__linha fechamento-total__final">
              <span>Total</span>
              <strong>{formatMoney(total)}</strong>
            </div>
          </div>
        </section>

        <section className="card fechamento-pagamento" aria-labelledby="pagamento-titulo">
          <h2 className="card-title" id="pagamento-titulo">Pagamento</h2>

          <div className="field">
            <label className="label" htmlFor="forma-pagamento">Forma de pagamento</label>
            <div className="pagamento-opcoes" role="radiogroup" aria-label="Forma de pagamento">
              {FORMAS_PAGAMENTO.map((forma) => (
                <button
                  key={forma.tipo}
                  type="button"
                  role="radio"
                  aria-checked={pagamentoSelecionado === forma.tipo}
                  className={`pagamento-opcao ${pagamentoSelecionado === forma.tipo ? 'pagamento-opcao--selected' : ''}`}
                  onClick={() => setPagamentoSelecionado(forma.tipo)}
                  disabled={pagando}
                >
                  <span aria-hidden="true">{forma.icone}</span>
                  <span>{forma.rotulo}</span>
                </button>
              ))}
            </div>
          </div>

          {pagamentoSelecionado === 'dinheiro' && (
            <div className="field">
              <label className="label" htmlFor="valor-recebido">Valor recebido</label>
              <input
                id="valor-recebido"
                type="number"
                step="0.01"
                min={saldoDevedor}
                value={valorRecebido}
                onChange={(e) => setValorRecebido(e.target.value)}
                placeholder={`Mínimo ${formatMoney(saldoDevedor)}`}
                className="valor-recebido-input"
                disabled={pagando}
                autoFocus
              />
              <div className="troco-display">
                Troco: <strong>{formatMoney(troco)}</strong>
              </div>
            </div>
          )}

          <div className="field">
            <label className="label" htmlFor="observacao">Observação (opcional)</label>
            <input
              id="observacao"
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Cliente pediu nota fiscal"
              disabled={pagando}
            />
          </div>

          <div className="fechamento-acoes">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/atendimento/mesas')}
              disabled={pagando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary btn-primary--large"
              onClick={() => pagamentoSelecionado && handlePagamento(FORMAS_PAGAMENTO.find(f => f.tipo === pagamentoSelecionado))}
              disabled={pagando || !pagamentoSelecionado || (pagamentoSelecionado === 'dinheiro' && Number(valorRecebido) < saldoDevedor)}
            >
              {pagando ? 'Processando...' : `Finalizar • ${formatMoney(total)}`}
            </button>
          </div>

          {!isOnline && (
            <div className="fechamento-offline-notice" role="alert">
              <span aria-hidden="true">📴</span>
              <span>Você está offline. A venda será salva localmente e enviada automaticamente quando a internet voltar.</span>
            </div>
          )}
        </section>
      </div>

      <style>{`
        .fechamento-page { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; max-width: 100%; }
        .fechamento-grid { display: grid; grid-template-columns: 1fr; gap: var(--space-2); min-width: 0; }
        .fechamento-resumo, .fechamento-pagamento { min-width: 0; }
        .fechamento-itens { display: grid; gap: var(--space-1); margin: 0; padding: 0; list-style: none; }
        .fechamento-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-1); padding: var(--space-1); background: var(--color-page); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
        .fechamento-item__info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .fechamento-item__nome { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
        .fechamento-item__meta { font-size: 12px; color: var(--color-text-secondary-aa); }
        .fechamento-item__total { font-size: 14px; font-weight: 700; color: var(--color-primary-hover); font-variant-numeric: tabular-nums; white-space: nowrap; }
        .fechamento-totais { display: flex; flex-direction: column; gap: 6px; padding-top: var(--space-1); border-top: 1px solid var(--color-border); }
        .fechamento-total__linha { display: flex; justify-content: space-between; gap: var(--space-1); font-size: 14px; }
        .fechamento-total__desconto { color: var(--color-success); }
        .fechamento-total__final { font-size: 18px; font-weight: 700; color: var(--color-primary-hover); padding-top: 4px; border-top: 1px solid var(--color-border); }
        .pagamento-opcoes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-1); }
        .pagamento-opcao { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: var(--space-2); background: var(--color-card); border: 2px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; transition: border-color 0.15s, background-color 0.15s; }
        .pagamento-opcao:hover { border-color: var(--color-primary); background: var(--color-page); }
        .pagamento-opcao--selected { border-color: var(--color-primary); background: var(--color-primary-bg); }
        .pagamento-opcao:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
        .valor-recebido-input { font-size: 18px; font-weight: 700; text-align: right; }
        .troco-display { margin-top: 8px; font-size: 14px; color: var(--color-text-secondary-aa); }
        .troco-display strong { color: var(--color-primary-hover); font-size: 16px; }
        .fechamento-acoes { display: flex; gap: var(--space-1); margin-top: var(--space-1); }
        .fechamento-acoes button { flex: 1; min-height: 48px; }
        .btn-primary--large { font-size: 16px; padding: 14px; }
        .fechamento-offline-notice { display: flex; align-items: center; gap: 8px; margin-top: var(--space-2); padding: var(--space-2); background: var(--color-warning-bg); border: 1px solid var(--color-warning); border-radius: var(--radius-sm); color: var(--color-warning-dark); font-size: 13px; }
        .fechamento-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; gap: 16px; color: var(--color-text-secondary); }
        .spinner { width: 32px; height: 32px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 900px) { .fechamento-grid { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); } }
      `}</style>
    </div>
  );
}