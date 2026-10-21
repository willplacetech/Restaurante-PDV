import React, { useState } from 'react';
import { showToast } from './Toast.jsx';

const ConfirmModal = ({ titulo, mensagem, acaoConfirmar, acaoCancelar, btnConfirmarTexto = 'Confirmar', btnCancelarTexto = 'Cancelar', tipo = 'warning' }) => {
  const [aberto, setAberto] = useState(true);

  const handleConfirmar = () => {
    setAberto(false);
    if (acaoConfirmar) acaoConfirmar();
    showToast('Ação confirmada.', 'success');
  };

  const handleCancelar = () => {
    setAberto(false);
    if (acaoCancelar) acaoCancelar();
    showToast('Operação cancelada.', 'info');
  };

  if (!aberto) return null;

  const colors = {
    warning: { bg: '#fff3e0', border: '#ffa726', text: '#e65100' },
    success: { bg: '#e8f5e9', border: '#43a047', text: '#2e7d32' },
    error: { bg: '#ffebee', border: '#ef5350', text: '#c62828' },
  };

  const color = colors[tipo] || colors.warning;

  return (
    <div className="confirm-modal" onClick={e => e.stopPropagation()}>
      <div className="confirm-modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ background: color.bg, borderLeft: `4px solid ${color.border}`, color: color.text, padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 16px', color: color.text }}>{titulo}</h2>
          <p style={{ margin: '0 0 24px', color: color.text, fontSize: '1rem' }}>{mensagem}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button onClick={handleCancelar} style={{ background: 'none', border: `1px solid ${color.border}`, color: color.text, padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>{btnCancelarTexto}</button>
            <button onClick={handleConfirmar} style={{ background: color.border, color: '#fff', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>{btnConfirmarTexto}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;