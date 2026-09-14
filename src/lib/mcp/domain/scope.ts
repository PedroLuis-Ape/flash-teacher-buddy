import type { UserScopedDb } from "./client";
import { McpDomainError, toMcpDomainError } from "./errors";
import { asRow, str } from "./query";

/**
 * Scope model of the agent-operable library.
 *
 * personal    -> the user's own library (institution_id IS NULL, class_id IS NULL)
 * institution -> a library hub owned by the account (institution_id = X)
 *
 * The Piteco data model keeps institutions owner-scoped today (RLS:
 * auth.uid() = institutions.owner_id). `assertScopeAccessible` is the single
 * place to evolve when the product gains institution membership/roles.
 */
export type LibraryScope =
  | { readonly kind: "personal" }
  | { readonly kind: "institution"; readonly institutionId: string };

export const PERSONAL_SCOPE: LibraryScope = Object.freeze({ kind: "personal" }) as LibraryScope;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

export function requireUuid(value: unknown, field: string): string {
  if (!isUuid(value)) {
    throw new McpDomainError("invalid_input", `O campo "${field}" precisa ser um UUID válido.`, {
      hint: `Use as tools de listagem/busca para descobrir o UUID correto de "${field}".`,
    });
  }
  return String(value).trim().toLowerCase();
}

export function scopeName(scope: LibraryScope): "personal" | "institution" {
  return scope.kind === "personal" ? "personal" : "institution";
}

export interface ScopeSummary {
  kind: "personal" | "institution";
  institution_id?: string;
  name?: string;
  /** Ownership role inside the scope. Institutions are owner-only today. */
  role: "owner" | "member";
}

/** Discovers where the authenticated account can operate. */
export async function listAccessibleScopes(db: UserScopedDb): Promise<ScopeSummary[]> {
  const { data, error } = await db.client
    .from("institutions")
    .select("id,name,owner_id")
    .eq("owner_id", db.userId)
    .order("name", { ascending: true });
  if (error) throw toMcpDomainError(error, "Não foi possível listar as instituições desta conta.");

  const scopes: ScopeSummary[] = [{ kind: "personal", role: "owner" }];
  for (const row of Array.isArray(data) ? data : []) {
    const record = asRow(row);
    const id = str(record, "id");
    if (!id) continue;
    const name = str(record, "name");
    scopes.push({
      kind: "institution",
      institution_id: id,
      ...(name ? { name } : {}),
      role: "owner",
    });
  }
  return scopes;
}

/**
 * Proves the account can operate inside the requested scope before any read or
 * write happens. Personal scope needs no lookup: it is defined by the account.
 */
export async function assertScopeAccessible(db: UserScopedDb, scope: LibraryScope): Promise<void> {
  if (scope.kind === "personal") return;

  const institutionId = requireUuid(scope.institutionId, "institution_id");
  const { data, error } = await db.client
    .from("institutions")
    .select("id")
    .eq("id", institutionId)
    .eq("owner_id", db.userId)
    .maybeSingle();
  if (error) throw toMcpDomainError(error, "Não foi possível validar o escopo institucional.");
  if (!data) {
    throw new McpDomainError("not_found", "Instituição não encontrada para esta conta.", {
      hint: "Liste os escopos disponíveis antes de repetir a operação.",
    });
  }
}
