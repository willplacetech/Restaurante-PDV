import {
  createOfflineStore,
  syncOfflineQueue,
} from '../../src/services/offlineStore.js';

describe('offline sales queue', () => {
  let store;
  let dbName;

  beforeEach(() => {
    dbName = `offline-sales-test-${Date.now()}-${Math.random()}`;
    store = createOfflineStore({ indexedDB: globalThis.indexedDB, dbName });
  });

  afterEach(async () => {
    await store.deleteDatabase();
  });

  it('persists a queued sale when the store is reopened', async () => {
    const sale = { itens: [{ produtoId: 'produto-1', quantidade: 1 }] };
    const idTemporario = await store.enqueueSale({
      ownerId: 'operador-1',
      sale,
      now: 100,
    });
    const reopenedStore = createOfflineStore({ indexedDB: globalThis.indexedDB, dbName });

    const [persisted] = await reopenedStore.listSales('operador-1');

    expect(persisted.idTemporario).to.equal(idTemporario);
    expect(persisted.sale).to.deep.equal(sale);
    expect(persisted.status).to.equal('pending');
    await reopenedStore.close();
  });

  it('never replays a sale for a different owner', async () => {
    await store.enqueueSale({
      ownerId: 'operador-original',
      sale: { itens: [] },
      now: 100,
    });
    const sendSale = cy.stub().resolves({ status: 201, data: {} });

    await syncOfflineQueue({
      ownerId: 'outro-operador',
      store,
      sendSale,
      now: 100,
    });

    expect(sendSale).not.to.have.been.called;
    expect(await store.listSales('operador-original')).to.have.length(1);
  });

  it('keeps one stable operation id through retry and confirmed duplicate replay', async () => {
    const idTemporario = await store.enqueueSale({
      ownerId: 'operador-1',
      sale: { itens: [{ produtoId: 'produto-1', quantidade: 1 }] },
      now: 100,
    });
    const sendSale = cy.stub()
      .onFirstCall().rejects(new Error('network unavailable'))
      .onSecondCall().resolves({ status: 200, data: { duplicata: true } });

    await syncOfflineQueue({ ownerId: 'operador-1', store, sendSale, now: 100 });
    const [failed] = await store.listSales('operador-1');

    expect(failed.status).to.equal('error');
    expect(failed.attempts).to.equal(1);
    expect(failed.nextRetryAt).to.be.greaterThan(100);
    expect(failed.idTemporario).to.equal(idTemporario);

    await syncOfflineQueue({
      ownerId: 'operador-1',
      store,
      sendSale,
      now: failed.nextRetryAt - 1,
    });
    expect(sendSale).to.have.been.calledOnce;

    await syncOfflineQueue({
      ownerId: 'operador-1',
      store,
      sendSale,
      now: failed.nextRetryAt,
    });

    expect(sendSale).to.have.been.calledTwice;
    expect(sendSale.secondCall.args[0].idTemporario).to.equal(idTemporario);
    expect(await store.listSales('operador-1')).to.have.length(0);
  });

  it('keeps a server conflict visible and does not retry it automatically', async () => {
    const idTemporario = await store.enqueueSale({
      ownerId: 'operador-1',
      sale: { itens: [] },
      now: 100,
    });
    const sendSale = cy.stub().rejects({ response: { status: 409, data: { msg: 'Conflito' } } });

    await syncOfflineQueue({ ownerId: 'operador-1', store, sendSale, now: 100 });
    const [conflicted] = await store.listSales('operador-1');

    expect(conflicted.status).to.equal('conflict');
    expect(conflicted.lastError).to.contain('Conflito');
    expect(conflicted.idTemporario).to.equal(idTemporario);
    await syncOfflineQueue({ ownerId: 'operador-1', store, sendSale, now: 100000 });
    expect(sendSale).to.have.been.calledOnce;
  });
});
