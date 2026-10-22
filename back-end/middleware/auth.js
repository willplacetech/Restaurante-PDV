const jwt = require('jsonwebtoken');
const User = require('../models/User');
const jwtSecret = process.env.JWT_SECRET || 'desenvolvimento-altere-esta-chave';

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;

  if (!token) return res.status(401).json({ msg: 'Acesso não autorizado' });

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findById(decoded.id || decoded._id || decoded.usuarioId).select('+password');
    if (!user) return res.status(401).json({ msg: 'Usuário não encontrado' });
    if (user.active === false) return res.status(403).json({ msg: 'Usuário inativo' });
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

auth.adminOnly = auth.allowRoles('admin');

module.exports = auth;