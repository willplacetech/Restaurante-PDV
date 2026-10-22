import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  createOperationId,
  MAX_PENDING_SALES,
  offlineStore,
  syncOfflineQueue,
} from '../services/offlineStore.js';

const RETRY_INTERVAL = 30000;
const QUEUE_CHANGE_EVENT = 'pdv-offline-queue-change';

function getOwnerId(user) {
  const id = user?._id ?? user?.id;
  if (typeof id === 'string' && id.trim()) return id;
  if (id && typeof id.toString === 'function') return id.toString();
  return null;
}

function getRetrySummary(queue) {
  const dueTimes = queue
    .filter((item) => item.status === 'error' && Number.isFinite(item.nextRetryAt))
    .map((item) => item.nextRetryAt);
  return dueTimes.length ? Math.min(...dueTimes) : null;
}

function notifyQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(QUEUE_CHANGE_EVENT));
  }
}

export function useFilaOffline() {
  const { user } = useAuth();
  const ownerId = getOwnerId(user);
  const [queue, setQueue] = useState([]);
  const [isOnline, setIsOnline] = useState(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine
  ));
  const [processing, setProcessing] = useState(false);
  const [queueReady, setQueueReady] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const processingRef = useRef(false);
  const queueRef = useRef([]);
  const ownerRef = useRef(ownerId);

  const setQueueItems = useCallback((items) => {
    queueRef.current = items;
    setQueue(items);
  }, []);

  const refreshQueue = useCallback(async () => {
    if (!ownerId) {
      setQueueItems([]);
      setQueueReady(true);
      return [];
    }

    try {
      const items = await offlineStore.listSales(ownerId);
      setStorageError(null);
      setQueueItems(items);
      setQueueReady(true);
      return items;
    } catch (error) {
      setStorageError(error.message || 'Não foi possível acessar a fila offline.');
      setQueueItems([]);
      setQueueReady(true);
      return [];
    }
  }, [ownerId, setQueueItems]);

  const processQueue = useCallback(async () => {
    if (!ownerId || !isOnline || processingRef.current) return;

    processingRef.current = true;
    setProcessing(true);
    try {
      await syncOfflineQueue({
        ownerId,
        store: offlineStore,
        sendSale: (item) => api.post('/vendas', {
          ...item.sale,
          idTemporario: item.idTemporario,
        }),
        isOwnerCurrent: () => ownerRef.current === ownerId,
      });
      await refreshQueue();
      notifyQueueChanged();
    } catch (error) {
      setStorageError(error.message || 'Não foi possível sincronizar a fila offline.');
      await refreshQueue();
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [isOnline, ownerId, refreshQueue]);

  useEffect(() => {
    ownerRef.current = ownerId;
  }, [ownerId]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      refreshQueue().then(() => {
        if (active && typeof navigator !== 'undefined' && navigator.onLine) {
          processQueue();
        }
      });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [processQueue, refreshQueue]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processQueue();
    };
    const handleOffline = () => setIsOnline(false);
    const handleQueueChange = () => refreshQueue();
    const interval = window.setInterval(() => {
      if (isOnline && queueRef.current.length && !processingRef.current) processQueue();
    }, RETRY_INTERVAL);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(QUEUE_CHANGE_EVENT, handleQueueChange);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(QUEUE_CHANGE_EVENT, handleQueueChange);
      window.clearInterval(interval);
    };
  }, [isOnline, processQueue, refreshQueue]);

  const addToQueue = useCallback((sale) => {
    if (!ownerId) throw new Error('Entre novamente para salvar uma venda offline.');
    const ownerQueue = queueRef.current.filter((item) => item.ownerId === ownerId);
    if (ownerQueue.length >= MAX_PENDING_SALES) {
      throw new Error(`Limite de vendas offline atingido (${MAX_PENDING_SALES}). Conecte à internet para sincronizar.`);
    }

    const now = Date.now();
    const idTemporario = createOperationId();
    const optimisticItem = {
      idTemporario,
      ownerId,
      sale,
      status: 'pending',
      attempts: 0,
      lastError: null,
      nextRetryAt: now,
      createdAt: now,
      updatedAt: now,
    };
    setQueueItems([...queueRef.current, optimisticItem]);
    setQueueReady(true);
    setStorageError(null);

    offlineStore.enqueueSale({ ownerId, sale, idTemporario, now })
      .then(() => {
        notifyQueueChanged();
        if (ownerRef.current === ownerId && isOnline) processQueue();
      })
      .catch((error) => {
        setStorageError(error.message || 'Não foi possível salvar a venda offline.');
        setQueueItems(queueRef.current.map((item) => (
          item.idTemporario === idTemporario
            ? { ...item, status: 'error', lastError: error.message, nextRetryAt: null }
            : item
        )));
      });

    notifyQueueChanged();
    return idTemporario;
  }, [isOnline, ownerId, processQueue, setQueueItems]);

  const removeFromQueue = useCallback(async (idTemporario) => {
    if (!ownerId) return;
    await offlineStore.removeSale(idTemporario, ownerId);
    await refreshQueue();
    notifyQueueChanged();
  }, [ownerId, refreshQueue]);

  const retry = useCallback(async (idTemporario) => {
    if (!ownerId) return;
    const item = queueRef.current.find((entry) => (
      entry.idTemporario === idTemporario && entry.ownerId === ownerId
    ));
    if (!item || item.status !== 'error') return;

    await offlineStore.updateSale(idTemporario, ownerId, {
      status: 'pending',
      lastError: null,
      nextRetryAt: Date.now(),
      claimExpiresAt: null,
    });
    await refreshQueue();
    notifyQueueChanged();
    if (isOnline) processQueue();
  }, [isOnline, ownerId, processQueue, refreshQueue]);

  const retryFailed = useCallback(async () => {
    const failures = queueRef.current.filter((item) => (
      item.ownerId === ownerId && item.status === 'error'
    ));
    await Promise.all(failures.map((item) => offlineStore.updateSale(
      item.idTemporario,
      ownerId,
      {
        status: 'pending',
        lastError: null,
        nextRetryAt: Date.now(),
        claimExpiresAt: null,
      },
    )));
    await refreshQueue();
    notifyQueueChanged();
    if (isOnline) processQueue();
  }, [isOnline, ownerId, processQueue, refreshQueue]);

  const clearQueue = useCallback(async () => {
    if (!ownerId) return;
    await offlineStore.removeAllSales(ownerId);
    await refreshQueue();
    notifyQueueChanged();
  }, [ownerId, refreshQueue]);

  const visibleQueue = ownerId
    ? queue.filter((item) => item.ownerId === ownerId)
    : [];
  const errorCount = visibleQueue.filter((item) => (
    item.status === 'error' || item.status === 'conflict'
  )).length;
  const retryingCount = visibleQueue.filter((item) => item.status === 'syncing').length;
  const pendingCount = visibleQueue.length;
  const isNearLimit = pendingCount >= MAX_PENDING_SALES * 0.8;
  const isAtLimit = pendingCount >= MAX_PENDING_SALES;

  return {
    queue: visibleQueue,
    isOnline,
    processing,
    queueReady,
    storageError,
    errorCount,
    failedCount: errorCount,
    retryingCount,
    nextRetryAt: getRetrySummary(visibleQueue),
    addToQueue,
    removeFromQueue,
    retry,
    retryFailed,
    clearQueue,
    pendingCount,
    isNearLimit,
    isAtLimit,
    maxPending: MAX_PENDING_SALES,
  };
}
