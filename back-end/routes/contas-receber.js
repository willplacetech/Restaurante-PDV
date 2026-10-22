const csv = require('csv-stringify/sync');
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Comanda = require('../models/Comanda');
const Order = require('../models/Order');

router.use(auth, auth.allowRoles('admin'));

router.get('/csv', async (req, res) => {
  try {
    const [comandasAbertas, pedidos] = await Promise.all([
      Comanda.find({
        status: 'aberta',
        utilizacaoInterna: { $ne: true },
        statusPagamento: { $in: ['pendente', 'parcial'] },
        valorTotal: { $gt: 0 },
      })
        .select('_id valorTotal historicoPagamentos clienteId clienteNome clienteTelefone')
        .lean(),
      Order.find({ status: { $in: ['pendente', 'parcial'] }, utilizacaoInterna: { $ne: true } })
        .select('_id comandaId total pagamentos clienteId clienteNome clienteTelefone')
        .lean(),
    ]);

    const dados = [...comandasAbertas, ...pedidos].map((registro) => ({
      tipo: registro.tipoComanda || 'comanda',
      id: registro._id,
      cliente: registro.clienteNome || 'Não identificado',
      telefone: registro.clienteTelefone || '',
      valor_total: registro.valorTotal || registro.total || 0,
      status: registro.status,
      data: registro.createdAt ? new Date(registro.createdAt).toLocaleDateString('pt-BR') : '',
      forma_pagamento: registro.formaPagamento || '',
    }));

    const csvString = csv.stringify(dados, { header: true, columnMode: 'natural' });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=contas-receber.csv');
    res.send(csvString);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
});

router.get('/resumo', async (req, res) => {
  try {
    const [comandasAbertas, pedidos] = await Promise.all([
      Comanda.find({
        status: 'aberta',
        utilizacaoInterna: { $ne: true },
        statusPagamento: { $in: ['pendente', 'parcial'] },
        valorTotal: { $gt: 0 },
      })
        .select('_id valorTotal historicoPagamentos clienteId clienteNome clienteTelefone')
        .lean(),
      Order.find({ status: { $in: ['pendente', 'parcial'] }, utilizacaoInterna: { $ne: true } })
        .select('_id comandaId total pagamentos clienteId clienteNome clienteTelefone')
        .lean(),
    ]);
    const idsComandasVinculadas = [...new Set(pedidos.map((pedido) => pedido.comandaId).filter(Boolean).map(String))];
    const comandasVinculadas = idsComandasVinculadas.length
      ? await Comanda.find({ _id: { $in: idsComandasVinculadas } })
        .select('_id valorTotal historicoPagamentos status utilizacaoInterna')
        .lean()
      : [];
    const comandasPorId = new Map(comandasVinculadas.map((comanda) => [String(comanda._id), comanda]));
    const comandasAbertasPorId = new Map(comandasAbertas.map((comanda) => [String(comanda._id), comanda]));
    const devedores = new Map();
    let total = 0;

    const acumularDevedor = (registro, valor) => {
      if (valor <= 0) return;
      total += valor;
      const nome = String(registro.clienteNome || 'Cliente não identificado').trim();
      const chave = registro.clienteId ? String(registro.clienteId) : `${nome.toLocaleLowerCase('pt-BR')}:${registro.clienteTelefone || ''}`;
      const atual = devedores.get(chave) || { nome, telefone: registro.clienteTelefone || '', valor: 0 };
      atual.valor += valor;
      if (!atual.telefone && registro.clienteTelefone) atual.telefone = registro.clienteTelefone;
      devedores.set(chave, atual);
    };

    comandasAbertas.forEach((comanda) => {
      acumularDevedor(comanda, comanda.valorTotal || 0);
    });

    pedidos.forEach((pedido) => {
      acumularDevedor(pedido, pedido.total || 0);
    });

    const listaDevedores = Array.from(devedores.values()).map((d) => ({
      nome: d.nome,
      telefone: d.telefone,
      valor: d.valor,
    }));

    res.json({
      devedores: listaDevedores,
      total,
      comandasVinculadas: comandasPorId.size,
      comandasAbertas: comandasAbertasPorId.size,
    });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
});

module.exports = router;