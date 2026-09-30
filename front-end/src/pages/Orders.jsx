import { useState, useEffect, useMemo } from 'react';
import api from '../services/api.jsx';
import { useToast } from '../components/Toast.jsx';
import NfceEmissionModal from '../components/NfceEmissionModal.jsx';

export default function Orders() {
  const [pedidos, setPedidos] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [carregando, setCarregando] = useState(true);
  const [cancelando, setCancelando] = useState(false);
  const { showToast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const carregar = async () => {
      setCarregando(true);
      try {
        const url = filtroStatus === 'todos' 
          ? '/orders' 
          : `/orders?status=${filtroStatus}`;
        const res = await api.get(url);
        setPedidos(res.data || []);
      } catch (err) {
        console.error('Erro ao carregar pedidos:', err);
        setPedidos([]);
      } finally {
        setCarregando(false);
      }
    };
    
    carregar();
  }, [filtroStatus]);

  const cancelarPedido = async (pedidoId) => {
    if (!window.confirm('Tem certeza que deseja cancelar este pedido? O estoque será devolvido automaticamente.')) {
      return;
    }

    setCancelando(true);
    try {
      await api.patch(`/orders/${pedidoId}/cancelar`);
      showToast('Pedido cancelado com sucesso. Estoque devolvido.', 'success');
      setSelecionado(null);
      carregar(); // Recarrega a lista para atualizar o status
    } catch (err) {
      console.error('Erro ao cancelar pedido:', err);
      showToast(err.response?.data?.msg || 'Erro ao cancelar pedido. Tente novamente.', 'error');
    } finally {
      setCancelando(false);
    }
  };

  const podeCancelar = (status) => {
    return ['pendente', 'parcial'].includes(status);
  };

  const totalVendido = useMemo(() => {
    if (!Array.isArray(pedidos) || pedidos.length === 0) return 0;
    const soma = pedidos.reduce((soma, p) => {
      const valor = parseFloat(
        p.total || 
        p.valorTotal || 
        p.totalPedido || 
        p.valor || 
        p.subtotal || 
        0
      ) || 0;
      return ac + valor;
    }, 0);
    return soma;
  }, [pedidos]);

  const getStatusInfo = (status) => {
    const map = {
      pendente: { cor: 'var(--warning-bg)', texto: 'Pendente' },
      pago: { cor: 'var(--success-bg)', texto: 'Pago' },
      parcial: { cor: 'var(--info-bg)', texto: 'Parcial' },
      cancelado: { cor: 'var(--error-bg)', texto: 'Cancelado' }
    };
    return map[status] || { cor: 'var(--text-tertiary)', texto: status || '—' };
  };

  const getNfceStatus = (nfce) => {
    if (!nfce) return 'nao_emitida';
    return nfce.status;
  };

  return (
    <div>
      <div className="page-heading">
        <div>
          <h1>📋 Histórico de Pedidos</h1>
          <p>Acompanhe todas as vendas realizadas</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { valor: 'todos', label: '📋 Todos' },
          { valor: 'pendente', label: '⏳ Pendentes' },
          { valor: 'parcial', label: '💰 Parciais' },
          { valor: 'pago', label: '✅ Pagos' },
          { valor: 'cancelado', label: '❌ Cancelados' }
        ].map(item => (
          <button
            key={item.valor}
            onClick={() => setFiltroStatus(item.valor)}
            style={{
              padding: '6px 14px', borderRadius: '20px', border: 'none',
              fontSize: '12px', fontWeight: filtroStatus === item.valor ? '700' : '500',
              cursor: 'pointer', transition: 'all 0.2s',
              background: filtroStatus === item.valor ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: filtroStatus === item.valor ? '#fff' : 'var(--text-secondary)'
            }}
          >
            {item.label}
          </button>
        }));
      </div>

      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            Pedidos
            <span style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              {pedidos.length}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total vendido:</span>
            <span style={{ fontWeight: 700, color: 'var(--success-bg)', fontSize: 16 }}>
              {carregando ? (
                <span style={{ color: 'var(--text-tertiary)' }}>Carregando...</span>
              ) : (
                `R$ ${totalVendido.toFixed(2).replace('.', ',')}`
              )}
            </span>
          </div>
        </div>
        
        {carregando ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            ⏳ Carregando pedidos...
          </div>
        ) : (
          <div style={{ overflowX: 'auto', margin: '0 -16px', padding: '0 16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['Nº', 'Data', 'Status', 'Cliente', 'Itens', 'Total', 'Ver'].map(h => (
                    <th key={h} style={{ padding: '10px 8px', textAlign: ['Total','Ver'].includes(h) ? 'right' : 'left', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    {h}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pedidos.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)', fontSize: 13 }}>
                    Nenhum pedido realizado
                  </td></tr>
                ) : pedidos.slice(0, 100).map(p => {
                  const statusInfo = getStatusInfo(p.status);
                  const valorTotal = Number(p?.total || p?.valorTotal || p?.subtotal || 0);
                  
                  return (
                    <tr key={p._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>
                        #{p.numero}
                      </td>
                      <td style={{ padding: '10px 8px', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {new Date(p.createdAt).toLocaleDateString('pt-BR')} {new Date(p.createdAt).toLocaleTimeString('pt-BR').slice(0, 5)}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: `${statusInfo.cor}15`, color: statusInfo.cor, whiteSpace: 'nowrap' }}>
                          {statusInfo.texto}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', fontSize: 13 }}>
                        <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: 'var(--bg-tertiary)' }}>
                          {p.clienteNome}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 13 }}>
                        {p.itens?.length || 0}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        R$ {valorTotal.toFixed(2).replace('.', ',')}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        <button 
                          onClick={() => setSelecionado(p)} 
                          style={{
                            padding: '6px 14px', 
                            background: 'var(--accent-light)', 
                            color: 'var(--accent-primary)', 
                            border: '1px solid var(--accent-border)', 
                            borderRadius: 8, 
                            fontSize: 12, 
                            fontWeight: 600, 
                            cursor: 'pointer', 
                            minHeight: 34
                          }}>
                          Detalhes
                        </button>
                        
                        {/* NFC Button */}
                        {getNfceStatus(p.nfce) !== 'emitida' && (
                          <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelecionado(p);
                            }}
                            style={{
                              padding: '6px 14px', 
                              background: 'var(--accent-light)', 
                              color: 'var(--accent-primary)', 
                              border: '1px solid var(--accent-border)', 
                              borderRadius: 8, 
                              fontSize: 12, 
                              fontWeight: 600, 
                              cursor: 'pointer', 
                              minHeight: 34,
                              marginLeft: 8
                            }}>
                            📄 Emitir NFC-e
                          </button>
                        )}
                        
                        {/* NFC-e Status */}
                        {p.nfce && (
                          <span style={{
                            padding: '3px 8px', 
                            borderRadius: '12px', 
                            fontSize: '11px', 
                            fontWeight: 600, 
                            background: 'var(--bg-tertiary)', 
                            color: 'var(--text-secondary)',
                            marginLeft: 8
                          }}>
                            NFC-e: {p.nfce.numero || 'Não emitida'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                });
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );
}