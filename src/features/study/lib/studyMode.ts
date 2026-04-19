/**
 * Canonical study mode tokens used by the engine and views.
 *
 * Single source of truth for valid mode strings. Anything entering the system
 * (URL params, localStorage, button clicks) MUST pass through normalizeStudyMode().
 */

export type StudyMode =
  | "flip"
  | "write"
  | "multiple-choice"
  | "unscramble"
  | "mixed"
  | "pronunciation";

export const DEFAULT_STUDY_MODE: StudyMode = "flip";

const VALID_MODES: ReadonlySet<StudyMode> = new Set<StudyMode>([
  "flip",
  "write",
  "multiple-choice",
  "unscramble",
  "mixed",
  "pronunciation",
]);

/**
 * Aliases accepted from external sources (URL, button names) that map to
 * canonical tokens. Keep this list explicit and small.
 */
const ALIASES: Readonly<Record<string, StudyMode>> = {
  multiple: "multiple-choice",
  multiplechoice: "multiple-choice",
  multiple_choice: "multiple-choice",
};

/**
 * Normalize any incoming string to a canonical StudyMode.
 * Falls back to DEFAULT_STUDY_MODE when the input is unknown.
 */
export function normalizeStudyMode(raw: unknown): StudyMode {
  if (typeof raw !== "string") return DEFAULT_STUDY_MODE;
  const lower = raw.trim().toLowerCase();
  if (VALID_MODES.has(lower as StudyMode)) return lower as StudyMode;
  if (lower in ALIASES) return ALIASES[lower];
  return DEFAULT_STUDY_MODE;
}

/**
 * URL-safe token used in query string. Currently identical to the canonical
 * token, but isolated here so future renames (e.g. shortening) don't leak.
 */
export function studyModeToUrlParam(mode: StudyMode): string {
  return mode;
}
