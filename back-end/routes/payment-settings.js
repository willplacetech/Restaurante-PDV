const express = require('express');
const PaymentSettings = require('../models/PaymentSettings');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const configuracao = await PaymentSettings.findOne({ chave: 'principal' }).lean();
    if (!configuracao) {
      return res.json({ chave: 'principal', cartao_credito: 0, cartao_debito: 0 });
    }
    res.json(configuracao);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { chave, cartao_credito, cartao_debito } = req.body || {};
    await PaymentSettings.findOneAndUpdate(
      { chave: 'principal' },
      { $set: { chave, cartao_credito: Number(cartao_credito) || 0, cartao_debito: Number(cartao_debito) || 0 } },
      { upsert: true, new: true }
    );
    const config = await PaymentSettings.findOne({ chave: 'principal' }).lean();
    res.json(config);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
});

module.exports = router;