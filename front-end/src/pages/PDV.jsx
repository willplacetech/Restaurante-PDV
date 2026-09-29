import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';

export default function PDV() {
  const { user } = useAuth();
  const [produtos, setProdutos] = useState([]);
  const [itens, setItens] = useState([]);
  const [cliente, setCliente] = useState('');
  const [observacao, setObservacao] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const carregarProdutos = useCallback(async () => {
    try {
      const { data } = await api.get('/produtos?tipo=venda&ativo=true');
      setProdutos(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { carregarProdutos(); }, [carregarProdutos]);

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
      setMsg('Pedido finalizado com sucesso!');
      setItens([]);
      setCliente('');
      setObservacao('');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg('Erro ao finalizar pedido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>🛒 PDV - Nova Venda</h1>

      {msg && (
        <div style={{
          padding: 12, borderRadius: 10, marginBottom: 16,
          background: msg.includes('sucesso') ? '#d4edda' : '#f8d7da',
          color: msg.includes('sucesso') ? '#155724' : '#721c24',
          fontWeight: 600,
        }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Lista de produtos */}
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Produtos</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 500, overflowY: 'auto' }}>
            {produtos.map((p) => (
              <button
                key={p._id}
                type="button"
                onClick={() => adicionarItem(p)}
                style={{
                  padding: '10px 14px', borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  cursor: 'pointer', textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 600 }}>{p.nome}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  R$ {p.preco.toFixed(2)} {p.unidadeVenda !== 'un' ? `/${p.unidadeVenda}` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Carrinho */}
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Pedido</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
            {itens.map((item, idx) => (
              <div key={idx} style={{
                padding: 12, borderRadius: 10,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.nome}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    R$ {item.precoUnitario.toFixed(2)} x {item.quantidade} {item.unidadeVenda}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={item.quantidade}
                    onChange={(e) => alterarQuantidade(idx, e.target.value)}
                    style={{ width: 70, padding: 6, borderRadius: 8, border: '1px solid var(--border-color)' }}
                  />
                  <button type="button" onClick={() => removerItem(idx)} style={{
                    background: 'var(--error-bg)', color: 'var(--error-text)',
                    border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
                  }}>✕</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-secondary)', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Cliente:</span>
              <input
                type="text"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nome do cliente"
                style={{ padding: 6, borderRadius: 8, border: '1px solid var(--border-color)', width: 200 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total:</span>
              <strong style={{ fontSize: 18 }}>R$ {total.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => finalizarPedido('pix')} disabled={loading || !itens.length} style={{
                flex: 1, padding: 12, borderRadius: 10, border: 'none',
                background: '#00b894', color: '#fff', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14,
              }}>
                💰 PIX
              </button>
              <button type="button" onClick={() => finalizarPedido('dinheiro')} disabled={loading || !itens.length} style={{
                flex: 1, padding: 12, borderRadius: 10, border: 'none',
                background: '#6c5ce7', color: '#fff', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14,
              }}>
                💵 Dinheiro
              </button>
              <button type="button" onClick={() => finalizarPedido('credito_loja')} disabled={loading || !itens.length} style={{
                flex: 1, padding: 12, borderRadius: 10, border: 'none',
                background: '#0984e3', color: '#fff', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14,
              }}>
                💳 Cartão
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}