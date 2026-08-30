import type { SpecialFocusTag } from "@/hooks/useSpecialFlashcards";

export type AttentionPointTag = "orthography" | "recall" | "vocabulary" | "usage" | "other";

export interface AttentionPointToken {
  index: number;
  raw: string;
  value: string;
}
export interface AttentionPointTagOption {
  value: AttentionPointTag;
  label: string;
  specialTag: SpecialFocusTag;
}

/**
 * Keep the product vocabulary small while preserving the existing database
 * enum. `orthography` and `recall` intentionally map to `other` because the
 * current schema has no separate persisted tags for those presentation labels.
 */
export const ATTENTION_POINT_TAGS: readonly AttentionPointTagOption[] = [
  { value: "orthography", label: "Ortografia", specialTag: "other" },
  { value: "recall", label: "Não lembro", specialTag: "other" },
  { value: "vocabulary", label: "Vocabulário", specialTag: "vocabulary" },
  { value: "usage", label: "Uso", specialTag: "natural_usage" },
  { value: "other", label: "Outro", specialTag: "other" },
];

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function tokenValue(raw: string): string {
  return raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "") || raw;
}

export function tokenizeAttentionText(text: string): AttentionPointToken[] {
  const tokens: AttentionPointToken[] = [];
  const pattern = /\S+/gu;
  let match = pattern.exec(text);

  while (match) {
    const raw = match[0];
    tokens.push({
      index: tokens.length,
      raw,
      value: tokenValue(raw),
    });
    match = pattern.exec(text);
  }

  return tokens;
}

/**
 * Suggest one expected token only when expected/typed have the same number of
 * tokens and exactly one normalized token differs. This deliberately avoids
 * guessing through insertion/deletion alignment or NLP.
 */
export function suggestAttentionToken(expected: string, typed: string): number | null {
  const expectedTokens = tokenizeAttentionText(expected);
  const typedTokens = tokenizeAttentionText(typed);
  if (expectedTokens.length === 0 || expectedTokens.length !== typedTokens.length) return null;

  const differences = expectedTokens.reduce<number[]>((indexes, token, index) => {
    if (normalizeToken(token.value) !== normalizeToken(typedTokens[index].value)) indexes.push(index);
    return indexes;
  }, []);

  return differences.length === 1 ? differences[0] : null;
}

export function attentionTagOption(value: AttentionPointTag): AttentionPointTagOption {
  return ATTENTION_POINT_TAGS.find((tag) => tag.value === value) ?? ATTENTION_POINT_TAGS[ATTENTION_POINT_TAGS.length - 1];
}

export function specialTagToAttentionTag(tag: SpecialFocusTag | null | undefined): AttentionPointTag {
  switch (tag) {
    case "vocabulary":
      return "vocabulary";
    case "natural_usage":
      return "usage";
    default:
      return "other";
  }
}
