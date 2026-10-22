import { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import api from '../services/api.jsx';

const STATUS_NOMES = {
  pendente: 'Pendente',
  pronto: 'Pronto',
  despachado: 'Despachado',
  a_caminho: 'A caminho',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};
const PROXIMO_STATUS = {
  despachado: { status: 'a_caminho', label: 'Iniciar entrega' },
  a_caminho: { status: 'entregue', label: 'Marcar como entregue' },
};
const formatarMoeda = (valor) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function EntregadorDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [pedidos, setPedidos] = useState([]);
  const [statusFiltro, setStatusFiltro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [agora, setAgora] = useState(Date.now);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  const carregarPedidos = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/delivery/pedidos', {
        pdvSilenciosa: true,
        params: { status: statusFiltro || undefined },
      });
      setPedidos(Array.isArray(data) ? data : data.pedidos || data.data || []);
      setAgora(Date.now());
      setErro('');
    } catch (err) {
      console.error(err);
      setErro(err.response?.data?.msg || 'Erro ao carregar pedidos.');
    } finally {
      setCarregando(false);
    }
  }, [statusFiltro]);

  const atualizarStatus = async (pedidoId, novoStatus) => {
    setAtualizando(true);
    try {
      await api.post(`/delivery/pedidos/${pedidoId}/status`, { novoStatus });
      setPedidos((atuais) => atuais.map((p) => (p._id === pedidoId ? { ...p, status: novoStatus } : p)));
      setErro('');
      showToast(`Pedido marcado como ${STATUS_NOMES[novoStatus] || novoStatus}.`, 'success');
    } catch (err) {
      console.error(err);
      setErro(err.response?.data?.msg || 'Erro ao atualizar status.');
    } finally {
      setAtualizando(false);
    }
  };

  const filtrarPorStatus = (pedido) => {
    if (!statusFiltro) return true;
    return pedido.status === statusFiltro;
  };

  useEffect(() => {
    if (!user || user.role !== 'entregador') return undefined;

    const carregamentoInicial = setTimeout(() => void carregarPedidos(), 0);
    const intervalo = setInterval(() => void carregarPedidos(), 10000);
    return () => {
      clearTimeout(carregamentoInicial);
      clearInterval(intervalo);
    };
  }, [carregarPedidos, user]);

  const statusCounts = useMemo(() => {
    const counts = { pendente: 0, pronto: 0, despachado: 0, a_caminho: 0, entregue: 0, cancelado: 0 };
    pedidos.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return counts;
  }, [pedidos]);

  if (!user || user.role !== 'entregador') {
    return null;
  }

  return (
    <div className="delivery-app delivery-board">
      <header className="delivery-board-heading page-heading">
        <div>
          <span className="dashboard-eyebrow">MINHAS ENTREGAS</span>
          <h1>Entregador: {user.nome}</h1>
          <p>Acompanhe e atualize o status dos seus pedidos.</p>
        </div>
        <span className="delivery-muted" role="status">Atualização automática a cada 10 segundos</span>
      </header>

      {erro && <p className="delivery-error" role="alert">{erro}</p>}

      <section className="delivery-stats" aria-label="Resumo das entregas">
        <div className="delivery-card delivery-stat" key="pendente">
          <span>Pendentes</span><strong>{statusCounts.pendente}</strong>
        </div>
        <div className="delivery-card delivery-stat" key="pronto">
          <span>Pronto para despacho</span><strong>{statusCounts.pronto}</strong>
        </div>
        <div className="delivery-card delivery-stat" key="entregue">
          <span>Entregues</span><strong>{statusCounts.entregue}</strong>
        </div>
      </section>

      <section className="delivery-grid" aria-label="Minhas entregas">
        {carregando ? (
          <div className="delivery-card"><p>Carregando pedidos...</p></div>
        ) : pedidos.length === 0 ? (
          <div className="delivery-card">
            <p>Nenhum pedido encontrado.</p>
            {statusFiltro && <p>Tente ajustar o filtro de status.</p>}
          </div>
        ) : (
          <div className="delivery-grid-content">
            {pedidos
              .filter(filtrarPorStatus)
              .map((pedido) => {
                const criadoEm = new Date(pedido.criadoEm).getTime();
                const minutos = Number.isFinite(criadoEm)
                  ? Math.max(0, Math.floor((agora - criadoEm) / 60000))
                  : 0;
                const horarioPedido = Number.isFinite(criadoEm)
                  ? new Date(criadoEm).toLocaleString('pt-BR')
                  : 'Horário não informado';
                const proximoStatus = PROXIMO_STATUS[pedido.status];

                return (
                  <article
                    className={`delivery-card delivery-order ${minutos >= 20 ? 'vermelho' : minutos >= 10 ? 'amarelo' : ''}`}
                    key={pedido._id}
                  >
                    <span className="delivery-badge">{STATUS_NOMES[pedido.status]}</span>
                    <p className="delivery-muted">
                      Há {minutos} min {horarioPedido}
                    </p>
                    <h3>{pedido.origem?.nomeCliente || 'Cliente'}</h3>
                    <p className="delivery-muted">
                      {[pedido.origem?.endereco?.rua, pedido.origem?.endereco?.numero, pedido.origem?.endereco?.bairro, pedido.origem?.endereco?.complemento].filter(Boolean).join(', ') || 'Endereço não informado'}
                    </p>
                    <p>
                      <strong>{formatarMoeda(pedido.valorTotal)} + {formatarMoeda(pedido.taxaEntrega)} de entrega</strong>
                    </p>
                    {pedido.entregadorId && (
                      <p className="delivery-muted">Entregador: {pedido.entregadorId.nome}</p>
                    )}

                    {proximoStatus && (
                      <button disabled={atualizando} onClick={() => atualizarStatus(pedido._id, proximoStatus.status)}>
                        {proximoStatus.label}
                      </button>
                    )}

                    <a
                      href={`/pedido/${pedido.tokenRastreamento}`}
                      target="_blank"
                      rel="noreferrer"
                      className="delivery-secondary"
                    >
                      Ver rastreio
                    </a>
                  </article>
                );
              })}
          </div>
        )}
      </section>

      <footer className="delivery-footer">
        <button onClick={() => setStatusFiltro((s) => (s === '' ? 'pendente' : ''))}>
          Filtrar: {statusFiltro === '' ? 'Todos' : STATUS_NOMES[statusFiltro]}
        </button>
        <button onClick={() => setStatusFiltro((s) => (s === 'pronto' ? '' : 'pronto'))}>
          Apenas {statusFiltro === 'pronto' ? 'Pronto' : 'Pronto'}
        </button>
      </footer>
    </div>
  );
}