export function totalPagesFor(resultCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(resultCount / pageSize));
}

export function clampPage(page: number, totalPages: number): number {
  return Math.max(1, Math.min(page, totalPages));
}

export function pageItems<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const totalPages = totalPagesFor(items.length, pageSize);
  const currentPage = clampPage(page, totalPages);
  return items.slice((currentPage - 1) * pageSize, currentPage * pageSize);
}
