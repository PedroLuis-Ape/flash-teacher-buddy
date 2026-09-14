import { McpDomainError } from "./errors";
import { isUuid } from "./scope";

/** Crockford-like alphabet without 0/O/1/I/L, chosen for spoken ids. */
export const REFERENCE_ID_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const FOLDER_REFERENCE_ID_PATTERN = new RegExp(`^F-[${REFERENCE_ID_ALPHABET}]{6}$`, "i");
export const LIST_REFERENCE_ID_PATTERN = new RegExp(`^L-[${REFERENCE_ID_ALPHABET}]{6}$`, "i");

export type ReferenceKind = "folder" | "list";
export type ReferenceSelector =
  | { kind: "uuid"; id: string }
  | { kind: ReferenceKind; referenceId: string };

export function referenceIdKind(value: unknown): ReferenceKind | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (FOLDER_REFERENCE_ID_PATTERN.test(normalized)) return "folder";
  if (LIST_REFERENCE_ID_PATTERN.test(normalized)) return "list";
  return null;
}

export function isReferenceIdentifier(value: unknown, expectedKind?: ReferenceKind): boolean {
  if (isUuid(value)) return true;
  const kind = referenceIdKind(value);
  return kind !== null && (expectedKind === undefined || kind === expectedKind);
}

export function referenceSelector(value: unknown): ReferenceSelector {
  if (isUuid(value)) return { kind: "uuid", id: value.trim().toLowerCase() };
  const referenceId = typeof value === "string" ? value.trim().toUpperCase() : "";
  const kind = referenceIdKind(referenceId);
  if (kind) return { kind, referenceId };
  throw new McpDomainError("invalid_input", 'O identificador precisa ser um UUID ou uma referência F-/L- válida.', {
    hint: "Use o UUID canônico ou a referência devolvida por list_folders/list_lists.",
  });
}

export function requireReferenceIdentifier(value: unknown, expectedKind: ReferenceKind, field: string): string {
  const selector = referenceSelector(value);
  if (selector.kind === "uuid") return selector.id;
  if (selector.kind !== expectedKind) {
    throw new McpDomainError("invalid_input", `O campo "${field}" precisa ser um identificador de ${expectedKind}.`, {
      hint: `Use um UUID ou uma referência ${expectedKind === "folder" ? "F-XXXXXX" : "L-XXXXXX"}.`,
    });
  }
  return selector.referenceId;
}

export function requireReferenceList(
  raw: unknown,
  field: string,
  expectedKind: ReferenceKind,
  maxItems: number,
): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new McpDomainError("invalid_input", `O campo "${field}" precisa ser uma lista não vazia de identificadores.`);
  }
  if (raw.length > maxItems) {
    throw new McpDomainError("invalid_input", `O campo "${field}" aceita no máximo ${maxItems} itens por chamada.`);
  }
  return raw.map((value, index) => requireReferenceIdentifier(value, expectedKind, `${field}[${index}]`));
}
