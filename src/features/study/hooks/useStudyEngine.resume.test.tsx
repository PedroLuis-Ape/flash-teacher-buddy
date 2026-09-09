import React, { useCallback, useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStudyEngine } from "./useStudyEngine";
import { buildStudySessionSettingsSnapshot, type StudySessionSettingsSnapshot } from "../lib/studySessionContext";

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(), writes: [] as Record<string, unknown>[], row: {} as Record<string, unknown>,
  claim: vi.fn(), noop: () => undefined, asyncNoop: async () => undefined,
}));
vi.mock("@/features/study/lib/requestedStudySession", () => ({ fetchRequestedStudySession: mocks.lookup }));
vi.mock("@/features/study/lib/studySessionRepository", () => ({
  claimStudySession: mocks.claim,
  persistStudySession: async (input: { payload: Record<string, unknown>; revision: number }) => {
    mocks.writes.push(input.payload);
    Object.assign(mocks.row, input.payload);
    return { accepted: true, revision: input.revision, usedRpc: true };
  },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => {
  let payload: Record<string, unknown> = {};
  const query = {
    update: (value: Record<string, unknown>) => { payload = value; return query; },
    eq: () => query, select: () => query, abortSignal: () => query,
    maybeSingle: async () => { mocks.writes.push(payload); Object.assign(mocks.row, payload); return { data: { id: mocks.row.id }, error: null }; },
  };
  return query;
} } }));
vi.mock("sonner", () => ({ toast: { success: mocks.noop, error: mocks.noop, warning: mocks.noop, info: mocks.noop } }));
vi.mock("@/hooks/useListActivity", () => ({ useListActivity: () => ({ trackListOpened: mocks.noop, trackListStudied: mocks.noop }) }));
vi.mock("@/features/classroom/hooks/useTurmaActivity", () => ({ useTurmaActivity: () => ({ initTurmaTracking: mocks.asyncNoop, updateTurmaActivity: mocks.noop, flushActivity: mocks.noop }) }));
vi.mock("@/features/classroom/hooks/useTurmaEngagementTracking", () => ({ useTurmaEngagementTracking: () => ({ trackCardViewed: mocks.noop, trackAnswer: mocks.noop, trackCompleted: mocks.noop }) }));
vi.mock("@/lib/rewardEngine", () => ({ recordStudyAnswer: async () => ({ success: true }), settleStudySession: mocks.asyncNoop }));
vi.mock("@/hooks/useGoals", () => ({ updateGoalProgress: mocks.asyncNoop }));
vi.mock("@/features/study/lib/studyProgressRepository", () => ({ createStudyProgressOperationId: () => "operation", recordStudyProgressAttempt: mocks.asyncNoop }));

const cards = ["a", "b", "c"].map(id => ({ id, term: id, translation: id }));
const empty: string[] = [];
const context = { direction: "a-b" as const };
const settings = buildStudySessionSettingsSnapshot({ mode: "flip", order: "sequential", direction: "a-b" });
let engine: ReturnType<typeof useStudyEngine>;
let renderer: ReactTestRenderer | undefined;

function Harness({ deckReady = true, presetReady = true, mode = "flip", removedCard = false }: { deckReady?: boolean; presetReady?: boolean; mode?: Parameters<typeof useStudyEngine>[2]; removedCard?: boolean }) {
  const [saved, setSaved] = useState<StudySessionSettingsSnapshot>(settings);
  const restore = useCallback((value: StudySessionSettingsSnapshot) => setSaved(value), []);
  const deck = saved.subset === "favorites" || removedCard ? cards.slice(1) : cards;
  engine = useStudyEngine("list", deckReady ? deck : [], mode, false, empty,
    { mode: "sequential", subset: "all" }, empty, "user", saved.studyFlowMode,
    context, deckReady, restore, "list", "session-x", presetReady);
  return null;
}
async function mount(props = {}) {
  await act(async () => { renderer = create(<Harness {...props} />); });
}
beforeEach(() => {
  mocks.row = { id: "session-x", cards_order: ["a", "b", "c"], current_index: 1, completed: false, settings_snapshot: settings };
  mocks.writes.length = 0;
  mocks.lookup.mockReset().mockImplementation(async () => ({ status: "found", session: structuredClone(mocks.row) }));
  mocks.claim.mockReset().mockResolvedValue({ id: "fresh", created: true });
  const storage = new Map<string, string>();
  const localStorage = { get length() { return storage.size; }, key: (i: number) => [...storage.keys()][i] ?? null, getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage, addEventListener: mocks.noop, removeEventListener: mocks.noop });
  vi.stubGlobal("document", { addEventListener: mocks.noop, removeEventListener: mocks.noop });
});
afterEach(async () => {
  await act(async () => renderer?.unmount()); renderer = undefined;
  vi.unstubAllGlobals();
});

