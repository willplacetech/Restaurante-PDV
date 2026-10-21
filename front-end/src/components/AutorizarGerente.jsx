import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContextDefinition.jsx';
import { showToast } from '../components/Toast.jsx';

const AUTH_API = '/api/auth/autorizar';

export default function AutorizarGerente({ acao, onConfirmado }) {
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [senha, setSenha] = useState('');
  const [bloqueado, setBloqueado] = useState(false);
  const [tentativas, setTentativas] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState(null);

  // Verificar se usuário é admin - pular senha completamente
  useEffect(() => {
    if (user && user.role === 'admin') {
      // Admin: executar ação imediatamente sem pedir senha
      if (onConfirmado) {
        onConfirmado();
        showToast('Ação permitida para administrador.', 'success');
      }
      return;
    }
  }, [user, acao, onConfirmado]);

  // Verificar bloqueio
  useEffect(() => {
    if (blockedUntil) {
      const agora = Date.now();
      if (agora < blockedUntil) {
        setTentativas(3); // mostrar bloqueado
      } else {
        setBlockedUntil(null);
        setTentativas(0);
        setSenha('');
      }
    }
  }, [blockedUntil]);

  const handleConfirmar = async () => {
    // Admin bypass - already handled above
    if (user && user.role === 'admin') {
      if (onConfirmado) onConfirmado();
      return;
    }

    if (bloqueado) {
      showToast('Muitas tentativas falhas. Tente novamente em alguns minutos.', 'error');
      return;
    }

    if (!senha.trim()) {
      showToast('Informe a senha do gerente.', 'error');
      return;
    }

    try {
      const response = await fetch(AUTH_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ senha, acao }),
      });

      const data = await response.json();

      if (response.ok) {
        // Sucesso: token de autorização válido por 5 minutos
        if (data.tokenAutorizacao) {
          // Armazenar token globalmente ou passar para onConfirmado
          // O payload do token contém a ação validada
          localStorage.setItem('autorizacao_gerente', data.tokenAutorizacao);
          setTimeout(() => {
            localStorage.removeItem('autorizacao_gerente');
          }, 5 * 60 * 1000); // 5 minutos
        }
        if (onConfirmado) {
          // Passar o token para a ação confirmada
          onConfirmado(data.tokenAutorizacao);
        }
        setTentativas(0);
        setSenha('');
        setBloqueado(false);
        showToast('Autorização confirmada.', 'success');
      } else {
        // Falha: conta tentativa
        setTentativas(prev => {
          const next = prev + 1;
          if (next >= 3) {
            setBloqueado(true);
            setBlockedUntil(Date.now() + 60 * 1000); // 60 segundos
          }
          return next;
        });
        showToast(data.msg || 'Senha incorreta.', 'error');
      }
    } catch (error) {
      console.error('Erro na autorização:', error);
      showToast('Erro ao conectar com o servidor.', 'error');
    }
  };

  const handleLimparSenha = () => setSenha('');

  // Se já tem token autorização válido no localStorage, usar automaticamente
  useEffect(() => {
    if (!user || user.role === 'admin') return;
    const savedToken = localStorage.getItem('autorizacao_gerente');
    if (savedToken) {
      // Token ainda válido (verificado pelo backend na requisição)
      // Pode prosseguir sem pedir senha novamente
      if (onConfirmado) {
        onConfirmado(savedToken);
        localStorage.removeItem('autorizacao_gerente');
      }
    }
  }, [user, onConfirmado]);

  return (
    <div className="autorizacao-gerente-modal">
      <div className="modal-content">
        <h2>Autorização de Gerente</h2>
        <p className="modal-subtitle">
          {user && user.role !== 'admin' ? 'Informe a senha do gerente.' : 'Ação de administrador confirmada.'}
        </p>
        {user && user.role !== 'admin' && (
          <div className="senha-field">
            <label>Senha do gerente</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite a senha"
              maxLength={32}
              disabled={bloqueado}
              required
            />
          </div>
        )}
        {bloqueado && (
          <div className="blocked-notice">
            <p>Muitas tentativas falhas. Tente novamente em <span id="countdown"></p>
            <p>minutos.</p>
          </div>
        )}
        <div className="modal-actions">
          {user && user.role !== 'admin' && (
            <button onClick={handleLimparSenha} className="secondary-btn">
              Limpar
            </button>
          )}
          <button onClick={handleConfirmar} className="primary-btn" disabled={bloqueado}>
            {tentativas >= 3 ? 'Bloqueado' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}