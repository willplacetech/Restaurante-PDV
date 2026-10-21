const mongoose = require('mongoose');

const mesasPadrao = () => ({
  mesas: [1, 2, 3, 4].map((numero) => ({ id: numero, numero, nome: `Mesa ${numero}`, lugares: 4, ativa: true })),
  oferecerBalcao: true,
});

const mesasSettingsSchema = new mongoose.Schema({
  _id: { type: String, default: 'principal' },
  mesas: [{
    id: { type: Number, required: true },
    numero: { type: Number, required: true },
    nome: { type: String, required: true },
    lugares: { type: Number, required: true },
    ativa: { type: Boolean, default: true },
  }],
  oferecerBalcao: { type: Boolean, default: true },
}, { timestamps: true });

mesasSettingsSchema.statics.mesasPadrao = mesasPadrao;

module.exports = mongoose.model('MesasSettings', mesasSettingsSchema);