describe("ST-empty-order real React resume lifecycle", () => {
  it("preserves completion and round bookkeeping in the explicit exit snapshot", async () => {
    await mount();
    await act(async () => engine.goToNext());
    await act(async () => engine.goToNext());
    expect(engine.isFinished).toBe(true);
    await act(async () => { await engine.saveProgressNow(); });
    const saved = Array.from({ length: localStorage.length }, (_, i) =>
      JSON.parse(localStorage.getItem(localStorage.key(i)!)!))
      .find(value => value?.version === 2 && value?.sessionId === "session-x");
    expect(saved).toMatchObject({ isFinished: true, roundNumber: 1 });
    expect(saved).toHaveProperty("roundResults");
    expect(saved).toHaveProperty("unseenCards");
    expect(saved).toHaveProperty("missedCards");
  });
  it("stays loading until the actual requested lookup resolves", async () => {
    let resolveLookup!: (value: unknown) => void;
    mocks.lookup.mockReturnValue(new Promise(resolve => { resolveLookup = resolve; }));
    await mount();
    expect(engine.initializationState).toBe("loading");
    expect(engine.isLoading).toBe(true);
    expect(mocks.writes).toEqual([]);
    await act(async () => resolveLookup({ status: "found", session: structuredClone(mocks.row) }));
    expect(engine.currentCard?.id).toBe("b");
  });
  it("does not rewind on an equivalent rerender", async () => {
    await mount();
    await act(async () => engine.goToNext());
    await act(async () => renderer?.update(<Harness />));
    expect(engine.currentCard?.id).toBe("c");
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
  });
  it("preserves the cursor through a transient deck refetch", async () => {
    await mount();
    await act(async () => engine.goToNext());
    await act(async () => renderer?.update(<Harness deckReady={false} />));
    expect((await engine.saveProgressNow()).status).toBe("failed");
    await act(async () => renderer?.update(<Harness deckReady />));
    expect(engine.currentCard?.id).toBe("c");
    expect(engine.initializationState).toBe("ready");
  });
  it("reconciles a changed deck against live progress instead of the old fetched row", async () => {
    await mount();
    await act(async () => engine.goToNext());
    await act(async () => renderer?.update(<Harness removedCard />));
    expect(engine.currentCard?.id).toBe("c");
    expect(engine.currentIndex).toBe(1);
  });
  it.each(["flip", "write", "multiple-choice", "unscramble", "pronunciation"] as const)("restores the same card in %s", async mode => {
    await mount({ mode });
    expect(engine.currentCard?.id).toBe("b");
    expect(engine.initializationState).toBe("ready");
  });
  it("uses only the same-session local fallback when offline", async () => {
    await mount();
    await act(async () => { await engine.saveProgressNow(); });
    await act(async () => renderer?.unmount()); renderer = undefined;
    mocks.lookup.mockResolvedValue({ status: "unavailable" });
    await mount();
    expect(engine.currentCard?.id).toBe("b");
    expect(engine.sessionId).toBe("session-x");
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it("starts fresh only after an explicit action", async () => {
    await mount();
    await act(async () => { await engine.startFreshSession(); });
    expect(mocks.claim).toHaveBeenCalledTimes(1);
    expect(engine.sessionId).toBe("fresh");
    expect(engine.currentIndex).toBe(0);
    expect(engine.currentCard?.id).toBe("a");
  });
  it("answers, saves, unmounts and restores the same card and results", async () => {
    await mount();
    expect(engine.currentCard?.id).toBe("b");
    await act(async () => { await engine.recordResult("b", true); engine.goToNext(); });
    await act(async () => { await engine.saveProgressNow(); });
    expect(mocks.row.current_index).toBe(2);
    await act(async () => renderer?.unmount()); renderer = undefined;
    await mount();
    expect(engine.currentCard?.id).toBe("c");
    expect(engine.results).toContainEqual(expect.objectContaining({ flashcardId: "b", correct: true }));
    expect(engine.sessionId).toBe("session-x");
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it("waits for settings and deck instead of saving an empty runtime", async () => {
    mocks.row.settings_snapshot = { ...settings, subset: "favorites" };
    await mount({ deckReady: false, presetReady: false });
    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.writes).toEqual([]);
    await act(async () => renderer?.update(<Harness deckReady={false} presetReady />));
    expect(mocks.writes).toEqual([]);
    await act(async () => renderer?.update(<Harness deckReady presetReady />));
    expect(engine.cardsOrder).toEqual(["b", "c"]);
    expect(engine.currentCard?.id).toBe("b");
    expect(mocks.writes.every(write => (write.cards_order as string[]).length > 0)).toBe(true);
  });
  it("retry refetches the requested row after a transport error", async () => {
    mocks.lookup.mockResolvedValueOnce({ status: "unavailable", error: new Error("offline") });
    await mount();
    expect(engine.initializationState).toBe("failed");
    expect(mocks.claim).not.toHaveBeenCalled();
    await act(async () => engine.retryInitialization());
    expect(mocks.lookup).toHaveBeenCalledTimes(2);
    expect(engine.currentCard?.id).toBe("b");
  });
  it("repairs a corrupt row and writes the repaired snapshot to the same row", async () => {
    mocks.row.cards_order = [];
    await mount();
    expect(engine.currentCard?.id).toBe("b");
    expect(mocks.row.cards_order).toEqual(["a", "b", "c"]);
    expect(mocks.row.session_snapshot).toMatchObject({ sessionId: "session-x", currentIndex: 1 });
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it("missing requested sessions fail without starting another one", async () => {
    mocks.lookup.mockResolvedValue({ status: "not-found" });
    await mount();
    expect(engine.initializationError).toBe("study-resume-session-not-found");
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it("completed sessions render completion and do not overwrite their row", async () => {
    mocks.row.completed = true;
    await mount();
    expect(engine.isFinished).toBe(true);
    expect(mocks.writes).toEqual([]);
  });
});
