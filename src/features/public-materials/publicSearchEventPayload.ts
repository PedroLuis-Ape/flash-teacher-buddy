/**
 * Payload do evento `public_search_used`.
 *
 * `has_filters` precisa dizer se o visitante usou filtro de verdade (nivel,
 * tema ou tipo) — busca por texto nao e filtro. O termo digitado nunca entra.
 */
export interface PublicSearchEventInput {
  resultCount: number;
  level?: string;
  theme?: string;
  type?: string;
}

export function buildPublicSearchEventPayload({
  resultCount,
  level,
  theme,
  type,
}: PublicSearchEventInput) {
  return {
    result_count: Number.isFinite(resultCount) ? resultCount : 0,
    has_filters: Boolean(level || theme || type),
  };
}

