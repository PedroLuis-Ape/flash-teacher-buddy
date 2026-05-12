import { useEffect, useRef, useState, useCallback } from "react";
import {
  loadShortcuts,
  normalizeKey,
  isTypingTarget,
  type ShortcutActionId,
  type ShortcutMap,
} from "@/features/study/lib/keyboardShortcuts";

export type ShortcutHandlers = Partial<Record<ShortcutActionId, (e: KeyboardEvent) => void>>;

interface Options {
  /** Disable all shortcut handling (e.g. when a modal is open). */
  disabled?: boolean;
  /** Allow Enter even when focused in input/textarea (e.g. Write mode submit). */
  allowEnterInTyping?: boolean;
}

/**
 * Reactive hook that returns the current shortcut map and listens for
 * `study:shortcuts-changed` so consumers update when the user remaps keys.
 */
export function useShortcutMap(): ShortcutMap {
  const [map, setMap] = useState<ShortcutMap>(() => loadShortcuts());
  useEffect(() => {
    const onChange = () => setMap(loadShortcuts());
    window.addEventListener("study:shortcuts-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("study:shortcuts-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return map;
}

/**
 * Registers a single global keydown listener that dispatches to the provided
 * action handlers based on the user's configured shortcut map. Handlers are
 * read from a ref so the listener doesn't need to be re-attached on each
 * render.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers, opts: Options = {}): ShortcutMap {
  const map = useShortcutMap();
  const handlersRef = useRef(handlers);
  const mapRef = useRef(map);
  const optsRef = useRef(opts);

  handlersRef.current = handlers;
  mapRef.current = map;
  optsRef.current = opts;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (optsRef.current.disabled) return;
      const typing = isTypingTarget(e.target);
      if (typing && !(optsRef.current.allowEnterInTyping && e.key === "Enter")) return;

      const key = normalizeKey(e.key);
      const m = mapRef.current;
      const hs = handlersRef.current;
      // Iterate handlers and fire any whose bound key matches.
      (Object.keys(hs) as ShortcutActionId[]).forEach((id) => {
        const bound = m[id];
        if (!bound) return;
        if (normalizeKey(bound) !== key) return;
        const fn = hs[id];
        if (fn) fn(e);
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return map;
}

/** Returns a stable callback that, given an action id, returns the bound key. */
export function useShortcutKeyResolver(): (id: ShortcutActionId) => string {
  const map = useShortcutMap();
  return useCallback((id: ShortcutActionId) => map[id], [map]);
}