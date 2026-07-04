import type { SpecialFlashcardDetail } from "@/hooks/useSpecialFlashcards";
import { chunk } from "./chunking";

export const SPECIAL_CARDS_FORMAT = "ape-special-cards" as const;
export const SPECIAL_EXPLANATIONS_FORMAT = "ape-special-explanations" as const;
export const SPECIAL_SCHEMA_VERSION = 2 as const;
const MANIFEST_STORAGE_KEY = "ape:special-export-manifests:v2";
const MAX_MANIFEST_BYTES = 2_500_000;
const MAX_MANIFESTS = 20;

export interface SpecialExportCard {
  card_ref: string;
  flashcard_id: string;
  term: string;
  translation: string;
  hint: string | null;
  context_tag: string | null;
  example_text: string | null;
  example_translation: string | null;
  is_layer: boolean;
  layer_number: number | null;
  list_title: string | null;
  focus_text: string | null;
  focus_tag: string | null;
  focus_note: string | null;
}

export interface SpecialExportPackage {
  format: typeof SPECIAL_CARDS_FORMAT;
  schema_version: typeof SPECIAL_SCHEMA_VERSION;
  export_id: string;
  batch_index: number;
  batch_count: number;
  card_count: number;
  cards: SpecialExportCard[];
}

export interface StoredSpecialExportManifest extends SpecialExportPackage {
  created_at: string;
  status: "awaiting_import" | "partial" | "completed";
}

export type ExportIdFactory = () => string;

function defaultExportIdFactory(): string {
  const date = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const randomPart = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `exp_${date}_${randomPart}`;
}

function toExportCard(card: SpecialFlashcardDetail, index: number): SpecialExportCard {
  return {
    card_ref: `CARD_${String(index + 1).padStart(3, "0")}`,
    flashcard_id: card.flashcard_id,
    term: card.term,
    translation: card.translation,
    hint: card.hint,
    context_tag: card.context_tag,
    example_text: card.example_text,
    example_translation: card.example_translation,
    is_layer: card.parent_card_id != null || card.layer_index != null,
    layer_number: card.layer_index == null ? null : card.layer_index + 1,
    list_title: card.list_title,
    focus_text: card.focus_text,
    focus_tag: card.focus_tag,
    focus_note: card.focus_note || card.notes || null,
  };
}

export function buildSpecialExportBatches(
  cards: readonly SpecialFlashcardDetail[],
  batchSize: number,
  idFactory: ExportIdFactory = defaultExportIdFactory,
): SpecialExportPackage[] {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("O tamanho do lote deve ser um inteiro positivo.");
  }
  const batches = chunk(cards, batchSize);
  const batchCount = batches.length;
  const rootId = idFactory();

  return batches.map((batch, batchIndex) => ({
    format: SPECIAL_CARDS_FORMAT,
    schema_version: SPECIAL_SCHEMA_VERSION,
    export_id: `${rootId}_b${String(batchIndex + 1).padStart(2, "0")}`,
    batch_index: batchIndex + 1,
    batch_count: batchCount,
    card_count: batch.length,
    cards: batch.map(toExportCard),
  }));
}

export function buildRetryExportPackage(
  manifest: StoredSpecialExportManifest,
  missingFlashcardIds: readonly string[],
  idFactory: ExportIdFactory = defaultExportIdFactory,
): SpecialExportPackage | null {
  const missingSet = new Set(missingFlashcardIds);
  const cards = manifest.cards.filter((card) => missingSet.has(card.flashcard_id));
  if (cards.length === 0) return null;

  return {
    format: SPECIAL_CARDS_FORMAT,
    schema_version: SPECIAL_SCHEMA_VERSION,
    export_id: `${idFactory()}_retry`,
    batch_index: 1,
    batch_count: 1,
    card_count: cards.length,
    cards: cards.map((card, index) => ({
      ...card,
      card_ref: `CARD_${String(index + 1).padStart(3, "0")}`,
    })),
  };
}

