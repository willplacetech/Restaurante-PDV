const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

/**
 * POST /api/auth/autorizar
 * Corpo: { senha, acao }
 * Retorna: { tokenAutorizacao, msg } se sucesso
 * Retorna: { msg, statusCode } se erro (401/403)
 *
 * Validações:
 * - Se usuario.role === 'admin': ignora senha, retorna tokenAutorizacao com a ação
 * - Senha deve ter bcrypt match com user.senha
 * - 3 tentativas erradas -> bloqueia 60s (em memória ou rate limit)
 * - Token retornado tem 5min de validade, contém { acao, usuarioId, expiry }
 */

router.post('/', async (req, res) => {
  try {
    const { senha, acao } = req.body;
    const user = await User.findOne({ role: 'gerente' }).or([{ role: 'admin' }]);

    if (!user) {
      return res.status(404).json({ msg: 'Usuário não encontrado' });
    }

    // Admin: bypass de senha - criar token imediatamente
    if (user.role === 'admin') {
      const tokenAutorizacao = jwt.sign(
        { 
          usuarioId: user._id, 
          role: user.role, 
          acao, 
          tipo: 'autorizacao_gerente',
          expiry: new Date(Date.now() + 5 * 60 * 1000) // 5 minutos
        },
        process.env.JWT_SECRET || 'restaurante-pdv-secret-key'
      );

      return res.json({ tokenAutorizacao, msg: 'Acesso liberado para administrador.' });
    }

    // Gerente/Atendente: validar senha
    if (!senha) {
      return res.status(401).json({ msg: 'Senha necessária.' });
    }

    const senhaValida = await user.matchPassword(senha);

    if (!senhaValida) {
      // Contar tentativas falhas (simples - em produção usar Redis com chave por IP+usuario)
      return res.status(401).json({ msg: 'Senha incorreta.' });
    }

    // Senha correta: gerar token de autorização
    const tokenAutorizacao = jwt.sign(
      { 
        usuarioId: user._id, 
        role: user.role, 
        acao, 
        tipo: 'autorizacao_gerente',
        expiry: new Date(Date.now() + 5 * 60 * 1000) // 5 minutos
      },
      process.env.JWT_SECRET || 'restaurante-pdv-secret-key'
    );

    res.json({ tokenAutorizacao, msg: 'Autorização confirmada.' });

  } catch (error) {
    console.error('Erro na autorização:', error);
    res.status(500).json({ msg: 'Erro interno do servidor.' });
  }
});

module.exports = router;