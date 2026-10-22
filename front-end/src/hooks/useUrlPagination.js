import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const PAGE_SIZES = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

const positiveInteger = (value, fallback) => {
  if (!/^\d+$/.test(String(value || ''))) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export default function useUrlPagination({ defaultFilters = {}, defaultPageSize = DEFAULT_PAGE_SIZE } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = positiveInteger(searchParams.get('page'), 1);
  const requestedPageSize = positiveInteger(searchParams.get('pageSize'), defaultPageSize);
  const pageSize = PAGE_SIZES.includes(requestedPageSize) ? requestedPageSize : defaultPageSize;
  const search = searchParams.toString();
  const filterKey = useMemo(() => {
    const filters = new URLSearchParams(search);
    filters.delete('page');
    filters.delete('pageSize');
    filters.delete('aba');
    return filters.toString();
  }, [search]);
  const filters = useMemo(() => Object.fromEntries(new URLSearchParams(filterKey)), [filterKey]);

  const defaultFiltersKey = JSON.stringify(defaultFilters);

  useEffect(() => {
    const current = new URLSearchParams(search);
    let changed = false;
    if (current.has('page') && String(page) !== current.get('page')) {
      current.set('page', String(page));
      changed = true;
    }
    if (current.has('pageSize') && String(pageSize) !== current.get('pageSize')) {
      current.set('pageSize', String(pageSize));
      changed = true;
    }
    const initialFilters = JSON.parse(defaultFiltersKey);
    const hasAnyDefaultFilter = Object.keys(initialFilters).some((key) => current.has(key));
    if (!hasAnyDefaultFilter && Object.keys(initialFilters).length) {
      Object.entries(initialFilters).forEach(([key, value]) => current.set(key, value));
      changed = true;
    }
    if (changed) setSearchParams(current, { replace: true });
  }, [defaultFiltersKey, page, pageSize, search, setSearchParams]);

  const updateSearch = (updates, { replace = false } = {}) => {
    const current = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') current.delete(key);
      else current.set(key, String(value));
    });
    setSearchParams(current, { replace });
  };

  const setPage = (nextPage) => {
    const value = Number(nextPage);
    if (Number.isSafeInteger(value) && value > 0) updateSearch({ page: value });
  };

  const setPageSize = (nextPageSize) => {
    const value = Number(nextPageSize);
    if (PAGE_SIZES.includes(value)) updateSearch({ page: 1, pageSize: value });
  };

  const setFilters = (nextFilters) => {
    updateSearch({ ...nextFilters, page: 1 });
  };

  const setSort = (sort, order = 'asc') => {
    updateSearch({ sort, order, page: 1 });
  };

  return { page, pageSize, filters, setPage, setPageSize, setFilters, setSort };
}

export { PAGE_SIZES, DEFAULT_PAGE_SIZE };
