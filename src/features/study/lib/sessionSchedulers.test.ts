import { describe, expect, it } from "vitest";
import {
  createDirectionSchedule,
  createMixedModeSchedule,
  MIXED_MODE_WEIGHTS,
} from "./sessionSchedulers";

function seededRandom(seed = 123456789): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function maxStreak<T>(items: readonly T[]): number {
  let best = 0;
  let current = 0;
  let previous: T | undefined;

  for (const item of items) {
    current = item === previous ? current + 1 : 1;
    previous = item;
    best = Math.max(best, current);
  }

  return best;
}

describe("createDirectionSchedule", () => {
  it("balances an even session exactly", () => {
    const schedule = createDirectionSchedule(20, seededRandom());
    expect(schedule.filter((direction) => direction === "a-b")).toHaveLength(10);
    expect(schedule.filter((direction) => direction === "b-a")).toHaveLength(10);
  });

  it("keeps an odd session within one item of balance", () => {
    const schedule = createDirectionSchedule(21, seededRandom());
    const aFirst = schedule.filter((direction) => direction === "a-b").length;
    const bFirst = schedule.length - aFirst;
    expect(Math.abs(aFirst - bFirst)).toBeLessThanOrEqual(1);
  });

  it("does not create long direction streaks", () => {
    const schedule = createDirectionSchedule(101, seededRandom(7));
    expect(maxStreak(schedule)).toBeLessThanOrEqual(2);
  });
});

describe("createMixedModeSchedule", () => {
  it("uses the configured distribution and never includes flip", () => {
    const schedule = createMixedModeSchedule(100, {
      pronunciationSupported: true,
      random: seededRandom(),
    });

    for (const [mode, weight] of Object.entries(MIXED_MODE_WEIGHTS)) {
      expect(schedule.filter((item) => item === mode)).toHaveLength(weight);
    }
    expect(schedule).not.toContain("flip");
  });

  it("limits repeated modes and separates pronunciation activities", () => {
    const schedule = createMixedModeSchedule(100, {
      pronunciationSupported: true,
      random: seededRandom(42),
    });

    expect(maxStreak(schedule)).toBeLessThanOrEqual(2);
    for (let index = 1; index < schedule.length; index += 1) {
      expect(schedule[index] === "pronunciation" && schedule[index - 1] === "pronunciation").toBe(false);
    }
  });

  it("redistributes pronunciation weight when recognition is unavailable", () => {
    const schedule = createMixedModeSchedule(73, {
      pronunciationSupported: false,
      random: seededRandom(99),
    });

    expect(schedule).toHaveLength(73);
    expect(schedule).not.toContain("pronunciation");
    expect(schedule).not.toContain("flip");
    expect(maxStreak(schedule)).toBeLessThanOrEqual(2);
  });
});
