import { useState, useEffect, useContext } from 'react';
import api from '../services/api.jsx';
import { AuthContext } from './AuthContextDefinition.jsx';

export { AuthContext } from './AuthContextDefinition.jsx';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('pdv_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem('pdv_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data);
        localStorage.setItem('pdv_user', JSON.stringify(data));
      } catch (error) {
        if (error.response?.status === 401) {
          localStorage.removeItem('pdv_token');
          localStorage.removeItem('pdv_user');
          setUser(null);
        }
        setLoading(false);
      }
    };
    validateToken();
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('pdv_token', data.token);
    localStorage.setItem('pdv_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
try {
      await api.post('/auth/logout');
    } catch {
      // ignore logout errors
    }
    localStorage.clear();
    setUser(null);
    location.reload();
  };

  const hasRole = (role) => !user || user.role === role;
  const canAccessMenu = (requiredRole) => {
    const roleMap = {
      atendente: ['atendente', 'gerente', 'admin', 'operador'],
      gerente: ['gerente', 'admin'],
      admin: ['admin'],
      garcom: ['garcom', 'gerente', 'admin'],
      cozinha: ['cozinha', 'gerente', 'admin'],
      entregador: ['entregador', 'gerente', 'admin'],
      operador: ['operador', 'atendente', 'gerente', 'admin'],
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