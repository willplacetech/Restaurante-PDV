import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api.jsx';
import { useToast } from '../components/Toast.jsx';
import '../styles/delivery.css';

const STATUS_NOMES = {
  pendente: 'Aguardando preparo',
  pronto: 'Pronto para despachar',
  despachado: 'Aguardando retirada',
  a_caminho: 'A caminho',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};
const moeda = valor => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const enderecoTexto = endereco => [endereco?.rua, endereco?.numero, endereco?.bairro, endereco?.complemento].filter(Boolean).join(', ');
const idadeMinutos = (data, referencia = Date.now()) => Math.max(0, Math.floor((referencia - new Date(data).getTime()) / 60000));
const dataLocal = data => {
  const dataValida = new Date(data);
  if (Number.isNaN(dataValida.getTime())) return '';
  return `${dataValida.getFullYear()}-${String(dataValida.getMonth() + 1).padStart(2, '0')}-${String(dataValida.getDate()).padStart(2, '0')}`;
};
const escaparHtml = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[caractere]);

function imprimirEntrega(pedido) {
  const janela = window.open('', '_blank', 'width=420,height=640');
  if (!janela) return false;
  const endereco = pedido.origem?.endereco || {};
  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  const linhasItens = itens.map(item => `
    <div class="linha">
      <span>${escaparHtml(item.quantidade)} × ${escaparHtml(item.nome)}</span>
      <span>${moeda(Number(item.quantidade || 0) * Number(item.precoUnitario || 0))}</span>
    </div>`).join('');
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pedido de entrega</title><style>
    *{box-sizing:border-box}body{width:76mm;margin:0;padding:4mm;color:#222;font:12px ui-monospace,monospace}
    h1{font-size:16px;text-align:center}.linha{display:flex;justify-content:space-between;gap:8px;margin:6px 0}
    hr{border:0;border-top:1px dashed #555;margin:10px 0}@media print{@page{size:80mm auto;margin:0}}
  </style></head><body><h1>Pedido de entrega</h1><div class="linha"><span>Pedido</span><span>${escaparHtml(pedido._id)}</span></div>
  <div>${escaparHtml(pedido.origem?.nomeCliente)}</div><div>${escaparHtml(pedido.origem?.telefone)}</div>
  <div>${escaparHtml(enderecoTexto(endereco))}</div><hr>${linhasItens}<hr>
  <div class="linha"><span>Produtos</span><span>${moeda(pedido.valorTotal)}</span></div>
  <div class="linha"><span>Entrega</span><span>${moeda(pedido.taxaEntrega)}</span></div>
  <div class="linha"><strong>Total</strong><strong>${moeda(Number(pedido.valorTotal || 0) + Number(pedido.taxaEntrega || 0))}</strong></div>
  <script>window.onload=()=>window.print()</script></body></html>`);
  janela.document.close();
  return true;
}

function minutosNoStatus(pedido, status, agora) {
  const evento = [...(pedido.statusHistorico || [])].reverse().find(item => item.status === status);
  if (!evento?.data) return null;
  const data = new Date(evento.data).getTime();
  return Number.isFinite(data) ? idadeMinutos(data, agora) : null;
}

function faixaAtraso(minutos) {
  return minutos !== null && minutos > 10 ? 'vermelho' : '';
}

function FormularioPedidoManual({ onSubmit, ocupado, taxaPadrao }) {
  const [itens, setItens] = useState([]);
  const alterarItem = (indice, campo, valor) => {
    setItens(atuais => atuais.map((item, posicao) => posicao === indice ? { ...item, [campo]: valor } : item));
  };
  return <form className="delivery-card" onSubmit={event => onSubmit(event, itens)}>
    <h2>Novo pedido de entrega</h2>
    <div className="delivery-form-grid">
      <label>Nome do cliente<input name="nomeCliente" required maxLength={160} /></label>
      <label>Telefone do cliente<input name="telefone" type="tel" required maxLength={30} /></label>
      <label>Rua<input name="rua" required maxLength={200} /></label>
      <label>Número<input name="numero" required maxLength={30} /></label>
      <label>Bairro<input name="bairro" required maxLength={120} /></label>
      <label>Complemento<input name="complemento" maxLength={200} /></label>
      <label>Referência<input name="referencia" maxLength={300} /></label>
      <label>Valor do pedido (R$)<input name="valorTotal" type="number" step="0.01" min="0" required /></label>
      <label>Taxa de entrega (R$)<input name="taxaEntrega" type="number" step="0.01" min="0" defaultValue={taxaPadrao} required /></label>
    </div>
    <details>
      <summary>Itens do pedido</summary>
      {itens.map((item, indice) => <div className="delivery-form-grid" key={indice}>
        <label>Descrição<input name="descricao" value={item.descricao} onChange={event => alterarItem(indice, 'descricao', event.target.value)} required /></label>
        <label>Quantidade<input name="quantidade" type="number" min="0.001" step="0.001" value={item.quantidade} onChange={event => alterarItem(indice, 'quantidade', event.target.value)} required /></label>
        <label>Preço unitário<input name="precoUnitario" type="number" min="0" step="0.01" value={item.precoUnitario} onChange={event => alterarItem(indice, 'precoUnitario', event.target.value)} required /></label>
        <button type="button" className="delivery-danger" onClick={() => setItens(atuais => atuais.filter((_, posicao) => posicao !== indice))}>Remover item</button>
      </div>)}
      <button type="button" className="delivery-secondary" onClick={() => setItens(atuais => [...atuais, { descricao: '', quantidade: '1', precoUnitario: '0' }])}>Adicionar item</button>
    </details>
    <div className="delivery-actions"><button disabled={ocupado}>{ocupado ? 'Salvando…' : 'Criar pedido'}</button></div>
  </form>;
}

export default function Entregas() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const pedidoDestacado = searchParams.get('pedido');
  const [pedidos, setPedidos] = useState([]);
  const [entregadores, setEntregadores] = useState([]);
  const [usuariosEntregadores, setUsuariosEntregadores] = useState([]);
  const [estatisticas, setEstatisticas] = useState({});
  const [comercio, setComercio] = useState(null);
  const [selecao, setSelecao] = useState({});
  const [aba, setAba] = useState('fila');
  const [filaAba, setFilaAba] = useState('prontos');
  const [filtroStatus, setFiltroStatus] = useState(() => searchParams.get('status') || '');
  const [filtroData, setFiltroData] = useState(() => searchParams.get('data') || '');
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [entregadorEdicao, setEntregadorEdicao] = useState(null);
  const [whatsapp, setWhatsapp] = useState(null);
  const [erro, setErro] = useState('');
  const [erroLista, setErroLista] = useState('');
  const [aviso, setAviso] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [agora, setAgora] = useState(Date.now);
  const [ocupado, setOcupado] = useState(false);
  const [despachando, setDespachando] = useState('');
  const carregamentoRequestId = useRef(0);
  const pedidoFocado = useRef(null);
  const paginaAtual = Math.max(1, Number(searchParams.get('pagina') || 1));
  const limiteAtual = Math.max(1, Number(searchParams.get('limite') || 25));
  const alterarPagina = useCallback((pagina) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.set('pagina', String(Math.max(1, pagina)));
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const alterarLimite = useCallback((limite) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.set('pagina', '1');
      next.set('limite', String(limite));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const carregar = useCallback(async (silencioso = false) => {
    const requestId = ++carregamentoRequestId.current;
    if (!silencioso) setCarregando(true);
    try {
      const [pedidosResponse, entregadoresResponse, usuariosResponse, comercioResponse] = await Promise.all([
        api.get('/delivery/pedidos', { pdvSilenciosa: silencioso }),
        api.get('/delivery/entregadores', { pdvSilenciosa: silencioso }),
        api.get('/delivery/entregadores/usuarios-disponiveis', { pdvSilenciosa: silencioso }),
        api.get('/delivery/configuracao', { pdvSilenciosa: silencioso }),
      ]);
      if (requestId !== carregamentoRequestId.current) return;
      const todosPedidos = Array.isArray(pedidosResponse.data)
        ? pedidosResponse.data
        : pedidosResponse.data.pedidos || [];
      const pedidosHistorico = todosPedidos
        .filter(pedido => !filtroStatus || pedido.status === filtroStatus)
        .filter(pedido => !filtroData || dataLocal(pedido.criadoEm) === filtroData)
        .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
      const totalHistorico = pedidosHistorico.length;
      const ultimaPagina = Math.max(1, Math.ceil(totalHistorico / limiteAtual));
      const paginaHistorico = Math.min(paginaAtual, ultimaPagina);
      setPedidos(aba === 'historico'
        ? pedidosHistorico.slice((paginaHistorico - 1) * limiteAtual, paginaHistorico * limiteAtual)
        : [...todosPedidos].sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()));
      setTotalPedidos(aba === 'historico' ? totalHistorico : todosPedidos.length);
      setEntregadores(entregadoresResponse.data || []);
      setUsuariosEntregadores(usuariosResponse.data || []);
      setComercio(comercioResponse.data || null);
      const hoje = dataLocal(Date.now());
      const pedidosHoje = todosPedidos.filter(pedido => dataLocal(pedido.criadoEm) === hoje);
      const entreguesHoje = pedidosHoje.filter(pedido => pedido.status === 'entregue');
      const duracoes = entreguesHoje.map(pedido => {
        const conclusao = [...(pedido.statusHistorico || [])].reverse().find(item => item.status === 'entregue')?.data || pedido.atualizadoEm;
        return idadeMinutos(pedido.criadoEm, new Date(conclusao).getTime());
      }).filter(Number.isFinite);
      setEstatisticas({
        pendentes: todosPedidos.filter(pedido => pedido.status === 'pendente').length,
        prontos: todosPedidos.filter(pedido => pedido.status === 'pronto').length,
        emEntrega: todosPedidos.filter(pedido => ['despachado', 'a_caminho'].includes(pedido.status)).length,
        entregues: entreguesHoje.length,
        tempoMedioMin: duracoes.length ? Math.round(duracoes.reduce((total, minutos) => total + minutos, 0) / duracoes.length) : 0,
      });
      setAgora(Date.now());
      setErroLista('');
    } catch (error) {
      if (requestId === carregamentoRequestId.current) {
        setErroLista(error.response?.data?.msg || 'Não foi possível carregar as entregas.');
      }
    } finally {
      if (requestId === carregamentoRequestId.current) setCarregando(false);
    }
  }, [aba, filtroData, filtroStatus, paginaAtual, limiteAtual]);

  useEffect(() => {
    const iniciar = window.setTimeout(() => { void carregar(); }, 0);
    const polling = window.setInterval(() => { void carregar(true); }, 15000);
    const relogio = window.setInterval(() => setAgora(Date.now()), 60000);
    return () => {
      window.clearTimeout(iniciar);
      window.clearInterval(polling);
      window.clearInterval(relogio);
    };
  }, [carregar]);

  const atualizarFiltroHistorico = (nome, valor, atualizarEstado) => {
    atualizarEstado(valor);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('pagina', '1');
      if (!valor) next.delete(nome);
      else next.set(nome, valor);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (!pedidoDestacado || pedidoFocado.current === pedidoDestacado) return undefined;
    const pedido = pedidos.find(item => item._id === pedidoDestacado);
    if (!pedido) return undefined;
    let rolagem;
    const quadro = window.requestAnimationFrame(() => {
      pedidoFocado.current = pedidoDestacado;
      setAba('fila');
      setFilaAba(pedido.status === 'pronto' ? 'prontos' : pedido.status === 'pendente' ? 'preparo' : 'em-entrega');
      rolagem = window.requestAnimationFrame(() => {
        document.getElementById(`pedido-${pedido._id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    return () => {
      window.cancelAnimationFrame(quadro);
      if (rolagem !== undefined) window.cancelAnimationFrame(rolagem);
    };
  }, [pedidoDestacado, pedidos]);

  const prontos = useMemo(() => pedidos.filter(pedido => pedido.status === 'pronto'), [pedidos]);
  const emEntrega = useMemo(() => pedidos.filter(pedido => ['despachado', 'a_caminho'].includes(pedido.status)), [pedidos]);
  const aguardandoPreparo = useMemo(() => pedidos.filter(pedido => pedido.status === 'pendente'), [pedidos]);
  const pedidosDaFila = filaAba === 'prontos' ? prontos : filaAba === 'em-entrega' ? emEntrega : aguardandoPreparo;
  const pedidosVisiveis = aba === 'fila' ? pedidosDaFila : pedidos;

  const executar = async (acao, sucesso) => {
    if (ocupado) return false;
    setOcupado(true);
    setErro('');
    setAviso('');
    try {
      await acao();
      if (sucesso) {
        setAviso(sucesso);
        showToast(sucesso, 'success');
      }
      await carregar(true);
      return true;
    } catch (error) {
      const mensagem = error.response?.data?.msg || 'Não foi possível concluir a operação.';
      setErro(mensagem);
      showToast(mensagem, 'error');
      return false;
    } finally {
      setOcupado(false);
      setDespachando('');
    }
  };

  const criarPedidoManual = async (event, itens) => {
    event.preventDefault();
    if (!itens.length) {
      const mensagem = 'Adicione ao menos um item ao pedido.';
      setErro(mensagem);
      showToast(mensagem, 'error');
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const endereco = Object.fromEntries(['rua', 'numero', 'complemento', 'bairro', 'referencia'].map(campo => [campo, form.get(campo) || '']));
    const criado = await executar(
      () => api.post('/delivery/pedidos', {
        origem: { nomeCliente: form.get('nomeCliente'), telefone: form.get('telefone'), endereco },
        valorTotal: Number(form.get('valorTotal')),
        taxaEntrega: Number(form.get('taxaEntrega')),
        itens: itens.map(item => ({ ...item, quantidade: Number(item.quantidade), precoUnitario: Number(item.precoUnitario) })),
      }),
      'Pedido criado e pronto para despacho.'
    );
    if (criado) {
      formElement.reset();
      setAba('fila');
      setFilaAba('prontos');
    }
  };

  const despachar = async pedido => {
    const entregadorId = selecao[pedido._id];
    if (!entregadorId) {
      setErro('Selecione um entregador disponível antes de despachar.');
      return;
    }
    setDespachando(pedido._id);
    await executar(async () => {
      const { data } = await api.post(`/delivery/pedidos/${pedido._id}/despachar`, { entregadorId });
      setWhatsapp(data.whatsapp || null);
      setSelecao(atual => {
        const proxima = { ...atual };
        delete proxima[pedido._id];
        return proxima;
      });
    }, `Pedido de ${pedido.origem.nomeCliente} despachado.`);
  };

  const enviarWhatsApp = async pedido => {
    await executar(async () => {
      const { data } = await api.post(`/delivery/pedidos/${pedido._id}/enviar-whatsapp`, {});
      setWhatsapp({ ...data, mensagemPronta: data.mensagem, enviado: false });
    }, 'Mensagem de rastreamento pronta para compartilhar.');
  };

  const cancelar = (pedido, motivo) => executar(
    () => api.post(`/delivery/pedidos/${pedido._id}/cancelar`, { motivo }),
    'Pedido cancelado.'
  );

  const marcarPronto = pedido => {
    void executar(() => api.post(`/delivery/pedidos/${pedido._id}/pronto`, {}), 'Pedido marcado como pronto.');
  };

  const marcarEntregue = pedido => {
    void executar(
      () => api.post(`/delivery/pedidos/${pedido._id}/status`, { novoStatus: 'entregue' }),
      'Pedido marcado como entregue.'
    );
  };

  const salvarEntregador = event => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = {
      nome: form.get('nome'),
      telefone: form.get('telefone'),
      ativo: form.get('ativo') === 'on',
      usuarioId: form.get('usuarioId'),
    };
    if (form.get('senha')) body.senha = form.get('senha');
    const mensagemSucesso = entregadorEdicao
      ? 'Entregador atualizado.'
      : 'Entregador cadastrado. Compartilhe a senha temporária com ele.';
    void executar(async () => {
      if (entregadorEdicao) {
        await api.put(`/delivery/entregadores/${entregadorEdicao._id}`, body);
      } else {
        body.senha = form.get('senha');
        await api.post('/delivery/entregadores', body);
      }
      setEntregadorEdicao(null);
      formElement.reset();
    }, mensagemSucesso);
  };

  const excluirEntregador = entregador => {
    void executar(() => api.delete(`/delivery/entregadores/${entregador._id}`), 'Entregador desativado.');
  };

  const salvarConfiguracao = event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void executar(
      () => api.patch('/delivery/configuracao', {
        taxaEntregaPadrao: Number(form.get('taxaEntregaPadrao')),
        tempoEstimadoPadraoMin: Number(form.get('tempo')),
        mensagemWhatsApp: form.get('mensagem'),
      }),
      'Configurações salvas.'
    );
  };

  const copiarMensagem = async () => {
    if (!whatsapp?.mensagemPronta) return;
    try {
      await navigator.clipboard.writeText(whatsapp.mensagemPronta);
      setAviso('Mensagem copiada.');
    } catch {
      setAviso('Selecione a mensagem para copiar.');
    }
  };

  return <div className="delivery-app delivery-board">
    <header className="delivery-board-heading page-heading">
      <div><span className="dashboard-eyebrow">OPERAÇÃO DO DIA</span><h1>Entregas</h1><p>Acompanhe e despache os pedidos do seu comércio.</p></div>
      <span className="delivery-muted" role="status">Atualização automática a cada 15 segundos</span>
    </header>

    <section className="delivery-stats" aria-label="Resumo das entregas">
      {[['Pendentes', estatisticas.pendentes || 0], ['Prontos', estatisticas.prontos || 0], ['Em entrega', estatisticas.emEntrega || 0], ['Entregues hoje', estatisticas.entregues || 0], ['Tempo médio', `${estatisticas.tempoMedioMin || 0} min`]].map(([label, value]) =>
        <article className="delivery-card delivery-stat" key={label}><span>{label}</span><strong>{value}</strong></article>
      )}
    </section>

    {erro && <p role="alert" className="delivery-error">{erro}</p>}
    {erroLista && <div role="alert" className="delivery-error"><span>{erroLista}</span><button type="button" onClick={() => void carregar()}>Tentar novamente</button></div>}
    {aviso && <p role="status" className="delivery-success">{aviso}</p>}

    {whatsapp && <section className="delivery-card" aria-label="Mensagem de rastreamento">
      <h2>Link para o cliente</h2>
      <p className="delivery-muted">{whatsapp.enviado ? 'Mensagem enviada pelo WhatsApp configurado.' : 'Abra o WhatsApp ou copie a mensagem para enviar ao cliente.'}</p>
      <textarea aria-label="Mensagem de rastreamento" readOnly value={whatsapp.mensagemPronta || ''} />
      <div className="delivery-actions">
        {whatsapp.whatsappUrl && <a className="delivery-button" href={whatsapp.whatsappUrl} target="_blank" rel="noreferrer">Abrir WhatsApp</a>}
        <button type="button" className="delivery-secondary" onClick={() => void copiarMensagem()}>Copiar mensagem</button>
        <button type="button" className="delivery-secondary" onClick={() => setWhatsapp(null)}>Fechar</button>
      </div>
    </section>}

    <nav className="delivery-tabs" aria-label="Gestão de entregas">
      {[['fila', 'Fila de entregas'], ['novo', 'Novo pedido'], ['historico', 'Histórico'], ['entregadores', 'Entregadores'], ['configuracao', 'Configurações']].map(([id, label]) =>
        <button key={id} type="button" aria-selected={aba === id} onClick={() => { setAba(id); alterarPagina(1); }}>{label}</button>
      )}
    </nav>

    {aba === 'novo' && comercio && <FormularioPedidoManual onSubmit={criarPedidoManual} ocupado={ocupado} taxaPadrao={Number(comercio.taxaEntregaPadrao ?? comercio.taxaPorEntrega ?? 0)} />}

    {aba === 'fila' && <nav className="delivery-tabs" aria-label="Status da fila">
      <button type="button" aria-selected={filaAba === 'prontos'} onClick={() => setFilaAba('prontos')}>Prontos para despachar ({prontos.length})</button>
      <button type="button" aria-selected={filaAba === 'em-entrega'} onClick={() => setFilaAba('em-entrega')}>Em entrega ({emEntrega.length})</button>
      <button type="button" aria-selected={filaAba === 'preparo'} onClick={() => setFilaAba('preparo')}>Aguardando preparo ({aguardandoPreparo.length})</button>
    </nav>}

    {['fila', 'historico'].includes(aba) && <section className="delivery-grid" aria-label={aba === 'historico' ? 'Histórico de pedidos' : 'Pedidos de entrega'}>
      {carregando ? <p className="delivery-card" role="status">Carregando pedidos...</p> : pedidosVisiveis.length === 0 ? (
        <p className="delivery-card delivery-empty">{aba === 'historico' ? 'Nenhum pedido encontrado para este filtro.' : 'Nenhum pedido nesta fila.'}</p>
      ) : pedidosVisiveis.map(pedido => {
        const minutos = minutosNoStatus(pedido, pedido.status, agora) ?? idadeMinutos(pedido.criadoEm, agora);
        const endereco = pedido.origem?.endereco || {};
        return <article
          className={`delivery-card delivery-order ${faixaAtraso(minutos)}`}
          id={`pedido-${pedido._id}`}
          key={pedido._id}
        >
          <span className="delivery-badge">{STATUS_NOMES[pedido.status] || pedido.status}</span>
          <p className="delivery-muted">Há {minutos} min · {new Date(pedido.criadoEm).toLocaleString('pt-BR')}</p>
          <h2>{pedido.origem?.nomeCliente || 'Cliente'}</h2>
          <p>{enderecoTexto(endereco) || 'Endereço não informado'}</p>
          {endereco.referencia && <p className="delivery-muted">Referência: {endereco.referencia}</p>}
          <p><strong>{moeda(pedido.valorTotal)}</strong> + {moeda(pedido.taxaEntrega)} de entrega</p>
          {pedido.entregadorId?.nome && <p className="delivery-muted">Entregador: {pedido.entregadorId.nome}</p>}
          <div className="delivery-actions">
            {pedido.status === 'pendente' && <button type="button" disabled={ocupado} onClick={() => marcarPronto(pedido)}>Marcar como pronto</button>}
            {pedido.status === 'pronto' && <>
              <label>Entregador
                <select value={selecao[pedido._id] || ''} onChange={event => setSelecao(atual => ({ ...atual, [pedido._id]: event.target.value }))}>
                  <option value="">Selecione um entregador</option>
                  {entregadores.filter(entregador => entregador.ativo !== false).map(entregador => <option key={entregador._id} value={entregador._id}>{entregador.nome}</option>)}
                </select>
              </label>
              <button type="button" disabled={ocupado || !selecao[pedido._id]} onClick={() => void despachar(pedido)}>
                {despachando === pedido._id ? 'Despachando...' : 'Despachar'}
              </button>
            </>}
            {['despachado', 'a_caminho'].includes(pedido.status) && <button type="button" disabled={ocupado} onClick={() => marcarEntregue(pedido)}>Marcar como entregue</button>}
            {pedido.status !== 'cancelado' && pedido.status !== 'entregue' && <button type="button" className="delivery-danger" disabled={ocupado} onClick={() => {
              const motivo = window.prompt('Qual o motivo do cancelamento?');
              if (motivo?.trim()) void cancelar(pedido, motivo.trim());
            }}>Cancelar</button>}
            <button type="button" className="delivery-secondary" disabled={ocupado} onClick={() => void enviarWhatsApp(pedido)}>Compartilhar rastreio</button>
            <button type="button" className="delivery-secondary" onClick={() => {
              if (!imprimirEntrega(pedido)) setErro('Permita janelas pop-up para imprimir o pedido.');
            }}>Imprimir</button>
          </div>
          <a href={`/pedido/${pedido.tokenRastreamento}`} target="_blank" rel="noreferrer">Ver rastreio</a>
        </article>;
      })}
    </section>}

    {aba === 'historico' && <div className="delivery-form-grid">
      <label>Status
        <select value={filtroStatus} onChange={event => atualizarFiltroHistorico('status', event.target.value, setFiltroStatus)}>
          <option value="">Todos</option>{Object.entries(STATUS_NOMES).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </select>
      </label>
      <label>Data<input type="date" value={filtroData} onChange={event => atualizarFiltroHistorico('data', event.target.value, setFiltroData)} /></label>
    </div>}

    {aba === 'entregadores' && <section className="delivery-grid">
      <form className="delivery-card" onSubmit={salvarEntregador} key={entregadorEdicao?._id || 'novo-entregador'}>
        <h2>{entregadorEdicao ? 'Editar entregador' : 'Cadastrar entregador'}</h2>
        <label>Conta de usuário
          <select name="usuarioId" required={!entregadorEdicao?.usuarioId} defaultValue={entregadorEdicao?.usuarioId?._id || ''}>
            <option value="">Selecione uma conta ativa de entregador</option>
            {entregadorEdicao?.usuarioId && !usuariosEntregadores.some(usuario => usuario._id === entregadorEdicao.usuarioId._id) && (
              <option value={entregadorEdicao.usuarioId._id}>
                {entregadorEdicao.usuarioId.name || entregadorEdicao.usuarioId.username} (vínculo atual)
              </option>
            )}
            {usuariosEntregadores.map(usuario => <option key={usuario._id} value={usuario._id}>
              {usuario.name || usuario.username}{usuario.email ? ` · ${usuario.email}` : ''}
            </option>)}
          </select>
        </label>
        <label>Nome<input name="nome" required maxLength={160} defaultValue={entregadorEdicao?.nome || ''} /></label>
        <label>Telefone<input name="telefone" type="tel" required maxLength={30} defaultValue={entregadorEdicao?.telefone || ''} /></label>
        <label>Senha temporária<input name="senha" type="password" autoComplete="new-password" required={!entregadorEdicao} minLength={8} /></label>
        <label><span>Ativo</span><input name="ativo" type="checkbox" defaultChecked={entregadorEdicao?.ativo !== false} /></label>
        <div className="delivery-actions"><button disabled={ocupado}>{entregadorEdicao ? 'Salvar alterações' : 'Cadastrar entregador'}</button>{entregadorEdicao && <button type="button" className="delivery-secondary" onClick={() => setEntregadorEdicao(null)}>Cancelar edição</button>}</div>
      </form>
      <div>
        <div className="delivery-grid">
        {entregadores.map(entregador => {
          return <article className="delivery-card" key={entregador._id}>
          <span className="delivery-badge">{entregador.ativo === false ? 'Desativado' : entregador.status || 'Disponível'}</span>
          <h2>{entregador.nome}</h2><p><a href={`tel:${entregador.telefone}`}>{entregador.telefone}</a></p>
          {entregador.usuarioId && <p className="delivery-muted">Conta: {entregador.usuarioId.name || entregador.usuarioId.username}</p>}
          <div className="delivery-actions">
            <button type="button" className="delivery-secondary" onClick={() => setEntregadorEdicao(entregador)}>Editar</button>
            {entregador.ativo !== false && <button type="button" className="delivery-danger" disabled={ocupado} onClick={() => {
              if (window.confirm(`Desativar o entregador ${entregador.nome}?`)) excluirEntregador(entregador);
            }}>Desativar</button>}
          </div>
          </article>;
        })}
        {!entregadores.length && <p className="delivery-empty">Nenhum entregador cadastrado.</p>}
        </div>
      </div>
    </section>}

    {aba === 'configuracao' && <form className="delivery-card delivery-form-grid" onSubmit={salvarConfiguracao}>
      <h2>Configurações de entrega</h2>
      <label>Taxa padrão de entrega (R$)
        <input name="taxaEntregaPadrao" type="number" min="0" step="0.01" defaultValue={comercio?.taxaEntregaPadrao ?? 0} required />
      </label>
      <label>Tempo estimado padrão (minutos)
        <input name="tempo" type="number" min="1" step="1" defaultValue={comercio?.tempoEstimadoPadraoMin ?? 30} required />
      </label>
      <label>Mensagem de WhatsApp
        <textarea name="mensagem" maxLength={1000} defaultValue={comercio?.mensagemWhatsApp || ''} />
      </label>
      <div className="delivery-actions"><button type="submit" disabled={ocupado}>Salvar configurações</button></div>
    </form>}

    {aba === 'historico' && <div className="delivery-actions">
      <button type="button" disabled={paginaAtual <= 1 || carregando} onClick={() => alterarPagina(paginaAtual - 1)}>Anterior</button>
      <span>Página {paginaAtual} de {Math.max(1, Math.ceil(totalPedidos / limiteAtual))}</span>
      <button type="button" disabled={paginaAtual >= Math.max(1, Math.ceil(totalPedidos / limiteAtual)) || carregando} onClick={() => alterarPagina(paginaAtual + 1)}>Próxima</button>
      <label>Por página
        <select value={limiteAtual} onChange={event => alterarLimite(Number(event.target.value))}>
          {[10, 25, 50, 100].map(limite => <option key={limite} value={limite}>{limite}</option>)}
        </select>
      </label>
    </div>}

  </div>;
}