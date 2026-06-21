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

function directionRule(side: GlossarySourceSide) {
  if (side === "A") return "Use side = \"A\" e traduza A para B.";
  if (side === "B") return "Use side = \"B\" e traduza B para A.";
  return "Analise A e B; não crie pares espelhados duplicados.";
}

export function buildGlossaryAiPromptHeader(sourceSide: GlossarySourceSide = "both") {
  return `Você é o gerador oficial de glossários do App Piteco.

OBJETIVO
Crie um glossário JSON completo a partir de todo o conteúdo-fonte, mesmo com dezenas de milhares de cards.

DIREÇÃO
${directionRule(sourceSide)}
O glossário funciona nos dois sentidos durante o estudo.

COBERTURA OBRIGATÓRIA
- No fim haverá um INVENTÁRIO OBRIGATÓRIO DE PALAVRAS ÚNICAS.
- Crie uma entrada individual para cada item do inventário, incluindo artigos, preposições, pronomes, auxiliares e palavras comuns.
- Uma palavra repetida muitas vezes deve aparecer uma única vez no JSON para aquele lado.
- Chunks são adicionais: nunca substituem as palavras individuais.
- Exemplo: affordable prices exige affordable, prices e também affordable prices quando o chunk for útil.

CHUNKS
- Acrescente phrasal verbs, locuções, expressões e combinações didaticamente úteis.
- Não gere combinações mecânicas sem valor linguístico.

TRADUÇÕES
- Reúna traduções comuns importantes em translated_text, separadas por vírgula.
- Exemplos: am → sou, estou; what → o que, qual; take → pegar, levar.
- Use note apenas quando realmente ajudar; caso contrário, null.
- is_active deve ser true.

SAÍDA
- Entregue somente app-piteco-glossario.json, em JSON UTF-8 válido.
- Não use Markdown, CSV, TXT, JSONL, comentários ou texto externo.
- Use exatamente esta raiz: schema, version, entries.
- schema: \"app-piteco-glossary\"; version: 2.
- Cada entry contém somente original_text, translated_text, note, side e is_active.
- side é \"A\" ou \"B\"; is_active é true.
- Gere o resultado completo, sem cortes ou reticências.

EXEMPLO
{
  \"schema\": \"app-piteco-glossary\",
  \"version\": 2,
  \"entries\": [
    {\"original_text\": \"affordable\", \"translated_text\": \"acessível, com preço razoável\", \"note\": null, \"side\": \"A\", \"is_active\": true},
    {\"original_text\": \"prices\", \"translated_text\": \"preços\", \"note\": null, \"side\": \"A\", \"is_active\": true},
    {\"original_text\": \"affordable prices\", \"translated_text\": \"preços acessíveis\", \"note\": \"chunk\", \"side\": \"A\", \"is_active\": true}
  ]
}

=== CONTEÚDO-FONTE ===
`;
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
