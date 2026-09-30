const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { emitirNfce, NfceProviderError } = require('../utils/nfce');

router.post('/orders/:id/emitir-nfce', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ msg: 'Pedido não encontrado' });
  
  // Check if NFC is already emitted
  if (order.nfce?.status === 'emitida') {
    return res.json({ 
      order, 
      nfce: order.nfce, 
      avisos: [] 
    });
  }

  try {
    // Get customer info from request body
    const { cpfCliente = '', nomeCliente = '' } = req.body;
    
    // Validate customer info (basic validation)
    if (!cpfCliente && !nomeCliente) {
      return res.status(400).json({ 
        msg: 'Informe o CPF ou nome do cliente para emitir NFC-e',
        code: 'MISSING_CUSTOMER_INFO'
      });
    }

    // Get products and emit NFC
    const productIds = [...new Set(order.itens.map((item) => String(item.produtoId)))];
    const products = await Product.find({ _id: { $in: productIds } }).select('ncm').lean();
    const resultado = await emitirNfce({ order, products });

    // Update order with NFC data
    order.nfce = {
      ...(order.nfce?.toObject?.() || order.nfce || {}),
      status: 'emitida',
      numero: resultado.numero,
      serie: resultado.serie,
      chaveAcesso: resultado.chaveAcesso,
      protocolo: resultado.protocolo,
      xml: resultado.xml,
      danfePdf: resultado.danfePdf,
      mensagemSeErro: resultado.avisos?.length ? `Avisos: ${resultado.avisos.join('; ')}` : undefined,
      dataEmissao: new Date(),
      // Customer info
      cpfCliente,
      nomeCliente
    };
    
    await order.save();
    
    return res.json({ 
      order, 
      nfce: order.nfce, 
      avisos: resultado.avisos || [] 
    });
  } catch (error) {
    const nfceError = error instanceof NfceProviderError
      ? error
      : new NfceProviderError('Não foi possível emitir a NFC-e', 'UNKNOWN_ERROR', { cause: error.message });
    
    order.nfce = {
      ...(order.nfce?.toObject?.() || order.nfce || {}),
      status: nfceError.code === 'CONFIG_MISSING' ? 'nao_emitida' : 'erro',
      mensagemSeErro: nfceError.message,
      dataEmissao: undefined,
      cpfCliente,
      nomeCliente
    };
    
    await order.save();
    
    const status = nfceError.code === 'NETWORK_ERROR' ? 503 : 
                  nfceError.code === 'CONFIG_MISSING' ? 409 : 422;
                  
    return res.status(status).json({ 
      msg: nfceError.message, 
      code: nfceError.code, 
      faltantes: nfceError.details?.missing || [], 
      nfce: order.nfce 
    });
  }
});

module.exports = router;