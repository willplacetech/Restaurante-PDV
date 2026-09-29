import { useContext, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';

const gruposMenu = [
  {
    chave: 'atendimento',
    label: 'Atendimento',
    items: [
      { label: 'Novo Pedido', to: '/pdv' },
      { label: 'Mesas / Comandas', to: '/atendimento/mesas' },
      { label: 'A Receber', to: '/contas-receber', admin: true },
    ],
  },
  {
    chave: 'cadastro',
    label: 'Cadastro',
    items: [
      { label: 'Produtos', to: '/produtos', admin: true },
      { label: 'Mesas', to: '/cadastro/mesas', admin: true },
      { label: 'Clientes', to: '/clientes', admin: true },
      { label: 'Usuários', to: '/usuarios', admin: true },
    ],
  },
  {
    chave: 'compras',
    label: 'Compras',
    items: [
      { label: 'Compras', to: '/compras', admin: true },
    ],
  },
  {
    chave: 'producao',
    label: 'Produção',
    items: [
      { label: 'Produção', to: '/producao', admin: true },
      { label: 'Cozinha', to: '/cozinha', roles: ['admin', 'operador', 'cozinha'] },
    ],
  },
  {
    chave: 'financeiro',
    label: 'Financeiro',
    items: [
      { label: 'Fechamento de Caixa', to: '/caixa', admin: true },
      { label: 'Dashboard', to: '/dashboard', admin: true },
      { label: 'Financeiro / DRE', to: '/financeiro', admin: true },
    ],
  },
];

const pageTitles = {
  '/pdv': 'Atendimento',
  '/produtos': 'Produtos',
  '/clientes': 'Clientes',
  '/usuarios': 'Usuários',
  '/atendimento/mesas': 'Mesas / Comandas',
  '/comandas': 'Mesas / Comandas',
  '/cozinha': 'Cozinha',
  '/contas-receber': 'A Receber',
  '/dashboard': 'Dashboard',
  '/producao': 'Produção',
  '/producao/fichas': 'Produção',
  '/compras': 'Compras',
  '/financeiro': 'Financeiro',
  '/caixa': 'Fechamento de Caixa',
  '/cadastro/mesas': 'Mesas',
};

function ChevronIcon({ open }) {
  return (
    <svg
      className="nav-chevron"
      data-open={open ? 'true' : 'false'}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Layout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [showConfirm, setShowConfirm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [gruposAbertos, setGruposAbertos] = useState({ atendimento: true });
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const hamburgerRef = useRef(null);

  const sair = () => { logout(); navigate('/login'); };

  const toggleGrupo = (chave) => {
    setGruposAbertos((prev) => ({ ...prev, [chave]: !prev[chave] }));
  };

  const pathAtivo = location.pathname;
  const grupoAtivo = gruposMenu.find((g) => g.items.some((item) => pathAtivo.startsWith(item.to)));

  const abrirMenuMobile = () => {
    setMobileMenuOpen(true);
    if (grupoAtivo) {
      setGruposAbertos((prev) => ({ ...prev, [grupoAtivo.chave]: true }));
    }
  };

  const fecharMenuMobile = ({ restaurarFoco = true } = {}) => {
    setMobileMenuOpen(false);
    if (restaurarFoco) hamburgerRef.current?.focus();
  };

  // Mantem o grupo da rota atual sempre aberto, sem efeito colateral.
  const grupoAberto = (chave) => Boolean(gruposAbertos[chave]) || grupoAtivo?.chave === chave;

  // Drawer: trava o scroll, foca o botao de fechar e fecha com Escape.
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const aoTeclar = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        fecharMenuMobile();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusaveis = drawerRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusaveis || focusaveis.length === 0) return;
      const primeiro = focusaveis[0];
      const ultimo = focusaveis[focusaveis.length - 1];

      if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener('keydown', aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [mobileMenuOpen]);

  // Fecha o modal de confirmacao com Escape.
  useEffect(() => {
    if (!showConfirm) return undefined;
    const aoTeclar = (event) => {
      if (event.key === 'Escape') setShowConfirm(false);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [showConfirm]);

  const tituloPagina = Object.entries(pageTitles).find(([path]) => pathAtivo.startsWith(path))?.[1] || 'Atendimento';

  const visibleGroups = () => {
    const userRole = user?.role;
    return gruposMenu
      .map((grupo) => ({
        ...grupo,
        items: grupo.items.filter((item) => {
          if (item.admin) return userRole === 'admin';
          if (item.roles) return item.roles.includes(userRole);
          return true;
        }),
      }))
      .filter((grupo) => grupo.items.length > 0);
  };

  const renderGrupo = (grupo, isMobile) => {
    const isOpen = grupoAberto(grupo.chave);
    const grupoLabelId = `nav-group-${grupo.chave}-${isMobile ? 'mobile' : 'desktop'}`;

    return (
      <div className="nav-group" key={grupo.chave}>
        <button
          type="button"
          className="nav-group-header"
          onClick={() => toggleGrupo(grupo.chave)}
          aria-expanded={isOpen}
          aria-controls={grupoLabelId}
        >
          <span className="nav-group-label">{grupo.label}</span>
          <ChevronIcon open={isOpen} />
        </button>
        <div id={grupoLabelId} className="nav-group-content" data-open={isOpen ? 'true' : 'false'} hidden={!isOpen}>
          {grupo.items.map((item) => {
            const isActive = pathAtivo.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className="nav-link"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => { if (isMobile) setMobileMenuOpen(false); }}
              >
                <span className="nav-link-text">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  const groups = visibleGroups();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Ir para o conteúdo principal</a>

      <header className="app-header">
        <button
          ref={hamburgerRef}
          type="button"
          className="hamburger"
          onClick={abrirMenuMobile}
          aria-label="Abrir menu de navegação"
          aria-expanded={mobileMenuOpen}
          aria-controls="app-drawer"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <h1 className="app-header__title">{tituloPagina}</h1>

        <div className="app-header__actions">
          <span className="user-chip">
            <span className="user-chip__avatar" aria-hidden="true">{user?.username?.[0]?.toUpperCase() || '?'}</span>
            <span className="user-chip__name truncate">{user?.username || 'Usuário'}</span>
          </span>
          <button type="button" className="btn-secondary btn-logout-compact" onClick={() => setShowConfirm(true)}>
            Sair
          </button>
        </div>
      </header>

      <aside className="app-sidebar" id="sidebar-desktop">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">S</span>
          <span className="brand__text">
            <strong className="brand__name">Sistema PDV</strong>
            <span className="brand__tagline">Restaurante</span>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {groups.map((grupo) => renderGrupo(grupo, false))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <span className="user-card__avatar" aria-hidden="true">{user?.username?.[0]?.toUpperCase() || '?'}</span>
            <span className="user-card__text">
              <strong className="truncate">{user?.username || 'Usuário'}</strong>
              <span className="user-card__role">{user?.role || '—'}</span>
            </span>
          </div>
          <button type="button" className="btn-secondary" onClick={() => setShowConfirm(true)}>Sair</button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="drawer-backdrop" onClick={() => fecharMenuMobile()}>
          <div
            className="app-drawer"
            id="app-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-header">
              <div className="brand brand--drawer">
                <span className="brand__mark" aria-hidden="true">S</span>
                <span className="brand__text">
                  <strong className="brand__name">Sistema PDV</strong>
                  <span className="brand__tagline">Restaurante</span>
                </span>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="drawer-close"
                onClick={fecharMenuMobile}
                aria-label="Fechar menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <nav className="drawer-nav" aria-label="Navegação principal (menu)">
              {groups.map((grupo) => renderGrupo(grupo, true))}
            </nav>

            <div className="drawer-footer">
              <div className="user-card">
                <span className="user-card__avatar" aria-hidden="true">{user?.username?.[0]?.toUpperCase() || '?'}</span>
                <span className="user-card__text">
                  <strong className="truncate">{user?.username || 'Usuário'}</strong>
                  <span className="user-card__role">{user?.role || '—'}</span>
                </span>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { fecharMenuMobile({ restaurarFoco: false }); setShowConfirm(true); }}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      <main id="main-content" className="app-main">
        <Outlet />
      </main>

      {showConfirm && (
        <div className="modal-backdrop" onClick={() => setShowConfirm(false)}>
          <div
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            aria-describedby="logout-desc"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal__icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" focusable="false">
                <path d="M12 8v5M12 16.5v.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <h2 className="modal__title" id="logout-title">Deseja realmente sair?</h2>
            <p className="modal__text" id="logout-desc">Você precisará fazer login novamente para acessar o sistema.</p>
            <div className="modal__actions">
              <button type="button" className="btn-secondary" onClick={() => setShowConfirm(false)}>Cancelar</button>
              <button type="button" className="btn-danger" onClick={sair}>Sim, sair</button>
            </div>
          </div>
        </div>
      )}

      <style>{layoutStyles}</style>
    </div>
  );
}

const layoutStyles = `
  .app-shell { min-height: 100svh; background: var(--color-page); }

  .skip-link {
    position: absolute; left: -9999px; top: 8px; z-index: 10000;
    padding: 8px 16px; background: var(--color-primary); color: #fff;
    border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none;
  }
  .skip-link:focus { left: 8px; }

  /* ---------- HEADER ---------- */
  .app-header {
    position: sticky; top: 0; z-index: 60;
    display: flex; align-items: center; gap: var(--space-1);
    min-height: 60px; padding: var(--space-1) var(--space-2);
    background: var(--color-card); border-bottom: 1px solid var(--color-border);
  }
  .app-header__title {
    flex: 1 1 auto; min-width: 0; margin: 0;
    font-size: 20px; font-weight: 600; color: var(--color-text);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .app-header__actions { display: flex; align-items: center; gap: var(--space-1); flex-shrink: 0; }

  .hamburger {
    display: inline-flex; align-items: center; justify-content: center;
    width: var(--touch-target); height: var(--touch-target);
    padding: 0; background: transparent; border: 1px solid var(--color-border);
    border-radius: 8px; color: var(--color-text); cursor: pointer; flex-shrink: 0;
  }
  .hamburger:hover { background: var(--color-surface-muted); }

  .user-chip {
    display: inline-flex; align-items: center; gap: var(--space-1);
    max-width: 160px; padding: 0 var(--space-1); min-height: var(--control-height);
    background: var(--color-surface-muted); border-radius: var(--radius-pill);
    font-size: 14px; font-weight: 600; color: var(--color-text);
  }
  .user-chip__avatar {
    display: inline-flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; border-radius: 50%;
    background: var(--color-primary); color: #fff; font-size: 12px; font-weight: 700; flex-shrink: 0;
  }
  .user-chip__name { min-width: 0; }

  .btn-logout-compact { flex-shrink: 0; }

  /* ---------- SIDEBAR ---------- */
  .app-sidebar { display: none; }

  /* ---------- MAIN ---------- */
  .app-main {
    min-width: 0; max-width: 100%;
    padding: var(--space-2);
    padding-bottom: calc(var(--space-4) + var(--safe-bottom));
    overflow-x: hidden;
  }
  .app-main > * { min-width: 0; }

  /* ---------- BRAND ---------- */
  .brand { display: flex; align-items: center; gap: var(--space-1); min-width: 0; }
  .brand__mark {
    display: inline-flex; align-items: center; justify-content: center;
    width: 40px; height: 40px; flex-shrink: 0;
    border-radius: 10px; background: var(--color-primary); color: #fff;
    font-size: 20px; font-weight: 700;
  }
  .brand__text { display: flex; flex-direction: column; min-width: 0; }
  .brand__name { font-size: 16px; font-weight: 600; color: var(--color-text); }
  .brand__tagline { font-size: 12px; color: var(--color-text-secondary-aa); }

  /* ---------- NAV ---------- */
  .nav-group { margin-bottom: var(--space-1); }
  .nav-group-header {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-1);
    width: 100%; min-height: var(--control-height); padding: 0 var(--space-1);
    background: transparent; border: 0; border-radius: 8px;
    color: var(--color-text-secondary-aa);
    font-family: inherit; font-size: 12px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
  }
  .nav-group-header:hover { background: var(--color-surface-muted); color: var(--color-text); }
  .nav-group-header[aria-expanded='true'] { color: var(--color-primary-hover); }
  .nav-chevron { flex-shrink: 0; transition: transform 0.15s ease; }
  .nav-chevron[data-open='true'] { transform: rotate(90deg); }
  .nav-group-content { display: flex; flex-direction: column; gap: 2px; }
  .nav-group-content[hidden] { display: none; }
  .nav-link {
    display: flex; align-items: center; min-height: var(--control-height);
    padding: 0 var(--space-1); border-radius: 8px;
    color: var(--color-text-secondary-aa); font-size: 14px; font-weight: 500; text-decoration: none;
  }
  .nav-link:hover { background: var(--color-surface-muted); color: var(--color-text); text-decoration: none; }
  .nav-link[aria-current='page'] {
    background: var(--color-primary-bg); color: var(--color-primary-hover);
    font-weight: 600; box-shadow: inset 3px 0 0 var(--color-primary);
  }
  .nav-link-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* ---------- DRAWER ---------- */
  .drawer-backdrop {
    position: fixed; inset: 0; z-index: 900;
    display: flex; background: rgba(61, 47, 35, 0.45);
  }
  .app-drawer {
    display: flex; flex-direction: column; gap: var(--space-1);
    width: min(300px, 86vw); max-width: 86vw; height: 100%;
    padding: var(--space-2); background: var(--color-card);
    border-right: 1px solid var(--color-border); box-shadow: var(--shadow-lg);
    overflow-y: auto;
  }
  .drawer-header {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-1);
    padding-bottom: var(--space-1); border-bottom: 1px solid var(--color-border);
  }
  .drawer-close {
    display: inline-flex; align-items: center; justify-content: center;
    width: var(--touch-target); height: var(--touch-target); padding: 0;
    background: transparent; border: 1px solid var(--color-border);
    border-radius: 8px; color: var(--color-text); cursor: pointer; flex-shrink: 0;
  }
  .drawer-close:hover { background: var(--color-surface-muted); }
  .drawer-nav { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
  .drawer-footer {
    display: flex; flex-direction: column; gap: var(--space-1);
    padding-top: var(--space-1); border-top: 1px solid var(--color-border);
  }

  /* ---------- USUARIO ---------- */
  .user-card {
    display: flex; align-items: center; gap: var(--space-1);
    min-width: 0; padding: var(--space-1); border-radius: 8px; background: var(--color-surface-muted);
  }
  .user-card__avatar {
    display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%;
    background: var(--color-primary); color: #fff; font-size: 14px; font-weight: 700;
  }
  .user-card__text { display: flex; flex-direction: column; min-width: 0; }
  .user-card__text strong { font-size: 14px; font-weight: 600; color: var(--color-text); }
  .user-card__role { font-size: 12px; color: var(--color-text-secondary-aa); }

  /* ---------- MODAL ---------- */
  .modal-backdrop {
    position: fixed; inset: 0; z-index: 1000;
    display: flex; align-items: center; justify-content: center; padding: var(--space-2);
    background: rgba(61, 47, 35, 0.45);
  }
  .modal {
    display: flex; flex-direction: column; align-items: center; gap: var(--space-1);
    width: 100%; max-width: 380px; padding: var(--space-3);
    text-align: center; background: var(--color-card);
    border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-lg);
  }
  .modal__icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 48px; height: 48px; border-radius: 50%;
    background: var(--color-error-bg); color: var(--color-error-dark);
  }
  .modal__title { margin: 0; font-size: 16px; font-weight: 600; color: var(--color-text); }
  .modal__text { margin: 0; font-size: 14px; color: var(--color-text-secondary-aa); }
  .modal__actions { display: flex; gap: var(--space-1); width: 100%; margin-top: var(--space-1); }
  .modal__actions > * { flex: 1 1 0; }

  /* ---------- DESKTOP ---------- */
  @media (min-width: 1024px) {
    .app-header { display: none; }

    .app-sidebar {
      position: fixed; top: 0; left: 0; z-index: 50;
      display: flex; flex-direction: column; gap: var(--space-2);
      width: 264px; height: 100svh;
      padding: var(--space-2);
      background: var(--color-card); border-right: 1px solid var(--color-border);
      overflow-y: auto;
    }
    .sidebar-nav { flex: 1 1 auto; min-height: 0; }
    .sidebar-footer {
      display: flex; flex-direction: column; gap: var(--space-1);
      padding-top: var(--space-2); border-top: 1px solid var(--color-border);
    }
    .sidebar-footer > * { width: 100%; }

    .app-main {
      margin-left: 264px;
      padding: var(--space-3);
      padding-bottom: calc(var(--space-4) + var(--safe-bottom));
    }
  }

  @media (max-width: 420px) {
    .app-main { padding: var(--space-1); }
    .user-chip__name { display: none; }
    .user-chip { padding: 0 4px; }
  }
`;
