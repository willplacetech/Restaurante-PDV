const express = require('express');
const mongoose = require('mongoose');
const DeliverySettings = require('../models/DeliverySettings');
const Entregador = require('../models/Entregador');
const DeliveryOrder = require('../models/DeliveryOrder');
const Order = require('../models/Order');
const Comanda = require('../models/Comanda');
const Product = require('../models/Product');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { recordAuditEvent } = require('../services/auditLog');
const router = express.Router();

const transicoes = {
  pendente: ['pronto', 'cancelado'],
  pronto: ['despachado', 'cancelado'],
  despachado: ['a_caminho', 'entregue', 'cancelado'],
  a_caminho: ['entregue', 'cancelado'],
  entregue: [],
  cancelado: [],
};

const obterEntregadorAutenticado = (req) => (
  req.user.role === 'entregador'
    ? Entregador.findOne({ usuarioId: req.user._id, ativo: true }).select('_id')
    : null
);

const obterPedidoAcessivel = async (req, id) => {
  const entregador = await obterEntregadorAutenticado(req);
  if (req.user.role === 'entregador' && !entregador) return null;
  return DeliveryOrder.findOne({
    _id: id,
    ...(entregador ? { entregadorId: entregador._id } : {}),
  });
};

const salvarTransicao = (pedido, status, fields = {}) => DeliveryOrder.findOneAndUpdate(
  { _id: pedido._id, status: pedido.status },
  {
    $set: { status, atualizadoEm: Date.now(), ...fields },
    $push: { statusHistorico: { status: pedido.status, data: new Date() } },
  },
  { new: true, runValidators: true }
);

const transicaoInvalida = (statusAtual, novoStatus) => (
  !transicoes[statusAtual]?.includes(novoStatus)
);

const validarUsuarioEntregador = async (usuarioId, entregadorAtualId) => {
  if (!mongoose.isValidObjectId(usuarioId)) return { erro: 'Selecione uma conta de entregador válida' };
  const usuario = await User.findOne({ _id: usuarioId, role: 'entregador', active: true });
  if (!usuario) return { erro: 'A conta selecionada não é um entregador ativo' };
  const filtroDuplicado = { usuarioId: usuario._id };
  if (entregadorAtualId) filtroDuplicado._id = { $ne: entregadorAtualId };
  if (await Entregador.exists(filtroDuplicado)) return { erro: 'Esta conta já está vinculada a outro entregador' };
  return { usuario };
};

// GET /api/delivery/configuracao - Configurações de entrega
router.get('/configuracao', auth, async (req, res) => {
  try {
    let settings = await DeliverySettings.findOne();
    if (!settings) {
      settings = new DeliverySettings();
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao buscar configurações' });
  }
});

// PATCH /api/delivery/configuracao - Atualizar configurações
router.patch('/configuracao', auth, auth.allowRoles('admin', 'gerente'), async (req, res) => {
  try {
    const { tempoEstimadoPadraoMin, taxaEntregaPadrao, mensagemWhatsApp } = req.body;
    const settings = await DeliverySettings.findOneAndUpdate(
      {},
      { tempoEstimadoPadraoMin, taxaEntregaPadrao, mensagemWhatsApp, atualizadoEm: Date.now() },
      { new: true, upsert: true }
    );
    res.json(settings);
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao atualizar configurações' });
  }
});

// GET /api/delivery/entregadores/usuarios-disponiveis - Listar contas sem perfil vinculado
router.get('/entregadores/usuarios-disponiveis', auth, auth.allowRoles('admin', 'gerente'), async (req, res) => {
  try {
    const vinculados = await Entregador.find({
      usuarioId: { $exists: true, $ne: null },
      ...(req.query.entregadorId ? { _id: { $ne: req.query.entregadorId } } : {}),
    }).distinct('usuarioId');
    const usuarios = await User.find({
      role: 'entregador',
      active: true,
      _id: { $nin: vinculados },
    }).select('username email').sort({ username: 1 });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao listar contas disponíveis' });
  }
});

// GET /api/delivery/entregadores - Listar entregadores
router.get('/entregadores', auth, auth.allowRoles('admin', 'gerente', 'entregador'), async (req, res) => {
  try {
    const filtro = req.user.role === 'entregador'
      ? { usuarioId: req.user._id, ativo: true }
      : {};
    const entregadores = await Entregador.find(filtro).populate('usuarioId', 'name username email').sort({ nome: 1 });
    res.json(entregadores);
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao listar entregadores' });
  }
});

// POST /api/delivery/entregadores - Cadastrar entregador
router.post('/entregadores', auth, auth.allowRoles('admin', 'gerente'), async (req, res) => {
  try {
    const { nome, telefone, senha, ativo, usuarioId } = req.body;
    const validacao = await validarUsuarioEntregador(usuarioId);
    if (validacao.erro) return res.status(400).json({ msg: validacao.erro });
    const entregador = new Entregador({ nome, telefone, senha, ativo, usuarioId: validacao.usuario._id });
    await entregador.save();

    try {
      await recordAuditEvent({
        req,
        action: 'entregador.criar',
        details: { entregadorId: String(entregador._id), nome: entregador.nome, telefone: entregador.telefone },
      });
    } catch (_) {}

    res.status(201).json(entregador);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ msg: 'Esta conta já está vinculada a outro entregador' });
    res.status(500).json({ msg: 'Erro ao cadastrar entregador' });
  }
});

