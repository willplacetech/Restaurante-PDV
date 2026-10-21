import { useState, useContext } from 'react';
import api from '../services/api.jsx';
import { AuthContext } from './AuthContextDefinition.jsx';

export { AuthContext } from './AuthContextDefinition.jsx';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('pdv_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const loading = false;
  
  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('pdv_token', data.token);
    localStorage.setItem('pdv_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    location.reload();
  };

  const hasRole = (role) => !user || user.role === role;
  const canAccessMenu = (requiredRole) => {
    const roleMap = {
      atendente: ['atendente', 'gerente', 'admin'],
      gerente: ['gerente', 'admin'],
      admin: ['admin'],
    };
    return (roleMap[requiredRole] || []).includes(user?.role);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole, canAccessMenu }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);