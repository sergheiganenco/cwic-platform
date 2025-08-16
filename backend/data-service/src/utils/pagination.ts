export type PageQuery = { page?: any; pageSize?: any; sort?: any; dir?: any };

export function pageParams(q: PageQuery, allowedSort: string[] = ['created_at']) {
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));
  const sort = allowedSort.includes(String(q.sort || '')) ? String(q.sort) : allowedSort[0];
  const dir = (String(q.dir).toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc'|'desc';
  const offset = (page - 1) * pageSize;
  return { page, pageSize, sort, dir, offset };
}
