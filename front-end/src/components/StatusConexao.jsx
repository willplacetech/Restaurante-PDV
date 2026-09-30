import { useFilaOffline } from '../hooks/useFilaOffline';

export default function StatusConexao() {
  const { isOnline, pendingCount, isNearLimit, isAtLimit } = useFilaOffline();

  if (isOnline && pendingCount === 0) {
    return (
      <div className="status-conexao status-conexao--online" role="status" aria-live="polite">
        <span className="status-conexao__icon" aria-hidden="true">✅</span>
        <span className="status-conexao__text">Conectado</span>
      </div>
    );
  }

  return (
    <div className={`status-conexao status-conexao--offline ${isAtLimit ? 'status-conexao--critical' : ''}`} role="alert" aria-live="assertive">
      <span className="status-conexao__icon" aria-hidden="true">⚠️</span>
      <span className="status-conexao__text">
        {isOnline
          ? `Sincronizando... ${pendingCount} venda${pendingCount !== 1 ? 's' : ''} pendente${pendingCount !== 1 ? 's' : ''}`
          : `Sem internet — ${pendingCount} venda${pendingCount !== 1 ? 's' : ''} salva${pendingCount !== 1 ? 's' : ''} localmente`}
      </span>
      {isNearLimit && !isAtLimit && (
        <span className="status-conexao__warning">
          Atenção: fila quase cheia ({pendingCount}/50)
        </span>
      )}
      {isAtLimit && (
        <span className="status-conexao__critical">
          ⛔ Limite atingido! Conecte à internet para sincronizar.
        </span>
      )}
    </div>
  );
}