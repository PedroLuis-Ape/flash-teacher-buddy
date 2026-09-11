import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRewriteFlowState, updateRewriteDraft } from "./writeRewriteFlow";
import {
  clearRewriteCardSnapshot,
  clearRewriteSnapshot,
  readRewriteSnapshot,
  rewriteSnapshotKey,
  writeRewriteSnapshot,
} from "./writeRewriteSnapshot";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("write Rewrite snapshot", () => {
  const storage = new MemoryStorage();

  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: storage },
    });
  });

  afterEach(() => {
    clearRewriteSnapshot("session-a");
    Reflect.deleteProperty(globalThis, "window");
  });

  it("preserves independent card states in the existing session scope", () => {
    const first = updateRewriteDraft(createRewriteFlowState(), "first draft");
    const second = updateRewriteDraft(createRewriteFlowState(), "second draft");
    writeRewriteSnapshot("session-a", "card-1", first);
    writeRewriteSnapshot("session-a", "card-2", second);

    expect(readRewriteSnapshot("session-a", "card-1")?.draft).toBe("first draft");
    expect(readRewriteSnapshot("session-a", "card-2")?.draft).toBe("second draft");

    clearRewriteCardSnapshot("session-a", "card-1");
    expect(readRewriteSnapshot("session-a", "card-1")).toBeNull();
    expect(readRewriteSnapshot("session-a", "card-2")?.draft).toBe("second draft");
  });

  it("discards expired, future, and malformed envelopes", () => {
    const key = rewriteSnapshotKey("session-a");
    storage.setItem(key, JSON.stringify({
      version: 1,
      states: { card: createRewriteFlowState() },
      timestamp: 1,
    }));
    expect(readRewriteSnapshot("session-a", "card", 31 * 24 * 60 * 60 * 1000)).toBeNull();

    storage.setItem(key, JSON.stringify({
      version: 1,
      states: { card: createRewriteFlowState() },
      timestamp: 200_000,
    }));
    expect(readRewriteSnapshot("session-a", "card", 1)).toBeNull();

    storage.setItem(key, "not-json");
    expect(readRewriteSnapshot("session-a", "card")).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });

  it("does nothing without a session scope", () => {
    writeRewriteSnapshot(undefined, "card", createRewriteFlowState());
    expect(readRewriteSnapshot(undefined, "card")).toBeNull();
  });
});