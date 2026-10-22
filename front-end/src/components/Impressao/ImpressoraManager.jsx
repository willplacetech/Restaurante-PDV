import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api.jsx';
import {
  buildKitchenTickets,
  connectPrinter,
  disconnectPrinter,
  getPrinterStatus,
  loadPrintSettings,
  loadPrinterPreference,
  printKitchenTicket,
  printPersistedSale,
  reconnectPrinter,
  savePrintSettings,
} from '../../services/impressaoService.js';

const panelStyle = {
  display: 'grid',
  gap: 'var(--space-2)',
  padding: 'var(--space-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-card)',
};
const rowStyle = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-1)' };
const fieldStyle = { display: 'grid', gap: 4, minWidth: 180 };
const inputStyle = { minHeight: 40, padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8 };
const buttonStyle = { minHeight: 40 };

const errorMessage = (error, fallback) => error?.response?.data?.msg || error?.message || fallback;
const dateLabel = (date) => date ? new Date(date).toLocaleString('pt-BR') : 'Data indisponível';
const money = (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;

export default function ImpressoraManager() {
  const [settings, setSettings] = useState(null);
  const [printer, setPrinter] = useState(null);
  const [printerStatus, setPrinterStatus] = useState({ connected: false, preference: null });
  const [sales, setSales] = useState([]);
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [categoriesByProduct, setCategoriesByProduct] = useState({});
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState('');
  const [newSector, setNewSector] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesError, setSalesError] = useState('');
  const [kitchenError, setKitchenError] = useState('');
  const [printerError, setPrinterError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');

  const categoryOptions = useMemo(
    () => [...new Set([
      ...categories,
      ...(settings?.sectors || []).flatMap((sector) => sector.categories),
    ])].sort((left, right) => left.localeCompare(right, 'pt-BR')),
    [categories, settings],
  );

  const refreshPrinterStatus = useCallback(() => {
    try {
      const current = getPrinterStatus();
      setPrinterStatus(current);
      setPrinter(current.preference);
      setPrinterError('');
    } catch (error) {
      setPrinterError(error.message);
    }
  }, []);

  const loadSales = useCallback(async () => {
    try {
      const { data } = await api.get('/vendas');
      if (!Array.isArray(data)) throw new Error('A API não retornou uma lista de vendas válida.');
      setSales(data);
      setSalesError('');
    } catch (error) {
      setSalesError(errorMessage(error, 'Não foi possível carregar as vendas salvas.'));
    }
  }, []);

  const loadKitchen = useCallback(async () => {
    try {
      const { data } = await api.get('/comandas?status=aberta');
      if (!Array.isArray(data)) throw new Error('A API não retornou uma lista de comandas válida.');
      setKitchenOrders(data
        .filter((order) => order.status === 'aberta')
        .map((order) => ({ ...order, itens: (order.itens || []).filter((item) => item.aFazer) }))
        .filter((order) => order.itens.length));
      setKitchenError('');
    } catch (error) {
      setKitchenError(errorMessage(error, 'Não foi possível carregar os pedidos da cozinha.'));
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        setSettings(loadPrintSettings());
      } catch (error) {
        if (active) {
          setPrinterError(error.message);
          setSettings({ paperWidth: '80mm', sectors: [{ name: 'Cozinha', categories: [] }] });
        }
      }
      try {
        const savedPrinter = loadPrinterPreference();
        if (active) setPrinter(savedPrinter);
        if (savedPrinter) await reconnectPrinter();
        if (active) refreshPrinterStatus();
      } catch (error) {
        if (active) setPrinterError(error.message);
      }
      const [productsResult] = await Promise.allSettled([
        api.get('/produtos?tipo=venda'),
        loadSales(),
        loadKitchen(),
      ]);
      if (active && productsResult.status === 'fulfilled' && Array.isArray(productsResult.value.data)) {
        const productMap = Object.fromEntries(productsResult.value.data
          .filter((product) => product?._id && product.categoria)
          .map((product) => [String(product._id), product.categoria]));
        setCategoriesByProduct(productMap);
        setCategories([...new Set(Object.values(productMap))]);
      } else if (active) {
        const error = productsResult.status === 'rejected' ? productsResult.reason : null;
        setCategoriesError(errorMessage(error, 'Não foi possível carregar categorias dos produtos.'));
      }
      if (active) setLoading(false);
    }
    initialize();
    return () => { active = false; };
  }, [loadKitchen, loadSales, refreshPrinterStatus]);

  const connect = async (type) => {
    setBusy('connection');
    setNotice('');
    setPrinterError('');
    try {
      const preference = await connectPrinter(type);
      setPrinter(preference);
      refreshPrinterStatus();
      setNotice(type === 'system'
        ? 'Impressão pelo diálogo do navegador selecionada. A impressora disponível é escolhida no sistema.'
        : `${preference.name} autorizada neste navegador.`);
    } catch (error) {
      setPrinterError(error.message);
    } finally {
      setBusy('');
    }
  };

  const saveSettings = () => {
    try {
      const saved = savePrintSettings(settings);
      setSettings(saved);
      setPrinterError('');
      setNotice('Preferências e setores salvos neste dispositivo.');
    } catch (error) {
      setPrinterError(error.message);
    }
  };

  const printSale = async (sale) => {
    setBusy(`sale:${sale._id}`);
    setPrinterError('');
    setNotice('');
    try {
      await printPersistedSale(sale._id, api, settings);
      setNotice('Recibo da venda salva preparado. Confirme a impressão no navegador ou confira a saída da impressora.');
    } catch (error) {
      setPrinterError(`${error.message} Se houve saída parcial, confira o papel antes de tentar novamente.`);
    } finally {
      setBusy('');
    }
  };

  const printSector = async (orderId, sectorName) => {
    setBusy(`kitchen:${orderId}:${sectorName}`);
    setPrinterError('');
    setNotice('');
    try {
      const currentOrder = kitchenOrders.find((order) => order._id === orderId);
      if (!currentOrder) throw new Error('Esta comanda não está mais pendente na cozinha. Atualize a lista.');
      const tickets = buildKitchenTickets(currentOrder, {
        sectors: settings.sectors,
        categoriesByProduct,
        paperWidth: settings.paperWidth,
      });
      const ticket = tickets.find((entry) => entry.sector === sectorName);
      if (!ticket) throw new Error(`Não há itens pendentes para o setor ${sectorName}.`);
      const result = await printKitchenTicket(ticket);
      setNotice(result.message);
    } catch (error) {
      setPrinterError(`${errorMessage(error, 'Falha ao imprimir ticket da cozinha.')} Se houve saída parcial, confira o papel antes de tentar novamente.`);
    } finally {
      setBusy('');
    }
  };

  const addSector = (event) => {
    event.preventDefault();
    const name = newSector.trim();
    if (!name) return;
    if (settings.sectors.some((sector) => sector.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setPrinterError('Já existe um setor com esse nome.');
      return;
    }
    setSettings((current) => ({ ...current, sectors: [...current.sectors, { name, categories: [] }] }));
    setNewSector('');
    setPrinterError('');
  };

  const updateSector = (sectorName, category, checked) => {
    setSettings((current) => ({
      ...current,
      sectors: current.sectors.map((sector) => {
        if (sector.name !== sectorName) return sector;
        const categories = checked
          ? [...sector.categories, category]
          : sector.categories.filter((value) => value !== category);
        return { ...sector, categories };
      }),
    }));
  };

  const removeSector = (sectorName) => {
    if (settings.sectors.length === 1) {
      setPrinterError('Mantenha pelo menos um setor de cozinha.');
      return;
    }
    setSettings((current) => ({
      ...current,
      sectors: current.sectors.filter((sector) => sector.name !== sectorName),
    }));
  };

  const disconnect = () => {
    try {
      disconnectPrinter();
      refreshPrinterStatus();
      setNotice('Impressora desconectada neste navegador.');
    } catch (error) {
      setPrinterError(error.message);
    }
  };

  if (loading || !settings) {
    return (
      <div className="card">
        <div className="state" role="status">Carregando configuração de impressão…</div>
        {printerError && <p role="alert">{printerError}</p>}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Dispositivos locais</span>
          <h1>Impressoras</h1>
          <p>Configure a conexão, distribua categorias por setor e reimprima dados já salvos.</p>
        </div>
      </header>

      {printerError && <div className="state state--error" role="alert">{printerError}</div>}
      {notice && <div className="state state--success" role="status" aria-live="polite">{notice}</div>}

      <section style={panelStyle} aria-labelledby="printer-connection-title">
        <div>
          <h2 id="printer-connection-title">Conexão local</h2>
          <p>
            {printerStatus.preference
              ? `Selecionada: ${printerStatus.preference.name} · ${printerStatus.connected ? 'conexão disponível' : 'reconecte para imprimir'}`
              : 'Nenhuma conexão selecionada.'}
          </p>
        </div>
        <div style={rowStyle}>
          <button type="button" className="btn-primary" style={buttonStyle} disabled={Boolean(busy)} onClick={() => connect('system')}>
            Diálogo do sistema
          </button>
          <button type="button" className="btn-secondary" style={buttonStyle} disabled={Boolean(busy) || !globalThis.navigator?.serial} onClick={() => connect('serial')}>
            USB / serial
          </button>
          <button type="button" className="btn-secondary" style={buttonStyle} disabled={Boolean(busy) || !globalThis.navigator?.bluetooth} onClick={() => connect('bluetooth')}>
            Bluetooth BLE
          </button>
          {printer && (
            <button type="button" className="btn-secondary" style={buttonStyle} disabled={Boolean(busy)} onClick={disconnect}>
              Desconectar
            </button>
          )}
        </div>
        <p className="muted">
          USB/serial e BLE enviam dados ESC/POS diretamente; Bluetooth clássico não é compatível com a Web Bluetooth.
          No diálogo do sistema, use uma impressora já instalada no dispositivo. Compatibilidade e acentuação ESC/POS
          dependem do modelo e da codificação configurada; valide com uma impressão física antes de operar.
        </p>
      </section>

      <section style={panelStyle} aria-labelledby="printer-settings-title">
        <div>
          <h2 id="printer-settings-title">Bobina e setores</h2>
          <p>As preferências ficam apenas neste dispositivo. Categorias sem setor configurado vão para o primeiro setor.</p>
        </div>
        <label style={fieldStyle}>
          Largura do papel
          <select style={inputStyle} value={settings.paperWidth} onChange={(event) => setSettings({ ...settings, paperWidth: event.target.value })}>
            <option value="58mm">58 mm</option>
            <option value="80mm">80 mm</option>
          </select>
        </label>
        {categoriesError && (
          <p role="alert">{categoriesError} Atualize os produtos antes de distribuir os setores.</p>
        )}
        {!categoryOptions.length && !categoriesError && (
          <p>Não há categorias disponíveis para distribuir setores. Verifique os produtos cadastrados.</p>
        )}
        {settings.sectors.map((sector) => (
          <fieldset key={sector.name} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12 }}>
            <legend>{sector.name}</legend>
            <div style={rowStyle}>
              {categoryOptions.map((category) => (
                <label key={category} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={sector.categories.includes(category)}
                    onChange={(event) => updateSector(sector.name, category, event.target.checked)}
                  />
                  {category}
                </label>
              ))}
              {settings.sectors.length > 1 && (
                <button type="button" className="btn-secondary" onClick={() => removeSector(sector.name)}>Remover setor</button>
              )}
            </div>
          </fieldset>
        ))}
        <form onSubmit={addSector} style={rowStyle}>
          <label style={fieldStyle}>
            Novo setor
            <input style={inputStyle} value={newSector} onChange={(event) => setNewSector(event.target.value)} maxLength={40} />
          </label>
          <button type="submit" className="btn-secondary" style={buttonStyle}>Adicionar setor</button>
          <button type="button" className="btn-primary" style={buttonStyle} onClick={saveSettings}>Salvar preferências</button>
        </form>
      </section>

      <section style={panelStyle} aria-labelledby="sales-reprint-title">
        <div style={rowStyle}>
          <div>
            <h2 id="sales-reprint-title">Recibos de vendas salvas</h2>
            <p>A reimpressão consulta novamente a venda persistida e não cria nem altera vendas.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={loadSales}>Atualizar vendas</button>
        </div>
        {salesError && <p role="alert">{salesError}</p>}
        {sales.length === 0 && !salesError ? <p>Nenhuma venda salva encontrada.</p> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {sales.map((sale) => (
              <div key={sale._id} style={{ ...rowStyle, justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                <span>Venda #{sale.numero} · {dateLabel(sale.createdAt)} · {money(sale.total)}</span>
                <button
                  type="button"
                  className="btn-primary"
                  style={buttonStyle}
                  disabled={Boolean(busy)}
                  onClick={() => printSale(sale)}
                >
                  {busy === `sale:${sale._id}` ? 'Preparando…' : 'Reimprimir recibo'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={panelStyle} aria-labelledby="kitchen-print-title">
        <div style={rowStyle}>
          <div>
            <h2 id="kitchen-print-title">Tickets pendentes da cozinha</h2>
            <p>Somente itens marcados para preparo são agrupados por categoria e setor.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={loadKitchen}>Atualizar cozinha</button>
        </div>
        {kitchenError && <p role="alert">{kitchenError}</p>}
        {!kitchenOrders.length && !kitchenError ? <p>Nenhum item pendente para impressão.</p> : kitchenOrders.map((order) => {
          const tickets = buildKitchenTickets(order, { sectors: settings.sectors, categoriesByProduct });
          return (
            <article key={order._id} style={{ borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
              <strong>Comanda #{order.numero} · {order.tipoAtendimento === 'mesa' ? `Mesa ${order.mesa || '—'}` : 'Balcão'}</strong>
              <div style={rowStyle}>
                {tickets.map((ticket) => (
                  <button
                    key={ticket.sector}
                    type="button"
                    className="btn-primary"
                    style={buttonStyle}
                    disabled={Boolean(busy)}
                    onClick={() => printSector(order._id, ticket.sector)}
                  >
                    {busy === `kitchen:${order._id}:${ticket.sector}` ? 'Enviando…' : `Imprimir ${ticket.sector}`}
                  </button>
                ))}
                {!tickets.length && <span>Esta comanda não possui itens marcados para preparo.</span>}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
