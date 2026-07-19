import { z } from "zod";
import type { SpecialFlashcardDetail } from "@/hooks/useSpecialFlashcards";
import type {
  NormalizedSpecialImportItem,
  ReconciledSpecialImportRow,
} from "./parser";
import { chunk } from "./chunking";

export const SPECIAL_V3_INPUT_SCHEMA = "app-piteco-special-cards" as const;
export const SPECIAL_V3_RESULT_SCHEMA = "app-piteco-special-cards-result" as const;
export const SPECIAL_V3_VERSION = "3.0" as const;
const STORAGE_KEY = "app-piteco:special-cards:v3:manifests";
const MAX_MANIFESTS = 30;
const MAX_STORAGE_BYTES = 3_500_000;

export interface SpecialV3SourceSnapshot {
  term: string;
  translation: string;
  hint: string | null;
  context_tag: string | null;
  example_text: string | null;
  example_translation: string | null;
  layer_index: number | null;
  parent_card_id: string | null;
  list_id: string | null;
  focus_text: string | null;
  focus_tag: string | null;
  focus_note: string | null;
}

export interface SpecialV3ExportItem extends SpecialV3SourceSnapshot {
  item_id: string;
  card_id: string;
  source_hash: string;
  list_title: string | null;
}

export interface SpecialV3ExportBatch {
  schema: typeof SPECIAL_V3_INPUT_SCHEMA;
  version: typeof SPECIAL_V3_VERSION;
  export_id: string;
  batch_id: string;
  batch_index: number;
  batch_count: number;
  item_count: number;
  response_language: "pt-BR";
  created_at: string;
  items: SpecialV3ExportItem[];
}

export interface StoredSpecialV3Manifest extends SpecialV3ExportBatch {
  status: "prepared" | "awaiting_import" | "partial" | "completed";
  updated_at: string;
}

export interface SpecialV3CommonMistake {
  mistake: string;
  correction: string;
  explanation: string;
}

export interface SpecialV3ResultItem {
  item_id: string;
  card_id: string;
  source_hash: string;
  detailed_explanation: string;
  usage_notes: string[];
  common_mistakes: SpecialV3CommonMistake[];
}

export interface SpecialV3Result {
  schema: typeof SPECIAL_V3_RESULT_SCHEMA;
  version: typeof SPECIAL_V3_VERSION;
  export_id: string;
  batch_id: string;
  items: SpecialV3ResultItem[];
}

export interface V3NormalizedImportItem extends NormalizedSpecialImportItem {
  item_id: string;
  source_hash: string;
  usage_notes_list: string[];
  common_mistakes_list: SpecialV3CommonMistake[];
}

export interface ReconciledSpecialV3Import {
  rows: ReconciledSpecialImportRow[];
  missing_expected_ids: string[];
  warnings: string[];
  manifest: StoredSpecialV3Manifest;
}

type IdFactory = () => string;

const nonEmptyText = z.string().trim().min(1).max(20_000);
const commonMistakeSchema = z.object({
  mistake: z.string().trim().min(1).max(1_500),
  correction: z.string().trim().min(1).max(1_500),
  explanation: z.string().trim().min(1).max(3_000),
}).strict();

const resultItemSchema = z.object({
  item_id: z.string().uuid(),
  card_id: z.string().uuid(),
  source_hash: z.string().regex(/^sp3_[0-9a-f]{8}$/u),
  detailed_explanation: nonEmptyText,
  usage_notes: z.array(z.string().trim().min(1).max(2_000)).max(5),
  common_mistakes: z.array(commonMistakeSchema).max(5),
}).strict();

const resultSchema = z.object({
  schema: z.literal(SPECIAL_V3_RESULT_SCHEMA),
  version: z.literal(SPECIAL_V3_VERSION),
  export_id: z.string().uuid(),
  batch_id: z.string().uuid(),
  items: z.array(resultItemSchema).min(1).max(5_000),
}).strict();

