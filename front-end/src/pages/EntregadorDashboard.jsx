import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { SearchableSelect } from '../components/SearchableSelect.jsx';
import api from '../services/api.jsx';

const STATUS_NOMES = {
  pendente: 'Pendente',
  pronto: 'Pronto',
  despachado: 'Despachado',
  a_caminho: 'A caminho',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export default function EntregadorDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [statusFiltro, setStatusFiltro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const erroRef = useRef(null);

  useEffect(() => {
    if (!user) return navigate('/login');
  }, [user]);

  const carregarPedidos = async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/entregas/pedidos', {
        pdvSilenciosa: true,
        params: { status: statusFiltro || undefined },
      });
      setPedidos(data.pedidos || data.data || []);
    } catch (err) {
      setErro('Erro ao carregar pedidos');
      console.error(err);
    } finally {
      setCarregando(false);
    }
  };

  const atualizarStatus = async (pedidoId, novoStatus) => {
    setAtualizando(true);
    try {
      await api.post(`/entregas/pedidos/${pedidoId}/pronto`, {});
      setPedidos(pedidos.map((p) => (p._id === pedidoId ? { ...p, status: novoStatus } : p)));
      const toastKey = novoStatus === 'pronto' ? 'status' : 'sucesso';
      setToast(toastKey, `Pedido marcado como ${novoStatus}.`);
    } catch (err) {
      console.error(err);
      setErro('Erro ao atualizar status');
    } finally {
      setAtualizando(false);
    }
  };

  const filtrarPorStatus = (pedido) => {
    if (!statusFiltro) return true;
    return pedido.status === statusFiltro;
  };

  if (!user || user.role !== 'entregador') {
    return null;
  }

  useEffect(() => {
    const intervalo = setInterval(carregarPedidos, 10000);
    return () => clearInterval(intervalo);
  }, [carregarPedidos]);

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

      <section className="delivery-stats" aria-label="Resumo das entregas">
        const statusCounts = useMemo(
          () => {
            const counts = { pendente: 0, pronto: 0, despachado: 0, a_caminho: 0, entregue: 0, cancelado: 0 };
            pedidos.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
            return counts;
          },
          [pedidos]
        );

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
                const minutos = Math.floor(
                  (new Date().getTime() - new Date(pedido.criadoEm).getTime()) / 60000
                );
                const isPronto = pedido.status === 'pronto';
                const podeAtualizar = !['entregue', 'cancelado'].includes(pedido.status);

                return (
                  <article
                    className={`delivery-card delivery-order ${minutos >= 20 ? 'vermelho' : minutos >= 10 ? 'amarelo' : ''}`}
                    key={pedido._id}
                  >
                    <span className="delivery-badge">{STATUS_NOMES[pedido.status]}</span>
                    <p className="delivery-muted">
                      Ha {minutos} min {new Date(pedido.criadoEm).toLocaleString('pt-BR')}
                    </p>
                    <h3>{pedido.origem.nomeCliente}</h3>
                    <p className="delivery-muted">
                      {pedido.origem.endereco.rua}, {pedido.origem.endereco.numero}
                      {pedido.origem.endereco.bairro}
                      {pedido.origem.endereco.complemento && ` ${pedido.origem.endereco.complemento}`}
                    </p>
                    <p>
                      <strong>{pedido.valorTotal} + {pedido.taxaEntrega} de entrega</strong>
                    </p>
                    {pedido.entregadorId && (
                      <p className="delivery-muted">Entregador: {pedido.entregadorId.nome}</p>
                    )}

                    {podeAtualizar && (
                      <>
                        {isPronto && (
                          <button disabled={atualizando} onClick={() => atualizarStatus(pedido._id, 'despachado')}>
                            Despachar
                          </button>
                        )}

                        {!isPronto && (
                          <button disabled={atualizando} onClick={() => atualizarStatus(pedido._id, 'pronto')}>
                            Marcar como pronto
                          </button>
                        )}
                      </>
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