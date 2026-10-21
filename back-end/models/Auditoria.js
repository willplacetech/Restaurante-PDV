const mongoose = require('mongoose');

const AuditoriaSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  role: { type: String, required: true },
  acao: { type: String, required: true },
  descricao: { type: String, default: '' },
  ip: { type: String },
  userAgent: { type: String },
  detalhes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

AuditoriaSchema.index({ usuarioId: 1, createdAt: -1 });
AuditoriaSchema.index({ acao: 1, createdAt: -1 });

module.exports = mongoose.model('Auditoria', AuditoriaSchema);