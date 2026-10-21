import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, lazy, Suspense } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import ErrorBoundary from './components/ErrorBoundary';
import PrivateRoute from './components/PrivateRoute.jsx';
import RoleRoute from './components/RoleRoute.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import { waitForServiceWorkerUpdate } from './services/appVersion';

const PDV = lazy(() => import('./pages/PDV.jsx'));
const Products = lazy(() => import('./pages/Products.jsx'));
const Customers = lazy(() => import('./pages/Customers.jsx'));
const ContasReceber = lazy(() => import('./pages/ContasReceber.jsx'));
const Users = lazy(() => import('./pages/Users.jsx'));
const Comandas = lazy(() => import('./pages/Comandas.jsx'));
const MesasCadastro = lazy(() => import('./pages/MesasCadastro.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Production = lazy(() => import('./pages/Production.jsx'));
const Purchases = lazy(() => import('./pages/Purchases.jsx'));
const Kitchen = lazy(() => import('./pages/Kitchen.jsx'));
const Financeiro = lazy(() => import('./pages/Financeiro.jsx'));
const Caixa = lazy(() => import('./pages/Caixa.jsx'));
const TelaFechamento = lazy(() => import('./pages/TelaFechamento.jsx'));
const Auditoria = lazy(() => import('./pages/Auditoria.jsx'));
const Configuracoes = lazy(() => import('./pages/Configuracoes.jsx'));
const PaymentSettings = lazy(() => import('./pages/PaymentSettings.jsx'));
const Impressoras = lazy(() => import('./pages/Impressoras.jsx'));

import { FormasPagamentoProvider } from './context/FormasPagamentoContext.jsx';
import { ComandaProvider } from './context/ComandaContext.jsx';

export default function App() {
  const [swRegistered, setSwRegistered] = useState(false);
  const [swAvailable, setSwAvailable] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setSwRegistered(true);
      return;
    }

    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        setSwRegistered(true);
        setSwAvailable(true);

        registration.onupdatefound = () => {
          const newWorker = registration.installing;
          newWorker.onstatechange = () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                waitForServiceWorkerUpdate(registration, navigator.serviceWorker)
                  .then(() => {
                    console.log('Atualização do service worker concluída');
                  });
              }
            }
          };
        };
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
        setSwRegistered(true);
      });
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <FormasPagamentoProvider>
          <ComandaProvider>
            <ToastProvider>
              <Router>
                <ErrorBoundary fallback={<div>Erro na aplicação. Tente recarregar.</div>}>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route element={<PrivateRoute />}>
                      <Route element={<Layout />}>
                        <Route path="/pdv" element={<PDV />} />
                        <Route path="/atendimento/mesas" element={<Comandas />} />
                        <Route path="/fechamento/:id" element={<TelaFechamento />} />
                        <Route path="/comandas" element={<Navigate to="/atendimento/mesas" replace />} />
                        <Route path="/cadastro/mesas" element={<MesasCadastro />} />
                        <Route element={<RoleRoute roles={['admin', 'operador', 'cozinha']} />}>
                          <Route path="/cozinha" element={<Kitchen />} />
                        </Route>
                        <Route element={<RoleRoute roles={['admin']} />}>
                          <Route path="/produtos" element={<Products />} />
                          <Route path="/clientes" element={<Customers />} />
                          <Route path="/pedidos" element={<Navigate to="/dashboard" replace />} />
                          <Route path="/contas-receber" element={<ContasReceber />} />
                          <Route path="/auditoria" element={<Auditoria />} />
                          <Route path="/usuarios" element={<Users />} />
                          <Route path="/configuracoes" element={<Configuracoes />} />
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/producao" element={<Production />} />
                          <Route path="/compras" element={<Purchases />} />
                          <Route path="/financeiro" element={<Financeiro />} />
                          <Route path="/caixa" element={<Caixa />} />
                          <Route path="/payment-settings" element={<PaymentSettings />} />
                          <Route path="/impressoras" element={<Impressoras />} />
                        </Route>
                        <Route element={<RoleRoute roles={['admin', 'cozinha']} />}>
                          <Route path="/producao/fichas" element={<Navigate to="/producao?tab=fichas" replace />} />
                        </Route>
                        <Route path="*" element={<Navigate to="/pdv" />} />
                      </Route>
                    </Route>
                  </Routes>
                </ErrorBoundary>
              </Router>
            </ToastProvider>
          </ComandaProvider>
        </FormasPagamentoProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}