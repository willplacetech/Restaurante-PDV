const mongoose = require('mongoose');

const auditActions = [
  'auth.login',
  'auth.logout',
  'caixa.sangria',
  'caixa.suprimento',
  'caixa.fechamento',
  'pedido.excluido',
  'produto.preco_custo_alterado',
  'usuario.status_alterado',
  'usuario.alterado',
  'usuario.arquivado',
  'pagamento.desconto_acima_limite',
  'autorizacao.desconto',
  'autorizacao.cancelamento',
  'pagamento.estornado',
  'entregador.pedido_atribuido',
  'entregador.pedido_entregue',
  'entregador.status_alterado',
];

const sensitiveKey = /password|token|authorization|secret|cookie|credential/i;

const safeDetails = (value) => {
  if (Array.isArray(value)) return value.map(safeDetails);
  if (value && typeof value === 'object') {
    if (value instanceof Date) return value.toISOString();
    if (value instanceof mongoose.Types.ObjectId) return value.toString();
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !sensitiveKey.test(key))
      .map(([key, item]) => [key, safeDetails(item)]));
  }
  if (typeof value === 'string') return value.slice(0, 2000);
  return value;
};

function buildAuditRecord({ req, requester = req?.user, authorizedBy, action, details = {}, success = true }) {
  if (!auditActions.includes(action)) throw new Error('Ação de auditoria inválida');
  return {
    data: new Date(),
    usuarioSolicitante: requester?._id || requester?.id || null,
    usuarioAutorizou: authorizedBy?._id || authorizedBy?.id || null,
    acao: action,
    detalhes: safeDetails(details),
    ip: typeof req?.ip === 'string' ? req.ip.slice(0, 64) : '',
    sucesso: Boolean(success),
  };
}

async function recordAuditEvent({ AuditLogModel, ...event }) {
  const Model = AuditLogModel || require('../models/Auditoria');
  return Model.create(buildAuditRecord(event));
}

function parseAuditFilters(query = {}) {
  const filter = {};
  if (query.usuarioSolicitante) {
    if (!mongoose.isValidObjectId(query.usuarioSolicitante)) {
      throw Object.assign(new Error('Usuário inválido'), { statusCode: 400 });
    }
    filter.usuarioSolicitante = query.usuarioSolicitante;
  }
  if (query.acao) {
    if (!auditActions.includes(query.acao)) {
      throw Object.assign(new Error('Ação de auditoria inválida'), { statusCode: 400 });
    }
    filter.acao = query.acao;
  }
  if (query.de !== undefined || query.ate !== undefined) {
    const isValidDateKey = (dateStr) => /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    if (!isValidDateKey(query.de) || !isValidDateKey(query.ate) || query.de > query.ate) {
      throw Object.assign(new Error('Informe um período válido (formato YYYY-MM-DD)'), { statusCode: 400 });
    }
    const start = new Date(query.de + 'T00:00:00-03:00');
    const endExclusive = new Date(query.ate + 'T23:59:59-03:00');
    endExclusive.setDate(endExclusive.getDate() + 1);
    const maximumEnd = new Date(start);
    maximumEnd.setFullYear(maximumEnd.getFullYear() + 1);
    if (endExclusive > maximumEnd) {
      throw Object.assign(new Error('O período máximo permitido é de um ano'), { statusCode: 400 });
    }
    filter.data = { $gte: start, $lt: endExclusive };
  }
  const page = Math.max(1, parseInt(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || 20));
  const skip = (page - 1) * pageSize;
  return { filter, pagination: { page, pageSize, skip } };
}

module.exports = {
  auditActions,
  buildAuditRecord,
  recordAuditEvent,
  parseAuditFilters,
};