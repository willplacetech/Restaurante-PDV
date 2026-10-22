import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import Layout from '../../components/Layout.jsx';

const STATUS_PEDIDO = {
  pendente: 'Aguardando',
  confirmado: 'Confirmado',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const FORMAS_PAGAMENTO = ['dinheiro', 'pix', 'credito', 'debito'];

export default function Atendimento() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [pesquisa, setPesquisa] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [comandaAtual, setComandaAtual] = useState(null);
  const [itensComanda, setItensComanda] = useState([]);
  const [total, setTotal] = useState(0);
  const [aberto, setAberto] = useState(false);

  const carregarPedidos = useCallback(async () => {
    try {
      const res = await api.get('/pedidos?status=pendente');
      setPedidos(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar pedidos:', err);
      showToast('Erro ao carregar pedidos', 'error');
    }
  }, []);

  const carregarComanda = useCallback(async (id) => {
    try {
      const res = await api.get(`/comandas/${id}`);
      setComandaAtual(res.data);
      setItensComanda(res.data?.itens || []);
      setTotal(Number(res.data?.total || 0) || 0);
      setAberto(true);
    } catch (err) {
      console.error('Erro ao carregar comanda:', err);
      showToast('Erro ao carregar comanda', 'error');
    }
  }, []);

  const adicionarItem = useCallback(async (item) => {
    const itensAtualizados = [...itensComanda, item];
    setItensComanda(itensAtualizados);
    
    const { data } = await api.post('/pedidos', {
      itens: itensAtualizados.map(i => ({ nome: i.nome, quantidade: i.quantidade, preco: i.preco })),
      total: total + item.preco,
      formaPagamento: 'dinheiro',
      atendente: user?.username,
    });
    
    setTotal((total + item.preco));
    setItensComanda(itensAtualizados);
    showToast('Item adicionado ao pedido', 'success');
  }, []);

  const removerItem = useCallback((index) => {
    const itensRestantes = itensComanda.filter((_, i) => i !== index);
    setItensComanda(itensRestantes);
    setTotal(itensRestantes.reduce((s, i) => s + i.preco, 0));
    showToast('Item removido', 'info');
  }, []);

  const finalizarVenda = useCallback(async () => {
    if (!comandaAtual || total <= 0) return;
    
    try {
      await api.post('/vendas', {
        comandaId: comandaAtual._id,
        itens: itensComanda,
        total,
        formaPagamento: 'dinheiro',
        atendente: user?.username,
      });
      
      showToast('Venda finalizada com sucesso!', 'success');
      setComandaAtual(null);
      setItensComanda([]);
      setTotal(0);
      setAberto(false);
      carregarPedidos();
      navigate('/pdv');
    } catch (err) {
      console.error('Erro ao finalizar venda:', err);
      showToast('Erro ao finalizar venda', 'error');
    }
  }, [comandaAtual, total, navigate, carregarPedidos]);

  useEffect(() => {
    carregarPedidos();
  }, [carregarPedidos]);

  return (
    <Layout title="Atendimento">
      <div className="atendimento-container">
        <header className="atendimento-header">
          <h1>🏪 Atendimento PDV</h1>
          <p>Usuário: {user?.username || 'Convidado'}</p>
        </header>

        <section className="atendimento-busca">
          <div className="input-group">
            <input
              type="text"
              placeholder="Buscar pedido ou mesa..."
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              disabled={aberto}
            />
            <button onClick={carregarPedidos} disabled={aberto}>
              Atualizar
            </button>
          </div>
        </section>

        {aberto && (
          <section className="atendimento-comanda">
            <h2>Comanda Atual - #{comandaAtual?.numero || 'N/A'}</h2>
            <p>Atendente: {comandaAtual?.atendente || user?.username}</p>
            
            {itensComanda.length === 0 ? (
              <p className="empty-state">Nenhum item no pedido</p>
            ) : (
              <div className="itens-lista">
                {itensComanda.map((item, idx) => (
                  <div key={idx} className="item-linha">
                    <span className="item-nome">{item.nome}</span>
                    <span className="item-quantidade">{item.quantidade}x</span>
                    <span className="item-preco">{formatMoney(item.preco)}</span>
                    <button
                      className="item-remover"
                      onClick={() => removerItem(idx)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="resumo-pedido">
              <div>Itens: {itensComanda.length}</div>
              <div>Total: {formatMoney(total)}</div>
            </div>
          </section>
        )}

        {!aberto && (
          <section className="atendimento-pedidos">
            <h2>Pedidos Pendentes</h2>
            {pedidos.length === 0 ? (
              <p className="empty-state">Nenhum pedido pendente</p>
            ) : (
              <div className="pedidos-lista">
                {pedidos.map((pedido) => (
                  <div key={pedido._id} className="pedido-item" onClick={() => carregarComanda(pedido._id)}>
                    <span className="pedido-status">{pedido.status}</span>
                    <span className="pedido-detalhes">
                      #{pedido.numero} • {pedido.clienteNome || 'Cliente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {aberto && (
          <section className="atendimento-acoes">
            <div className="acoes-grid">
              <button
                className="btn-acao"
                onClick={finalizarVenda}
                disabled={total <= 0}
              >
                <span>💰 Finalizar Venda</span>
              </button>
              <button
                className="btn-acao"
                onClick={() => setComandaAtual(null)}
                disabled={total <= 0}
              >
                <span>⟲ Nova Comanda</span>
              </button>
              <button
                className="btn-acao"
                onClick={carregarPedidos}
              >
                <span>🔄 Atualizar</span>
              </button>
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}

function formatMoney(value) {
  return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
}