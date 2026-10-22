const express = require('express');
const router = express.Router();
const Auditoria = require('../models/Auditoria');
const auth = require('../middleware/auth');
const { parseAuditFilters } = require('../services/auditLog');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { filter, pagination } = parseAuditFilters(req.query);

    const [registros, total] = await Promise.all([
      Auditoria.find(filter)
        .sort({ data: -1 })
        .skip(pagination.skip)
        .limit(pagination.pageSize)
        .populate('usuarioSolicitante', 'username role')
        .populate('usuarioAutorizou', 'username role')
        .lean(),
      Auditoria.countDocuments(filter),
    ]);

    res.json({
      registros,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ msg: error.message });
    }
    console.error('Erro ao carregar auditoria:', error);
    res.status(500).json({ msg: 'Erro interno do servidor.' });
  }
});

module.exports = router;