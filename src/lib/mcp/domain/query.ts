import { McpDomainError } from "./errors";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
export const DEFAULT_CARD_LIMIT = 25;
export const MAX_CARD_LIMIT = 100;
export const MAX_SEARCH_LIMIT = 25;
export const MAX_SEARCH_TERM_LENGTH = 80;

export interface Page {
  limit: number;
  offset: number;
}

export interface PageOptions {
  defaultLimit: number;
  maxLimit: number;
}

/**
 * Bounds pagination so a tool call can never stream an unbounded library into
 * the agent context. Requests above the maximum are capped, not rejected.
 */
export function resolvePage(
  input: { limit?: unknown; offset?: unknown },
  options: PageOptions = { defaultLimit: DEFAULT_PAGE_SIZE, maxLimit: MAX_PAGE_SIZE },
): Page {
  const rawLimit = input.limit;
  const limitValue = rawLimit === undefined || rawLimit === null ? options.defaultLimit : Number(rawLimit);
  if (!Number.isFinite(limitValue) || limitValue < 1) {
    throw new McpDomainError(
      "invalid_input",
      `"limit" precisa ser um número inteiro entre 1 e ${options.maxLimit}.`,
    );
  }

  const rawOffset = input.offset;
  const offsetValue = rawOffset === undefined || rawOffset === null ? 0 : Number(rawOffset);
  if (!Number.isFinite(offsetValue) || offsetValue < 0) {
    throw new McpDomainError("invalid_input", '"offset" precisa ser um número inteiro maior ou igual a 0.');
  }

  return {
    limit: Math.min(Math.trunc(limitValue), options.maxLimit),
    offset: Math.trunc(offsetValue),
  };
}

/** Characters that would break PostgREST filter syntax if echoed back raw. */
const RESERVED_FILTER_CHARACTERS = /[,()*%_\\"']/g;

/**
 * Sanitizes a free-text search term before it reaches PostgREST.
 * Returns a plain literal (no wildcards, no filter separators).
 */
export function sanitizeSearchTerm(raw: unknown, maxLength = MAX_SEARCH_TERM_LENGTH): string {
  const value = typeof raw === "string" ? raw : "";
  const cleaned = value
    .normalize("NFKC")
    .replace(RESERVED_FILTER_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    throw new McpDomainError(
      "invalid_input",
      "O termo de busca não contém caracteres pesquisáveis.",
      { hint: "Envie texto simples, sem apenas pontuação ou curingas." },
    );
  }
  return cleaned.slice(0, maxLength);
}

export function asRows(data: unknown): unknown[] {
  return Array.isArray(data) ? data : [];
}

export function asRow(data: unknown): Record<string, unknown> | null {
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
}

export function str(row: Record<string, unknown> | null | undefined, key: string): string | undefined {
  const value = row?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function truncatedStr(
  row: Record<string, unknown> | null | undefined,
  key: string,
  maxLength: number,
): string | undefined {
  const value = str(row, key);
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}

export function num(row: Record<string, unknown> | null | undefined, key: string): number | undefined {
  const value = row?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function bool(row: Record<string, unknown> | null | undefined, key: string): boolean | undefined {
  const value = row?.[key];
  return typeof value === "boolean" ? value : undefined;
}
