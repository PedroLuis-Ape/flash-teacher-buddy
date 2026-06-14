/**
 * groupStatusGate — pure decision module for the Phase 5.b feature gate.
 *
 * Kept in /lib (not /hooks) so it can be imported in tests without dragging
 * in React, AuthContext, or any browser-only API (e.g. localStorage).
 */

export type GateMode = "legacy" | "shadow" | "new";

export function resolveGateMode(args: {
  authStatus: "initializing" | "authenticated" | "anonymous" | "error";
  statusGroupUid?: string | null;
  flagValue: "off" | "shadow" | "on";
}): GateMode {
  if (args.authStatus !== "authenticated") return "legacy";
  if (!args.statusGroupUid) return "legacy";
  if (args.flagValue === "off") return "legacy";
  return args.flagValue === "on" ? "new" : "shadow";
}