export function buildSpecialPrompt(batch: SpecialExportPackage): string {
  return `Você é uma IA especializada em ensino de inglês para brasileiros.

TAREFA
Crie uma explicação didática para CADA card do objeto ENTRADA abaixo.

REGRA DE FOCO PEDAGÓGICO
- Cada card pode conter focus_text, focus_tag e focus_note.
- Se focus_text estiver preenchido, explique obrigatoriamente esse trecho como foco principal. Não escolha outro foco principal.
- Se focus_tag estiver preenchido, use essa categoria para guiar a explicação: gramática, vocabulário, expressão, phrasal verb, pronúncia, tradução, uso natural ou outro.
- Se focus_note estiver preenchido, responda diretamente à dificuldade descrita pelo professor/aluno.
- Comece detailed_explanation exatamente com: Expressão-chave: <trecho exato do foco>
- Se focus_text estiver vazio e term for uma frase completa, aí sim identifique dentro dela a palavra, collocation, phrasal verb ou expressão mais específica e útil para o aluno compreender.
- Não explique a frase inteira palavra por palavra quando existir uma peça-chave mais relevante.
- Se o card já for uma palavra ou expressão curta, use o próprio term como expressão-chave.
- Se is_layer for true, respeite somente o sentido daquela camada.

REGRAS OBRIGATÓRIAS
1. Responda SOMENTE com um único objeto JSON válido. Não use Markdown, crases, comentários ou texto antes/depois.
2. Na resposta, use exatamente:
   - format: "${SPECIAL_EXPLANATIONS_FORMAT}"
   - schema_version: ${SPECIAL_SCHEMA_VERSION}
   - export_id: "${batch.export_id}"
3. Para cada card, copie card_ref e flashcard_id EXATAMENTE como aparecem na entrada. Nunca invente, traduza, encurte ou substitua IDs.
4. Devolva exatamente ${batch.card_count} item(ns), um para cada card, na mesma ordem.
5. Cada item deve conter: card_ref, flashcard_id, detailed_explanation, usage_notes, common_mistakes e examples.
6. examples deve conter exatamente 2 objetos no formato {"en":"...","pt":"..."}.
7. detailed_explanation deve explicar significado, quando usar e diferenças importantes de palavras parecidas.
8. Se for phrasal verb, explique a lógica da construção.
9. Use português simples e útil para aluno brasileiro. Use null apenas quando realmente não houver observação relevante.

FORMATO DA RESPOSTA
{
  "format": "${SPECIAL_EXPLANATIONS_FORMAT}",
  "schema_version": ${SPECIAL_SCHEMA_VERSION},
  "export_id": "${batch.export_id}",
  "items": [
    {
      "card_ref": "copiar exatamente da entrada",
      "flashcard_id": "copiar exatamente da entrada",
      "detailed_explanation": "Expressão-chave: trecho exato do foco\n\nExplicação completa",
      "usage_notes": "observações de uso ou null",
      "common_mistakes": "erros comuns ou null",
      "examples": [
        {"en": "exemplo 1", "pt": "tradução 1"},
        {"en": "exemplo 2", "pt": "tradução 2"}
      ]
    }
  ]
}

ENTRADA
${JSON.stringify(batch, null, 2)}`;
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSpecialExportManifests(
  storage: Storage | null = getBrowserStorage(),
): StoredSpecialExportManifest[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(MANIFEST_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is StoredSpecialExportManifest => (
      item?.format === SPECIAL_CARDS_FORMAT
      && item?.schema_version === SPECIAL_SCHEMA_VERSION
      && typeof item?.export_id === "string"
      && Array.isArray(item?.cards)
    ));
  } catch {
    return [];
  }
}

export function saveSpecialExportManifest(
  batch: SpecialExportPackage,
  storage: Storage | null = getBrowserStorage(),
): StoredSpecialExportManifest | null {
  if (!storage) return null;
  const manifest: StoredSpecialExportManifest = {
    ...batch,
    created_at: new Date().toISOString(),
    status: "awaiting_import",
  };
  const supersededCardIds = new Set(batch.cards.map((card) => card.flashcard_id));
  const previous = loadSpecialExportManifests(storage)
    .filter((item) => item.export_id !== batch.export_id)
    .map((item) => {
      const cards = item.cards.filter((card) => !supersededCardIds.has(card.flashcard_id));
      return cards.length === 0 ? null : { ...item, cards, card_count: cards.length };
    })
    .filter((item): item is StoredSpecialExportManifest => item !== null);
  const next = [manifest, ...previous].slice(0, MAX_MANIFESTS);
  while (next.length > 1 && JSON.stringify(next).length > MAX_MANIFEST_BYTES) {
    next.pop();
  }
  try {
    storage.setItem(MANIFEST_STORAGE_KEY, JSON.stringify(next));
    return manifest;
  } catch {
    return null;
  }
}

export function findSpecialExportManifest(
  exportId: string | undefined,
  storage: Storage | null = getBrowserStorage(),
): StoredSpecialExportManifest | null {
  if (!exportId) return null;
  return loadSpecialExportManifests(storage).find((item) => item.export_id === exportId) ?? null;
}

export function updateSpecialExportManifestStatus(
  exportId: string,
  status: StoredSpecialExportManifest["status"],
  storage: Storage | null = getBrowserStorage(),
): void {
  if (!storage) return;
  const manifests = loadSpecialExportManifests(storage);
  const next = manifests.map((item) => item.export_id === exportId ? { ...item, status } : item);
  try {
    storage.setItem(MANIFEST_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Importação não deve falhar apenas porque o armazenamento local está indisponível.
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }
}
