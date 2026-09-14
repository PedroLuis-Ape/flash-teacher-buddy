import type { ConfirmationKey } from "./client";
import { McpDomainError } from "./errors";

/**
 * Stateless two-step confirmation for material destructive operations.
 *
 * No storage and no migration: the token is an HMAC-SHA256 of the normalized
 * claim (action + authenticated user + object/scope + exact target ids +
 * previewed row count + current state fingerprint + expiry),
 * keyed with the verified bearer of the current request. Consequences:
 * - the model cannot mint a token without the caller's bearer;
 * - a token from account A is useless for account B;
 * - if the object or requested target set changes since the preview, the
 *   recomputed claim stops matching (the agent must preview again);
 * - a bearer refresh between preview and confirm invalidates the token, which
 *   fails safely by asking for a new preview.
 */
export const CONFIRMATION_TTL_SECONDS = 600;

export type ConfirmationAction = "delete_list" | "delete_folder" | "remove_cards";

export interface ConfirmationClaim {
  action: ConfirmationAction;
  userId: string;
  objectId: string;
  /** Logical scope of the target, e.g. the list owning removable cards. */
  scope?: string;
  /** Stable, exact target identifiers; sorted before signing. */
  targetIds?: readonly string[];
  /** Rows the preview showed; recomputed server-side before verification. */
  expectedCount: number;
  /** Digest of current affected rows, computed server-side and never model-supplied. */
  stateFingerprint?: string;
}

export interface ConfirmationStateRow {
  kind: string;
  id: string;
  updatedAt?: unknown;
  deletedAt?: unknown;
}

export interface ConfirmationToken {
  token: string;
  expires_at: string;
  ttl_seconds: number;
}

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function canonical(claim: ConfirmationClaim, expiresAtSeconds: number): string {
  const targetIds = [...(claim.targetIds ?? [])].map((id) => id.toLowerCase()).sort().join(",");
  return [
    claim.action,
    claim.userId,
    claim.objectId,
    claim.scope ?? "",
    targetIds,
    String(claim.expectedCount),
    claim.stateFingerprint ?? "",
    String(expiresAtSeconds),
  ].join("|");
}

/** Produces a stable, non-reversible snapshot identifier for confirmation claims. */
export async function confirmationStateFingerprint(rows: readonly ConfirmationStateRow[]): Promise<string> {
  const normalized = rows
    .map((row) => ({
      kind: row.kind,
      id: row.id,
      updatedAt: row.updatedAt ?? null,
      deletedAt: row.deletedAt ?? null,
    }))
    .sort((left, right) =>
      `${left.kind}|${left.id}|${String(left.updatedAt)}|${String(left.deletedAt)}`
        .localeCompare(`${right.kind}|${right.id}|${String(right.updatedAt)}|${String(right.deletedAt)}`),
    );
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify(normalized)));
  return base64Url(new Uint8Array(digest));
}

async function sign(key: ConfirmationKey, message: string): Promise<string> {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return base64Url(new Uint8Array(signature)).slice(0, 22);
}

function constantTimeEquals(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export async function createConfirmationToken(
  key: ConfirmationKey,
  claim: ConfirmationClaim,
  nowMs: number = Date.now(),
): Promise<ConfirmationToken> {
  const expiresAtSeconds = Math.floor(nowMs / 1000) + CONFIRMATION_TTL_SECONDS;
  const signature = await sign(key, canonical(claim, expiresAtSeconds));
  return {
    token: `${signature}.${expiresAtSeconds}`,
    expires_at: new Date(expiresAtSeconds * 1000).toISOString(),
    ttl_seconds: CONFIRMATION_TTL_SECONDS,
  };
}

function reject(hint: string): never {
  throw new McpDomainError("confirmation_required", "Confirmação inválida para esta operação.", { hint });
}

/** Throws a controlled confirmation_required error when the token is not valid. */
export async function verifyConfirmationToken(
  key: ConfirmationKey,
  token: unknown,
  claim: ConfirmationClaim,
  nowMs: number = Date.now(),
): Promise<void> {
  if (typeof token !== "string" || token.length < 10 || !token.includes(".")) {
    reject("Faça o preview da operação (dry_run) e envie o confirmation_token devolvido por ele.");
  }
  const separator = (token as string).indexOf(".");
  const signature = (token as string).slice(0, separator);
  const expiresAtSeconds = Number((token as string).slice(separator + 1));
  if (!Number.isInteger(expiresAtSeconds)) {
    reject("Token malformado: faça um novo preview da operação.");
  }
  if (expiresAtSeconds <= Math.floor(nowMs / 1000)) {
    reject("O confirmation_token expirou; faça um novo preview da operação.");
  }
  const expected = await sign(key, canonical(claim, expiresAtSeconds));
  if (!constantTimeEquals(signature, expected)) {
    reject(
      "Confirmation_token não corresponde a esta operação/estado; faça um novo preview e confirme o que ele mostrar.",
    );
  }
}
