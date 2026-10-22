import { createRoot } from 'react-dom/client';
import { BrowserRouter, useSearchParams } from 'react-router-dom';
import DashboardTabs from '../../src/components/DashboardTabs.jsx';
import Paginacao from '../../src/components/Paginacao.jsx';
import usePagination from '../../src/hooks/usePagination.js';
import useUrlPagination from '../../src/hooks/useUrlPagination.js';

export function DashboardPaginationHarness() {
  const [searchParams] = useSearchParams();
  const pagination = useUrlPagination();
  const response = usePagination({
    endpoint: '/dashboard',
    page: pagination.page,
    pageSize: pagination.pageSize,
    filters: pagination.filters,
    itemsPath: 'relatorioClientes.clientes',
  });
  const dashboardTab = searchParams.get('aba') === 'producao' ? 'producao' : 'vendas';

  return <>
    <DashboardTabs value={dashboardTab} />
    <label>Início do relatório
      <input
        aria-label="Início do relatório"
        type="date"
        value={pagination.filters.dataInicio || ''}
        onChange={(event) => pagination.setFilters({ dataInicio: event.target.value, dataFim: pagination.filters.dataFim })}
      />
    </label>
    <label>Fim do relatório
      <input
        aria-label="Fim do relatório"
        type="date"
        value={pagination.filters.dataFim || ''}
        onChange={(event) => pagination.setFilters({ dataInicio: pagination.filters.dataInicio, dataFim: event.target.value })}
      />
    </label>
    <div className="dashboard-customer-list">
      {response.items.map((customer) => <div className="dashboard-customer" key={String(customer.id)}>{customer.nome}</div>)}
    </div>
    <Paginacao
      pagination={response.pagination}
      page={pagination.page}
      pageSize={pagination.pageSize}
      onPageChange={pagination.setPage}
      onPageSizeChange={pagination.setPageSize}
      label="clientes"
    />
  </>;
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <DashboardPaginationHarness />
  </BrowserRouter>,
);
