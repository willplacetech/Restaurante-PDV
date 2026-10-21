const express = require('express');
const router = express.Router();
const Auditoria = require('../models/Auditoria');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { usuario, acao, dataInicio, dataFim } = req.query;
    const filter = {};

    if (usuario) {
      filter.usuarioId = usuario;
    }
    if (acao) {
      filter.acao = acao;
    }
    if (dataInicio || dataFim) {
      filter.createdAt = {};
      if (dataInicio) filter.createdAt.$gte = new Date(String(dataInicio));
      if (dataFim) filter.createdAt.$lte = new Date(String(dataFim));
    }

    const registros = await Auditoria.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('usuarioId', 'username role')
      .lean();

    res.json({ registros });
  } catch (error) {
    console.error('Erro ao carregar auditoria:', error);
    res.status(500).json({ msg: 'Erro interno do servidor.' });
  }
});

module.exports = router;