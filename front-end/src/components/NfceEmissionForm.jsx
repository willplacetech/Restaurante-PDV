import { useState } from 'react';
import api from '../services/api.jsx';

export default function NfceEmissionForm({ onEmitComplete, onClose }) {
  const [cpfCliente, setCpfCliente] = useState('');
  const [nomeCliente, setNomeCliente] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const emitNfce = async () => {
    if (!cpfCliente && !nomeCliente) {
      setErrorMessage('Informe o CPF ou nome do cliente');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    
    try {
      const response = await api.post(`/api/orders/${onEmitComplete.pedido.numero}/emitir-nfce`, {
        cpfCliente,
        nomeCliente,
      });
      
      onEmitComplete();
    } catch (error) {
      setErrorMessage(error.response?.data?.msg || 'Erro ao emitir NFC-e');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(61, 47, 35, .45)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 10000,
      padding: 20
    }}>
      <div 
        onClick={(e) => e.stopPropagation()} 
        style={{
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-color)', 
          borderRadius: 16,
          padding: 24, 
          width: '90%', 
          maxWidth: 400, 
          textAlign: 'center'
        }}
      >
        <div style={{
          background: 'var(--bg-tertiary)', 
          padding: 24, 
          borderRadius: 16, 
          boxShadow: 'var(--shadow-sm)'
        }}>
          <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary)' }}>
            Emitir NFC-e
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '16px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
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
                  marginBottom: 8,
                  width: '100%',
                  boxSizing: 'border-box'
                }
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              <button 
                onClick={emitNfce}
                disabled={loading}
                style={{
                  padding: 12, 
                  background: 'var(--brand-brown)', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 8, 
                  fontWeight: 700, 
                  cursor: loading ? 'not-allowed' : 'pointer',
                  padding: '8px 16px'
                }}
              >
                {loading ? 'Emitindo...' : 'Emitir NFC-e'}
              </button>
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
              <button 
                onClick={onClose}
                style={{
                  padding: 12, 
                  background: 'var(--bg-tertiary)', 
                  color: 'var(--text-secondary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 8, 
                  fontWeight: 600, 
                  cursor: 'pointer'
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}