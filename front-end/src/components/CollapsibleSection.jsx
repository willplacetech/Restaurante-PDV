import { useId, useState } from 'react';

/**
 * Secao expansivel usada para agrupar campos avancados semremove-los da tela.
 * O estado e anunciado por aria-expanded e o conteudo fica no painel controlado.
 */
export default function CollapsibleSection({ title, description, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="collapsible">
      <button
        type="button"
        className="collapsible__trigger"
        onClick={() => setOpen((valor) => !valor)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="collapsible__label">
          {icon ? <span className="collapsible__icon" aria-hidden="true">{icon}</span> : null}
          <span className="collapsible__text">
            <strong className="collapsible__title">{title}</strong>
            {description ? <small className="collapsible__description">{description}</small> : null}
          </span>
        </span>
        <svg
          className="collapsible__chevron"
          data-open={open ? 'true' : 'false'}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id={panelId} className="collapsible__panel" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
