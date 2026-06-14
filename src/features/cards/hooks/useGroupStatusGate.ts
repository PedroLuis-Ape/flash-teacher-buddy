/**
 * useGroupStatusGate — Phase 5.b bridge.
 *
 * Returns the runtime decision for a single (flashcard, statusGroupUid) pair:
 *
 *   mode === "legacy"          → render using legacy state passed by the caller
 *   mode === "shadow"          → legacy state still drives UI; new pipeline is
 *                                queried only to compare and emit drift telemetry
 *   mode === "new"             → new pipeline drives UI & writes
 *
 * Gating rules (all defensive):
 *   - When `statusGroupUid` is not provided, the gate ALWAYS returns "legacy".
 *     No caller can be accidentally switched without explicitly passing the
 *     stable identifier.
 *   - When the user is not authenticated, the gate ALWAYS returns "legacy".
 *   - The feature flag is read via `getFlag("new_status_pipeline")` so Safe
 *     Mode can override it.
 */

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getFlag } from "@/lib/featureFlags";
import { useFlashcardGroupStatus } from "./useFlashcardGroupStatus";
import { reportDrift } from "../lib/statusTelemetry";

export type GateMode = "legacy" | "shadow" | "new";

export interface GateInput {
  statusGroupUid?: string | null;
  legacyIsFavorite: boolean;
  legacyIsRedList: boolean;
}

export interface GateResult {
  mode: GateMode;
  /** What the UI should render. Always defined. */
  effectiveIsFavorite: boolean;
  effectiveIsRedList: boolean;
  /** New-pipeline sync state, only meaningful when mode === "new". */
  syncState?: "salvo" | "salvando" | "aguardando" | "erro";
}

/**
 * Pure decision function — exposed so it can be unit-tested without React.
 * Returns the *mode* given the gating inputs. The hook layer applies it.
 */
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

export function useGroupStatusGate(input: GateInput): GateResult {
  const { status } = useAuth();
  const flagValue = getFlag("new_status_pipeline") as "off" | "shadow" | "on";

  const mode = resolveGateMode({
    authStatus: status,
    statusGroupUid: input.statusGroupUid,
    flagValue,
  });

  const canActivate = mode !== "legacy";

  // Always call the hook to keep hook order stable; it self-disables when
  // statusGroupUid / userId are missing.
  const newQuery = useFlashcardGroupStatus(canActivate ? input.statusGroupUid : null);

  // In shadow mode we compare and emit drift exactly once per change.
  useEffect(() => {
    if (mode !== "shadow") return;
    if (!newQuery.data) return;
    if (!input.statusGroupUid) return;
    reportDrift({
      statusGroupUid: input.statusGroupUid,
      legacyIsFavorite: input.legacyIsFavorite,
      newIsFavorite: newQuery.data.isFavorite,
      legacyIsRedList: input.legacyIsRedList,
      newIsRedList: newQuery.data.isRedList,
    });
  }, [
    mode,
    input.statusGroupUid,
    input.legacyIsFavorite,
    input.legacyIsRedList,
    newQuery.data?.isFavorite,
    newQuery.data?.isRedList,
  ]);

  if (mode === "new" && newQuery.data) {
    return {
      mode,
      effectiveIsFavorite: newQuery.data.isFavorite,
      effectiveIsRedList: newQuery.data.isRedList,
      syncState: newQuery.data.syncState,
    };
  }

  return {
    mode,
    effectiveIsFavorite: input.legacyIsFavorite,
    effectiveIsRedList: input.legacyIsRedList,
  };
}