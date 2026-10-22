const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Usuário é obrigatório'],
    unique: true,
    trim: true,
    minlength: [2, 'Usuário deve ter pelo menos 2 caracteres'],
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'E-mail inválido'],
  },
  password: {
    type: String,
    required: [true, 'Senha é obrigatória'],
    minlength: [4, 'Senha deve ter pelo menos 4 caracteres'],
    select: false,
  },
  role: {
    type: String,
    enum: ['atendente', 'gerente', 'admin', 'garcom', 'cozinha', 'entregador', 'operador'],
    default: 'atendente',
  },
  active: {
    type: Boolean,
    default: true,
  },
  archivedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);