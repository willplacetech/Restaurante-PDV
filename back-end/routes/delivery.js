const express = require('express');
const DeliverySettings = require('../models/DeliverySettings');
const Entregador = require('../models/Entregador');
const DeliveryOrder = require('../models/DeliveryOrder');
const Order = require('../models/Order');
const Comanda = require('../models/Comanda');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { recordAuditEvent } = require('../services/auditLog');
const router = express.Router();

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

// GET /api/delivery/entregadores - Listar entregadores
router.get('/entregadores', auth, auth.allowRoles('admin', 'gerente', 'entregador'), async (req, res) => {
  try {
    const entregadores = await Entregador.find().sort({ nome: 1 });
    res.json(entregadores);
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao listar entregadores' });
  }
});

// POST /api/delivery/entregadores - Cadastrar entregador
router.post('/entregadores', auth, auth.allowRoles('admin', 'gerente'), async (req, res) => {
  try {
    const { nome, telefone, senha, ativo } = req.body;
    const entregador = new Entregador({ nome, telefone, senha, ativo });
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
    res.status(500).json({ msg: 'Erro ao cadastrar entregador' });
  }
});

// PUT /api/delivery/entregadores/:id - Atualizar entregador
router.put('/entregadores/:id', auth, auth.allowRoles('admin', 'gerente'), async (req, res) => {
  try {
    const { nome, telefone, senha, ativo } = req.body;
    const entregador = await Entregador.findByIdAndUpdate(
      req.params.id,
      { nome, telefone, senha, ativo, atualizadoEm: Date.now() },
      { new: true }
    );
    if (!entregador) return res.status(404).json({ msg: 'Entregador não encontrado' });

    try {
      await recordAuditEvent({
        req,
        action: 'entregador.atualizar',
        details: { entregadorId: String(entregador._id), nome: entregador.nome, ativo: entregador.ativo },
      });
    } catch (_) {}

    res.json(entregador);
  } catch (error) {
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
    const pedido = await DeliveryOrder.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'despachado', 
        statusHistorico: [
          ...( pedido.statusHistorico || [] ),
          { status: pedido.status, data: new Date() }
        ],
        entregadorId,
        atualizadoEm: Date.now()
      },
      { new: true }
    );
    if (!pedido) return res.status(404).json({ msg: 'Pedido não encontrado' });

    try {
      await recordAuditEvent({
        req,
        action: 'delivery.pedido.despachar',
        details: { pedidoId: String(pedido._id), entregadorId, statusAnterior: 'pendente', statusNovo: 'despachado' },
      });
    } catch (_) {}

    res.json(pedido);
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao despachar pedido' });
  }
});

// POST /api/delivery/pedidos/:id/pronto - Marcar pedido como pronto
router.post('/pedidos/:id/pronto', auth, auth.allowRoles('admin', 'gerente', 'entregador'), async (req, res) => {
  try {
    const pedido = await DeliveryOrder.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'pronto', 
        statusHistorico: [
          ...( pedido.statusHistorico || [] ),
          { status: pedido.status, data: new Date() }
        ],
        atualizadoEm: Date.now()
      },
      { new: true }
    );
    if (!pedido) return res.status(404).json({ msg: 'Pedido não encontrado' });

    try {
      await recordAuditEvent({
        req,
        action: 'delivery.pedido.pronto',
        details: { pedidoId: String(pedido._id), statusAnterior: 'despachado', statusNovo: 'pronto' },
      });
    } catch (_) {}

    res.json(pedido);
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao marcar como pronto' });
  }
});

// POST /api/delivery/pedidos/:id/cancelar - Cancelar pedido
router.post('/pedidos/:id/cancelar', auth, auth.allowRoles('admin', 'gerente', 'operador', 'entregador'), async (req, res) => {
  try {
    const { motivo } = req.body;
    const pedido = await DeliveryOrder.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'cancelado', 
        statusHistorico: [
          ...( pedido.statusHistorico || [] ),
          { status: pedido.status, data: new Date() }
        ],
        atualizadoEm: Date.now()
      },
      { new: true }
    );
    if (!pedido) return res.status(404).json({ msg: 'Pedido não encontrado' });

    try {
      await recordAuditEvent({
        req,
        action: 'delivery.pedido.cancelar',
        details: { pedidoId: String(pedido._id), motivo, statusAnterior: pedido.statusHistorico?.[pedido.statusHistorico.length - 1]?.status || 'pendente', statusNovo: 'cancelado' },
      });
    } catch (_) {}

    res.json(pedido);
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao cancelar pedido' });
  }
});

// POST /api/delivery/pedidos/:id/status - Atualizar status do pedido
router.post('/pedidos/:id/status', auth, auth.allowRoles('admin', 'gerente', 'entregador'), async (req, res) => {
  try {
    const { novoStatus } = req.body;
    const pedidoAntigo = await DeliveryOrder.findById(req.params.id);
    if (!pedidoAntigo) return res.status(404).json({ msg: 'Pedido não encontrado' });
    const statusAnterior = pedidoAntigo.status;

    const pedido = await DeliveryOrder.findByIdAndUpdate(
      req.params.id,
      { status: novoStatus, statusHistorico: [...(pedidoAntigo.statusHistorico || []), { status: pedidoAntigo.status, data: new Date() }], atualizadoEm: Date.now() },
      { new: true }
    );
    if (!pedido) return res.status(404).json({ msg: 'Pedido não encontrado' });

    try {
      await recordAuditEvent({
        req,
        action: 'delivery.pedido.status',
        details: { pedidoId: String(pedido._id), statusAnterior, statusNovo: novoStatus },
      });
    } catch (_) {}

    res.json(pedido);
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao atualizar status' });
  }
});

// POST /api/delivery/pedidos/:id/enviar-whatsapp - Enviar WhatsApp
router.post('/pedidos/:id/enviar-whatsapp', auth, auth.allowRoles('admin', 'gerente', 'operador', 'entregador'), async (req, res) => {
  try {
    const pedido = await DeliveryOrder.findById(req.params.id).populate('entregadorId', 'nome');
    if (!pedido) return res.status(404).json({ msg: 'Pedido não encontrado' });
    const mensagem = pedido.entregadorId 
      ? `Entregador: ${pedido.entregadorId.nome}. ${pedido.origem.nomeCliente} · ${pedido.origem.endereco.rua}, ${pedido.origem.endereco.numero} · Total: R$ ${pedido.valorTotal}`
      : `Cliente: ${pedido.origem.nomeCliente}. ${pedido.origem.endereco.rua}, ${pedido.origem.endereco.numero} · Total: R$ ${pedido.valorTotal}`;
    res.json({ mensagem, whatsappUrl: `https://wa.me/?text=${encodeURIComponent(mensagem)}` });
  } catch (error) {
    res.status(500).json({ msg: 'Erro ao gerar mensagem' });
  }
});

module.exports = router;