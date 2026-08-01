/**
 * resolveStudyAccess — pure decision module for Study route gating.
 *
 * Clara Master P0 hotfix: prevents Study from treating "auth still
 * resolving" as "anonymous user", which was the trigger that wiped
 * `favoritesOnly` from persistent preferences on cold restart.
 *
 * No React, no Supabase, no window — fully testable in isolation.
 */

export type StudyAuthStatus =
  | "initializing"
  | "stale"
  | "authenticated"
  | "anonymous"
  | "error";

export type StudyAccess = "wait" | "authenticated" | "public" | "denied";

export interface StudyAccessInput {
  authStatus: StudyAuthStatus;
  isPortalRoute: boolean;
  userId: string | undefined | null;
}

/**
 * Decision table:
 *
 *   authStatus      | isPortalRoute | userId | result
 *   ----------------|---------------|--------|-----------------
 *   *               | true          | *      | public
 *   initializing/stale | false      | *      | wait
 *   error           | true          | *      | public
 *   error           | false         | *      | denied
 *   anonymous       | true          | *      | public
 *   anonymous       | false         | *      | denied
 *   authenticated   | *             | set    | authenticated
 *   authenticated   | *             | null   | wait  (race: status flipped before userId)
 */
export function resolveStudyAccess(input: StudyAccessInput): StudyAccess {
  const { authStatus, isPortalRoute, userId } = input;

  // Portal routes have an anonymous, session-free read contract. A private
  // session that is initializing, stale or authenticated must never switch
  // these routes to the private Data API path.
  if (isPortalRoute) return "public";

  if (authStatus === "initializing" || authStatus === "stale") return "wait";

  if (authStatus === "authenticated") {
    if (!userId) return "wait";
    return "authenticated";
  }

  // anonymous OR error on a protected route
  return "denied";
}
