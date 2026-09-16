import {
  getLangLabel,
  resolveEffectiveListSettings,
  type LanguageSettingsMode,
} from "../study/lib/resolveStudySides";
import type { GlobalImportList, GlobalImportPackage } from "./schema";

export interface ImportLanguageDirection {
  front: string;
  back: string;
}

interface ImportLanguageListRow {
  lang_a?: string | null;
  lang_b?: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
  study_type?: string | null;
  tts_enabled?: boolean | null;
  system_kind?: string | null;
  language_settings_mode?: string | null;
}

interface ImportLanguageFolderRow {
  lang_a?: string | null;
  lang_b?: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
  study_type?: string | null;
  tts_enabled?: boolean | null;
}

export type ImportLanguageMatchSource =
  | "effective"
  | "legacy-list"
  | "none";

export interface ImportLanguageCompatibility {
  compatible: boolean;
  incoming: ImportLanguageDirection;
  target: ImportLanguageDirection;
  effectiveTarget: ImportLanguageDirection;
  rawListTarget: ImportLanguageDirection | null;
  mode: LanguageSettingsMode;
  isListOverride: boolean;
  matchSource: ImportLanguageMatchSource;
  authorityLabel: string;
  labelA: string;
  labelB: string;
}

export function normalizeImportLanguage(value: string): string {
  const normalized = value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, "-");

  const aliases: Record<string, string> = {
    english: "en",
    ingles: "en",
    portuguese: "pt",
    portugues: "pt",
    spanish: "es",
    espanhol: "es",
    french: "fr",
    frances: "fr",
    german: "de",
    alemao: "de",
    italian: "it",
    italiano: "it",
  };

  return aliases[normalized] ?? normalized.split("-")[0];
}

export function importDirectionsMatch(
  left: ImportLanguageDirection,
  right: ImportLanguageDirection,
): boolean {
  return normalizeImportLanguage(left.front) === normalizeImportLanguage(right.front)
    && normalizeImportLanguage(left.back) === normalizeImportLanguage(right.back);
}

export function resolveIncomingListDirection(
  list: GlobalImportList,
  packageValue: GlobalImportPackage,
): ImportLanguageDirection | null {
  const metadata = list.cards[0]?.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const front = metadata.front_language;
    const back = metadata.back_language;
    if (typeof front === "string" && typeof back === "string") {
      return { front, back };
    }
  }

  const front = packageValue.package.source_language;
  const back = packageValue.package.target_language;
  return front && back ? { front, back } : null;
}

function rawListDirection(list: ImportLanguageListRow): ImportLanguageDirection | null {
  if (!list.lang_a || !list.lang_b) return null;
  return { front: list.lang_a, back: list.lang_b };
}

export function importLanguageAuthorityLabel(
  mode: LanguageSettingsMode,
  isListOverride: boolean,
  matchSource: ImportLanguageMatchSource = "effective",
): string {
  if (matchSource === "legacy-list") return "configuração armazenada na lista (compatibilidade antiga)";
  if (mode === "explicit") return "configuração própria da lista";
  if (mode === "inherited") return "configuração herdada da pasta";
  return isListOverride
    ? "configuração da lista em modo legado"
    : "configuração herdada por compatibilidade antiga";
}

/**
 * Canonical compatibility check used by every existing-list import entrypoint.
 *
 * `explicit` and `inherited` follow resolveEffectiveListSettings exactly.
 * For `legacy`, we preserve the historical effective resolver first, but allow
 * the incoming package to match the list's stored A/B metadata when that exact
 * pair is the only thing that disagrees with a folder-derived legacy result.
 * This makes old en/pt rows importable without rewriting their flashcards and
 * without treating pt-BR vs pt (or en-US vs en) as different directions.
 */
export function resolveImportLanguageCompatibility(
  incoming: ImportLanguageDirection,
  list: ImportLanguageListRow,
  folder?: ImportLanguageFolderRow | null,
): ImportLanguageCompatibility {
  const effective = resolveEffectiveListSettings(list, folder);
  const effectiveTarget = { front: effective.langA, back: effective.langB };
  const rawTarget = rawListDirection(list);

  if (importDirectionsMatch(incoming, effectiveTarget)) {
    return {
      compatible: true,
      incoming,
      target: effectiveTarget,
      effectiveTarget,
      rawListTarget: rawTarget,
      mode: effective.languageSettingsMode,
      isListOverride: effective.isListOverride,
      matchSource: "effective",
      authorityLabel: importLanguageAuthorityLabel(
        effective.languageSettingsMode,
        effective.isListOverride,
      ),
      labelA: effective.labelsA,
      labelB: effective.labelsB,
    };
  }

  if (
    effective.languageSettingsMode === "legacy"
    && rawTarget
    && importDirectionsMatch(incoming, rawTarget)
  ) {
    return {
      compatible: true,
      incoming,
      target: rawTarget,
      effectiveTarget,
      rawListTarget: rawTarget,
      mode: effective.languageSettingsMode,
      isListOverride: true,
      matchSource: "legacy-list",
      authorityLabel: importLanguageAuthorityLabel("legacy", true, "legacy-list"),
      labelA: list.labels_a || getLangLabel(rawTarget.front),
      labelB: list.labels_b || getLangLabel(rawTarget.back),
    };
  }

  return {
    compatible: false,
    incoming,
    target: effectiveTarget,
    effectiveTarget,
    rawListTarget: rawTarget,
    mode: effective.languageSettingsMode,
    isListOverride: effective.isListOverride,
    matchSource: "none",
    authorityLabel: importLanguageAuthorityLabel(
      effective.languageSettingsMode,
      effective.isListOverride,
    ),
    labelA: effective.labelsA,
    labelB: effective.labelsB,
  };
}

/**
 * Keep the validation string stable for existing callers/tests. The mapping UI
 * renders the structured incoming/target/authority diagnostics from the result
 * itself, so we do not need to overload the blocking error with presentation.
 */
export function formatImportLanguageMismatch(_result: ImportLanguageCompatibility): string {
  return "Os lados do pacote não correspondem aos lados da lista escolhida. Revise o mapeamento antes de importar.";
}
