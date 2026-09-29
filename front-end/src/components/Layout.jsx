import { useContext, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { ThemeContext } from '../context/ThemeContext.jsx';

const gruposMenu = [
  {
    chave: 'atendimento',
    label: 'ATENDIMENTO',
    items: [
      { label: 'Novo Pedido', to: '/pdv' },
      { label: 'Mesas / Comandas', to: '/atendimento/mesas' },
      { label: 'A Receber', to: '/contas-receber', admin: true },
    ],
  },
  {
    chave: 'cadastro',
    label: 'CADASTRO',
    items: [
      { label: 'Produtos', to: '/produtos', admin: true },
      { label: 'Mesas', to: '/cadastro/mesas', admin: true },
    ],
  },
  {
    chave: 'compras',
    label: 'COMPRAS',
    items: [
      { label: 'Lançar Entrada', to: '/compras', admin: true },
      { label: 'Histórico de Compras', to: '/compras', admin: true },
    ],
  },
  {
    chave: 'producao',
    label: 'PRODUÇÃO',
    items: [
      { label: 'Estoque de Insumos', to: '/producao', admin: true },
      { label: 'Lançar Produção', to: '/producao', admin: true },
      { label: 'Histórico de Movimentação', to: '/producao', admin: true },
      { label: 'Cozinha', to: '/cozinha', roles: ['admin', 'operador', 'cozinha'] },
    ],
  },
  {
    chave: 'financeiro',
    label: 'FINANCEIRO',
    items: [
      { label: 'Fechamento de Caixa', to: '/caixa', admin: true },
      { label: 'Dashboard', to: '/financeiro', admin: true },
      { label: 'DRE / Demonstrativo', to: '/financeiro', admin: true },
    ],
  },
  {
    chave: 'pessoas',
    label: 'PESSOAS',
    items: [
      { label: 'Clientes', to: '/clientes', admin: true },
      { label: 'Usuários', to: '/usuarios', admin: true },
    ],
  },
];

const pageIcons = {
  '/pdv': { title: 'Atendimento' },
  '/produtos': { title: 'Produtos' },
  '/clientes': { title: 'Clientes' },
  '/comandas': { title: 'Comandas' },
  '/cozinha': { title: 'Cozinha' },
  '/contas-receber': { title: 'A Receber' },
  '/usuarios': { title: 'Usuários' },
  '/dashboard': { title: 'Dashboard' },
  '/producao/fichas': { title: 'Ficha técnica' },
  '/producao': { title: 'Produção' },
  '/compras': { title: 'Compras' },
  '/financeiro': { title: 'Financeiro' },
};

export default function Layout() {
  const { user, logout } = useContext(AuthContext);
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [showConfirm, setShowConfirm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [gruposAbertos, setGruposAbertos] = useState({ atendimento: true });

  const sair = () => { logout(); navigate('/login'); };

  const toggleGrupo = (chave) => {
    setGruposAbertos((prev) => {
      const novo = {};
      Object.keys(prev).forEach((k) => { if (k !== chave) novo[k] = false; });
      novo[chave] = !prev[chave];
      return novo;
    });
  };

  const pathAtivo = location.pathname;
  const grupoAtivo = gruposMenu.find((g) => g.items.some((item) => pathAtivo.startsWith(item.to)));

  const toggleMobileMenu = (open) => {
    setMobileMenuOpen(open);
    if (open) {
      const activeKey = grupoAtivo?.chave;
      const novo = {};
      gruposMenu.forEach((g) => {
        if (g.chave === activeKey) novo[g.chave] = true;
        else novo[g.chave] = false;
      });
      setGruposAbertos(novo);
    }
  };

  const pageInfo = Object.entries(pageIcons).find(([path]) => pathAtivo.startsWith(path));
  const tituloPagina = pageInfo ? pageInfo[1].title : 'Atendimento';

  const visibleGroups = () => {
    const userRole = user?.role;
    return gruposMenu.filter((grupo) => {
      if (grupo.chave === 'atendimento') {
        return grupo.items.some((item) => !item.admin || userRole === 'admin');
      }
      if (grupo.admin) return userRole === 'admin';
      return grupo.items.some((item) => {
        if (item.admin) return userRole === 'admin';
        if (item.roles) return item.roles.includes(userRole);
        return true;
      });
    });
  };

  const renderGrupo = (grupo, isMobile) => {
    const isOpen = gruposAbertos[grupo.chave] || grupo.sempreVisivel;
    const userRole = user?.role;
    const visibleItems = grupo.items.filter((item) => {
      if (item.admin) return userRole === 'admin';
      if (item.roles) return item.roles.includes(userRole);
      return true;
    });
    if (visibleItems.length === 0) return null;

    return (
      <div className="nav-group-container" key={grupo.chave}>
        <button
          type="button"
          className={'nav-group-header ' + (isOpen ? 'open' : '')}
          onClick={() => toggleGrupo(grupo.chave)}
          aria-expanded={isOpen}
        >
          <span className="nav-group-label">{grupo.label}</span>
          <span className="nav-group-arrow">{isOpen ? '▼' : '▶'}</span>
        </button>
        {isOpen && (
          <div className={'nav-group-content ' + (isOpen ? 'open' : '')}>
            {visibleItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={pathAtivo.startsWith(item.to) ? 'nav-link active' : 'nav-link'}
                onClick={() => {
                  if (isMobile) toggleMobileMenu(false);
                  toggleGrupo(grupo.chave);
                }}
              >
                <span className="nav-link-text">{item.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  const groups = visibleGroups();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'var(--font-body)', color: 'var(--text-primary)', transition: 'background-color 0.3s ease, color 0.3s ease' }}>

      {/* ==========================================
            HEADER MOBILE
            ========================================== */}
      <header id="header-mobile">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <button
            type="button"
            className="hamburger"
            onClick={() => toggleMobileMenu(true)}
            aria-label="Abrir menu"
            aria-expanded={mobileMenuOpen}
          >
            &#9776;
          </button>
          <h1 style={{
            fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>{tituloPagina}</h1>
        </div>

        <div style={{
          display: 'flex', borderRadius: 10, overflow: 'hidden',
          border: '1px solid var(--border-color)', height: 38, flexShrink: 0
        }}>
          <button onClick={toggleTheme} style={{
            background: 'transparent', color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRight: '1px solid var(--border-color)',
            padding: '0 10px', fontWeight: 700, fontSize: 16,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 4,
            transition: 'all 0.2s ease'
          }} title={isDark ? 'Modo claro' : 'Modo escuro'}>
            {isDark ? '☀️' : '🌙'}
          </button>
          <div style={{
            background: 'var(--success-bg)', color: 'var(--success-text)',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 10px', fontWeight: 700, fontSize: 13
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: 'rgba(255,255,255,.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, flexShrink: 0
            }}>{user?.username?.[0]?.toUpperCase()}</div>
            <span style={{ maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.username}
            </span>
          </div>
          <button onClick={() => setShowConfirm(true)} style={{
            background: 'var(--error-bg)', color: 'var(--error-text)', border: 'none',
            borderLeft: '1px solid rgba(255,255,255,.2)',
            padding: '0 14px', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 4
          }}>
            Sair
          </button>
        </div>
      </header>


      {/* ==========================================
            SIDEBAR DESKTOP - 260px
            ========================================== */}
      <aside id="sidebar-desktop">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>Sistema PDV</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Caixa Eletrônico</div>
          </div>
        </div>

        <button onClick={toggleTheme} style={{
          width: '100%', padding: '10px',
          background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px', cursor: 'pointer',
          fontWeight: '600', fontSize: '13px',
          minHeight: '40px', fontFamily: 'inherit',
          marginBottom: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '6px',
          transition: 'all 0.2s ease'
        }} title={isDark ? 'Modo claro' : 'Modo escuro'}>
          {isDark ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
        </button>

        <nav className="sidebar-nav">
          {groups.map((grupo) => renderGrupo(grupo, false))}
        </nav>

        <div style={{
          borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 'auto'
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 10,
            background: 'var(--accent-light)', marginBottom: 10
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--success-bg)', color: 'var(--success-text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 14, flexShrink: 0
            }}>{user?.username?.[0]?.toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{user?.role}</div>
            </div>
          </div>
          <button onClick={() => setShowConfirm(true)} className="btn-logout">Sair</button>
        </div>
      </aside>


      {/* ==========================================
            OVERLAY MOBILE - MENU HAMBURGUER
            ========================================== */}
      {mobileMenuOpen && (
        <div className="mobile-menu-backdrop" onClick={() => toggleMobileMenu(false)}>
          <div className="mobile-menu-panel" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Sistema PDV</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Caixa Eletrônico</div>
                </div>
              </div>
              <button
                type="button"
                className="mobile-menu-close"
                onClick={() => toggleMobileMenu(false)}
                aria-label="Fechar menu"
              >
                x
              </button>
            </div>

            <nav className="mobile-menu-nav">
              {groups.map((grupo) => renderGrupo(grupo, true))}
            </nav>

            <div className="mobile-menu-footer">
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10,
                background: 'var(--accent-light)', marginBottom: 10
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--success-bg)', color: 'var(--success-text)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14, flexShrink: 0
                }}>{user?.username?.[0]?.toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{user?.role}</div>
                </div>
              </div>
              <button onClick={() => { setShowConfirm(true); toggleMobileMenu(false); }} className="btn-logout">Sair</button>
            </div>
          </div>
        </div>
      )}


      {/* ==========================================
            CONTEUDO PRINCIPAL
            ========================================== */}
      <main id="main-content">
        <Outlet />
      </main>


      {/* ==========================================
            MODAL DE SAIDA
            ========================================== */}
      {showConfirm && (
        <div onClick={() => setShowConfirm(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, padding: 20
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-secondary)', borderRadius: 16, padding: 24,
            width: '100%', maxWidth: 340, textAlign: 'center',
            boxShadow: 'var(--shadow-lg)',
            color: 'var(--text-primary)'
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, margin: '0 auto 16px'
            }}></div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, color: 'var(--text-primary)' }}>Deseja realmente sair?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-secondary)' }}>
              Voce precisara fazer login novamente para acessar o sistema.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} style={{
                flex: 1, padding: '12px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                border: '1px solid var(--border-color)', borderRadius: 10, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', minHeight: 44,
                transition: 'all 0.2s ease'
              }}>Cancelar</button>
              <button onClick={sair} style={{
                flex: 1, padding: '12px', background: 'var(--error-bg)', color: 'var(--error-text)',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', minHeight: 44,
                transition: 'all 0.2s ease'
              }}>Sim, Sair</button>
            </div>
          </div>
        </div>
      )}


      {/* ==========================================
            CSS GLOBAL
            ========================================== */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap');

        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; }

        /* DESKTOP - BARRA LATERAL 260px */
        @media (min-width: 769px) {
          #header-mobile { display: none !important; }
          #sidebar-desktop {
            display: flex !important;
            position: fixed; top: 0; left: 0;
            width: 260px;
            height: 100vh;
            background: var(--bg-secondary);
            border-right: 1px solid var(--border-color);
            padding: 24px;
            flex-direction: column;
            z-index: 50;
          }
          #main-content {
            margin-left: 260px !important;
            padding: 28px !important;
          }
        }

        /* MOBILE */
        @media (max-width: 768px) {
          #header-mobile {
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            position: sticky;
            top: 0;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
            padding: calc(12px + var(--safe-top)) 16px 12px 16px;
            z-index: 100;
          }
          #sidebar-desktop {
            display: none !important;
            position: absolute !important;
            left: -9999px !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
          }
          #main-content {
            margin-left: 0 !important;
            padding: calc(16px + var(--safe-top)) 16px calc(80px + var(--safe-bottom)) 16px !important;
            min-height: calc(100vh - 60px);
          }
        }

        @media (display-mode: standalone) {
          #header-mobile {
            padding-top: calc(18px + var(--safe-top)) !important;
          }
          #main-content {
            padding-top: calc(20px + var(--safe-top)) !important;
          }
        }

        /* HAMBURGER BUTTON (mobile) */
        .hamburger {
          display: none;
          background: transparent;
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          width: 44px;
          height: 44px;
          font-size: 22px;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          transition: background 0.2s ease;
        }

        @media (max-width: 768px) {
          .hamburger { display: flex; }
        }

        .hamburger:hover { background: var(--bg-tertiary); }
        .hamburger:active { transform: scale(0.95); }

        /* NAVIGATION */
        .nav-group-container { margin-bottom: 4px; }
        .nav-group-header {
          width: 100%; padding: 10px 12px; background: transparent;
          border: none; color: var(--text-secondary); font-weight: 600;
        }
        .nav-group-header:hover { background: var(--bg-tertiary); }
        .nav-group-header:active { transform: scale(0.95); }
        .nav-group-arrow { transition: transform 0.2s ease; }
        .nav-group-header.open .nav-group-arrow { transform: rotate(180deg); }
        .nav-group-content { overflow: hidden; max-height: 0; transition: max-height 0.2s ease; }
        .nav-group-content.open { max-height: 500px; }
        .nav-link {
          width: 100%; padding: 10px 12px; background: transparent;
          border: none; color: var(--text-secondary); font-weight: 500;
          display: flex; align-items: center; justify-content: flex-start;
        }
        .nav-link:hover { background: var(--bg-tertiary); color: var(--text-primary); }
        .nav-link.active { background: var(--accent-light); color: var(--text-primary); font-weight: 600; }
        .nav-link-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* MOBILE MENU */
        .mobile-menu-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,.5);
          display: flex; align-items: center; justify-content: center;
          z-index: 9999; padding: 20;
        }
        .mobile-menu-panel {
          background: var(--bg-secondary); border-radius: 16; padding: 24;
          width: 100%; maxWidth: 340; position: relative;
        }
        .mobile-menu-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 20px;
        }
        .mobile-menu-close {
          background: transparent; border: none; color: var(--text-secondary);
          font-size: 24px; cursor: pointer; width: 30px; height: 30px;
          display: flex; align-items: center; justify-content: center;
        }
        .mobile-menu-nav .nav-group-container { margin-bottom: 4px; }
        .mobile-menu-footer {
          display: flex; flex-direction: column; gap: 10;
          margin-top: 20px;
        }
        .btn-logout {
          width: 100%; padding: 12px; background: var(--error-bg);
          color: var(--error-text); border: none; border-radius: 10;
          fontSize: 14; fontWeight: 700; cursor: pointer;
          fontFamily: inherit; minHeight: 44;
          transition: all 0.2s ease;
        }
        .btn-logout:hover { background: var(--error-dark); }

        /* FORM ELEMENTS */
        input, select, textarea {
          width: 100%; padding: 10px 12px; border: 1px solid var(--border-color);
          border-radius: 8px; background: var(--bg-secondary);
          color: var(--text-primary); fontFamily: inherit;
          fontSize: 14px;
        }
        input:focus, select:focus, textarea:focus {
          outline: none; border-color: var(--accent);
          box-shadow: 0 0 0 2px rgba(169, 79, 43, 0.2);
        }
        button {
          background: var(--accent); color: white; border: none;
          borderRadius: 8px; padding: 10px 16px; fontWeight: 600;
          cursor: pointer; fontFamily: inherit; fontSize: 14px;
          transition: background 0.2s ease;
        }
        button:hover { background: var(--accent-dark); }
        button:disabled { background: var(--bg-tertiary); color: var(--text-secondary); cursor: not-allowed; }
        button.secondary { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); }
        button.secondary:hover { background: var(--bg-tertiary); opacity: 0.9; }
        button.danger { background: var(--error-bg); color: var(--error-text); }
        button.danger:hover { background: var(--error-dark); }
        button.success { background: var(--success-bg); color: var(--success-text); }
        button.success:hover { background: var(--success-dark); }

        /* CARDS */
        .card {
          background: var(--bg-secondary); borderRadius: 12px;
          padding: 20px; marginBottom: 20px;
          border: 1px solid var(--border-color);
        }
        .card-header {
          display: flex; justifyContent: space-between; alignItems: center;
          marginBottom: 16px;
        }
        .card-title {
          fontSize: 18px; fontWeight: 600; color: var(--text-primary);
        }
        .card-body { }

        /* TABLES */
        table {
          width: 100%; borderCollapse: collapse;
        }
        th, td {
          padding: 12px 16px; textAlign: left;
          borderBottom: 1px solid var(--border-color);
        }
        th {
          background: var(--bg-tertiary); fontWeight: 600;
          color: var(--text-primary); fontSize: 14px;
        }
        tr:hover { background: var(--bg-tertiary); }

        /* ALERTAS */
        .alert {
          padding: 12px 16px; borderRadius: 8px; marginBottom: 16px;
          fontWeight: 500;
        }
        .alert-success { background: var(--success-bg); color: var(--success-text); border: 1px solid var(--success-border); }
        .alert-error { background: var(--error-bg); color: var(--error-text); border: 1px solid var(--error-border); }
        .alert-warning { background: var(--warning-bg); color: var(--warning-text); border: 1px solid var(--warning-border); }
        .alert-info { background: var(--info-bg); color: var(--info-text); border: 1px solid var(--info-border); }

        /* UTILIDADES */
        .text-center { textAlign: center; }
        .text-right { textAlign: right; }
        .text-left { textAlign: left; }
        .mt-1 { marginTop: 4px; }
        .mt-2 { marginTop: 8px; }
        .mt-3 { marginTop: 12px; }
        .mt-4 { marginTop: 16px; }
        .mt-5 { marginTop: 20px; }
        .mb-1 { marginBottom: 4px; }
        .mb-2 { marginBottom: 8px; }
        .mb-3 { marginBottom: 12px; }
        .mb-4 { marginBottom: 16px; }
        .mb-5 { marginBottom: 20px; }
        .flex { display: flex; }
        .flex-col { flexDirection: column; }
        .items-center { alignItems: center; }
        .justify-center { justifyContent: center; }
        .justify-between { justifyContent: space-between; }
        .gap-4 { gap: 16px; }
        .w-full { width: 100%; }
        .max-w-xs { maxWidth: 360px; }
        .max-w-sm { maxWidth: 240px; }
        .hidden { display: none; }
      `}</style>
    </div>
  );
}