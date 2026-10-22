import { useState, useEffect } from 'react';
import api from '../services/api.jsx';
import { useToast } from '../components/Toast.jsx';

const NoveltiesModal = ({ onClose }) => {
  const [novelties, setNovelties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const loadNovelties = async () => {
      try {
        const response = await api.get('/products', {
          params: { type: 'venda', status: 'ativo' }
        });
        setNovelties(response.data || []);
      } catch {
        showToast('Erro ao carregar novelties', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadNovelties();
  }, [showToast]);

  const toggleModal = () => setShowModal(!showModal);

  return (
    <div>
      {/* Botão para abrir modal de novelties */}
      <button
        onClick={toggleModal}
        style={{
          padding: '8px 16px',
          background: 'var(--accent-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 16
        }}
      >
        🆕 Novelties / Novidades
      </button>

      {showModal && (
        <div onClick={toggleModal} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            borderRadius: 16, padding: 24, width: '100%', maxWidth: 500, maxHeight: 'calc(100vh - 40px)',
            overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--accent-primary)' }}>🆕 Novelties / Novidades</h3>
            
            {loading ? (
              <p>Carregando novelties...</p>
            ) : novelties.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                Nenhuma novidade cadastrada
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                {novelties.map((product) => (
                  <div
                    key={product._id}
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 12,
                      padding: 16,
                      textAlign: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ width: 80, height: 80, background: 'var(--border-light)', borderRadius: 12, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--text-secondary)' }}>
                      Ⓝ
                    </div>
                    <h4 style={{ fontSize: 14, fontWeight: 600, margin: '4px 0 2px' }}>{product.nome}</h4>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0' }}>
                      R$ {Number(product.precoVenda || 0).toFixed(2).replace('.', ',')}
                    </p>
                    <button
                      onClick={() => onClose && onClose(product)}
                      style={{
                        marginTop: 8, padding: '6px 12px',
                        background: 'var(--accent-primary)', color: '#fff',
                        border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer'
                      }}
                    >
                      Ver detalhes
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NoveltiesModal;