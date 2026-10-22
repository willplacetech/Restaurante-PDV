import { buildNotaVendaHtml } from '../utils/notaVenda.js';

const SETTINGS_KEY = 'restaurante_pdv_print_settings';
const PRINTER_KEY = 'restaurante_pdv_printer';
const BLE_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];

const DEFAULT_SETTINGS = {
  paperWidth: '80mm',
  sectors: [{ name: 'Cozinha', categories: [] }],
};

let serialPort = null;
let bluetoothDevice = null;
let bluetoothCharacteristic = null;

const storage = () => {
  if (!globalThis.localStorage) throw new Error('O armazenamento local não está disponível.');
  return globalThis.localStorage;
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));

const cleanText = (value) => Array.from(String(value ?? ''), (character) => {
  const code = character.codePointAt(0);
  return code < 32 || code === 127 ? ' ' : character;
}).join('').replace(/\s+/g, ' ').trim();
const money = (value) => Number(value || 0).toFixed(2).replace('.', ',');
const quantity = (item) => `${Number(item.quantidade || 0)} x ${cleanText(item.nome || 'Item')}`;
const lineWidth = (paperWidth) => paperWidth === '58mm' ? 32 : 48;

function wrapText(value, width) {
  const words = cleanText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const parts = [...word].reduce((chunks, character) => {
      const last = chunks.length - 1;
      if (last < 0 || [...chunks[last]].length === width) chunks.push(character);
      else chunks[last] += character;
      return chunks;
    }, []);
    for (const part of parts) {
      if (line && line.length + part.length + 1 > width) {
        lines.push(line);
        line = part;
      } else {
        line = line ? `${line} ${part}` : part;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function loadPrintSettings() {
  try {
    const saved = storage().getItem(SETTINGS_KEY);
    if (!saved) return structuredClone(DEFAULT_SETTINGS);
    const settings = JSON.parse(saved);
    validateSettings(settings);
    return settings;
  } catch (error) {
    throw new Error(`Não foi possível carregar as configurações de impressão: ${error.message}`, { cause: error });
  }
}

export function savePrintSettings(settings) {
  validateSettings(settings);
  storage().setItem(SETTINGS_KEY, JSON.stringify(settings));
  return settings;
}

function validateSettings(settings) {
  if (!settings || !['58mm', '80mm'].includes(settings.paperWidth)
    || !Array.isArray(settings.sectors) || !settings.sectors.length
    || settings.sectors.some((sector) => !sector || typeof sector.name !== 'string' || !sector.name.trim()
      || !Array.isArray(sector.categories) || sector.categories.some((category) => typeof category !== 'string'))) {
    throw new TypeError('Informe uma largura de bobina válida e mantenha pelo menos um setor.');
  }
  if (new Set(settings.sectors.map((sector) => sector.name.trim().toLocaleLowerCase())).size !== settings.sectors.length) {
    throw new TypeError('Os nomes dos setores não podem se repetir.');
  }
  const categories = settings.sectors.flatMap((sector) => sector.categories);
  if (new Set(categories).size !== categories.length) {
    throw new TypeError('Uma categoria não pode pertencer a mais de um setor.');
  }
}

export function loadPrinterPreference() {
  const saved = storage().getItem(PRINTER_KEY);
  if (!saved) return null;
  const preference = JSON.parse(saved);
  if (!preference || !['system', 'serial', 'bluetooth'].includes(preference.type)) {
    throw new Error('A conexão salva da impressora é inválida.');
  }
  return preference;
}

export async function connectPrinter(type) {
  if (type === 'system') {
    const preference = { type, name: 'Impressora do sistema' };
    storage().setItem(PRINTER_KEY, JSON.stringify(preference));
    serialPort = null;
    bluetoothDevice = null;
    bluetoothCharacteristic = null;
    return preference;
  }

  if (type === 'serial') {
    if (!globalThis.navigator?.serial) {
      throw new Error('USB/serial não é compatível com este navegador. Use a impressão do sistema ou Bluetooth BLE.');
    }
    try {
      serialPort = await globalThis.navigator.serial.requestPort();
      const info = serialPort.getInfo();
      const preference = {
        type,
        vendorId: info.usbVendorId ?? null,
        productId: info.usbProductId ?? null,
        name: [info.usbVendorId, info.usbProductId].filter(Boolean)
          .map((id) => id.toString(16).toUpperCase().padStart(4, '0')).join(':') || 'Impressora USB/serial',
      };
      storage().setItem(PRINTER_KEY, JSON.stringify(preference));
      bluetoothDevice = null;
      bluetoothCharacteristic = null;
      return preference;
    } catch (error) {
      throw new Error(error.message || 'Não foi possível conectar à impressora USB/serial.', { cause: error });
    }
  }

  if (type === 'bluetooth') {
    if (!globalThis.navigator?.bluetooth) {
      throw new Error('Bluetooth BLE não é compatível com este navegador. Bluetooth clássico não é suportado pela Web Bluetooth.');
    }
    try {
      bluetoothDevice = await globalThis.navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_SERVICES,
      });
      bluetoothCharacteristic = await findWritableCharacteristic(bluetoothDevice);
      const preference = { type, deviceId: bluetoothDevice.id, name: bluetoothDevice.name || 'Impressora Bluetooth BLE' };
      storage().setItem(PRINTER_KEY, JSON.stringify(preference));
      serialPort = null;
      return preference;
    } catch (error) {
      bluetoothDevice = null;
      bluetoothCharacteristic = null;
      throw new Error(error.message || 'Não foi possível conectar à impressora Bluetooth BLE.', { cause: error });
    }
  }

  throw new TypeError('Escolha uma conexão de impressora compatível.');
}

export function getPrinterStatus() {
  const preference = loadPrinterPreference();
  if (!preference) return { preference: null, connected: false };
  if (preference.type === 'system') return { preference, connected: true };
  if (preference.type === 'serial') return { preference, connected: Boolean(serialPort) };
  return {
    preference,
    connected: Boolean(bluetoothDevice?.gatt?.connected && bluetoothCharacteristic),
  };
}

export async function reconnectPrinter() {
  const preference = loadPrinterPreference();
  if (!preference || preference.type === 'system') return preference;

  if (preference.type === 'serial' && globalThis.navigator?.serial) {
    const ports = await globalThis.navigator.serial.getPorts();
    serialPort = ports.find((port) => {
      const info = port.getInfo();
      return info.usbVendorId === preference.vendorId && info.usbProductId === preference.productId;
    }) || null;
    return serialPort ? preference : null;
  }

  if (preference.type === 'bluetooth' && globalThis.navigator?.bluetooth?.getDevices) {
    bluetoothDevice = (await globalThis.navigator.bluetooth.getDevices())
      .find((device) => device.id === preference.deviceId) || null;
    if (!bluetoothDevice) return null;
    bluetoothCharacteristic = await findWritableCharacteristic(bluetoothDevice);
    return preference;
  }
  return null;
}

export function disconnectPrinter() {
  bluetoothDevice?.gatt?.disconnect();
  bluetoothDevice = null;
  bluetoothCharacteristic = null;
  serialPort = null;
  storage().removeItem(PRINTER_KEY);
}

async function findWritableCharacteristic(device) {
  if (!device.gatt) throw new Error('O dispositivo não oferece uma conexão Bluetooth BLE.');
  const server = await device.gatt.connect();
  for (const uuid of BLE_SERVICES) {
    try {
      const service = await server.getPrimaryService(uuid);
      const characteristics = await service.getCharacteristics();
      const writable = characteristics.find((characteristic) => (
        characteristic.properties.write || characteristic.properties.writeWithoutResponse
      ));
      if (writable) return writable;
    } catch (error) {
      if (error.name !== 'NotFoundError') throw error;
    }
  }
  throw new Error('A impressora BLE não anunciou um canal de escrita ESC/POS conhecido.');
}

export function buildReceiptHtml(sale, settings = DEFAULT_SETTINGS) {
  if (!sale || !sale._id || !Array.isArray(sale.itens)) {
    throw new TypeError('A venda persistida não possui um formato válido para reimpressão.');
  }
  const html = buildNotaVendaHtml(sale, { titulo: 'SEGUNDA VIA — NOTA DE VENDA' });
  return html.replaceAll('76mm', settings.paperWidth === '58mm' ? '54mm' : '76mm')
    .replaceAll('80mm', settings.paperWidth);
}

export function buildKitchenTickets(comanda, {
  sectors = DEFAULT_SETTINGS.sectors,
  categoriesByProduct = {},
  paperWidth = DEFAULT_SETTINGS.paperWidth,
} = {}) {
  if (!comanda || !Array.isArray(comanda.itens)) {
    throw new TypeError('A comanda não possui itens de cozinha válidos.');
  }
  const tickets = new Map();
  const defaultSector = sectors[0]?.name || 'Cozinha';
  for (const item of comanda.itens.filter((entry) => entry.aFazer)) {
    const category = item.categoria || categoriesByProduct[String(item.produtoId)] || '';
    const sector = sectors.find((entry) => entry.categories.includes(category))?.name || defaultSector;
    const lines = tickets.get(sector) || [];
    lines.push(item);
    tickets.set(sector, lines);
  }
  return [...tickets.entries()].map(([sector, items]) => ({
    sector,
    html: buildKitchenTicketHtml(comanda, sector, items, paperWidth),
    text: buildKitchenTicketText(comanda, sector, items, paperWidth),
  }));
}

function buildKitchenTicketHtml(comanda, sector, items, paperWidth) {
  const table = items.map((item) => `<li><strong>${escapeHtml(quantity(item))}</strong>${
    item.modificadores?.length ? `<small>${escapeHtml(item.modificadores.join(' · '))}</small>` : ''
  }</li>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Cozinha #${escapeHtml(comanda.numero)}</title>
    <style>*{box-sizing:border-box;font:16px 'Courier New',monospace}body{width:76mm;margin:0;padding:4mm;color:#000}
    h1{font-size:20px}hr{border:0;border-top:1px dashed #000}li{padding:8px 0;border-bottom:1px dashed #777}
    @media print{@page{margin:0;size:80mm auto}body{margin:4mm}}</style></head><body>
    <h1>${escapeHtml(sector.toUpperCase())}</h1><hr><p>Pedido #${escapeHtml(comanda.numero)}</p>
    <p>${escapeHtml(comanda.tipoAtendimento === 'mesa' ? `Mesa ${comanda.mesa || '—'}` : 'Balcão')}</p>
    <p>${escapeHtml(comanda.clienteNome || 'Cliente não identificado')}</p>
    ${comanda.observacao ? `<p><strong>Observação:</strong> ${escapeHtml(comanda.observacao)}</p>` : ''}
    <hr><ul>${table}</ul></body></html>`.replaceAll('76mm', paperWidth === '58mm' ? '54mm' : '76mm')
    .replaceAll('80mm', paperWidth);
}

function buildKitchenTicketText(comanda, sector, items, paperWidth) {
  const width = lineWidth(paperWidth);
  return [
    ...wrapText(sector.toLocaleUpperCase(), width),
    ...wrapText(`Pedido #${cleanText(comanda.numero)}`, width),
    ...wrapText(comanda.tipoAtendimento === 'mesa' ? `Mesa ${cleanText(comanda.mesa || '—')}` : 'Balcão', width),
    ...wrapText(comanda.clienteNome || 'Cliente não identificado', width),
    ...(comanda.observacao ? wrapText(`Observação: ${comanda.observacao}`, width) : []),
    '-'.repeat(width),
    ...items.flatMap((item) => [
      ...wrapText(quantity(item), width),
      ...(item.modificadores || []).flatMap((value) => wrapText(`  ${value}`, width)),
    ]),
    '',
    '',
  ].filter((line) => line !== '');
}

export async function loadSavedSale(saleId, api) {
  if (!saleId || !api?.get) throw new TypeError('É necessário informar uma venda e o serviço de consulta.');
  const { data } = await api.get('/vendas');
  const sale = Array.isArray(data) ? data.find((entry) => entry._id === saleId) : null;
  if (!sale) throw new Error('A venda salva não foi encontrada. Atualize a lista antes de tentar novamente.');
  return sale;
}

export async function printPersistedSale(saleId, api, settings = loadPrintSettings()) {
  const preference = loadPrinterPreference();
  const printWindow = !preference || preference.type === 'system' ? createPrintWindow() : null;
  try {
    const sale = await loadSavedSale(saleId, api);
    const html = buildReceiptHtml(sale, settings);
    if (printWindow) renderPrintWindow(printWindow, html);
    else await dispatchPrintJob(html, buildReceiptText(sale, settings), preference);
    return sale;
  } catch (error) {
    printWindow?.close();
    throw error;
  }
}

export async function printKitchenTicket(ticket) {
  if (!ticket?.html || !ticket?.text) throw new TypeError('O ticket de cozinha está vazio ou inválido.');
  return dispatchPrintJob(ticket.html, ticket.text, loadPrinterPreference());
}

export function buildReceiptText(sale, settings = DEFAULT_SETTINGS) {
  if (!sale || !Array.isArray(sale.itens)) throw new TypeError('Venda inválida para impressão.');
  const width = lineWidth(settings.paperWidth);
  return [
    ...wrapText('RESTAURANTE', width),
    ...wrapText('SEGUNDA VIA — NOTA DE VENDA', width),
    ...wrapText(`Pedido: #${cleanText(sale.numero || sale._id)}`, width),
    ...wrapText(`Data: ${new Date(sale.createdAt || Date.now()).toLocaleString('pt-BR')}`, width),
    ...wrapText(`Cliente: ${sale.clienteNome || 'Cliente não identificado'}`, width),
    '-'.repeat(width),
    ...sale.itens.flatMap((item) => [
      ...wrapText(quantity(item), width),
      ...wrapText(`  Unitário: R$ ${money(item.precoUnitario)}`, width),
      ...wrapText(`  Total: R$ ${money(Number(item.quantidade) * Number(item.precoUnitario))}`, width),
      ...(item.modificadores || []).flatMap((value) => wrapText(`  ${value}`, width)),
    ]),
    '-'.repeat(width),
    ...wrapText(`TOTAL: R$ ${money(sale.total)}`, width),
    ...(sale.pagamentos || []).flatMap((payment) => wrapText(`${payment.tipo}: R$ ${money(payment.valorRecebido)}`, width)),
    '',
    'Agradece a preferência!',
    '',
    '',
  ].join('\n');
}

async function dispatchPrintJob(html, text, preference) {
  if (!preference || preference.type === 'system') return openPrintWindow(html);
  const bytes = escPosBytes(text);
  if (preference.type === 'serial') return writeSerial(bytes);
  if (preference.type === 'bluetooth') return writeBluetooth(bytes);
  throw new Error('A conexão de impressão salva não é compatível.');
}

function openPrintWindow(html) {
  const printWindow = createPrintWindow();
  renderPrintWindow(printWindow, html);
  return { method: 'system', message: 'Diálogo de impressão aberto; confirme a impressora no navegador.' };
}

function createPrintWindow() {
  if (typeof globalThis.window?.open !== 'function') {
    throw new Error('A impressão pelo navegador não está disponível neste ambiente.');
  }
  const printWindow = globalThis.window.open('', '_blank', 'width=480,height=720');
  if (!printWindow) throw new Error('O navegador bloqueou a janela de impressão. Permita pop-ups e tente novamente.');
  return printWindow;
}

function renderPrintWindow(printWindow, html) {
  const printableHtml = html.replace(/<script>[\s\S]*?<\/script>/gi, '')
    .replace('</body>', '<script>window.onload=function(){window.focus();window.print()}</script></body>');
  printWindow.document.open();
  printWindow.document.write(printableHtml);
  printWindow.document.close();
}

function escPosBytes(text) {
  const encoded = new TextEncoder().encode(text);
  return Uint8Array.from([0x1b, 0x40, ...encoded, 0x1d, 0x56, 0x01]);
}

async function writeSerial(bytes) {
  if (!serialPort) throw new Error('A impressora USB/serial foi desconectada. Reconecte e tente imprimir novamente.');
  let opened = false;
  try {
    if (!serialPort.writable) {
      await serialPort.open({ baudRate: 9600 });
      opened = true;
    }
    const writer = serialPort.writable.getWriter();
    try {
      await writer.write(bytes);
    } finally {
      writer.releaseLock();
    }
    return { method: 'serial', message: 'Dados enviados à impressora USB/serial.' };
  } catch (error) {
    throw new Error(`Falha ao enviar dados à impressora USB/serial: ${error.message}`, { cause: error });
  } finally {
    if (opened && serialPort?.close) await serialPort.close().catch(() => {});
  }
}

async function writeBluetooth(bytes) {
  if (!bluetoothDevice?.gatt?.connected || !bluetoothCharacteristic) {
    throw new Error('A impressora Bluetooth BLE está desconectada. Reconecte e confira o papel antes de tentar novamente.');
  }
  try {
    for (let offset = 0; offset < bytes.length; offset += 20) {
      const chunk = bytes.slice(offset, offset + 20);
      if (bluetoothCharacteristic.properties.writeWithoutResponse) {
        await bluetoothCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await bluetoothCharacteristic.writeValue(chunk);
      }
    }
    return { method: 'bluetooth', message: 'Dados enviados à impressora Bluetooth BLE.' };
  } catch (error) {
    throw new Error(`Falha ao enviar dados à impressora Bluetooth BLE: ${error.message}`, { cause: error });
  }
}
