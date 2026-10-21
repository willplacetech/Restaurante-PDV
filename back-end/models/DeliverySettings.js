const mongoose = require('mongoose');

const DeliverySettingsSchema = new mongoose.Schema({
  tempoEstimadoPadraoMin: {
    type: Number,
    default: 30,
  },
  taxaEntregaPadrao: {
    type: Number,
    default: 0,
  },
  mensagemWhatsApp: {
    type: String,
    default: 'Seu pedido está pronto para retirada.',
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

module.exports = mongoose.model('DeliverySettings', DeliverySettingsSchema);