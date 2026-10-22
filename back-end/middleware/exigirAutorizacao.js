let cacheExigirAutorizacao = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000;

async function invalidarCacheConfiguracaoGerente() {
  cacheExigirAutorizacao = null;
  cacheTimestamp = 0;
}

async function getConfiguracaoGerente() {
  const now = Date.now();
  if (cacheExigirAutorizacao !== null && now - cacheTimestamp < CACHE_TTL) {
    return cacheExigirAutorizacao;
  }

  const Configuracoes = require('../models/Configuracoes');
  const configuracao = await Configuracoes.findOne({ _id: 'principal' });
  cacheExigirAutorizacao = configuracao?.exigirAutorizacaoGerente !== false;
  cacheTimestamp = now;
  return cacheExigirAutorizacao;
}

module.exports = {
  invalidarCacheConfiguracaoGerente,
  getConfiguracaoGerente,
};