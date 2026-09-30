import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'pdv_fila_offline';
const MAX_PENDING = 50;
const RETRY_INTERVAL = 30000;

function getQueue() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Erro ao salvar fila offline:', error);
  }
}

function generateIdTemporario() {
  return `tmp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function useFilaOffline() {
  const [queue, setQueue] = useState(() => getQueue());
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(processing);
  const queueRef = useRef(queue);

  useEffect(() => {
    processingRef.current = processing;
  }, [processing]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const processQueue = useCallback(async () => {
    if (queueRef.current.length === 0 || processingRef.current) return;

    setProcessing(true);
    const currentQueue = getQueue();
    const pending = [...currentQueue];
    let hasChanges = false;

    for (const item of pending) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: {
            'Content-Type': 'application/json',
            ...(item.headers || {}),
          },
          body: item.body,
          credentials: 'include',
        });

        if (response.ok) {
          const result = await response.json();
          console.log('[FilaOffline] Item sincronizado:', item.idTemporario, result);
          const updatedQueue = getQueue().filter((i) => i.idTemporario !== item.idTemporario);
          saveQueue(updatedQueue);
          setQueue(updatedQueue);
          hasChanges = true;
        } else if (response.status === 409) {
          console.log('[FilaOffline] Duplicata detectada, removendo:', item.idTemporario);
          const updatedQueue = getQueue().filter((i) => i.idTemporario !== item.idTemporario);
          saveQueue(updatedQueue);
          setQueue(updatedQueue);
          hasChanges = true;
        } else {
          console.warn('[FilaOffline] Falha ao sincronizar:', item.idTemporario, response.status);
        }
      } catch (error) {
        console.error('[FilaOffline] Erro ao sincronizar:', item.idTemporario, error);
      }
    }

    if (hasChanges) {
      setQueue(getQueue());
    }
    setProcessing(false);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(() => {
      if (isOnline && queueRef.current.length > 0 && !processingRef.current) {
        processQueue();
      }
    }, RETRY_INTERVAL);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [isOnline, processQueue]);

  const addToQueue = useCallback((vendaData) => {
    const currentQueue = getQueue();

    if (currentQueue.length >= MAX_PENDING) {
      throw new Error('Limite de vendas offline atingido (50). Conecte à internet para sincronizar.');
    }

    const idTemporario = generateIdTemporario();
    const item = {
      idTemporario,
      url: '/api/vendas',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...vendaData, idTemporario }),
      timestamp: Date.now(),
      status: 'pendente',
    };

    const newQueue = [...currentQueue, item];
    saveQueue(newQueue);
    setQueue(newQueue);
    return idTemporario;
  }, []);

  const removeFromQueue = useCallback((idTemporario) => {
    const updatedQueue = getQueue().filter((item) => item.idTemporario !== idTemporario);
    saveQueue(updatedQueue);
    setQueue(updatedQueue);
  }, []);

  const clearQueue = useCallback(() => {
    saveQueue([]);
    setQueue([]);
  }, []);

  const isNearLimit = queue.length >= MAX_PENDING * 0.8;
  const isAtLimit = queue.length >= MAX_PENDING;

  return {
    queue,
    isOnline,
    processing,
    addToQueue,
    removeFromQueue,
    clearQueue,
    pendingCount: queue.length,
    isNearLimit,
    isAtLimit,
    maxPending: MAX_PENDING,
  };
}