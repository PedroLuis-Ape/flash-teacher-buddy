import { useSyncExternalStore } from "react";
import type {
  StudyPlayModePreset,
  StudyPlaySidePreset,
} from "@/features/study/preferences/studyPreset";

type PlayPresetRuntimeSnapshot = {
  playMode: StudyPlayModePreset;
  playSide: StudyPlaySidePreset;
  labelA: string;
  labelB: string;
};

let snapshot: PlayPresetRuntimeSnapshot = {
  playMode: "both",
  playSide: "a",
  labelA: "Lado A",
  labelB: "Lado B",
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function setPlayPresetRuntime(
  partial: Partial<PlayPresetRuntimeSnapshot>,
): void {
  const next = { ...snapshot, ...partial };
  if (
    next.playMode === snapshot.playMode
    && next.playSide === snapshot.playSide
    && next.labelA === snapshot.labelA
    && next.labelB === snapshot.labelB
  ) {
    return;
  }
  snapshot = next;
  emit();
}

export function getPlayPresetRuntime(): PlayPresetRuntimeSnapshot {
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePlayPresetRuntime(): PlayPresetRuntimeSnapshot {
  return useSyncExternalStore(subscribe, getPlayPresetRuntime, getPlayPresetRuntime);
}