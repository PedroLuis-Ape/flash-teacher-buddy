export function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function searchTokens(query: string): string[] {
  return normalizeSearchText(query).split(" ").filter(Boolean);
}

export function matchesSearchQuery(values: unknown[], query: string): boolean {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return true;
  const haystack = normalizeSearchText(values.filter(Boolean).join("\n"));
  return tokens.every((token) => haystack.includes(token));
}
