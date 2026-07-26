import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeMasteryRepeatNextRound,
  requestMasteryRepeatNextRound,
  resetMasteryRepeatRequestForTests,
  setMasteryRepeatEnabled,
} from "./masteryRepeatRequest";

describe("masteryRepeatRequest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMasteryRepeatRequestForTests();
  });

  afterEach(() => {
    resetMasteryRepeatRequestForTests();
    vi.useRealTimers();
  });

  it("rejects a repeat request outside Rodadas de Domínio", () => {
    expect(requestMasteryRepeatNextRound()).toBe(false);
    expect(consumeMasteryRepeatNextRound()).toBe(false);
  });

  it("consumes an enabled request exactly once", () => {
    setMasteryRepeatEnabled(true);

    expect(requestMasteryRepeatNextRound()).toBe(true);
    expect(consumeMasteryRepeatNextRound()).toBe(true);
    expect(consumeMasteryRepeatNextRound()).toBe(false);
  });

  it("expires an orphan request instead of leaking it to a later card", () => {
    setMasteryRepeatEnabled(true);
    expect(requestMasteryRepeatNextRound()).toBe(true);

    vi.advanceTimersByTime(2_100);

    expect(consumeMasteryRepeatNextRound()).toBe(false);
  });

  it("clears a pending request when mastery mode is disabled", () => {
    setMasteryRepeatEnabled(true);
    expect(requestMasteryRepeatNextRound()).toBe(true);

    setMasteryRepeatEnabled(false);
    setMasteryRepeatEnabled(true);

    expect(consumeMasteryRepeatNextRound()).toBe(false);
  });
});
