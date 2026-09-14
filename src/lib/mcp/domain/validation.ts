import { McpDomainError } from "./errors";

function fail(message: string, hint?: string): never {
  throw new McpDomainError("invalid_input", message, hint ? { hint } : {});
}

function clean(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
}

export function requireText(raw: unknown, field: string, maxLength: number): string {
  const value = clean(raw);
  if (!value) fail(`O campo "${field}" é obrigatório e não pode ficar vazio.`);
  if (value.length > maxLength) fail(`O campo "${field}" excede ${maxLength} caracteres.`);
  return value;
}

/**
 * Returns undefined when the field was not informed, null when it was cleared
 * explicitly, and the trimmed value otherwise. That distinction is what makes
 * a partial update predictable.
 */
export function optionalText(raw: unknown, field: string, maxLength: number): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  if (value.length > maxLength) fail(`O campo "${field}" excede ${maxLength} caracteres.`);
  return value;
}

export function requireEnum<T extends string>(raw: unknown, field: string, allowed: readonly T[]): T {
  if (typeof raw === "string" && (allowed as readonly string[]).includes(raw)) return raw as T;
  fail(`O campo "${field}" aceita apenas: ${allowed.join(", ")}.`);
}

export function optionalEnum<T extends string>(
  raw: unknown,
  field: string,
  allowed: readonly T[],
): T | undefined {
  if (raw === undefined || raw === null) return undefined;
  return requireEnum(raw, field, allowed);
}

export function optionalBoolean(raw: unknown, field: string): boolean | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "boolean") fail(`O campo "${field}" precisa ser true ou false.`);
  return raw;
}

const LANGUAGE_TAG = /^[a-z]{2}(-[A-Za-z]{2,4})?$/;

const LANGUAGE_HINTS: Record<string, string> = {
  english: "en",
  ingles: "en",
  "inglês": "en",
  portuguese: "pt",
  portugues: "pt",
  "português": "pt",
  spanish: "es",
  espanhol: "es",
  french: "fr",
  frances: "fr",
  "francês": "fr",
  german: "de",
  alemao: "de",
  "alemão": "de",
  italian: "it",
  italiano: "it",
};

/** Accepts BCP-47-ish tags (en, pt-BR) and maps a few human names to them. */
export function optionalLanguageTag(
  raw: unknown,
  field: string,
  emptyValue: string | null | undefined,
): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const value = clean(raw);
  if (!value) return emptyValue === undefined ? null : emptyValue;
  const hint = LANGUAGE_HINTS[value.toLowerCase()];
  if (hint) return hint;
  if (LANGUAGE_TAG.test(value)) {
    const [base, region] = value.split("-");
    return region ? `${base.toLowerCase()}-${region.toUpperCase()}` : base.toLowerCase();
  }
  fail(`O campo "${field}" precisa ser um código de idioma como "en", "pt" ou "pt-BR".`);
}

export function requireUuidList(raw: unknown, field: string, maxItems: number): string[] {
  if (!Array.isArray(raw) || raw.length === 0) fail(`O campo "${field}" precisa ser uma lista não vazia de UUIDs.`);
  if (raw.length > maxItems) fail(`O campo "${field}" aceita no máximo ${maxItems} itens por chamada.`);
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string" || !UUID.test(item.trim())) {
      fail(`O campo "${field}" contém um valor que não é UUID.`);
    }
    seen.add(item.trim().toLowerCase());
  }
  return Array.from(seen);
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