// PUT /api/delivery/entregadores/:id - Atualizar entregador
router.put('/entregadores/:id', auth, auth.allowRoles('admin', 'gerente'), async (req, res) => {
  try {
    const entregador = await Entregador.findById(req.params.id);
    if (!entregador) return res.status(404).json({ msg: 'Entregador não encontrado' });
    const { nome, telefone, senha, ativo, usuarioId } = req.body;
    if (usuarioId !== undefined && String(usuarioId) !== String(entregador.usuarioId || '')) {
      const validacao = await validarUsuarioEntregador(usuarioId, entregador._id);
      if (validacao.erro) return res.status(400).json({ msg: validacao.erro });
      entregador.usuarioId = validacao.usuario._id;
    }
    if (nome !== undefined) entregador.nome = nome;
    if (telefone !== undefined) entregador.telefone = telefone;
    if (senha !== undefined && senha !== '') entregador.senha = senha;
    if (ativo !== undefined) entregador.ativo = ativo;
    entregador.atualizadoEm = Date.now();
    await entregador.save();

    try {
      await recordAuditEvent({
        req,
        action: 'entregador.atualizar',
        details: { entregadorId: String(entregador._id), nome: entregador.nome, ativo: entregador.ativo },
      });
    } catch (_) {}

    res.json(entregador);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ msg: 'Esta conta já está vinculada a outro entregador' });
    res.status(500).json({ msg: 'Erro ao atualizar entregador' });
  }
});

// DELETE /api/delivery/entregadores/:id - Excluir entregador (soft delete)
router.delete('/entregadores/:id', auth, auth.allowRoles('admin', 'gerente'), async (req, res) => {
  try {
    const entregador = await Entregador.findByIdAndUpdate(
      req.params.id,
      { ativo: false, atualizadoEm: Date.now() },
      { new: true }
    );
    if (!entregador) return res.status(404).json({ msg: 'Entregador não encontrado' });

    try {
      await recordAuditEvent({
        req,
        action: 'entregador.excluir',
        details: { entregadorId: String(entregador._id), nome: entregador.nome },
      });
    } catch (_) {}

    res.json(entregador);
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao excluir entregador' });
  }
});