function normalizeNullable(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function sourceSnapshotFromSpecialCard(card: SpecialFlashcardDetail): SpecialV3SourceSnapshot {
  return {
    term: card.term,
    translation: card.translation,
    hint: normalizeNullable(card.hint),
    context_tag: normalizeNullable(card.context_tag),
    example_text: normalizeNullable(card.example_text),
    example_translation: normalizeNullable(card.example_translation),
    layer_index: card.layer_index ?? null,
    parent_card_id: card.parent_card_id ?? null,
    list_id: card.list_id ?? null,
    focus_text: normalizeNullable(card.focus_text),
    focus_tag: normalizeNullable(card.focus_tag),
    focus_note: normalizeNullable(card.focus_note || card.notes),
  };
}

function stableSourcePayload(snapshot: SpecialV3SourceSnapshot): string {
  return JSON.stringify({
    term: snapshot.term,
    translation: snapshot.translation,
    hint: snapshot.hint,
    context_tag: snapshot.context_tag,
    example_text: snapshot.example_text,
    example_translation: snapshot.example_translation,
    layer_index: snapshot.layer_index,
    parent_card_id: snapshot.parent_card_id,
    list_id: snapshot.list_id,
    focus_text: snapshot.focus_text,
    focus_tag: snapshot.focus_tag,
    focus_note: snapshot.focus_note,
  });
}

export function hashSpecialSource(snapshot: SpecialV3SourceSnapshot): string {
  const input = stableSourcePayload(snapshot);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `sp3_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function fallbackUuid(): string {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function defaultIdFactory(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : fallbackUuid();
}

export function buildSpecialV3Batches(
  cards: readonly SpecialFlashcardDetail[],
  batchSize: number,
  idFactory: IdFactory = defaultIdFactory,
): SpecialV3ExportBatch[] {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("O tamanho do lote deve ser um inteiro positivo.");
  }
  if (cards.length === 0) return [];

  const exportId = idFactory();
  const groups = chunk(cards, batchSize);
  const createdAt = new Date().toISOString();

  return groups.map((group, batchIndex) => ({
    schema: SPECIAL_V3_INPUT_SCHEMA,
    version: SPECIAL_V3_VERSION,
    export_id: exportId,
    batch_id: idFactory(),
    batch_index: batchIndex + 1,
    batch_count: groups.length,
    item_count: group.length,
    response_language: "pt-BR",
    created_at: createdAt,
    items: group.map((card) => {
      const snapshot = sourceSnapshotFromSpecialCard(card);
      return {
        item_id: card.id,
        card_id: card.flashcard_id,
        source_hash: hashSpecialSource(snapshot),
        ...snapshot,
        list_title: card.list_title ?? null,
      };
    }),
  }));
}

export function buildSpecialV3Prompt(batch: SpecialV3ExportBatch): string {
  return `Você é o gerador oficial de explicações dos Cards Especiais do App Piteco.

MISSÃO
Analise TODOS os itens fornecidos na seção DADOS DE ENTRADA e devolva explicações pedagógicas claras, precisas e úteis para estudantes de idiomas.

CONTRATO OBRIGATÓRIO DE SAÍDA
1. Responda com exatamente um objeto JSON puro e válido.
2. Não use Markdown, bloco de código, introdução, conclusão ou texto fora do JSON.
3. Use aspas duplas em todas as chaves e textos.
4. Não use comentários, reticências, campos incompletos nem vírgulas finais.
5. Use exatamente schema = "${SPECIAL_V3_RESULT_SCHEMA}" e version = "${SPECIAL_V3_VERSION}".
6. Copie export_id e batch_id exatamente como recebidos.
7. Produza exatamente ${batch.item_count} item(ns), um para cada item recebido e na mesma ordem.
8. Copie item_id, card_id e source_hash exatamente. Nunca invente, traduza ou altere identificadores.
9. Não devolva term, translation, prompt, observações técnicas ou qualquer chave não prevista no formato.
10. Quando focus_text estiver preenchido, ele é obrigatoriamente o foco principal.
11. Quando focus_tag estiver preenchido, adapte a explicação à categoria indicada.
12. Quando focus_note estiver preenchido, responda diretamente à dúvida descrita.
13. Se o item for uma camada, respeite somente o sentido daquela camada.
14. Responda em português do Brasil, mantendo exemplos no idioma estudado quando necessário.
15. Não invente regras. Diferencie regra geral, uso comum, exceção e contexto quando necessário.

CONTEÚDO DE CADA ITEM
- detailed_explanation: string completa, didática e não vazia. Não repita apenas a tradução.
- usage_notes: lista de zero a cinco strings sobre contexto, registro, combinações naturais ou diferenças importantes.
- common_mistakes: lista de zero a cinco objetos com mistake, correction e explanation.
- Quando não houver observações ou erros relevantes, use uma lista vazia.

FORMATO EXATO DA RESPOSTA
{
  "schema": "${SPECIAL_V3_RESULT_SCHEMA}",
  "version": "${SPECIAL_V3_VERSION}",
  "export_id": "${batch.export_id}",
  "batch_id": "${batch.batch_id}",
  "items": [
    {
      "item_id": "copiar exatamente",
      "card_id": "copiar exatamente",
      "source_hash": "copiar exatamente",
      "detailed_explanation": "Explicação completa.",
      "usage_notes": ["Observação de uso."],
      "common_mistakes": [
        {
          "mistake": "Forma incorreta.",
          "correction": "Forma correta.",
          "explanation": "Motivo da correção."
        }
      ]
    }
  ]
}

VERIFICAÇÃO INTERNA ANTES DE RESPONDER
- Todos os itens foram processados.
- Nenhum identificador foi alterado.
- O JSON é válido.
- Não existe texto fora do JSON.
- Nenhuma chave obrigatória foi omitida.`;
}

export function buildSpecialV3Txt(batch: SpecialV3ExportBatch): string {
  return `APP PITECO — CARDS ESPECIAIS
PROTOCOLO OFICIAL DE EXPLICAÇÕES
VERSÃO: ${SPECIAL_V3_VERSION}

EXPORT_ID: ${batch.export_id}
BATCH_ID: ${batch.batch_id}
LOTE: ${batch.batch_index} de ${batch.batch_count}
QUANTIDADE: ${batch.item_count}
IDIOMA DA RESPOSTA: Português do Brasil

==================================================
INSTRUÇÕES PARA A IA
==================================================

${buildSpecialV3Prompt(batch)}

==================================================
DADOS DE ENTRADA — NÃO ALTERE OS IDENTIFICADORES
==================================================

${JSON.stringify(batch, null, 2)}
`;
}

export function specialV3TxtFilename(batch: SpecialV3ExportBatch): string {
  return `piteco-cards-especiais-lote-${String(batch.batch_index).padStart(2, "0")}-de-${String(batch.batch_count).padStart(2, "0")}.txt`;
}

export function isSpecialV3ExportText(input: string): boolean {
  return input.includes("APP PITECO — CARDS ESPECIAIS")
    || input.includes(`"schema": "${SPECIAL_V3_INPUT_SCHEMA}"`)
    || input.includes(`"schema":"${SPECIAL_V3_INPUT_SCHEMA}"`);
}

export function looksLikeSpecialV3Result(input: string): boolean {
  const trimmed = input.replace(/^\uFEFF/u, "").trim();
  return trimmed.startsWith("{")
    && (trimmed.includes(`"schema": "${SPECIAL_V3_RESULT_SCHEMA}"`)
      || trimmed.includes(`"schema":"${SPECIAL_V3_RESULT_SCHEMA}"`));
}

function describeZodError(error: z.ZodError): string {
  const issues = error.issues.slice(0, 6).map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "raiz";
    return `${path}: ${issue.message}`;
  });
  return `JSON v3 inválido. ${issues.join(" | ")}`;
}

export function parseSpecialV3Result(input: string): SpecialV3Result {
  const trimmed = input.replace(/^\uFEFF/u, "").trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    throw new Error("O retorno v3 precisa ser um objeto JSON puro, sem Markdown ou texto antes/depois.");
  }

  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    throw new Error("O retorno não é um JSON válido. Peça à IA para devolver somente o objeto JSON completo.");
  }

  const parsed = resultSchema.safeParse(value);
  if (!parsed.success) throw new Error(describeZodError(parsed.error));
  return parsed.data;
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSpecialV3Manifests(
  storage: Storage | null = browserStorage(),
): StoredSpecialV3Manifest[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is StoredSpecialV3Manifest => (
      item?.schema === SPECIAL_V3_INPUT_SCHEMA
      && item?.version === SPECIAL_V3_VERSION
      && typeof item?.export_id === "string"
      && typeof item?.batch_id === "string"
      && Array.isArray(item?.items)
    ));
  } catch {
    return [];
  }
}

export function saveSpecialV3Manifest(
  batch: SpecialV3ExportBatch,
  storage: Storage | null = browserStorage(),
): StoredSpecialV3Manifest | null {
  if (!storage) return null;
  const now = new Date().toISOString();
  const manifest: StoredSpecialV3Manifest = {
    ...batch,
    status: "awaiting_import",
    updated_at: now,
  };
  const replacedCardIds = new Set(batch.items.map((item) => item.card_id));
  const previous = loadSpecialV3Manifests(storage)
    .filter((item) => item.batch_id !== batch.batch_id)
    .map((item) => {
      const remaining = item.items.filter((card) => !replacedCardIds.has(card.card_id));
      return {
        ...item,
        items: remaining,
        item_count: remaining.length,
        status: remaining.length === 0 ? "completed" as const : item.status,
      };
    })
    .filter((item) => item.item_count > 0);

  const next = [manifest, ...previous].slice(0, MAX_MANIFESTS);
  while (next.length > 1 && JSON.stringify(next).length > MAX_STORAGE_BYTES) next.pop();
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    return manifest;
  } catch {
    return null;
  }
}

export function findSpecialV3Manifest(
  exportId: string,
  batchId: string,
  storage: Storage | null = browserStorage(),
): StoredSpecialV3Manifest | null {
  return loadSpecialV3Manifests(storage).find((item) => (
    item.export_id === exportId && item.batch_id === batchId
  )) ?? null;
}

export function updateSpecialV3ManifestStatus(
  exportId: string,
  batchId: string,
  status: StoredSpecialV3Manifest["status"],
  storage: Storage | null = browserStorage(),
): void {
  if (!storage) return;
  const now = new Date().toISOString();
  const next = loadSpecialV3Manifests(storage).map((item) => (
    item.export_id === exportId && item.batch_id === batchId
      ? { ...item, status, updated_at: now }
      : item
  ));
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A aplicação no banco não deve falhar por indisponibilidade do armazenamento local.
  }
}

function formatUsageNotes(notes: string[]): string | undefined {
  return notes.length ? notes.map((note) => `• ${note}`).join("\n") : undefined;
}

function formatCommonMistakes(mistakes: SpecialV3CommonMistake[]): string | undefined {
  if (!mistakes.length) return undefined;
  return mistakes.map((mistake, index) => (
    `${index + 1}. Erro: ${mistake.mistake}\nCorreção: ${mistake.correction}\nExplicação: ${mistake.explanation}`
  )).join("\n\n");
}

export function reconcileSpecialV3Result(
  result: SpecialV3Result,
  manifest: StoredSpecialV3Manifest | null,
): ReconciledSpecialV3Import {
  if (!manifest) {
    throw new Error(
      "O lote original não foi encontrado neste dispositivo. Exporte novamente os cards antes de importar, para que os identificadores possam ser conferidos com segurança.",
    );
  }
  if (result.export_id !== manifest.export_id || result.batch_id !== manifest.batch_id) {
    throw new Error("O export_id ou batch_id do JSON não corresponde ao lote exportado.");
  }

  const expectedByItemId = new Map(manifest.items.map((item) => [item.item_id, item]));
  const acceptedItemIds = new Set<string>();
  const acceptedCardIds = new Set<string>();
  const rows: ReconciledSpecialImportRow[] = [];

  result.items.forEach((item, sourceIndex) => {
    const expected = expectedByItemId.get(item.item_id);
    if (!expected) {
      rows.push({
        item: null,
        status: "outside",
        resolved_flashcard_id: item.card_id,
        reason: "O item não pertence ao lote exportado.",
        warnings: [],
      });
      return;
    }
    if (expected.card_id !== item.card_id) {
      rows.push({
        item: null,
        status: "invalid",
        resolved_flashcard_id: item.card_id,
        reason: "item_id e card_id apontam para cards diferentes.",
        warnings: [],
      });
      return;
    }
    if (expected.source_hash !== item.source_hash) {
      rows.push({
        item: null,
        status: "invalid",
        resolved_flashcard_id: item.card_id,
        reason: "A IA alterou o source_hash. O item não será aplicado.",
        warnings: [],
      });
      return;
    }
    if (acceptedItemIds.has(item.item_id) || acceptedCardIds.has(item.card_id)) {
      rows.push({
        item: null,
        status: "duplicate",
        resolved_flashcard_id: item.card_id,
        reason: "O card apareceu mais de uma vez no JSON.",
        warnings: [],
      });
      return;
    }

    acceptedItemIds.add(item.item_id);
    acceptedCardIds.add(item.card_id);
    const normalized: V3NormalizedImportItem = {
      item_id: item.item_id,
      flashcard_id: item.card_id,
      source_hash: item.source_hash,
      card_ref: item.item_id,
      term: expected.term,
      translation: expected.translation,
      detailed_explanation: item.detailed_explanation,
      usage_notes: formatUsageNotes(item.usage_notes),
      common_mistakes: formatCommonMistakes(item.common_mistakes),
      usage_notes_list: item.usage_notes,
      common_mistakes_list: item.common_mistakes,
      warnings: [],
      raw: item,
      source_index: sourceIndex,
    };
    rows.push({
      item: normalized,
      status: "valid",
      resolved_flashcard_id: item.card_id,
      warnings: [],
    });
  });

  const missingExpectedIds = manifest.items
    .filter((item) => !acceptedItemIds.has(item.item_id))
    .map((item) => item.card_id);

  const orderMismatch = result.items.some((item, index) => manifest.items[index]?.item_id !== item.item_id);
  const warnings = [
    `JSON oficial v${SPECIAL_V3_VERSION} detectado: ${result.items.length} item(ns).`,
    ...(orderMismatch ? ["A ordem dos itens foi alterada pela IA; os IDs foram usados para reconciliar com segurança."] : []),
  ];

  return { rows, missing_expected_ids: missingExpectedIds, warnings, manifest };
}

export function buildSpecialV3RetryBatch(
  manifest: StoredSpecialV3Manifest,
  missingCardIds: readonly string[],
  idFactory: IdFactory = defaultIdFactory,
): SpecialV3ExportBatch | null {
  const missing = new Set(missingCardIds);
  const items = manifest.items.filter((item) => missing.has(item.card_id));
  if (!items.length) return null;
  return {
    schema: SPECIAL_V3_INPUT_SCHEMA,
    version: SPECIAL_V3_VERSION,
    export_id: idFactory(),
    batch_id: idFactory(),
    batch_index: 1,
    batch_count: 1,
    item_count: items.length,
    response_language: "pt-BR",
    created_at: new Date().toISOString(),
    items,
  };
}
