import { buildCompleteAccountGlossaryContract } from "@/features/study/lib/glossaryPromptContracts";

export type GlossarySourceSide = "A" | "B" | "both";

export interface GlossarySourceCard {
  id: string;
  list_id: string;
  term: string;
  translation: string;
  list_title?: string;
  folder_title?: string;
}

export interface GlossaryWordInventoryItem {
  side: "A" | "B";
  text: string;
}

const WORD_TOKEN_REGEX = /[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu;
const cleanInline = (value: string) => value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
const normalizeToken = (value: string) => value.normalize("NFKC").toLocaleLowerCase();

export function filterGlossarySourceCards(cards: readonly GlossarySourceCard[], query: string) {
  const normalizedQuery = cleanInline(query).toLocaleLowerCase();
  if (!normalizedQuery) return cards;
  return cards.filter((card) => [card.term, card.translation, card.list_title, card.folder_title]
    .some((value) => cleanInline(value ?? "").toLocaleLowerCase().includes(normalizedQuery)));
}

export function addGlossaryWordInventory(
  cards: readonly GlossarySourceCard[],
  sourceSide: GlossarySourceSide = "both",
  inventory: Map<string, GlossaryWordInventoryItem> = new Map(),
) {
  const addText = (value: string, side: "A" | "B") => {
    for (const match of cleanInline(value).matchAll(WORD_TOKEN_REGEX)) {
      const text = normalizeToken(match[0]);
      const key = `${side}|${text}`;
      if (!inventory.has(key)) inventory.set(key, { side, text });
    }
  };

  cards.forEach((card) => {
    if (sourceSide === "A" || sourceSide === "both") addText(card.term, "A");
    if (sourceSide === "B" || sourceSide === "both") addText(card.translation, "B");
  });
  return inventory;
}

function sourceLines(cards: readonly GlossarySourceCard[], sourceSide: GlossarySourceSide, startIndex = 0) {
  const lines: string[] = [];
  cards.forEach((card, index) => {
    const term = cleanInline(card.term);
    const translation = cleanInline(card.translation);
    const folder = cleanInline(card.folder_title ?? "");
    const list = cleanInline(card.list_title ?? "");
    const context = [folder ? `PASTA: ${folder}` : "", list ? `LISTA: ${list}` : ""].filter(Boolean).join(" | ");
    const prefix = `[CARD ${startIndex + index + 1}${context ? ` | ${context}` : ""}]`;
    if ((sourceSide === "A" || sourceSide === "both") && term) lines.push(`${prefix}[A] ${term}`);
    if ((sourceSide === "B" || sourceSide === "both") && translation) lines.push(`${prefix}[B] ${translation}`);
  });
  return lines;
}

export function buildGlossaryAiPromptHeader(sourceSide: GlossarySourceSide = "both") {
  return buildCompleteAccountGlossaryContract(sourceSide);
}

export function buildGlossaryAiSourceChunk(cards: readonly GlossarySourceCard[], sourceSide: GlossarySourceSide = "both", startIndex = 0) {
  const lines = sourceLines(cards, sourceSide, startIndex);
  return lines.length ? `${lines.join("\n")}\n` : "";
}

export const GLOSSARY_AI_SOURCE_FOOTER = "=== FIM DO CONTEÚDO-FONTE ===";
export const GLOSSARY_AI_PROMPT_FOOTER = "=== FIM DO INVENTÁRIO OBRIGATÓRIO ===";

export function buildGlossaryWordInventorySection(inventory: Iterable<GlossaryWordInventoryItem>) {
  const items = Array.from(inventory).sort((a, b) => a.side.localeCompare(b.side) || a.text.localeCompare(b.text));
  return `=== INVENTÁRIO OBRIGATÓRIO DE PALAVRAS ÚNICAS ===
TOTAL: ${items.length}
${items.map((item) => `[${item.side}] ${item.text}`).join("\n") || "(vazio)"}
${GLOSSARY_AI_PROMPT_FOOTER}`;
}

export function buildGlossaryAiPromptParts(cards: readonly GlossarySourceCard[], sourceSide: GlossarySourceSide = "both", chunkSize = 1000): BlobPart[] {
  const parts: BlobPart[] = [buildGlossaryAiPromptHeader(sourceSide)];
  for (let index = 0; index < cards.length; index += chunkSize) {
    parts.push(buildGlossaryAiSourceChunk(cards.slice(index, index + chunkSize), sourceSide, index));
  }
  if (cards.length === 0) parts.push("(nenhum conteúdo selecionado)\n");
  parts.push(`${GLOSSARY_AI_SOURCE_FOOTER}\n`);
  parts.push(buildGlossaryWordInventorySection(addGlossaryWordInventory(cards, sourceSide).values()));
  return parts;
}

export function buildGlossaryAiPrompt(cards: readonly GlossarySourceCard[], sourceSide: GlossarySourceSide = "both") {
  return buildGlossaryAiPromptParts(cards, sourceSide).join("");
}