// GET /api/delivery/pedidos - Listar pedidos de entrega
router.get('/pedidos', auth, auth.allowRoles('admin', 'gerente', 'entregador'), async (req, res) => {
  try {
    const { status, entregadorId } = req.query;
    let query = {};
    if (status) query.status = status;
    if (entregadorId) query.entregadorId = entregadorId;
    const entregador = await obterEntregadorAutenticado(req);
    if (req.user.role === 'entregador') query.entregadorId = entregador?._id || null;
    const pedidos = await DeliveryOrder.find(query).populate('entregadorId', 'nome').sort({ criadoEm: -1 });
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao listar pedidos' });
  }
});

// POST /api/delivery/pedidos - Criar pedido de entrega
router.post('/pedidos', auth, auth.allowRoles('admin', 'gerente', 'operador'), async (req, res) => {
  try {
    const { origem, itens, valorTotal, taxaEntrega } = req.body;
    if (!Array.isArray(itens) || !itens.length) {
      return res.status(400).json({ msg: 'Pedido precisa ter pelo menos um item' });
    }
    const pedido = new DeliveryOrder({
      origem,
      itens,
      valorTotal,
      taxaEntrega,
      status: 'pendente',
    });
    await pedido.save();

    try {
      await recordAuditEvent({
        req,
        action: 'delivery.pedido.criar',
        details: { pedidoId: String(pedido._id), origem: pedido.origem?.nomeCliente, valorTotal: pedido.valorTotal, status: pedido.status },
      });
    } catch (_) {}

    res.status(201).json(pedido);
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao criar pedido' });
  }
});

// POST /api/delivery/pedidos/:id/despachar - Despachar pedido
router.post('/pedidos/:id/despachar', auth, auth.allowRoles('admin', 'gerente'), async (req, res) => {
  try {
    const { entregadorId } = req.body;
    const pedido = await DeliveryOrder.findById(req.params.id);
    if (!pedido) return res.status(404).json({ msg: 'Pedido não encontrado' });
    if (transicaoInvalida(pedido.status, 'despachado')) {
      return res.status(409).json({ msg: `Não é possível despachar um pedido com status ${pedido.status}` });
    }
    if (!mongoose.isValidObjectId(entregadorId)) {
      return res.status(400).json({ msg: 'Selecione um entregador válido' });
    }
    const entregador = await Entregador.findOne({ _id: entregadorId, ativo: true }).populate('usuarioId');
    if (!entregador || !entregador.usuarioId || entregador.usuarioId.role !== 'entregador' || !entregador.usuarioId.active) {
      return res.status(400).json({ msg: 'O entregador deve estar vinculado a uma conta ativa' });
    }
    const statusAnterior = pedido.status;
    const atualizado = await salvarTransicao(pedido, 'despachado', { entregadorId: entregador._id });
    if (!atualizado) return res.status(409).json({ msg: 'O pedido foi atualizado por outra operação. Recarregue e tente novamente.' });

    try {
      await recordAuditEvent({
        req,
        action: 'delivery.pedido.despachar',
        details: { pedidoId: String(atualizado._id), entregadorId: String(entregador._id), statusAnterior, statusNovo: 'despachado' },
      });
    } catch (_) {}

    res.json(atualizado);
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao despachar pedido' });
  }
});

// POST /api/delivery/pedidos/:id/pronto - Marcar pedido como pronto
router.post('/pedidos/:id/pronto', auth, auth.allowRoles('admin', 'gerente', 'entregador'), async (req, res) => {
  try {
    const pedido = await obterPedidoAcessivel(req, req.params.id);
    if (!pedido) return res.status(404).json({ msg: 'Pedido não encontrado' });
    if (transicaoInvalida(pedido.status, 'pronto')) {
      return res.status(409).json({ msg: `Não é possível marcar como pronto um pedido com status ${pedido.status}` });
    }
    const statusAnterior = pedido.status;
    const atualizado = await salvarTransicao(pedido, 'pronto');
    if (!atualizado) return res.status(409).json({ msg: 'O pedido foi atualizado por outra operação. Recarregue e tente novamente.' });

    try {
      await recordAuditEvent({
        req,
        action: 'delivery.pedido.pronto',
        details: { pedidoId: String(atualizado._id), statusAnterior, statusNovo: 'pronto' },
      });
    } catch (_) {}

    res.json(atualizado);
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao marcar como pronto' });
  }
});

