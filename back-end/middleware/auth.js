const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuthSession = require('../models/AuthSession');
const jwtSecret = process.env.JWT_SECRET || 'restaurante-pdv-secret-key';

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;

  if (!token) return res.status(401).json({ msg: 'Acesso não autorizado' });

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findById(decoded.id || decoded._id || decoded.usuarioId);
    if (!user) return res.status(401).json({ msg: 'Usuário não encontrado' });
    if (user.active === false || user.archivedAt) return res.status(403).json({ msg: 'Usuário inativo' });
    if ((decoded.authVersion ?? 0) !== (user.authVersion ?? 0)) {
      return res.status(401).json({ msg: 'Sessão revogada' });
    }
    if (decoded.sessionId) {
      const session = await AuthSession.findOne({
        _id: decoded.sessionId,
        userId: user._id,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      });
      if (!session) return res.status(401).json({ msg: 'Sessão revogada' });
      req.authSessionId = decoded.sessionId;
    }
    req.user = user;
    next();
  } catch (_) {
    res.status(401).json({ msg: 'Sessão inválida ou expirada' });
  }
};

auth.allowRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) return res.status(403).json({ msg: 'Você não tem permissão para esta ação' });
  next();
};

auth.adminOnly = (req, res, next) => auth(req, res, () => auth.allowRoles('admin')(req, res, next));

module.exports = auth;