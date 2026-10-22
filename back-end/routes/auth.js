const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const { recordAuditEvent } = require('../services/auditLog');
const {
  createAuthSession,
  revokeAuthSession,
  revokeUserSessions,
  invalidateUserSessions,
} = require('../utils/authSessions');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, username, password } = req.body || {};
    const loginIdentifier = typeof email === 'string'
      ? email.trim().toLowerCase()
      : typeof username === 'string'
        ? username.trim().toLowerCase()
        : '';

    const user = await User.findOne({
      $or: [{ email: loginIdentifier }, { username: loginIdentifier }],
    }).select('+password');

    if (!user || !password || !(await user.matchPassword(password))) {
      await recordAuditEvent({
        AuditLogModel: require('../models/Auditoria'),
        req,
        action: 'auth.login',
        details: { identificador: loginIdentifier },
        success: false,
      });
      return res.status(401).json({ message: 'Nome de usuário, e-mail ou senha inválidos' });
    }

    if (!user.active || user.archivedAt) {
      await recordAuditEvent({
        AuditLogModel: require('../models/Auditoria'),
        req,
        action: 'auth.login',
        details: { identificador: loginIdentifier, motivo: 'usuario_inativo' },
        success: false,
      });
      return res.status(403).json({ message: 'Usuário inativo' });
    }

    await recordAuditEvent({
      AuditLogModel: require('../models/Auditoria'),
      req,
      action: 'auth.login',
      details: { email: user.email },
    });

    const session = await createAuthSession(user._id);
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        sessionId: session._id,
        authVersion: user.authVersion ?? 0,
      },
      process.env.JWT_SECRET || 'restaurante-pdv-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, username: user.username || '', email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Não foi possível realizar o login' });
  }
});

router.post('/logout', auth, async (req, res) => {
  try {
    if (req.authSessionId) {
      await revokeAuthSession(req.authSessionId, req.user._id);
    } else {
      await invalidateUserSessions(req.user._id);
    }
    await recordAuditEvent({
      AuditLogModel: require('../models/Auditoria'),
      req,
      action: 'auth.logout',
    });
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Não foi possível registrar a auditoria do logout' });
  }
});

router.get('/me', auth, (req, res) => {
  res.json({ id: req.user._id, name: req.user.name, username: req.user.username || '', email: req.user.email, role: req.user.role });
});

// User management
router.get('/users', auth.adminOnly, async (req, res) => {
  try {
    const users = await User.find({ active: { $ne: false } }).select('-password');
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao listar usuários' });
  }
});

router.post('/users', auth.adminOnly, async (req, res) => {
  try {
    const { name, email, username, password, role } = req.body || {};
    if (!name || !password || !['atendente', 'gerente', 'admin', 'garcom', 'cozinha', 'entregador', 'operador'].includes(role)) {
      return res.status(400).json({ message: 'Informe nome, senha, e-mail/usuário e perfil válido' });
    }

    const emailLower = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const usernameNorm = typeof username === 'string' ? username.trim() : '';

    const existing = await User.findOne({
      $or: [
        ...(emailLower ? [{ email: emailLower }] : []),
        ...(usernameNorm ? [{ username: usernameNorm }] : []),
      ],
    });
    if (existing) {
      return res.status(409).json({ message: 'Já existe uma conta com este e-mail ou nome de usuário' });
    }

    const user = new User({ name, email: emailLower, username: usernameNorm, password, role, active: true });
    await user.save();

    res.status(201).json({ id: user._id, name: user.name, username: user.username || '', email: user.email, role: user.role, active: user.active });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Não foi possível criar o usuário' });
  }
});

