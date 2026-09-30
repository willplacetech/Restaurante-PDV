import { useState, useEffect } from 'react';
import api from '../services/api';

export default function PagamentoResultadoModal({
  titulo = 'Pagamento registrado',
  descricao,
  pedido,
  onPrint,
  onWhatsApp,
  onClose,
}) {
  const [isEmitting, setIsEmitting] = useState(false);
  const [nfceData, setNfceData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const emitNfce = async (cpfCliente = '', nomeCliente = '') => {
    setIsEmitting(true);
    setErrorMessage('');
    
    try {
      const response = await api.post(`/api/orders/${pedido.numero}/emitir-nfce`, {
        cpfCliente,
        nomeCliente,
      });
      
      setNfceData(response.data.nfce);
    } catch (error) {
      setErrorMessage(error.response?.data?.msg || 'Erro ao emitir NFC-e');
    } finally {
      setIsEmitting(false);
    }
  };

  useEffect(() => {
    if (nfceData) {
      const url = nfceData.linkDanfe;
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Ver DANFE';
      
      // Create QR code
      const qrContainer = document.createElement('div');
      qrContainer.style.marginTop = '16px';
      qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(nfceData.linkDanfe)}" alt="QR Code">`;
      
      // Update UI
      setNfceData(prev => ({
        ...prev,
        linkDanfe: url,
        qrCode: qrContainer.innerHTML,
      }));
    }
  }, [nfceData]);

  if (!pedido) return null;

  const hasNfce = nfceData?.status === 'emitida';
  const buttonDisabled = hasNfce;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(61, 47, 35, .45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 20
    }}>
      <div onClick={(event) => event.stopPropagation()} style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16,
        padding: 24, width: '100%', maxWidth: 360, textAlign: 'center'
      }}>
        <h3 style={{ margin: '0 0 8px' }}>✅ {titulo}</h3>
        <p style={{ margin: '0 0 18px', color: 'var(--text-secondary)' }}>
          {descricao || `Pedido(s) #${pedido.numero} atualizado(s) com sucesso.`}
        </p>
        
        <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
          <button 
            onClick={onPrint} 
            style={{
              padding: 12, background: 'var(--brand-brown)', color: '#fff', border: 'none', borderRadius: 10,
              fontWeight: 700, cursor: 'pointer'
            }}>
            🖨️ Imprimir comprovante
          </button>
          <button 
            onClick={onWhatsApp} 
            style={{
              padding: 12, background: 'var(--success-bg)', color: '#fff', border: 'none', borderRadius: 10,
              fontWeight: 700, cursor: 'pointer'
            }}>
            💬 Enviar pelo WhatsApp
          </button>
          <button 
            onClick={onClose} 
            style={{
              padding: 11, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 10,
              fontWeight: 600, cursor: 'pointer'
            }}>
            Fechar
          </button>
          
          {hasNfce ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <span style={{ fontWeight: 600 }}>NFC-e:</span>
              <span style={{ fontWeight: 600, color: 'var(--brand-brown)' }}>Nº {nfceData.numero} ✅</span>
            </div>
          ) : (
            <button 
              onClick={() => emitNfce('', '')}
              disabled={buttonDisabled}
              style={{
                padding: 12, 
                background: 'var(--brand-brown)', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 10,
                fontWeight: 700, 
                cursor: buttonDisabled ? 'not-allowed' : 'pointer'
              }}
            >
              📄 Emitir NFC-e
            </button>
          )}
        </div>
        
        {errorMessage && (
          <div style={{
            background: 'var(--error-bg)', 
            color: 'var(--color-error-dark)', 
            padding: 12, 
            borderRadius: 8, 
            marginTop: 16,
            textAlign: 'center'
          }}>
            {errorMessage}
          </div>
        )}
        
        <div style={{ marginTop: 24 }}>
          {loading && <p>Emitindo nota... (pode levar 5-15s)</p>}
        </div>
      </div>
    </div>
  );
}