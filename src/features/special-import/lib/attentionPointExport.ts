export interface AttentionPointExportCard {
  flashcard_id?: string;
  term: string;
  translation: string;
  list_title?: string | null;
  context_tag?: string | null;
  example_text?: string | null;
  example_translation?: string | null;
  hint?: string | null;
  focus_text?: string | null;
  focus_side?: string | null;
  focus_tag?: string | null;
  focus_note?: string | null;
  notes?: string | null;
  layer_index?: number | null;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function focusLabel(card: AttentionPointExportCard): string {
  const pieces = [clean(card.focus_text)];
  if (clean(card.focus_tag)) pieces.push(`categoria: ${clean(card.focus_tag)}`);
  if (clean(card.focus_side)) pieces.push(`lado: ${clean(card.focus_side)}`);
  if (clean(card.focus_note || card.notes)) pieces.push(`nota: ${clean(card.focus_note || card.notes)}`);
  return pieces.join(" · ");
}

export function buildAttentionPointAiText(cards: AttentionPointExportCard[]): string {
  const items = cards.map((card, index) => {
    const lines = [`${index + 1}. ${clean(card.term)} → ${clean(card.translation)}`];
    if (clean(card.list_title)) lines.push(`Lista: ${clean(card.list_title)}`);
    if (clean(card.context_tag)) lines.push(`Contexto: ${clean(card.context_tag)}`);
    if (focusLabel(card)) lines.push(`Ponto de atenção: ${focusLabel(card)}`);
    if (clean(card.example_text)) lines.push(`Exemplo: ${clean(card.example_text)}`);
    if (clean(card.example_translation)) lines.push(`Tradução do exemplo: ${clean(card.example_translation)}`);
    if (clean(card.hint)) lines.push(`Dica existente: ${clean(card.hint)}`);
    return lines.join("\n");
  });

  return [
    "Explique estes pontos de atenção de forma curta e prática para quem está estudando inglês.",
    "Preserve o sentido do card, destaque a diferença relevante e dê um exemplo quando ajudar.",
    "",
    ...items,
  ].join("\n\n");
}

export function buildAttentionPointWordsText(cards: AttentionPointExportCard[]): string {
  return Array.from(new Set(cards.map((card) => clean(card.term)).filter(Boolean))).join("\n");
}

export function buildAttentionPointContextText(cards: AttentionPointExportCard[]): string {
  return cards.map((card) => {
    const context = [clean(card.example_text), clean(card.example_translation)].filter(Boolean).join(" — ");
    return context ? `${clean(card.term)} → ${context}` : clean(card.term);
  }).filter(Boolean).join("\n");
}

export function buildAttentionPointJson(cards: AttentionPointExportCard[]): string {
  return JSON.stringify({
    schema: "app-piteco-attention-points",
    version: 1,
    items: cards.map((card) => ({
      flashcard_id: card.flashcard_id ?? null,
      term: clean(card.term),
      translation: clean(card.translation),
      list_title: card.list_title ?? null,
      context_tag: card.context_tag ?? null,
      example_text: card.example_text ?? null,
      example_translation: card.example_translation ?? null,
      hint: card.hint ?? null,
      layer_index: card.layer_index ?? null,
      focus_text: card.focus_text ?? null,
      focus_side: card.focus_side ?? null,
      focus_tag: card.focus_tag ?? null,
      focus_note: card.focus_note ?? card.notes ?? null,
    })),
  }, null, 2);
}
