export function archiveIndexPath(locale: string): string {
  return `/${locale}/archive`;
}

export function archiveDayPath(locale: string, date: string): string {
  return `/${locale}/archive/${date}`;
}

export function methodologyPath(locale: string): string {
  return `/${locale}/methodology`;
}

export function archiveQueryPath(
  locale: string,
  params: Record<string, string | undefined>
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value || value === "all") continue;
    qs.set(key, value);
  }
  const s = qs.toString();
  return s ? `${archiveIndexPath(locale)}?${s}` : archiveIndexPath(locale);
}
