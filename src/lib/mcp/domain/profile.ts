import type { UserScopedDb } from "./client";
import { toMcpDomainError } from "./errors";
import { asRow, bool, num, str } from "./query";
import { listAccessibleScopes, type ScopeSummary } from "./scope";

/** Least-privilege profile projection: no billing, no admin, no auth secrets. */
export const PROFILE_SELECT = "id,first_name,avatar_url,is_teacher,level,public_slug";

export interface CompactProfile {
  first_name?: string;
  avatar_url?: string;
  is_teacher?: boolean;
  level?: number;
  public_slug?: string;
}

export interface MyProfileResult {
  user_id: string;
  profile: CompactProfile | null;
  scopes: ScopeSummary[];
}

/**
 * Who am I, and where can I operate.
 *
 * `scopes` answers the agent's "where am I?" before any listing: personal
 * library plus every institution hub the authenticated account owns.
 */
export async function getMyProfile(db: UserScopedDb): Promise<MyProfileResult> {
  const { data, error } = await db.client
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", db.userId)
    .maybeSingle();
  if (error) throw toMcpDomainError(error, "Não foi possível ler o perfil da conta.");

  const record = asRow(data);
  const profile: CompactProfile | null = record
    ? {
        first_name: str(record, "first_name"),
        avatar_url: str(record, "avatar_url"),
        is_teacher: bool(record, "is_teacher"),
        level: num(record, "level"),
        public_slug: str(record, "public_slug"),
      }
    : null;

  return {
    user_id: db.userId,
    profile,
    scopes: await listAccessibleScopes(db),
  };
}
