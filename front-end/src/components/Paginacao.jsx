import { PAGE_SIZES } from '../hooks/useUrlPagination.js';

export default function Paginacao({
  pagination,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  label = 'Registros',
}) {
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 0;

  return <>
    <nav className="paginacao" aria-label={`Paginação de ${label.toLowerCase()}`}>
      <span className="paginacao-total">{total} {label.toLowerCase()}</span>
      <label>
        Por página
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} aria-label="Itens por página">
          {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <span className="paginacao-pagina">Página {page} de {totalPages || 1}</span>
      <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>Anterior</button>
      <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>Próxima</button>
    </nav>
    <style>{`
      .paginacao { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:8px; margin-top:12px; color:var(--text-secondary); font-size:12px; }
      .paginacao label { display:flex; align-items:center; gap:6px; }
      .paginacao select, .paginacao button { min-height:34px; padding:6px 9px; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-tertiary); color:var(--text-primary); font:inherit; }
      .paginacao button { cursor:pointer; }
      .paginacao button:disabled { opacity:.5; cursor:not-allowed; }
      .paginacao-pagina { min-width:84px; text-align:center; }
      @media(max-width:520px) { .paginacao { justify-content:flex-start; } .paginacao-total { flex:1 1 100%; } }
    `}</style>
  </>;
}
