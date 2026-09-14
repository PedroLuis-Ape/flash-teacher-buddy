/**
 * Inventario da biblioteca: indice compacto, deterministico e cacheavel.
 *
 * Por que existe: a analise precisa comparar o texto com TODA a biblioteca sem
 * transformar isso em N consultas (uma por lista) e sem mandar os cards para o
 * LLM. O inventario e montado com:
 *
 *   1. uma contagem agregada de listas do escopo;
 *   2. uma contagem agregada de cards (head + count);
 *   3. paginas de cards amplas (1000 por request) ordenadas por (created_at, id).
 *
 * Ou seja: o numero de requests cresce com o numero de CARDS / pagina, nunca
 * com o numero de listas. 1000 listas com 10.000 cards custam o mesmo que 5
 * listas com 10.000 cards.
 */

import {
  INVENTORY_VERSION,
  type AnalysisLanguage,
  type InventoryBuildStats,
  type InventoryFilter,
  type VocabularyCardRow,
  type VocabularyDataSource,
  type VocabularyEntry,
  type VocabularyIndex,
  type VocabularyInventory,
} from "./types";
import { normalizeSurface, normalizeTerm, phraseVariants } from "./normalize";
import { lemmaKeys as lemmaKeysFor, phraseLemmaKeys } from "./lemmas";

export const INVENTORY_PAGE_SIZE = 1000;
/** Teto de seguranca: 40 paginas x 1000 = 40.000 cards por inventario. */
export const MAX_INVENTORY_PAGES = 40;
export const MAX_INVENTORY_CARDS = MAX_INVENTORY_PAGES * INVENTORY_PAGE_SIZE;
export const INVENTORY_CACHE_TTL_MS = 60_000;
export const INVENTORY_CACHE_MAX_ENTRIES = 8;

export function emptyVocabularyIndex(): VocabularyIndex {
  return {
    exact: new Map(),
    variant: new Map(),
    lemma: new Map(),
    expression: new Map(),
    expressionLemma: new Map(),
    components: new Map(),
    byTerm: new Map(),
  };
}

function push(index: Map<string, VocabularyEntry[]>, key: string, entry: VocabularyEntry): void {
  if (!key) return;
  const bucket = index.get(key);
  if (bucket) bucket.push(entry);
  else index.set(key, [entry]);
}

function meaningSignature(row: VocabularyCardRow): string {
  return normalizeSurface(row.translation ?? "") + "|" + normalizeSurface(row.context_tag ?? "");
}

export function toVocabularyEntry(row: VocabularyCardRow, language: AnalysisLanguage): VocabularyEntry | null {
  const term = normalizeTerm(row.term ?? "");
  const exactKey = normalizeSurface(row.term ?? "");
  if (!exactKey) return null;
  const keys = exactKey.split(" ").filter(Boolean);
  const isExpression = keys.length > 1;
  return {
    cardId: String(row.id ?? ""),
    term,
    translation: row.translation ? normalizeTerm(row.translation) : undefined,
    hint: row.hint ? normalizeTerm(row.hint) : undefined,
    example: row.example_text ? normalizeTerm(row.example_text) : undefined,
    contextTag: row.context_tag ? normalizeTerm(row.context_tag) : undefined,
    listId: row.list_id,
    exactKey,
    variantKeys: phraseVariants(keys, language),
    lemmaKeys: isExpression ? [] : lemmaKeysFor(exactKey, language),
    tokenCount: keys.length,
    isExpression,
    meaningSignature: meaningSignature(row),
  };
}

