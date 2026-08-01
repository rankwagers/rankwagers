export function adminKey(): string {
  return process.env.ADMIN_KEY || "admin";
}

export function isAuthorized(cookieHeader: string | null, searchKey: string | null): boolean {
  const expected = adminKey();
  if (searchKey && searchKey === expected) return true;
  if (!cookieHeader) return false;
  const match = cookieHeader.match(/(?:^|;\s*)admin_key=([^;]*)/);
  if (!match) return false;
  try {
    return decodeURIComponent(match[1]) === expected;
  } catch {
    return false;
  }
}
