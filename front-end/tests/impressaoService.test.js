import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKitchenTickets,
  buildReceiptHtml,
  buildReceiptText,
  loadPrintSettings,
  loadSavedSale,
  printPersistedSale,
  savePrintSettings,
} from '../src/services/impressaoService.js';

function installLocalStorage() {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  });
  return () => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  };
}

test('printer settings persist paper width and category-to-sector assignments', () => {
  const restore = installLocalStorage();
  try {
    const settings = loadPrintSettings();
    const updated = {
      ...settings,
      paperWidth: '58mm',
      sectors: [
        { name: 'Cozinha', categories: ['Pratos na Hora', 'Salgados'] },
        { name: 'Bar', categories: ['Bebidas geladas'] },
      ],
    };

    savePrintSettings(updated);

    assert.deepEqual(loadPrintSettings(), updated);
    assert.throws(
      () => savePrintSettings({ ...updated, sectors: [{ name: 'Cozinha', categories: ['Salgados', 'Salgados'] }] }),
      /categoria.*mais de um setor/i,
    );
  } finally {
    restore();
  }
});

test('receipt HTML uses the committed sale fields and escapes untrusted text', () => {
  const html = buildReceiptHtml({
    _id: 'sale-123',
    numero: '000123',
    clienteNome: '<script>alert(1)</script>',
    total: 12.5,
    pagamentos: [{ tipo: 'pix', valorRecebido: 12.5 }],
    itens: [{ nome: '<b>Suco</b>', quantidade: 1, precoUnitario: 12.5 }],
  });

  assert.match(html, /Pedido:<\/span><span>#000123/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;b&gt;Suco&lt;\/b&gt;/);
  assert.match(html, /12,50/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});

test('kitchen tickets are separated by configured sector using product categories', () => {
  const tickets = buildKitchenTickets({
    numero: '42',
    mesa: '7',
    tipoAtendimento: 'mesa',
    itens: [
      { produtoId: 'p1', nome: 'Prato', quantidade: 1, aFazer: true },
      { produtoId: 'p2', nome: 'Suco', quantidade: 2, aFazer: true },
      { produtoId: 'p3', nome: 'Bala', quantidade: 1, aFazer: true },
    ],
  }, {
    sectors: [
      { name: 'Cozinha', categories: ['Pratos na Hora'] },
      { name: 'Bar', categories: ['Bebidas geladas'] },
    ],
    categoriesByProduct: {
      p1: 'Pratos na Hora',
      p2: 'Bebidas geladas',
      p3: 'Outros',
    },
  });

  assert.deepEqual(tickets.map(({ sector }) => sector), ['Cozinha', 'Bar']);
  assert.match(tickets[0].html, /1 x Prato/);
  assert.match(tickets[0].html, /1 x Bala/);
  assert.doesNotMatch(tickets[0].html, /Suco/);
  assert.match(tickets[1].html, /Mesa 7/);
  assert.match(tickets[1].html, /2 x Suco/);
});

test('reprinting resolves the sale from persisted GET data and never creates a sale', async () => {
  const sale = { _id: 'persisted-1', numero: '000009', itens: [] };
  const calls = [];
  const api = {
    async get(path) {
      calls.push(['get', path]);
      return { data: [{ _id: 'other-sale' }, sale] };
    },
    async post(...args) {
      calls.push(['post', ...args]);
      throw new Error('A reimpressão não deve criar vendas.');
    },
  };

  assert.equal(await loadSavedSale('persisted-1', api), sale);
  assert.deepEqual(calls, [['get', '/vendas']]);
});

test('reprinting reports a missing persisted sale instead of printing stale sale data', async () => {
  const api = {
    async get() {
      return { data: [] };
    },
  };

  await assert.rejects(loadSavedSale('removed-sale', api), /venda salva não foi encontrada/i);
});

test('USB print failure after a committed sale never sends another sale request', async () => {
  const restore = installLocalStorage();
  const calls = [];
  globalThis.localStorage.setItem('restaurante_pdv_printer', JSON.stringify({ type: 'serial' }));
  const api = {
    async get(path) {
      calls.push(['get', path]);
      return { data: [{ _id: 'already-committed', numero: '000010', total: 5, itens: [] }] };
    },
    async post(...args) {
      calls.push(['post', ...args]);
    },
  };
  try {
    await assert.rejects(
      printPersistedSale('already-committed', api),
      /USB\/serial foi desconectada/i,
    );
    assert.deepEqual(calls, [['get', '/vendas']]);
  } finally {
    restore();
  }
});

test('thermal receipt lines wrap to the configured 58 mm paper width', () => {
  const text = buildReceiptText({
    numero: '000011',
    total: 10,
    itens: [{ nome: 'Produto com uma descrição muito longa para bobina estreita', quantidade: 1, precoUnitario: 10 }],
  }, { paperWidth: '58mm' });

  assert.ok(text.split('\n').every((line) => line.length <= 32));
  assert.match(text, /descrição/);
});

test('ESC/POS receipt text removes command control characters from persisted product names', () => {
  const text = buildReceiptText({
    numero: '000012',
    total: 1,
    itens: [{ nome: 'Produto\u001b@Controlado', quantidade: 1, precoUnitario: 1 }],
  });

  assert.equal(text.includes(String.fromCharCode(27)), false);
  assert.match(text, /Produto @Controlado/);
});
