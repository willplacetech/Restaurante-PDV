const express = require('express');
const PaymentSettings = require('../models/PaymentSettings');

const router = express.Router();

const transformToFormasPagamento = (config) => ({
  formasPagamento: [
    { tipo: 'cartao_credito', nome: 'Cartão de Crédito', taxaPercentual: config?.cartao_credito || 0 },
    { tipo: 'cartao_debito', nome: 'Cartão de Débito', taxaPercentual: config?.cartao_debito || 0 },
  ],
});

router.get('/', async (req, res) => {
  try {
    const configuracao = await PaymentSettings.findOne({ chave: 'principal' }).lean();
    if (!configuracao) {
      return res.json(transformToFormasPagamento({ cartao_credito: 0, cartao_debito: 0 }));
    }
    res.json(transformToFormasPagamento(configuracao));
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { formasPagamento } = req.body || {};
    const updates = { chave: 'principal' };
    if (Array.isArray(formasPagamento)) {
      formasPagamento.forEach((f) => {
        if (f.tipo === 'cartao_credito') updates.cartao_credito = Number(f.taxaPercentual) || 0;
        if (f.tipo === 'cartao_debito') updates.cartao_debito = Number(f.taxaPercentual) || 0;
      });
    } else {
      const { cartao_credito, cartao_debito } = req.body || {};
      if (cartao_credito !== undefined) updates.cartao_credito = Number(cartao_credito) || 0;
      if (cartao_debito !== undefined) updates.cartao_debito = Number(cartao_debito) || 0;
    }
    await PaymentSettings.findOneAndUpdate(
      { chave: 'principal' },
      { $set: updates },
      { upsert: true, new: true }
    );
    const config = await PaymentSettings.findOne({ chave: 'principal' }).lean();
    res.json(transformToFormasPagamento(config));
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
});

module.exports = router;