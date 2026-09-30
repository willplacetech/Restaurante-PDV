const nfceSchema = new mongoose.Schema({
  status: { type: String, enum: ['nao_emitida', 'emitida', 'cancelada', 'erro'], default: 'nao_emitida' },
  numero: String,
  serie: String,
  chaveAcesso: String,
  protocolo: String,
  xml: String,
  danfePdf: String,
  mensagemSeErro: String,
  dataEmissao: Date,
  cpfCliente: String,
  nomeCliente: String,
  erro: String  // if status = erro
}, { _id: false });