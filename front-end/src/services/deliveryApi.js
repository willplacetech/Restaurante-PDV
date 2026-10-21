import axios from 'axios';
import { readCachedProfile, setAccessSession, refreshAccessSession, logoutAccessSession, canRestoreSession } from './accessSession.js';
import { attachSessionInterceptors } from './sessionInterceptors.js';

export const chaveSessao = () => 'delivery';

export const lerSessao = () => {
  const user = readCachedProfile('delivery');
  return user ? { user } : null;
};

export const salvarSessao = (data) => ({ user: setAccessSession('delivery', data) });

export const criarApiDelivery = () => {
  const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api', timeout: 15000, withCredentials: true });
  attachSessionInterceptors(api, 'delivery');
  return api;
};

export const deliveryApi = criarApiDelivery();

// Erro padrão de delivery
export const erroDelivery = error => error.response?.data?.msg || 'Não foi possível conectar. Verifique sua conexão e tente novamente.';