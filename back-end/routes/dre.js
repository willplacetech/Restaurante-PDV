const express = require('express');
const auth = require('../middleware/auth');
const Order = require('../models/Order');
const Comanda = require('../models/Comanda');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const PaymentSettings = require('../models/PaymentSettings');
const csv = require('csv-stringify/sync');

const router = express.Router();
const TIME_ZONE = 'America/Sao_Paulo';

const partesDataSaoPaulo = (value = new Date()) => {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const valores = Object.fromEntries(partes.filter((parte) => parte.type !== 'literal').map((parte) => [parte.type, parte.value]));
  return { year: Number(valores.year), month: Number(valores.month), day: Number(valores.day) };
};

const dataSaoPaulo = (value = new Date()) => {
  const { year, month, day } = partesDataSaoPaulo(value);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const inicioDoPeriodo = (periodo) => {
  if (periodo === 'dia') return new Date(`${dataSaoPaulo()}T00:00:00-03:00`);
  const agora = new Date();
  const inicio = new Date(agora);
  if (periodo === 'semana') {
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - inicio.getDay());
  }
  if (periodo === 'mes') {
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(1);
  }
  return inicio;
};

const fimDoMesAtual = () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
const inicioDoMesAnterior = () => new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);

router.use(auth, auth.allowRoles('admin'));

router.get('/csv', auth, async (req, res) => {
  try {
    const periodo = req.query.periodo || 'mes';
    const inicio = inicioDoPeriodo(periodo);
    const fim = periodo === 'dia' ? new Date(inicio.getTime() + 24 * 60 * 60 * 1000) : (periodo === 'mes' ? fimDoMesAtual() : new Date());

    const pedidos = await Order.find({ createdAt: { $gte: inicio, $lt: fim }, status: { $ne: 'cancelado' }, utilizacaoInterna: { $ne: true } }).select('total itens subtotal desconto pagamentos createdAt');
    const comandas = await Comanda.find({ createdAt: { $gte: inicio, $lt: fim }, status: { $ne: 'cancelado' } }).select('total criadoEm');

    const vendas = pedidos.map(p => ({
      data: new Date(p.createdAt).toLocaleDateString('pt-BR'),
      hora: new Date(p.createdAt).toLocaleTimeString('pt-BR'),
      tipo_atendimento: p.tipoAtendimento || '',
      cliente: p.clienteNome || '',
      total: Number(p.total || 0),
      subtotal: Number(p.subtotal || 0),
      desconto: Number(p.desconto || 0),
      itens: p.itens?.length || 0,
      forma_pagamento: p.pagamentos?.length ? p.pagamentos[pagamentos.length - 1]?.tipo || '' : '',
      status: p.status,
    }));

    const receitasVendas = vendas.reduce((sum, v) => sum + v.total, 0);
    const descontosTotal = vendas.reduce((sum, v) => sum + v.desconto, 0);

    const pagamentosMes = new Map();
    vendas.forEach((v) => {
      (v.forma_pagamento || '').split(',').forEach((tipo) => {
        tipo = tipo.trim();
        const atual = pagamentosMes.get(tipo) || { bruto: 0, taxa: 0, liquido: 0 };
        const taxa = Number(v.total) * 0.025; // taxa padrão 2.5% para cartão
        atual.bruto += v.total;
        atual.taxa += taxa;
        atual.liquido += v.total - taxa;
        pagamentosMes.set(tipo, atual);
      });
    });

    const totalRecebido = vendas.reduce((sum, v) => sum + v.total, 0);
    const totalTaxas = Array.from(pagamentosMes.values()).reduce((sum, p) => sum + p.taxa, 0);
    const totalLiquido = totalRecebido - totalTaxas;

    const produtos = new Map();
    vendas.forEach((v) => {
      (v.itens || 0).forEach(() => {}); // placeholder - would need item details
    });

    const dados = {
      periodo,
      data_inicio: inicio.toLocaleDateString('pt-BR'),
      data_fim: (periodo === 'dia' ? fim : fimDoMesAtual()).toLocaleDateString('pt-BR'),
      resumo: {
        total_vendas: vendas.length,
        receitas_vendas: vendas.length ? vendas.reduce((s, v) => s + v.total, 0) : 0,
        total_descontos: descontosTotal,
        total_recebido: totalRecebido,
        total_taxas: totalTaxas,
        total_liquido: totalLiquido,
      },
      vendas: vendas,
      resumo_pagamentos: Array.from(pagamentosMes.entries()).map(([tipo, valores]) => ({
        tipo,
        bruto: Number(valores.bruto.toFixed(2)),
        taxa: Number(valores.taxa.toFixed(2)),
        liquido: Number(valores.liquido.toFixed(2)),
      })),
    };

    const csvString = csv.stringify(dados, { header: true, columnMode: 'natural' });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=dre.csv');
    res.send(csvString);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
});

module.exports = router;