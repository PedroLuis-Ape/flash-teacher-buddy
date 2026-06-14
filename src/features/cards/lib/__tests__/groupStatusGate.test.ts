/**
 * Phase 5.b — pure gate decision tests.
 *
 * Validates that the activation rules for the new flashcard group status
 * pipeline are conservative by default:
 *   - missing statusGroupUid  → always "legacy"
 *   - missing auth            → always "legacy"
 *   - flag "off"              → always "legacy"
 *   - flag "shadow"           → "shadow" (legacy still drives UI)
 *   - flag "on"               → "new"   (new pipeline drives UI)
 */

import { describe, it, expect } from "vitest";
import { resolveGateMode } from "../../hooks/useGroupStatusGate";

describe("resolveGateMode", () => {
  it("returns legacy when statusGroupUid is missing, even with flag=on", () => {
    expect(
      resolveGateMode({
        authStatus: "authenticated",
        statusGroupUid: null,
        flagValue: "on",
      }),
    ).toBe("legacy");
  });

  it("returns legacy when user is not authenticated", () => {
    for (const s of ["initializing", "anonymous", "error"] as const) {
      expect(
        resolveGateMode({
          authStatus: s,
          statusGroupUid: "g1",
          flagValue: "on",
        }),
      ).toBe("legacy");
    }
  });

  it("returns legacy when flag is off", () => {
    expect(
      resolveGateMode({
        authStatus: "authenticated",
        statusGroupUid: "g1",
        flagValue: "off",
      }),
    ).toBe("legacy");
  });

  it("returns shadow when flag is shadow and all gating conditions are met", () => {
    expect(
      resolveGateMode({
        authStatus: "authenticated",
        statusGroupUid: "g1",
        flagValue: "shadow",
      }),
    ).toBe("shadow");
  });

  it("returns new when flag is on and all gating conditions are met", () => {
    expect(
      resolveGateMode({
        authStatus: "authenticated",
        statusGroupUid: "g1",
        flagValue: "on",
      }),
    ).toBe("new");
  });
});