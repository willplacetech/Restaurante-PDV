import { useSearchParams } from 'react-router-dom';

export default function DashboardTabs({ value, onChange }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectTab = (tab) => {
    const nextParams = new URLSearchParams(searchParams);
    if (tab === 'vendas') nextParams.delete('aba');
    else nextParams.set('aba', tab);
    setSearchParams(nextParams, { replace: true });
    onChange?.(tab);
  };

  return <nav className="dashboard-tabs" aria-label="Visão do dashboard" role="tablist">
    <button type="button" role="tab" aria-selected={value === 'vendas'} className={value === 'vendas' ? 'active' : ''} onClick={() => selectTab('vendas')}>Vendas</button>
    <button type="button" role="tab" aria-selected={value === 'producao'} className={value === 'producao' ? 'active' : ''} onClick={() => selectTab('producao')}>Produção</button>
  </nav>;
}
