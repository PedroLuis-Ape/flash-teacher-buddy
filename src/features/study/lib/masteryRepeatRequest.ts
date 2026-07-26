import { useSyncExternalStore } from "react";

const REQUEST_TTL_MS = 2_000;

interface RepeatRequestState {
  enabled: boolean;
  pendingUntil: number;
}

let state: RepeatRequestState = {
  enabled: false,
  pendingUntil: 0,
};

const listeners = new Set<() => void>();
let expirationTimer: ReturnType<typeof setTimeout> | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

function clearExpirationTimer(): void {
  if (expirationTimer !== null) {
    clearTimeout(expirationTimer);
    expirationTimer = null;
  }
}

function clearPendingRequest(): void {
  clearExpirationTimer();
  if (state.pendingUntil === 0) return;
  state = { ...state, pendingUntil: 0 };
  emit();
}

export function setMasteryRepeatEnabled(enabled: boolean): void {
  if (state.enabled === enabled && (enabled || state.pendingUntil === 0)) return;
  clearExpirationTimer();
  state = {
    enabled,
    pendingUntil: enabled ? state.pendingUntil : 0,
  };
  emit();
}

export function requestMasteryRepeatNextRound(): boolean {
  if (!state.enabled) return false;

  clearExpirationTimer();
  state = {
    ...state,
    pendingUntil: Date.now() + REQUEST_TTL_MS,
  };
  emit();

  expirationTimer = setTimeout(() => {
    expirationTimer = null;
    if (state.pendingUntil > 0 && state.pendingUntil <= Date.now()) {
      state = { ...state, pendingUntil: 0 };
      emit();
    }
  }, REQUEST_TTL_MS + 25);

  return true;
}

export function consumeMasteryRepeatNextRound(): boolean {
  const pending = state.enabled && state.pendingUntil > Date.now();
  clearPendingRequest();
  return pending;
}

export function resetMasteryRepeatRequestForTests(): void {
  clearExpirationTimer();
  state = { enabled: false, pendingUntil: 0 };
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return state.enabled;
}

export function useMasteryRepeatEnabled(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
