import type { SpecialFocusContext } from "@/hooks/useSpecialFlashcards";

const STORAGE_KEY = "ape:pending-special-focus-context:v1";

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function normalizeDraft(focus: SpecialFocusContext): SpecialFocusContext {
  const clean = (value?: string | null) => {
    if (typeof value !== "string") return value ?? null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  return {
    focus_text: clean(focus.focus_text),
    focus_side: focus.focus_side ?? null,
    focus_tag: focus.focus_tag ?? null,
    focus_note: clean(focus.focus_note),
  };
}

export function savePendingSpecialFocusDraft(focus: SpecialFocusContext): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalizeDraft(focus)));
  } catch {
    // Foco é melhoria opcional; nunca deve bloquear o fluxo de especiais.
  }
}

export function takePendingSpecialFocusDraft(): SpecialFocusContext | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    storage.removeItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return normalizeDraft(parsed as SpecialFocusContext);
  } catch {
    return null;
  }
}

export function clearPendingSpecialFocusDraft(): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}