router.patch('/users/:id/active', auth.adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Identificador de usuário inválido' });
    }

    const { active } = req.body;
    if (typeof active !== 'boolean') {
      return res.status(400).json({ message: 'Informe um estado ativo válido' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    if (user.archivedAt) return res.status(404).json({ message: 'Usuário não encontrado' });

    if (active === false && user.role === 'admin' && user.active) {
      if (String(user._id) === String(req.user._id)) {
        return res.status(400).json({ message: 'Não é possível desativar a própria conta de administrador' });
      }
      const adminCount = await User.countDocuments({ role: 'admin', active: true });
      if (adminCount <= 1) {
        return res.status(409).json({ message: 'Não é possível desativar o último administrador ativo' });
      }
    }

    const wasActive = user.active;
    user.active = active;
    if (wasActive && !active) {
      user.authVersion = (user.authVersion ?? 0) + 1;
    }
    await user.save();

    if (wasActive && !active) {
      await revokeUserSessions(user._id);
    }
    await recordAuditEvent({
      AuditLogModel: require('../models/Auditoria'),
      req,
      action: 'usuario.status_alterado',
      details: { usuarioId: String(user._id), ativo: { antes: wasActive, depois: user.active } },
    });

    res.json({ id: user._id, name: user.name, username: user.username || '', email: user.email, role: user.role, active: user.active });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'O status foi alterado, mas não foi possível concluir a invalidação ou auditoria' });
  }
});

router.patch('/users/:id', auth.adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Identificador de usuário inválido' });
    }

    const body = req.body || {};
    const fields = ['name', 'email', 'username', 'role', 'password'].filter((field) => Object.hasOwn(body, field));

    if (!fields.length) {
      return res.status(400).json({ message: 'Informe ao menos um campo para alterar' });
    }

    if ('name' in body && (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120)) {
      return res.status(400).json({ message: 'Informe um nome com até 120 caracteres' });
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if ('email' in body && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Informe um e-mail válido' });
    }

    const username = typeof body.username === 'string' ? body.username.trim() : '';
    if ('username' in body && username.length < 3) {
      return res.status(400).json({ message: 'O nome de usuário deve ter pelo menos 3 caracteres' });
    }

    if ('role' in body && !['atendente', 'gerente', 'admin', 'garcom', 'cozinha', 'entregador', 'operador'].includes(body.role)) {
      return res.status(400).json({ message: 'O perfil deve ser um dos seguintes: atendente, gerente, admin, garcom, cozinha, entregador, operador' });
    }

    if ('password' in body && (typeof body.password !== 'string' || body.password.length < 4)) {
      return res.status(400).json({ message: 'A nova senha deve ter pelo menos 4 caracteres' });
    }

    const user = await User.findById(req.params.id);
    if (!user || user.archivedAt) return res.status(404).json({ message: 'Usuário não encontrado' });

    if (user.role === 'admin' && String(user._id) === String(req.user._id)) {
      const editedNonUsernameEmail = fields.some((field) => !['username', 'email'].includes(field));
      if (editedNonUsernameEmail) {
        return res.status(403).json({ message: 'Contas de administrador só podem alterar o próprio nome de usuário e e-mail' });
      }
    }

    const changes = {};
    if ('name' in body && user.name !== body.name.trim()) {
      changes.nome = { antes: user.name, depois: body.name.trim() };
      user.name = body.name.trim();
    }
    if ('email' in body && user.email !== email) {
      changes.email = { antes: user.email, depois: email };
      user.email = email;
    }
    if ('username' in body && user.username !== username) {
      changes.nomeUsuario = { antes: user.username || '', depois: username };
      user.username = username;
    }
    if ('role' in body && user.role !== body.role) {
      changes.perfil = { antes: user.role, depois: body.role };
      user.role = body.role;
    }
    if ('password' in body) {
      changes.senha = { alterada: true };
      user.password = body.password;
    }

    if (Object.keys(changes).length === 0) {
      return res.json({ id: user._id, name: user.name, username: user.username || '', email: user.email, role: user.role, active: user.active });
    }

    if (changes.perfil || changes.senha) {
      user.authVersion = (user.authVersion ?? 0) + 1;
    }
    await user.save();
    if (changes.perfil || changes.senha) {
      await revokeUserSessions(user._id);
    }

    await recordAuditEvent({
      AuditLogModel: require('../models/Auditoria'),
      req,
      action: 'usuario.alterado',
      details: { usuarioId: String(user._id), alteracoes: changes },
    });

    res.json({ id: user._id, name: user.name, username: user.username || '', email: user.email, role: user.role, active: user.active });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'A alteração foi aplicada ou iniciada, mas não foi possível concluir a invalidação ou auditoria' });
  }
});

