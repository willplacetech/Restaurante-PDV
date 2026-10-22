import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import ErrorBoundary from './components/ErrorBoundary';
import PrivateRoute from './components/PrivateRoute.jsx';
import RoleRoute from './components/RoleRoute.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';

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
const DeliveryAdmin = lazy(() => import('./pages/DeliveryAdmin.jsx'));
const Entregas = lazy(() => import('./pages/Entregas.jsx'));
const EntregadorDashboard = lazy(() => import('./pages/EntregadorDashboard.jsx'));
const Atendimento = lazy(() => import('./pages/atendimento/Atendimento.jsx'));

import { FormasPagamentoProvider } from './context/FormasPagamentoContext.jsx';
import { ComandaProvider } from './context/ComandaContext.jsx';

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) return null;
  return <Navigate to={user?.role === 'entregador' ? '/entregador' : user ? '/pdv' : '/login'} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FormasPagamentoProvider>
          <ComandaProvider>
            <ToastProvider>
              <Router>
                <ErrorBoundary fallback={<div>Erro na aplicação. Tente recarregar.</div>}>
                  <Suspense fallback={<div role="status">Carregando página...</div>}>
                    <Routes>
                      <Route path="/" element={<HomeRedirect />} />
                      <Route path="/login" element={<Login />} />
                      <Route element={<PrivateRoute />}>
                        <Route element={<Layout />}>
                          <Route path="/pdv" element={<PDV />} />
                          <Route path="/atendimento/mesas" element={<Comandas />} />
                          <Route path="/fechamento/:id" element={<TelaFechamento />} />
                          <Route path="/comandas" element={<Navigate to="/atendimento/mesas" replace />} />
                          <Route path="/cadastro/mesas" element={<MesasCadastro />} />
                          <Route element={<RoleRoute roles={['atendente', 'gerente', 'admin', 'entregador']} />}>
                            <Route path="/cozinha" element={<Kitchen />} />
                            <Route path="/atendimento" element={<Atendimento />} />
                          </Route>
                          <Route element={<RoleRoute roles={['admin', 'gerente']} />}>
                            <Route path="/produtos" element={<Products />} />
                            <Route path="/clientes" element={<Customers />} />
                            <Route path="/pedidos" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/contas-receber" element={<ContasReceber />} />
                            <Route path="/entregas" element={<Entregas />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/producao" element={<Production />} />
                            <Route path="/compras" element={<Purchases />} />
                            <Route path="/financeiro" element={<Financeiro />} />
                            <Route path="/caixa" element={<Caixa />} />
                            <Route path="/impressoras" element={<Impressoras />} />
                          </Route>
                          <Route path="/producao/fichas" element={<Navigate to="/producao?tab=fichas" replace />} />
                          <Route element={<RoleRoute roles={['gerente', 'admin']} />}>
                            <Route path="/delivery-admin" element={<DeliveryAdmin />} />
                          </Route>
                          <Route element={<RoleRoute roles={'entregador'} />}>
                            <Route path="/entregador" element={<EntregadorDashboard />} />
                          </Route>
                          <Route path="*" element={<Navigate to="/pdv" />} />
                        </Route>
                      </Route>
                      <Route element={<RoleRoute roles={['admin']} />}>
                        <Route path="/auditoria" element={<Auditoria />} />
                        <Route path="/usuarios" element={<Users />} />
                        <Route path="/payment-settings" element={<PaymentSettings />} />
                        <Route path="/configuracoes" element={<Configuracoes />} />
                      </Route>
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </Router>
            </ToastProvider>
          </ComandaProvider>
        </FormasPagamentoProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}