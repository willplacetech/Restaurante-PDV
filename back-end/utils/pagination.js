const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const invalidPagination = (message) => Object.assign(new Error(message), { statusCode: 400 });

function parsePositiveInteger(value, name, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (!/^\d+$/.test(String(value))) throw invalidPagination(`Parâmetro ${name} inválido`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw invalidPagination(`Parâmetro ${name} inválido`);
  return parsed;
}

function parsePagination(query = {}, options = {}) {
  const page = parsePositiveInteger(query.page, 'page', DEFAULT_PAGE);
  const requestedSize = query.pageSize ?? query.limit;
  const pageSize = parsePositiveInteger(requestedSize, 'pageSize', DEFAULT_PAGE_SIZE);
  if (pageSize > MAX_PAGE_SIZE) {
    throw invalidPagination(`O tamanho da página máximo é ${MAX_PAGE_SIZE}`);
  }

  const allowedSortFields = options.sortFields || [];
  const sort = query.sort || options.defaultSort || null;
  if (sort && !allowedSortFields.includes(sort)) {
    throw invalidPagination('Ordenação inválida');
  }

  const order = String(query.order || options.defaultOrder || 'asc').toLowerCase();
  if (!['asc', 'desc'].includes(order)) throw invalidPagination('Direção da ordenação inválida');

  return {
    page,
    pageSize,
    limit: pageSize,
    skip: (page - 1) * pageSize,
    sort,
    order,
  };
}

function paginationMetadata(total, page, pageSize) {
  const totalPages = Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPreviousPage: page > 1 && total > 0,
    hasNextPage: page < totalPages,
  };
}

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePagination,
  paginationMetadata,
};