router.delete('/users/:id', auth.adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Identificador de usuário inválido' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Contas de administrador não podem ser excluídas por esta tela' });

    user.active = false;
    user.archivedAt = new Date();
    user.authVersion = (user.authVersion ?? 0) + 1;
    await user.save();
    await revokeUserSessions(user._id);

    await recordAuditEvent({
      AuditLogModel: require('../models/Auditoria'),
      req,
      action: 'usuario.arquivado',
      details: { usuarioId: String(user._id), email: user.email, perfil: user.role },
    });

    res.json({ message: 'Usuário arquivado com sucesso', id: user._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'O usuário foi arquivado, mas não foi possível concluir a invalidação ou auditoria' });
  }
});

// Authorization endpoint (smart print /api/auth/autorizar)
router.post('/autorizar', async (req, res) => {
  try {
    const { senha, acao } = req.body;
    const user = await User.findOne({ role: 'gerente' }).or([{ role: 'admin' }]).or([{ role: 'entregador' }]).or([{ role: 'atendente' }]);

    if (!user) {
      return res.status(404).json({ msg: 'Usuário não encontrado' });
    }

    // Admin: bypass de senha - criar token imediatamente
    if (user.role === 'admin') {
      const tokenAutorizacao = jwt.sign(
        { usuarioId: user._id, role: user.role, acao, tipo: 'autorizacao_gerente', expiry: new Date(Date.now() + 5 * 60 * 1000) },
        process.env.JWT_SECRET || 'restaurante-pdv-secret-key'
      );

      return res.json({ tokenAutorizacao, msg: 'Acesso liberado para administrador.' });
    }

    // Entregador: pode usar senha cadastrada ou bypass como gerente
    if (user.role === 'entregador') {
      if (!senha) {
        const tokenAutorizacao = jwt.sign(
          { usuarioId: user._id, role: user.role, acao, tipo: 'autorizacao_gerente', expiry: new Date(Date.now() + 5 * 60 * 1000) },
          process.env.JWT_SECRET || 'restaurante-pdv-secret-key'
        );
        return res.json({ tokenAutorizacao, msg: 'Acesso liberado para entregador.' });
      }

      const senhaValida = await user.matchPassword(senha);

      if (!senhaValida) {
        return res.status(401).json({ msg: 'Senha incorreta.' });
      }

      const tokenAutorizacao = jwt.sign(
        { usuarioId: user._id, role: user.role, acao, tipo: 'autorizacao_gerente', expiry: new Date(Date.now() + 5 * 60 * 1000) },
        process.env.JWT_SECRET || 'restaurante-pdv-secret-key'
      );

      res.json({ tokenAutorizacao, msg: 'Autorização confirmada.' });
      return;
    }

    // Gerente/Atendente: validar senha
    if (!senha) {
      return res.status(401).json({ msg: 'Senha necessária.' });
    }

    const senhaValida = await user.matchPassword(senha);

    if (!senhaValida) {
      return res.status(401).json({ msg: 'Senha incorreta.' });
    }

    const tokenAutorizacao = jwt.sign(
      { usuarioId: user._id, role: user.role, acao, tipo: 'autorizacao_gerente', expiry: new Date(Date.now() + 5 * 60 * 1000) },
      process.env.JWT_SECRET || 'restaurante-pdv-secret-key'
    );

    res.json({ tokenAutorizacao, msg: 'Autorização confirmada.' });
  } catch (error) {
    console.error('Erro na autorização:', error);
    res.status(500).json({ msg: 'Erro interno do servidor.' });
  }
});

module.exports = router;