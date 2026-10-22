export const MAX_PENDING_SALES = 50;

const DATABASE_NAME = 'restaurante-pdv-offline';
const DATABASE_VERSION = 1;
const SALES_STORE = 'sales';
const OWNER_INDEX = 'ownerId';
const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 15 * 60_000;
const CLAIM_LEASE_MS = 60_000;

export function createOperationId() {
  if (globalThis.crypto?.randomUUID) return `tmp_${globalThis.crypto.randomUUID()}`;
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falha ao acessar a fila offline.'));
  });
}

function transactionResult(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error || new Error('Transação offline cancelada.'));
    transaction.onerror = () => reject(transaction.error || new Error('Falha na transação offline.'));
  });
}

function requireOwnerId(ownerId) {
  if (typeof ownerId !== 'string' || !ownerId.trim()) {
    throw new Error('Não foi possível identificar a conta da venda offline.');
  }
  return ownerId;
}

function errorMessage(error) {
  return error?.response?.data?.msg
    || error?.response?.data?.message
    || error?.message
    || 'Falha ao sincronizar a venda.';
}

function isRetryable(error) {
  const status = Number(error?.response?.status);
  return !status || status === 408 || status === 425 || status === 429 || status === 401 || status === 403 || status >= 500;
}

function retryDelay(attempts) {
  return Math.min(RETRY_BASE_MS * (2 ** Math.max(0, attempts - 1)), RETRY_MAX_MS);
}

export function createOfflineStore({
  indexedDB = globalThis.indexedDB,
  dbName = DATABASE_NAME,
} = {}) {
  if (!indexedDB) {
    throw new Error('IndexedDB não está disponível neste navegador.');
  }

  let databasePromise;

  function openDatabase() {
    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(SALES_STORE)) {
            const sales = database.createObjectStore(SALES_STORE, { keyPath: 'idTemporario' });
            sales.createIndex(OWNER_INDEX, 'ownerId', { unique: false });
            sales.createIndex('createdAt', 'createdAt', { unique: false });
          }
        };
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => {
            database.close();
            databasePromise = null;
          };
          resolve(database);
        };
        request.onerror = () => {
          databasePromise = null;
          reject(request.error || new Error('Não foi possível abrir a fila offline.'));
        };
        request.onblocked = () => {
          databasePromise = null;
          reject(new Error('A fila offline está aberta em outra versão do aplicativo.'));
        };
      });
    }
    return databasePromise;
  }

  async function listSales(ownerId) {
    const owner = requireOwnerId(ownerId);
    const database = await openDatabase();
    const transaction = database.transaction(SALES_STORE, 'readonly');
    const result = await requestResult(transaction.objectStore(SALES_STORE).index(OWNER_INDEX).getAll(owner));
    return result.sort((first, second) => first.createdAt - second.createdAt);
  }

  async function enqueueSale({ ownerId, sale, idTemporario = createOperationId(), now = Date.now() }) {
    const owner = requireOwnerId(ownerId);
    if (!sale || typeof sale !== 'object' || Array.isArray(sale)) {
      throw new Error('Os dados da venda offline são inválidos.');
    }

    const database = await openDatabase();
    const transaction = database.transaction(SALES_STORE, 'readwrite');
    const finished = transactionResult(transaction);
    const sales = transaction.objectStore(SALES_STORE);

    try {
      const existing = await requestResult(sales.get(idTemporario));
      if (existing) {
        if (existing.ownerId !== owner) {
          throw new Error('O identificador da operação pertence a outra conta.');
        }
        await finished;
        return existing.idTemporario;
      }

      const count = await requestResult(sales.index(OWNER_INDEX).count(owner));
      if (count >= MAX_PENDING_SALES) {
        throw new Error(`Limite de vendas offline atingido (${MAX_PENDING_SALES}).`);
      }

      const item = {
        idTemporario,
        ownerId: owner,
        sale,
        status: 'pending',
        attempts: 0,
        lastError: null,
        nextRetryAt: now,
        createdAt: now,
        updatedAt: now,
        claimExpiresAt: null,
      };
      await requestResult(sales.add(item));
      await finished;
      return idTemporario;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already be complete.
      }
      await finished.catch(() => {});
      throw error;
    }
  }

  async function updateSale(idTemporario, ownerId, changes) {
    const owner = requireOwnerId(ownerId);
    const database = await openDatabase();
    const transaction = database.transaction(SALES_STORE, 'readwrite');
    const finished = transactionResult(transaction);
    const sales = transaction.objectStore(SALES_STORE);
    const item = await requestResult(sales.get(idTemporario));

    if (!item || item.ownerId !== owner) {
      await finished;
      return null;
    }

    const updated = { ...item, ...changes, updatedAt: Date.now() };
    await requestResult(sales.put(updated));
    await finished;
    return updated;
  }

  async function claimSale(idTemporario, ownerId, now) {
    const owner = requireOwnerId(ownerId);
    const database = await openDatabase();
    const transaction = database.transaction(SALES_STORE, 'readwrite');
    const finished = transactionResult(transaction);
    const sales = transaction.objectStore(SALES_STORE);
    const item = await requestResult(sales.get(idTemporario));

    if (
      !item
      || item.ownerId !== owner
      || item.status === 'conflict'
      || (item.status === 'error' && item.nextRetryAt != null && item.nextRetryAt > now)
      || (item.status === 'syncing' && item.claimExpiresAt > now)
    ) {
      await finished;
      return null;
    }

    const claimed = {
      ...item,
      status: 'syncing',
      attempts: item.attempts + 1,
      lastAttemptAt: now,
      nextRetryAt: null,
      claimExpiresAt: now + CLAIM_LEASE_MS,
      updatedAt: now,
    };
    await requestResult(sales.put(claimed));
    await finished;
    return claimed;
  }

  async function removeSale(idTemporario, ownerId) {
    const owner = requireOwnerId(ownerId);
    const database = await openDatabase();
    const transaction = database.transaction(SALES_STORE, 'readwrite');
    const finished = transactionResult(transaction);
    const sales = transaction.objectStore(SALES_STORE);
    const item = await requestResult(sales.get(idTemporario));

    if (item?.ownerId === owner) {
      sales.delete(idTemporario);
    }
    await finished;
    return item?.ownerId === owner;
  }

  async function removeAllSales(ownerId) {
    const items = await listSales(ownerId);
    await Promise.all(items.map((item) => removeSale(item.idTemporario, ownerId)));
  }

  async function close() {
    if (!databasePromise) return;
    const database = await databasePromise;
    database.close();
    databasePromise = null;
  }

  async function deleteDatabase() {
    await close();
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error || new Error('Não foi possível remover a fila de teste.'));
      request.onblocked = () => reject(new Error('A fila offline ainda está aberta.'));
    });
  }

  return {
    claimSale,
    close,
    deleteDatabase,
    enqueueSale,
    listSales,
    removeAllSales,
    removeSale,
    updateSale,
  };
}

