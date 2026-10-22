import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api.jsx';

const getPath = (value, path) => path.split('.').reduce((current, key) => current?.[key], value);

export default function usePagination({
  endpoint,
  page,
  pageSize,
  filters = {},
  itemsPath = 'items',
  enabled = true,
}) {
  const [result, setResult] = useState({ requestKey: null, data: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const params = useMemo(() => ({ ...filters, page, pageSize }), [filters, page, pageSize]);
  const requestKey = JSON.stringify([endpoint, params, enabled, reloadKey]);

  useEffect(() => {
    if (!enabled) return undefined;

    let currentRequest = true;
    api.get(endpoint, { params })
      .then((response) => {
        if (currentRequest) setResult({ requestKey, data: response.data, error: null });
      })
      .catch((requestError) => {
        if (currentRequest) setResult({ requestKey, data: null, error: requestError });
      });

    return () => {
      currentRequest = false;
    };
  }, [enabled, endpoint, params, reloadKey, requestKey]);

  const reload = useCallback(() => setReloadKey((current) => current + 1), []);
  const isCurrentResult = result.requestKey === requestKey;
  const data = isCurrentResult ? result.data : null;
  const error = isCurrentResult ? result.error : null;
  const items = data && getPath(data, itemsPath);

  return {
    data,
    items: Array.isArray(items) ? items : [],
    pagination: data?.pagination || null,
    loading: Boolean(enabled && !isCurrentResult),
    error,
    reload,
  };
}