// POST /api/delivery/pedidos/:id/cancelar - Cancelar pedido
router.post('/pedidos/:id/cancelar', auth, auth.allowRoles('admin', 'gerente', 'operador', 'entregador'), async (req, res) => {
  try {
    const { motivo } = req.body;
    const pedido = await obterPedidoAcessivel(req, req.params.id);
    if (!pedido) return res.status(404).json({ msg: 'Pedido não encontrado' });
    if (transicaoInvalida(pedido.status, 'cancelado')) {
      return res.status(409).json({ msg: `Não é possível cancelar um pedido com status ${pedido.status}` });
    }
    const statusAnterior = pedido.status;
    const atualizado = await salvarTransicao(pedido, 'cancelado');
    if (!atualizado) return res.status(409).json({ msg: 'O pedido foi atualizado por outra operação. Recarregue e tente novamente.' });

    try {
      await recordAuditEvent({
        req,
        action: 'delivery.pedido.cancelar',
        details: { pedidoId: String(atualizado._id), motivo, statusAnterior, statusNovo: 'cancelado' },
      });
    } catch (_) {}

    res.json(atualizado);
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao cancelar pedido' });
  }
});

// POST /api/delivery/pedidos/:id/status - Atualizar status do pedido
router.post('/pedidos/:id/status', auth, auth.allowRoles('admin', 'gerente', 'entregador'), async (req, res) => {
  try {
    const { novoStatus } = req.body;
    if (!Object.hasOwn(transicoes, novoStatus)) return res.status(400).json({ msg: 'Status inválido' });
    const pedido = await obterPedidoAcessivel(req, req.params.id);
    if (!pedido) return res.status(404).json({ msg: 'Pedido não encontrado' });
    if (req.user.role === 'entregador' && !['a_caminho', 'entregue'].includes(novoStatus)) {
      return res.status(403).json({ msg: 'Entregadores podem marcar pedidos a caminho ou entregues' });
    }
    if (transicaoInvalida(pedido.status, novoStatus)) {
      return res.status(409).json({ msg: `Transição de ${pedido.status} para ${novoStatus} não permitida` });
    }
    const statusAnterior = pedido.status;
    const atualizado = await salvarTransicao(pedido, novoStatus);
    if (!atualizado) return res.status(409).json({ msg: 'O pedido foi atualizado por outra operação. Recarregue e tente novamente.' });

    try {
      await recordAuditEvent({
        req,
        action: 'delivery.pedido.status',
        details: { pedidoId: String(atualizado._id), statusAnterior, statusNovo: novoStatus },
      });
    } catch (_) {}

    res.json(atualizado);
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao atualizar status' });
  }
});

// POST /api/delivery/pedidos/:id/enviar-whatsapp - Enviar WhatsApp
router.post('/pedidos/:id/enviar-whatsapp', auth, auth.allowRoles('admin', 'gerente', 'operador', 'entregador'), async (req, res) => {
  try {
    const pedido = await obterPedidoAcessivel(req, req.params.id);
    if (!pedido) return res.status(404).json({ msg: 'Pedido não encontrado' });
    await pedido.populate('entregadorId', 'nome');
    const mensagem = pedido.entregadorId 
      ? `Entregador: ${pedido.entregadorId.nome}. ${pedido.origem.nomeCliente} · ${pedido.origem.endereco.rua}, ${pedido.origem.endereco.numero} · Total: R$ ${pedido.valorTotal}`
      : `Cliente: ${pedido.origem.nomeCliente}. ${pedido.origem.endereco.rua}, ${pedido.origem.endereco.numero} · Total: R$ ${pedido.valorTotal}`;
    res.json({ mensagem, whatsappUrl: `https://wa.me/?text=${encodeURIComponent(mensagem)}` });
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao gerar mensagem' });
  }
});

module.exports = router;