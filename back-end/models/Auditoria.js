const mongoose = require('mongoose');
const { auditActions } = require('../services/auditLog');

const AuditoriaSchema = new mongoose.Schema({
  data: { type: Date, required: true, default: Date.now, immutable: true },
  usuarioSolicitante: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
  usuarioAutorizou: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
  acao: { type: String, required: true, enum: auditActions, immutable: true },
  detalhes: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
  ip: { type: String, maxlength: 64, default: '', immutable: true },
  sucesso: { type: Boolean, required: true, immutable: true },
}, { versionKey: false });

AuditoriaSchema.index({ data: -1 });
AuditoriaSchema.index({ usuarioSolicitante: 1, data: -1 });
AuditoriaSchema.index({ acao: 1, data: -1 });

module.exports = mongoose.model('Auditoria', AuditoriaSchema);