/** FNV-1a 32 bits: sem dependencia, estavel entre execucoes e plataformas. */
export function fnv1a(value: string, seed = 0x811c9dc5): string {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Fingerprint de conteudo: muda quando qualquer termo/sentido do inventario muda. */
export function fingerprintEntries(entries: VocabularyEntry[], language: AnalysisLanguage): string {
  const canonical = entries
    .map((entry) => entry.cardId + ":" + entry.exactKey + ":" + entry.meaningSignature)
    .sort()
    .join("\n");
  return (
    "v" +
    INVENTORY_VERSION +
    "-" +
    language +
    "-" +
    fnv1a(canonical) +
    "-" +
    fnv1a(canonical, 0x9e3779b1) +
    "-" +
    entries.length
  );
}

function registerEntry(index: VocabularyIndex, entry: VocabularyEntry, language: AnalysisLanguage): void {
  push(index.exact, entry.exactKey, entry);
  push(index.byTerm, entry.exactKey, entry);
  for (const variant of entry.variantKeys) push(index.variant, variant, entry);
  if (!entry.isExpression) {
    // A propria forma tambem e uma ancora de lema: o card "study" precisa
    // casar "studies" (e o card "run" precisa casar "ran").
    for (const lemma of [entry.exactKey, ...entry.lemmaKeys]) push(index.lemma, lemma, entry);
  } else {
    push(index.expression, entry.exactKey, entry);
    for (const variant of entry.variantKeys) push(index.expression, variant, entry);
    const tokens = entry.exactKey.split(" ");
    for (const key of phraseLemmaKeys(tokens, language)) push(index.expressionLemma, key, entry);
    for (const token of new Set(tokens)) push(index.components, token, entry);
  }
}

/**
 * Constroi o indice em memoria. Funcao pura: mesma entrada -> mesmo indice,
 * mesma ordem de lookup e mesmo fingerprint.
 */
export function buildVocabularyIndex(
  rows: VocabularyCardRow[],
  language: AnalysisLanguage,
): { entries: VocabularyEntry[]; index: VocabularyIndex; fingerprint: string } {
  const entries = rows
    .map((row) => toVocabularyEntry(row, language))
    .filter((entry): entry is VocabularyEntry => entry !== null)
    .sort((left, right) => {
      const leftId = String(left.cardId);
      const rightId = String(right.cardId);
      return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
    });
  const index = emptyVocabularyIndex();
  for (const entry of entries) registerEntry(index, entry, language);
  return { entries, index, fingerprint: fingerprintEntries(entries, language) };
}

export interface BuildInventoryOptions {
  language: AnalysisLanguage;
  filters?: InventoryFilter;
  /** Identificador do dono/escopo (ex.: userId). Isola o cache. */
  cacheKey?: string;
  cacheMode?: "use" | "off" | "refresh";
  now?: () => number;
}

export interface InventoryResult {
  inventory: VocabularyInventory;
  stats: InventoryBuildStats;
  fromCache: boolean;
}

interface CacheEntry {
  inventory: VocabularyInventory;
  expiresAt: number;
}

const inventoryCache = new Map<string, CacheEntry>();

function filterKey(filters: InventoryFilter): string {
  const folders = [...(filters.folderIds ?? [])].map((value) => value.toLowerCase()).sort().join(",");
  const lists = [...(filters.listIds ?? [])].map((value) => value.toLowerCase()).sort().join(",");
  return "f:" + folders + "|l:" + lists;
}

function cacheKeyFor(options: BuildInventoryOptions): string {
  return (
    (options.cacheKey ?? "anonymous") +
    "|" +
    options.language +
    "|" +
    filterKey(options.filters ?? {})
  );
}

/**
 * Invalida o cache do inventario. Qualquer fluxo de escrita (criar/editar/
 * apagar card) deve chamar isto antes da proxima analise.
 */
export function invalidateVocabularyInventory(cacheKey?: string): void {
  if (!cacheKey) {
    inventoryCache.clear();
    return;
  }
  const prefix = cacheKey + "|";
  for (const key of [...inventoryCache.keys()]) {
    if (key.startsWith(prefix)) inventoryCache.delete(key);
  }
}

export function vocabularyInventoryCacheSize(): number {
  return inventoryCache.size;
}

function remember(key: string, inventory: VocabularyInventory, expiresAt: number): void {
  if (inventoryCache.size >= INVENTORY_CACHE_MAX_ENTRIES) {
    const oldest = inventoryCache.keys().next().value;
    if (oldest !== undefined) inventoryCache.delete(oldest);
  }
  inventoryCache.set(key, { inventory, expiresAt });
}

/**
 * Monta (ou reaproveita) o inventario da biblioteca.
 *
 * cacheMode "off" e o modo honesto para testes de conteudo e para qualquer
 * leitura que precise refletir uma escrita imediatamente posterior.
 */
export async function buildVocabularyInventory(
  source: VocabularyDataSource,
  options: BuildInventoryOptions,
): Promise<InventoryResult> {
  const startedAt = Date.now();
  const key = cacheKeyFor(options);
  // Sem cacheKey (dono/escopo), nao existe cache: evita vazar inventario de um
  // dono para outro em qualquer chamada que esqueca a chave.
  const cacheMode = options.cacheKey ? options.cacheMode ?? "use" : "off";
  const now = options.now ?? (() => Date.now());

  if (cacheMode === "use") {
    const cached = inventoryCache.get(key);
    if (cached && cached.expiresAt > now()) {
      return {
        inventory: cached.inventory,
        fromCache: true,
        stats: {
          lists: cached.inventory.lists,
          cardsTotal: cached.inventory.cardsTotal,
          cardsScanned: cached.inventory.cardsScanned,
          pages: cached.inventory.pages,
          queries: 0,
          truncated: cached.inventory.truncated,
          fingerprint: cached.inventory.fingerprint,
          version: cached.inventory.version,
          fromCache: true,
          durationMs: Date.now() - startedAt,
        },
      };
    }
  }

  const queriesBefore = source.queryCount();
  const filters: InventoryFilter = {};
  if (options.filters?.folderIds?.length) {
    filters.folderIds = [...new Set(options.filters.folderIds.map((value) => value.toLowerCase()))].sort();
  }

  let missingListIds: string[] = [];
  if (options.filters?.listIds?.length) {
    const requested = [...new Set(options.filters.listIds.map((value) => value.toLowerCase()))].sort();
    const resolved = await source.resolveListIds(requested);
    missingListIds = resolved.missing;
    filters.listIds = resolved.accessible.length
      ? resolved.accessible
      : ["00000000-0000-4000-8000-000000000000"];
  }

  const [lists, cardsTotal] = await Promise.all([source.countLists(), source.countCards(filters)]);

  const rows: VocabularyCardRow[] = [];
  let pages = 0;
  let offset = 0;
  while (pages < MAX_INVENTORY_PAGES) {
    const batch = await source.readCardPage(filters, { limit: INVENTORY_PAGE_SIZE, offset });
    pages += 1;
    rows.push(...batch);
    offset += batch.length;
    if (batch.length < INVENTORY_PAGE_SIZE) break;
    if (cardsTotal !== null && rows.length >= cardsTotal) break;
    if (rows.length >= MAX_INVENTORY_CARDS) break;
  }

  const scanned = rows.length;
  const truncated = cardsTotal === null ? scanned >= MAX_INVENTORY_CARDS : scanned < cardsTotal;
  const { entries, index, fingerprint } = buildVocabularyIndex(rows, options.language);
  const queries = source.queryCount() - queriesBefore;

  const inventory: VocabularyInventory = {
    version: INVENTORY_VERSION,
    language: options.language,
    fingerprint,
    entries,
    index,
    terms: entries.length,
    expressions: entries.filter((entry) => entry.isExpression).length,
    cardsIndexed: entries.length,
    cardsScanned: scanned,
    cardsTotal,
    lists,
    truncated,
    missingListIds,
    pages,
    queries,
  };

  if (cacheMode !== "off") {
    remember(key, inventory, now() + INVENTORY_CACHE_TTL_MS);
  }

  return {
    inventory,
    fromCache: false,
    stats: {
      lists,
      cardsTotal,
      cardsScanned: scanned,
      pages,
      queries,
      truncated,
      fingerprint,
      version: INVENTORY_VERSION,
      fromCache: false,
      durationMs: Date.now() - startedAt,
    },
  };
}
