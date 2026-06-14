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
 *   initializing    | *             | *      | wait
 *   error           | true          | *      | public
 *   error           | false         | *      | denied
 *   anonymous       | true          | *      | public
 *   anonymous       | false         | *      | denied
 *   authenticated   | *             | set    | authenticated
 *   authenticated   | *             | null   | wait  (race: status flipped before userId)
 */
export function resolveStudyAccess(input: StudyAccessInput): StudyAccess {
  const { authStatus, isPortalRoute, userId } = input;

  if (authStatus === "initializing") return "wait";

  if (authStatus === "authenticated") {
    if (!userId) return "wait";
    return "authenticated";
  }

  // anonymous OR error
  return isPortalRoute ? "public" : "denied";
}