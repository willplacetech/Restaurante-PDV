import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const workerSource = await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8');

test('clears the stale PDV cache and reloads clients at the SPA root', async () => {
  const deletedCaches = [];
  const navigatedClients = [];
  const lifecycleHandlers = new Map();
  const clients = [{
    url: 'https://restaurante-pdv.onrender.com/pdv',
    navigate: async (url) => {
      navigatedClients.push(url);
    },
  }];
  const self = {
    addEventListener: (eventName, handler) => lifecycleHandlers.set(eventName, handler),
    skipWaiting: async () => {},
    clients: {
      claim: async () => {},
      matchAll: async () => clients,
    },
  };
  const caches = {
    has: async (name) => name === 'pdv-static-v1',
    delete: async (name) => {
      deletedCaches.push(name);
      return true;
    },
  };

  runInNewContext(workerSource, { self, caches, URL });
  const activationWaits = [];
  lifecycleHandlers.get('activate')({
    waitUntil: (promise) => activationWaits.push(promise),
  });
  await Promise.all(activationWaits);

  assert.deepEqual(deletedCaches, ['pdv-static-v1']);
  assert.deepEqual(navigatedClients, ['https://restaurante-pdv.onrender.com/']);
});
