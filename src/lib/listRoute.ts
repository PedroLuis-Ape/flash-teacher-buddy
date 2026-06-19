export function listIdFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const index = parts.indexOf("list");
  return index < 0 ? null : parts[index + 1] || null;
}

export function isPublicListPath(pathname: string): boolean {
  return pathname.startsWith("/portal/list/");
}
