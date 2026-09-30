import { useState, useEffect } from 'react';
import api from '../services/api.jsx';

export default function NfceEmissionModal({ selectedOrder }) {
  const [isEmitting, setIsEmitting] = useState(false);
  const [nfceData, setNfceData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [cpfCliente, setCpfCliente] = useState('');
  const [nomeCliente, setNomeCliente] = useState('');

  const emitNfce = async () => {
    setIsEmitting(true);
    setErrorMessage('');
    
    try {
      const response = await api.post(`/api/orders/${selectedOrder.numero}/emitir-nfce`, {
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

  if (!selectedOrder) return null;

  const hasNfce = nfceData?.status === 'emitida';
  const buttonDisabled = hasNfce;

  return (
    <div onClick={() => setSelecionado(null)} style={{
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(61, 47, 35, .45)',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 99999, 
      padding: 20
    }}>
      <div onClick={(event) => event.stopPropagation()} style={{
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-color)', 
        borderRadius: 16,
        padding: 24, 
        width: '100%', 
        maxWidth: 360, 
        textAlign: 'center'
      }}>
        <div style={{
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-color)', 
          borderRadius: 16,
          padding: 24, 
          width: '100%', 
          maxWidth: 360, 
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 8px' }}>✅ Emitir NFC-e</h3>
          <p style={{ margin: '0 0 18px', color: 'var(--text-secondary)' }}>
            {descricao || `Pedido(s) #${selectedOrder.numero} atualizado(s) com sucesso.`}
          </p>
          
          <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontWeight: 600, marginBottom: 4 }}>
                CPF ou Nome do Cliente
              </label>
              <input
                type="text"
                value={cpfCliente}
                onChange={(e) => setCpfCliente(e.target.value)}
                placeholder="CPF ou Nome"
                style={{
                  padding: 10, 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 8, 
                  width: '100%',
                  marginBottom: 8,
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <label style={{ fontWeight: 600, marginBottom: 4 }}>
                Nome do Cliente (opcional)
              </label>
              <input
                type="text"
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                placeholder="Nome do cliente (opcional)"
                style={{
                  padding: 10, 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 8, 
                  width: '100%',
                  boxSizing: 'border-box'
                }
              />
            </div>
          </div>
          
          <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
            <button 
              onClick={onClose} 
              style={{
                padding: 11, 
                background: 'var(--bg-tertiary)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 10,
                fontWeight: 600, 
                cursor: 'pointer'
              }}>
              Fechar
            </button>
          </div>
          
          {hasNfce ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <span style={{ fontWeight: 600 }}>NFC-e:</span>
              <span style={{ fontWeight: 600, color: 'var(--brand-brown)' }}>Nº {nfceData.numero} ✅</span>
            </div>
          ) : (
            <button 
              onClick={() => emitNfce()}
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
    </div>
  );
}