/**
 * Estado vazio reutilizavel: titulo, explicacao curta e (opcionalmente) uma acao.
 * `tone="error"` troca o visual para o padrao de erro e anuncia com role="alert".
 */
export default function EmptyState({ icon = '📭', title, description, tone = 'default', children }) {
  const isError = tone === 'error';

  return (
    <div className={`state${isError ? ' state--error' : ''}`} {...(isError ? { role: 'alert', 'aria-live': 'assertive' } : {})}>
      <span className="state__icon" aria-hidden="true">{icon}</span>
      <span className="state__title">{title}</span>
      {description ? <span className="state__text">{description}</span> : null}
      {children ? <div className="state__actions">{children}</div> : null}
    </div>
  );
}
