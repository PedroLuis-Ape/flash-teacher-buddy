export type RuntimeDirection = "a-b" | "b-a";
export type FlipSlotMode = "write" | "pronunciation";
export type MultipleSlotMode = "multiple-choice" | "write";

interface DirectionState {
  assignments: Map<string, RuntimeDirection>;
  aCount: number;
  bCount: number;
  history: RuntimeDirection[];
}

interface SlotState<T> {
  assignments: Map<string, T>;
  nextIndex: number;
  pattern: readonly T[];
}

const directionStates = new Map<string, DirectionState>();
const flipStates = new Map<string, SlotState<FlipSlotMode>>();
const multipleStates = new Map<string, SlotState<MultipleSlotMode>>();

function sessionKey(): string {
  if (typeof window === "undefined") return "server";
  return `${window.location.pathname}:${new URLSearchParams(window.location.search).get("mode") || "flip"}`;
}

export function isMixedStudySession(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("mode") === "mixed";
}

export function usesMixedDirection(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return (params.get("dir") || params.get("direction")) === "any";
}

export function getBalancedDirection(
  cardKey: string,
  fallback: RuntimeDirection,
): RuntimeDirection {
  if (!usesMixedDirection()) return fallback;
  const key = sessionKey();
  let state = directionStates.get(key);
  if (!state) {
    state = { assignments: new Map(), aCount: 0, bCount: 0, history: [] };
    directionStates.set(key, state);
  }

  const assigned = state.assignments.get(cardKey);
  if (assigned) return assigned;

  const last = state.history[state.history.length - 1];
  const previous = state.history[state.history.length - 2];
  let direction: RuntimeDirection;

  if (last && last === previous) {
    direction = last === "a-b" ? "b-a" : "a-b";
  } else if (state.aCount < state.bCount) {
    direction = "a-b";
  } else if (state.bCount < state.aCount) {
    direction = "b-a";
  } else {
    direction = Math.random() < 0.5 ? "a-b" : "b-a";
  }

  state.assignments.set(cardKey, direction);
  state.history.push(direction);
  if (direction === "a-b") state.aCount += 1;
  else state.bCount += 1;
  return direction;
}

function getSlot<T>(
  store: Map<string, SlotState<T>>,
  cardKey: string,
  pattern: readonly T[],
): T {
  const key = sessionKey();
  let state = store.get(key);
  if (!state) {
    const offset = Math.floor(Math.random() * pattern.length);
    const rotated = [...pattern.slice(offset), ...pattern.slice(0, offset)];
    state = { assignments: new Map(), nextIndex: 0, pattern: rotated };
    store.set(key, state);
  }

  const assigned = state.assignments.get(cardKey);
  if (assigned !== undefined) return assigned;
  const value = state.pattern[state.nextIndex % state.pattern.length];
  state.nextIndex += 1;
  state.assignments.set(cardKey, value);
  return value;
}

function speechRecognitionSupported(): boolean {
  return typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

export function getMixedFlipSlotMode(cardKey: string): FlipSlotMode {
  const selected = getSlot(
    flipStates,
    cardKey,
    ["pronunciation", "write", "pronunciation", "write", "pronunciation"] as FlipSlotMode[],
  );
  return selected === "pronunciation" && !speechRecognitionSupported() ? "write" : selected;
}

export function getMixedMultipleSlotMode(cardKey: string): MultipleSlotMode {
  return getSlot(multipleStates, cardKey, ["multiple-choice", "multiple-choice", "multiple-choice", "multiple-choice", "write"] as MultipleSlotMode[]);
}