export const offlineStore = createOfflineStore();

export async function syncOfflineQueue({
  ownerId,
  store = offlineStore,
  sendSale,
  now = Date.now(),
  isOwnerCurrent = () => true,
}) {
  if (!ownerId || !isOwnerCurrent()) return;
  if (typeof sendSale !== 'function') throw new Error('A sincronização precisa de uma função de envio.');

  const sales = await store.listSales(ownerId);
  for (const sale of sales) {
    if (!isOwnerCurrent()) return;
    const claimed = await store.claimSale(sale.idTemporario, ownerId, now);
    if (!claimed) continue;

    try {
      const response = await sendSale(claimed);
      const status = Number(response?.status || 200);
      if (status < 200 || status >= 300) {
        const responseError = new Error(errorMessage({ response }));
        responseError.response = response;
        throw responseError;
      }
      await store.removeSale(claimed.idTemporario, ownerId);
    } catch (error) {
      if (Number(error?.response?.status) === 409) {
        await store.updateSale(claimed.idTemporario, ownerId, {
          status: 'conflict',
          lastError: errorMessage(error),
          nextRetryAt: null,
          claimExpiresAt: null,
        });
        continue;
      }

      const retryAt = isRetryable(error)
        ? now + retryDelay(claimed.attempts)
        : null;
      await store.updateSale(claimed.idTemporario, ownerId, {
        status: 'error',
        lastError: errorMessage(error),
        nextRetryAt: retryAt,
        claimExpiresAt: null,
      });
    }
  }
}
