export type FlipAutoPlaySide = "first" | "second";

const RESTORE_TTL_MS = 3000;

let memoryState: {
  enabled: boolean;
  side: FlipAutoPlaySide;
  path: string;
  updatedAt: number;
} = {
  enabled: false,
  side: "first",
  path: "",
  updatedAt: 0,
};

function currentPath() {
  return typeof window === "undefined" ? "" : window.location.pathname;
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
