/**
 * Centralized configuration for keyboard shortcuts in study/game modes.
 *
 * Storage: localStorage key `study:keyboardShortcuts:v1` -> Record<ActionId, string>
 * Each value is the canonical key string returned by `normalizeKey` (see below).
 *
 * This module is intentionally framework-free so it can be reused by any
 * component / hook without React dependencies.
 */

export type ShortcutActionId =
  | "nextCard"
  | "prevCard"
  | "flip"
  | "confirm"
  | "knew"
  | "didntKnow"
  | "skip"
  | "playAudio"
  | "nextLayer"
  | "restart";

export interface ShortcutActionMeta {
  id: ShortcutActionId;
  label: string;
  description: string;
}

export const KEYBOARD_ACTIONS: ShortcutActionMeta[] = [
  { id: "nextCard", label: "Próximo card", description: "Avança para o próximo card" },
  { id: "prevCard", label: "Card anterior", description: "Volta ao card anterior" },
  { id: "flip", label: "Virar card (Flip)", description: "Vira o card no modo Flip" },
  { id: "confirm", label: "Confirmar resposta", description: "Confirma a resposta atual" },
  { id: "knew", label: "Marcar como Sabia", description: "Marca o card como acertado" },
  { id: "didntKnow", label: "Marcar como Não sabia", description: "Marca o card como errado" },
  { id: "skip", label: "Pular", description: "Pula o card atual" },
  { id: "playAudio", label: "Ouvir áudio", description: "Reproduz a pronúncia do lado visível" },
  { id: "nextLayer", label: "Próxima camada", description: "Alterna para a próxima camada do card" },
  { id: "restart", label: "Reiniciar atividade", description: "Reinicia a sessão atual" },
];

export type ShortcutMap = Record<ShortcutActionId, string>;

export const CLASSIC_PRESET: ShortcutMap = {
  nextCard: "ArrowRight",
  prevCard: "ArrowLeft",
  flip: " ",
  confirm: "Enter",
  knew: "ArrowUp",
  didntKnow: "ArrowDown",
  skip: "Tab",
  playAudio: "Enter",
  nextLayer: "L",
  restart: "R",
};

export const GAMER_PRESET: ShortcutMap = {
  nextCard: "D",
  prevCard: "A",
  flip: "W",
  confirm: "Enter",
  knew: "E",
  didntKnow: "S",
  skip: "Q",
  playAudio: " ",
  nextLayer: "F",
  restart: "R",
};

export const DEFAULT_SHORTCUTS: ShortcutMap = { ...CLASSIC_PRESET };

export type PresetId = "classic" | "gamer" | "custom";

export const PRESETS: { id: PresetId; label: string; map?: ShortcutMap }[] = [
  { id: "classic", label: "Padrão clássico", map: CLASSIC_PRESET },
  { id: "gamer", label: "Padrão gamer / WASD", map: GAMER_PRESET },
  { id: "custom", label: "Personalizado" },
];

const STORAGE_KEY = "study:keyboardShortcuts:v1";
const PRESET_KEY = "study:keyboardShortcuts:preset:v1";

/**
 * Normalize a KeyboardEvent.key to a canonical string used everywhere.
 * - Single letters/digits become uppercase ("a" -> "A").
 * - Special keys keep their browser names: " ", "Enter", "ArrowLeft", etc.
 */
export function normalizeKey(key: string): string {
  if (!key) return "";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/** Human-readable label for a key (for UI display). */
export function keyLabel(key: string): string {
  if (key === " ") return "Espaço";
  if (key === "ArrowLeft") return "←";
  if (key === "ArrowRight") return "→";
  if (key === "ArrowUp") return "↑";
  if (key === "ArrowDown") return "↓";
  if (key === "Tab") return "Tab";
  if (key === "Enter") return "Enter";
  if (key === "Escape") return "Esc";
  return key;
}

export function loadShortcuts(): ShortcutMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SHORTCUTS };
    const parsed = JSON.parse(raw) as Partial<ShortcutMap>;
    return { ...DEFAULT_SHORTCUTS, ...parsed };
  } catch {
    return { ...DEFAULT_SHORTCUTS };
  }
}

export function saveShortcuts(map: ShortcutMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent("study:shortcuts-changed"));
  } catch {
    // ignore
  }
}

export function resetShortcuts(): ShortcutMap {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PRESET_KEY);
    window.dispatchEvent(new CustomEvent("study:shortcuts-changed"));
  } catch {
    // ignore
  }
  return { ...DEFAULT_SHORTCUTS };
}

export function loadPreset(): PresetId {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    if (raw === "classic" || raw === "gamer" || raw === "custom") return raw;
  } catch {
    // ignore
  }
  return "classic";
}

export function savePreset(p: PresetId): void {
  try {
    localStorage.setItem(PRESET_KEY, p);
  } catch {
    // ignore
  }
}

/**
 * Returns the action ids (other than `excludeId`) that currently use `key`.
 * Note: some pairs are intentionally allowed to share keys (e.g. confirm and
 * playAudio both bound to Enter by default — they apply in different modes),
 * but we still surface the conflict to let the user decide.
 */
export function findConflicts(map: ShortcutMap, key: string, excludeId: ShortcutActionId): ShortcutActionId[] {
  const k = normalizeKey(key);
  const out: ShortcutActionId[] = [];
  (Object.keys(map) as ShortcutActionId[]).forEach((id) => {
    if (id === excludeId) return;
    if (normalizeKey(map[id]) === k) out.push(id);
  });
  return out;
}

/**
 * Whether the keyboard event originated from a typing context (input, textarea,
 * contenteditable). Shortcut handlers must early-return when this is true so
 * keys like A/W/S/D don't hijack typing in Write mode.
 *
 * Exception: when `allowConfirm` is true and the key is Enter, we allow it
 * (for Write mode "press Enter to submit").
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/** Build a short hint string like "← anterior • → próximo • Espaço virar". */
export function shortcutHint(map: ShortcutMap, items: { id: ShortcutActionId; label: string }[]): string {
  return items.map((it) => `${keyLabel(map[it.id])} ${it.label}`).join(" • ");
}