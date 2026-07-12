import type { FolderGlossaryInput, GlossarySide } from "./folderGlossaryTypes";

const APOSTROPHE_VARIANTS = /[‘’‛′＇]/gu;
const HYPHEN_VARIANTS = /[‐‑‒–—−]/gu;

export function cleanFolderGlossaryText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .replace(APOSTROPHE_VARIANTS, "'")
    .replace(HYPHEN_VARIANTS, "-")
    .trim()
    .replace(/\s+/gu, " ");
}

export function folderGlossaryIdentity(value: string | null | undefined): string {
  return cleanFolderGlossaryText(value).toLocaleLowerCase();
}

function normalizedSide(side: FolderGlossaryInput["side"]): GlossarySide {
  return side === "B" ? "B" : "A";
}

function mergeAlternative(
  alternatives: Map<string, string>,
  value: string | null | undefined,
  primaryIdentity: string,
) {
  const clean = cleanFolderGlossaryText(value);
  const identity = folderGlossaryIdentity(clean);
  if (!clean || !identity || identity === primaryIdentity || alternatives.has(identity)) return;
  alternatives.set(identity, clean);
}

interface CompactedEntry {
  input: FolderGlossaryInput;
  alternatives: Map<string, string>;
}

/**
 * Reduz o payload antes de enviar ao PostgreSQL.
 * Entradas com a mesma pasta/lado/termo canônico são transformadas em uma única
 * entrada, mantendo a primeira tradução como principal e agrupando as demais.
 */
export function compactFolderGlossaryEntries(
  entries: FolderGlossaryInput[],
): FolderGlossaryInput[] {
  const compacted = new Map<string, CompactedEntry>();

  for (const entry of entries) {
    const term = cleanFolderGlossaryText(entry.term);
    const translation = cleanFolderGlossaryText(entry.translation);
    if (!term || !translation) continue;

    const side = normalizedSide(entry.side);
    const key = `${side}|${folderGlossaryIdentity(term)}`;
    const existing = compacted.get(key);

    if (!existing) {
      const primaryIdentity = folderGlossaryIdentity(translation);
      const alternatives = new Map<string, string>();
      for (const alternative of entry.alternatives ?? []) {
        mergeAlternative(alternatives, alternative, primaryIdentity);
      }

      compacted.set(key, {
        input: {
          term,
          translation,
          alternatives: [],
          note: cleanFolderGlossaryText(entry.note) || null,
          side,
          source_language: cleanFolderGlossaryText(entry.source_language) || null,
          target_language: cleanFolderGlossaryText(entry.target_language) || null,
          active: entry.active ?? true,
        },
        alternatives,
      });
      continue;
    }

    const primaryIdentity = folderGlossaryIdentity(existing.input.translation);
    mergeAlternative(existing.alternatives, translation, primaryIdentity);
    for (const alternative of entry.alternatives ?? []) {
      mergeAlternative(existing.alternatives, alternative, primaryIdentity);
    }

    if (!existing.input.note) existing.input.note = cleanFolderGlossaryText(entry.note) || null;
    if (!existing.input.source_language) {
      existing.input.source_language = cleanFolderGlossaryText(entry.source_language) || null;
    }
    if (!existing.input.target_language) {
      existing.input.target_language = cleanFolderGlossaryText(entry.target_language) || null;
    }
    if (entry.active !== undefined) existing.input.active = entry.active;
  }

  return Array.from(compacted.values(), ({ input, alternatives }) => ({
    ...input,
    alternatives: Array.from(alternatives.values()).sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: "base" })),
  }));
}
