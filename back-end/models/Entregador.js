const mongoose = require('mongoose');

const EntregadorSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
  },
  telefone: {
    type: String,
    required: true,
  },
  senha: {
    type: String,
    required: true,
  },
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true,
    sparse: true,
  },
  ativo: {
    type: Boolean,
    default: true,
  },
  status: {
    type: String,
    enum: ['disponivel', 'em_entrega', 'offline'],
    default: 'disponivel',
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
  },
  criadoEm: {
    type: Date,
    default: Date.now,
  },
  atualizadoEm: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Entregador', EntregadorSchema);