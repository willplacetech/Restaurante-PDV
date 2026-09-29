import { useState, useContext, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

// Imagens de ambiente da cafeteria. Se nao existirem no servidor, o painel
// mantem o fundo terracota e o degrade continua funcionando.
const imagensAmbiente = ['/Abraco5.png', '/Abraco10.png', '/Abraco11.png'];

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [imagemAtiva, setImagemAtiva] = useState(0);
  const [imagensOk, setImagensOk] = useState([true, true, true]);
  const [logoOk, setLogoOk] = useState(true);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useContext(AuthContext);
  const { showToast } = useToast();
  const erroRef = useRef(null);

  const ambiente = imagensAmbiente.filter((_, indice) => imagensOk[indice]);

  useEffect(() => {
    if (ambiente.length < 2) return undefined;
    const intervalo = window.setInterval(() => setImagemAtiva((atual) => (atual + 1) % ambiente.length), 5000);
    return () => window.clearInterval(intervalo);
  }, [ambiente.length]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
      setShowInstallButton(true);
    };
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setShowInstallButton(false);
      showToast('App instalado com sucesso!', 'success');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [showToast]);

  useEffect(() => {
    if (erro) erroRef.current?.focus();
  }, [erro]);

  if (user) return <Navigate to="/pdv" />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErro('');
    try {
      // Remove credenciais e dados persistidos de versões anteriores antes de autenticar novamente.
      localStorage.clear();
      await login(form.username.trim().toLowerCase(), form.password);
      window.location.reload();
    } catch (err) {
      // O nome de usuário é preservado; apenas a senha é limpa.
      setForm((atual) => ({ ...atual, password: '' }));
      setErro(err.response?.data?.msg || 'Usuário ou senha inválidos');
    } finally {
      setLoading(false);
    }
  };

  const handleInstallClick = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.choiceResult === 'accepted' || choice.outcome === 'accepted') {
      showToast('Instalação iniciada!', 'success');
    } else {
      showToast('Instalação cancelada.', 'info');
    }

    setInstallPrompt(null);
    setShowInstallButton(false);
  };

  return (
    <div className="login-shell">
      <div className="login-layout">
        <section className="login-brand-panel" aria-hidden="true">
          {ambiente.map((imagem, indice) => (
            <img
              key={imagem}
              className="login-brand-panel__img"
              src={imagem}
              alt=""
              data-active={imagemAtiva === indice ? 'true' : 'false'}
              onError={() => setImagensOk((atuais) => atuais.map((ok, i) => (ambiente[i] === imagem ? false : ok)))}
            />
          ))}
          <div className="login-brand-panel__overlay" />
          <div className="login-brand-panel__content">
            <span className="login-brand-panel__eyebrow">CAFÉS ESPECIAIS · CONFEITARIA AFETIVA</span>
            <h2 className="login-brand-panel__title">Um abraço em cada pausa.</h2>
            <p className="login-brand-panel__text">Atenda com calma. A casa começa no primeiro carinho.</p>
            {ambiente.length > 1 && (
              <div className="login-brand-panel__dots">
                {ambiente.map((imagem, indice) => (
                  <button
                    key={imagem}
                    type="button"
                    className="login-dot"
                    data-active={imagemAtiva === indice ? 'true' : 'false'}
                    onClick={() => setImagemAtiva(indice)}
                    aria-label={`Ver imagem ${indice + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="login-card">
          <header className="login-card__header">
            {logoOk ? (
              <img className="login-logo" src="/logo.jpg" alt="" onError={() => setLogoOk(false)} />
            ) : (
              <span className="login-logo login-logo--fallback" aria-hidden="true">S</span>
            )}
            <h1 className="login-title">Recanto da Siriema</h1>
            <p className="login-subtitle">Restaurante a La'Carte</p>
          </header>

          {/* <p className="login-highlight">O cookie recheado é o abraço da casa</p> */}

          <div
            ref={erroRef}
            className="alert alert--error login-error"
            role="alert"
            aria-live="assertive"
            tabIndex={-1}
            hidden={!erro}
          >
            <span aria-hidden="true">⚠️</span>
            <span>{erro}</span>
          </div>

          <form onSubmit={handleSubmit} noValidate={false}>
            <div className="field">
              <label className="label" htmlFor="login-usuario">Usuário</label>
              <input
                id="login-usuario"
                name="username"
                placeholder="Digite seu usuário"
                value={form.username}
                autoComplete="username"
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                required
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="login-senha">Senha</label>
              <input
                id="login-senha"
                name="password"
                type="password"
                placeholder="Digite sua senha"
                value={form.password}
                autoComplete="current-password"
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
            </div>

            <button type="submit" className="btn-primary login-submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar no sistema'}
            </button>
          </form>

          {showInstallButton ? (
            <button
              type="button"
              className="btn-secondary login-install"
              onClick={handleInstallClick}
              title="Instalar o aplicativo na cafeteria"
            >
              <span aria-hidden="true">⬇️</span>
              <span>Instalar aplicativo</span>
            </button>
          ) : (
            <p className="login-install-hint">
              Para instalar, use o menu do navegador e escolha <strong>Instalar aplicativo</strong>.
            </p>
          )}
        </section>
      </div>

      <style>{loginStyles}</style>
    </div>
  );
}

const loginStyles = `
  .login-shell {
    min-height: 100svh; display: flex; align-items: center; justify-content: center;
    padding: var(--space-2); background: var(--color-page); overflow-x: hidden;
  }
  .login-shell *, .login-shell *::before, .login-shell *::after { box-sizing: border-box; }

  .login-layout {
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 400px);
    gap: var(--space-3); width: 100%; max-width: 960px; min-width: 0;
  }
  .login-layout > * { min-width: 0; }

  .login-brand-panel {
    position: relative; min-height: 560px; overflow: hidden;
    border-radius: var(--radius-md);
    background: linear-gradient(150deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
    box-shadow: var(--shadow-sm);
  }
  .login-brand-panel__img {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; opacity: 0; transition: opacity 0.8s ease;
  }
  .login-brand-panel__img[data-active='true'] { opacity: 1; }
  .login-brand-panel__overlay {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(61, 47, 35, 0.08), rgba(61, 47, 35, 0.78));
  }
  .login-brand-panel__content {
    position: absolute; left: var(--space-3); right: var(--space-3); bottom: var(--space-3);
    display: flex; flex-direction: column; gap: var(--space-1); color: #ffffff;
  }
  .login-brand-panel__eyebrow {
    font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  }
  .login-brand-panel__title { margin: 0; font-size: 20px; font-weight: 600; color: #ffffff; }
  .login-brand-panel__text { margin: 0; font-size: 14px; }

  .login-dot {
    width: 28px; height: 6px; min-height: 6px; padding: 0;
    border: 0; border-radius: var(--radius-pill);
    background: rgba(255, 255, 255, 0.45); cursor: pointer;
  }
  .login-dot[data-active='true'] { background: #ffffff; }
  .login-brand-panel__dots { display: flex; gap: 6px; margin-top: var(--space-1); }

  .login-card {
    display: flex; flex-direction: column; gap: var(--space-2);
    padding: var(--space-3); text-align: center;
    background: var(--color-card); border: 1px solid var(--color-border);
    border-radius: var(--radius-md); box-shadow: var(--shadow-sm);
  }
  .login-card__header { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); }
  .login-logo {
    width: 88px; height: 88px; object-fit: cover; border-radius: 50%;
    border: 1px solid var(--color-border);
  }
  .login-logo--fallback {
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--color-primary); color: #ffffff;
    font-size: 36px; font-weight: 700; line-height: 1;
  }
  .login-title { margin: 0; font-size: 20px; font-weight: 600; color: var(--color-text); }
  .login-subtitle { margin: 0; font-size: 14px; color: var(--color-text-secondary-aa); }
  .login-highlight {
    margin: 0; padding: 10px var(--space-2); font-size: 12px; font-weight: 600;
    color: var(--color-primary-hover); background: var(--color-primary-bg);
    border: 1px solid var(--accent-border); border-radius: var(--radius-sm);
  }
  .login-card form { display: flex; flex-direction: column; gap: var(--space-2); text-align: left; }
  .login-error { text-align: left; }
  .login-error[hidden] { display: none; }
  .login-submit { width: 100%; margin-top: var(--space-1); }
  .login-install { width: 100%; }
  .login-install-hint {
    margin: 0; font-size: 12px; text-align: center;
    color: var(--color-text-secondary-aa);
  }

  @media (max-width: 900px) {
    .login-layout { grid-template-columns: 1fr; max-width: 460px; }
    .login-brand-panel { min-height: 200px; }
  }

  @media (max-width: 480px) {
    .login-shell { padding: var(--space-1); align-items: flex-start; }
    .login-layout { gap: var(--space-1); }
    .login-card { padding: var(--space-2); }
    .login-brand-panel { min-height: 160px; }
    .login-brand-panel__content { left: var(--space-2); right: var(--space-2); bottom: var(--space-2); }
    .login-logo { width: 64px; height: 64px; }
  }
`;
