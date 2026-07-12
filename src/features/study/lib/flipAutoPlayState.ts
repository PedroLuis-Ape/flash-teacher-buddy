export type FlipAutoPlaySide = "a" | "b";
export type FlipAutoPlayMode = "both" | "single";

export type FlipAutoPlayStep =
  | { action: "switch"; side: FlipAutoPlaySide }
  | { action: "next" };

const RESTORE_TTL_MS = 3000;

let memoryState: {
  enabled: boolean;
  side: FlipAutoPlaySide;
  path: string;
  updatedAt: number;
} = {
  enabled: false,
  side: "a",
  path: "",
  updatedAt: 0,
};

function currentPath() {
  return typeof window === "undefined" ? "" : window.location.pathname;
}

export function oppositeFlipAutoPlaySide(side: FlipAutoPlaySide): FlipAutoPlaySide {
  return side === "a" ? "b" : "a";
}

export function getNextFlipAutoPlayStep(input: {
  mode: FlipAutoPlayMode;
  configuredSide: FlipAutoPlaySide;
  currentSide: FlipAutoPlaySide;
}): FlipAutoPlayStep {
  if (input.mode === "single") return { action: "next" };
  if (input.currentSide === input.configuredSide) {
    return { action: "switch", side: oppositeFlipAutoPlaySide(input.configuredSide) };
  }
  return { action: "next" };
}

export function readFlipAutoPlayState() {
  const samePath = memoryState.path === currentPath();
  const fresh = Date.now() - memoryState.updatedAt <= RESTORE_TTL_MS;

  return {
    enabled: memoryState.enabled && samePath && fresh,
    side: memoryState.side,
  };
}

export function writeFlipAutoPlayState(enabled: boolean, side: FlipAutoPlaySide) {
  memoryState = {
    enabled,
    side,
    path: currentPath(),
    updatedAt: Date.now(),
  };
}