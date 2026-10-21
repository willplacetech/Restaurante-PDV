const express = require('express');
const Configuracoes = require('../models/Configuracoes');
const Auditoria = require('../models/Auditoria');
const auth = require('../middleware/auth');
const { invalidarCacheConfiguracaoGerente } = require('../middleware/exigirAutorizacao');

const isSupportOverrideActive = () => process.env.FORCAR_AUTORIZACAO_GERENTE === 'true';

const router = express.Router();

// GET /api/configuracoes — somente admin
router.get('/', auth, auth.allowRoles('admin'), async (req, res) => {
  try {
    let configuracao = await Configuracoes.findOne({ _id: 'principal' });
    if (!configuracao) {
      configuracao = await Configuracoes.create({ _id: 'principal', exigirAutorizacaoGerente: true });
    }

    res.json({
      exigirAutorizacaoGerente: configuracao.exigirAutorizacaoGerente !== false,
      bloqueadoPorSuporte: isSupportOverrideActive(),
    });
  } catch (error) {
    console.error('Erro ao buscar configuracoes:', error);
    res.status(500).json({ msg: 'Erro ao buscar configuracoes' });
  }
});

// PATCH /api/configuracoes/autorizacao-gerente — somente admin
router.patch('/autorizacao-gerente', auth, auth.allowRoles('admin'), async (req, res) => {
  if (isSupportOverrideActive()) {
    return res.status(403).json({ msg: 'Bloqueado pelo suporte' });
  }

  const { valor, motivo } = req.body;
  if (typeof valor !== 'boolean') {
    return res.status(400).json({ msg: 'O campo valor deve ser booleano' });
  }
  if (!valor && (!motivo || typeof motivo !== 'string' || motivo.trim().length < 10)) {
    return res.status(400).json({ msg: 'Motivo obrigatório com no mínimo 10 caracteres ao desligar' });
  }

  try {
    let configuracao = await Configuracoes.findOne({ _id: 'principal' });
    if (!configuracao) {
      configuracao = await Configuracoes.create({ _id: 'principal', exigirAutorizacaoGerente: true });
    }

    configuracao.exigirAutorizacaoGerente = valor;
    await configuracao.save();
    invalidarCacheConfiguracaoGerente();

    await Auditoria.create({
      usuarioSolicitante: req.user.id,
      usuarioAutorizou: req.user.id,
      acao: 'toggle_autorizacao_gerente',
      detalhes: valor
        ? 'Autorização gerencial ativada'
        : `Autorização gerencial desativada. Motivo: ${motivo.trim()}`,
      ip: req.ip,
      sucesso: true,
    });

    res.json({ sucesso: true, exigirAutorizacaoGerente: valor });
  } catch (error) {
    console.error('Erro ao salvar configuracoes:', error);
    res.status(500).json({ msg: 'Erro ao salvar configuracoes' });
  }
});

module.exports = router;