import React from 'react';
import { useAuth } from '../context/AuthContext';

const Version = () => {
  const { user } = useAuth();
  const version = import.meta.env.VITE_APP_VERSION || '1.0.0';

  return (
    <div className="version">
      <span>Versão {version}</span>
      {user && (
        <span>
          • {user.role === 'admin' ? 'Admin' : user.role === 'gerente' ? 'Gerente' : 'Atendente'}
        </span>
      )}
    </div>
  );
};

export default Version;