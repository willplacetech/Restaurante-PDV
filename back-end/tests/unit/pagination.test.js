const { parsePagination, paginationMetadata } = require('../../utils/pagination');

describe('parsePagination', () => {
  test('uses stable defaults', () => {
    expect(parsePagination()).toMatchObject({
      page: 1,
      pageSize: 20,
      limit: 20,
      skip: 0,
    });
  });

  test('accepts page, limit, sort and order', () => {
    expect(parsePagination(
      { page: '3', limit: '10', sort: 'nome', order: 'DESC' },
      { sortFields: ['nome'] },
    )).toMatchObject({
      page: 3,
      pageSize: 10,
      limit: 10,
      skip: 20,
      sort: 'nome',
      order: 'desc',
    });
  });

  test.each([
    [{ page: '0' }, 'page'],
    [{ page: '1.5' }, 'page'],
    [{ pageSize: '101' }, 'máximo'],
    [{ pageSize: 'abc' }, 'pageSize'],
    [{ sort: 'injected' }, 'Ordenação'],
    [{ order: 'sideways' }, 'Direção'],
  ])('rejects invalid query %j', (query, message) => {
    expect(() => parsePagination(query, { sortFields: ['nome'] })).toThrow(message);
  });
});

describe('paginationMetadata', () => {
  test('reports totals and navigation for populated and empty results', () => {
    expect(paginationMetadata(21, 2, 20)).toEqual({
      page: 2,
      pageSize: 20,
      total: 21,
      totalPages: 2,
      hasPreviousPage: true,
      hasNextPage: false,
    });
    expect(paginationMetadata(0, 1, 20)).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    });
  });
});
