const mongoose = require('mongoose');

const configuracoesSchema = new mongoose.Schema({
  _id: { type: String, default: 'principal' },
  exigirAutorizacaoGerente: { type: Boolean, default: true },
  dataAtualizacao: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Configuracoes', configuracoesSchema);