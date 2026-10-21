const mongoose = require('mongoose');
const Order = require('./Order');
const Product = require('./Product');

const DeliveryOrderSchema = new mongoose.Schema({
  origem: {
    tipo: {
      type: String,
      enum: ['cliente', 'mesa'],
      default: 'cliente',
    },
    nomeCliente: {
      type: String,
    },
    telefone: {
      type: String,
    },
    endereco: {
      rua: { type: String },
      numero: { type: String },
      bairro: { type: String },
      complemento: { type: String },
      referencia: { type: String },
    },
    mesaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comanda',
    },
  },
  itens: [
    {
      produtoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      nome: { type: String, required: true },
      quantidade: { type: Number, required: true, min: 0.001 },
      precoUnitario: { type: Number, required: true, min: 0 },
    },
  ],
  valorTotal: {
    type: Number,
    required: true,
    min: 0,
  },
  taxaEntrega: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: ['pendente', 'pronto', 'despachado', 'a_caminho', 'entregue', 'cancelado'],
    default: 'pendente',
  },
  statusHistorico: [
    {
      status: {
        type: String,
        enum: ['pendente', 'pronto', 'despachado', 'a_caminho', 'entregue', 'cancelado'],
      },
      data: { type: Date, default: Date.now },
    },
  ],
  entregadorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entregador',
  },
  mesaOrigem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comanda',
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

module.exports = mongoose.model('DeliveryOrder', DeliveryOrderSchema);