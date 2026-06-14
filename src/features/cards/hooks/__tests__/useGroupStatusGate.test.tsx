/**
 * Phase 5.b — gate mode resolution tests.
 *
 * Invariants under test:
 *   1. Without `statusGroupUid`, mode is ALWAYS "legacy", regardless of flag.
 *   2. Without authentication, mode is ALWAYS "legacy".
 *   3. With uid + auth + flag "off"    → "legacy".
 *   4. With uid + auth + flag "shadow" → "shadow", and the legacy values
 *      are still what the UI sees.
 *   5. With uid + auth + flag "on" + new-pipeline data available → "new",
 *      and the UI sees the new-pipeline values (not the legacy props).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ---- Mocks --------------------------------------------------------------

let mockFlag: "off" | "shadow" | "on" = "off";
vi.mock("@/lib/featureFlags", () => ({
  getFlag: (_k: string) => mockFlag,
}));

let mockStatus: "initializing" | "authenticated" | "anonymous" | "error" = "authenticated";
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ userId: "u1", status: mockStatus }),
}));

let mockGroupData: { isFavorite: boolean; isRedList: boolean; syncState: "salvo" } | null = null;
vi.mock("../useFlashcardGroupStatus", () => ({
  useFlashcardGroupStatus: () => ({ data: mockGroupData, isLoading: false }),
}));

import { useGroupStatusGate } from "../useGroupStatusGate";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockFlag = "off";
  mockStatus = "authenticated";
  mockGroupData = null;
});

describe("useGroupStatusGate", () => {
  it("returns legacy mode when statusGroupUid is missing", () => {
    mockFlag = "on";
    const { result } = renderHook(
      () => useGroupStatusGate({ legacyIsFavorite: true, legacyIsRedList: false }),
      { wrapper },
    );
    expect(result.current.mode).toBe("legacy");
    expect(result.current.effectiveIsFavorite).toBe(true);
  });

  it("returns legacy mode when user is not authenticated", () => {
    mockFlag = "on";
    mockStatus = "anonymous";
    const { result } = renderHook(
      () =>
        useGroupStatusGate({
          statusGroupUid: "g-1",
          legacyIsFavorite: false,
          legacyIsRedList: false,
        }),
      { wrapper },
    );
    expect(result.current.mode).toBe("legacy");
  });

  it("returns legacy mode when flag is off", () => {
    mockFlag = "off";
    const { result } = renderHook(
      () =>
        useGroupStatusGate({
          statusGroupUid: "g-1",
          legacyIsFavorite: true,
          legacyIsRedList: false,
        }),
      { wrapper },
    );
    expect(result.current.mode).toBe("legacy");
    expect(result.current.effectiveIsFavorite).toBe(true);
  });

  it("returns shadow mode when flag is shadow, UI still reads legacy values", () => {
    mockFlag = "shadow";
    mockGroupData = { isFavorite: false, isRedList: false, syncState: "salvo" };
    const { result } = renderHook(
      () =>
        useGroupStatusGate({
          statusGroupUid: "g-1",
          legacyIsFavorite: true, // legacy says favorite
          legacyIsRedList: false,
        }),
      { wrapper },
    );
    expect(result.current.mode).toBe("shadow");
    // Drift exists (legacy=true, new=false), but legacy still drives the UI.
    expect(result.current.effectiveIsFavorite).toBe(true);
  });

  it("returns new mode when flag is on AND new-pipeline data is available", () => {
    mockFlag = "on";
    mockGroupData = { isFavorite: true, isRedList: true, syncState: "salvo" };
    const { result } = renderHook(
      () =>
        useGroupStatusGate({
          statusGroupUid: "g-1",
          legacyIsFavorite: false, // legacy disagrees; new wins
          legacyIsRedList: false,
        }),
      { wrapper },
    );
    expect(result.current.mode).toBe("new");
    expect(result.current.effectiveIsFavorite).toBe(true);
    expect(result.current.effectiveIsRedList).toBe(true);
    expect(result.current.syncState).toBe("salvo");
  });

  it("falls back to legacy values while new-pipeline data is still loading", () => {
    mockFlag = "on";
    mockGroupData = null;
    const { result } = renderHook(
      () =>
        useGroupStatusGate({
          statusGroupUid: "g-1",
          legacyIsFavorite: true,
          legacyIsRedList: false,
        }),
      { wrapper },
    );
    expect(result.current.mode).toBe("new");
    expect(result.current.effectiveIsFavorite).toBe(true); // legacy still visible
  });
});