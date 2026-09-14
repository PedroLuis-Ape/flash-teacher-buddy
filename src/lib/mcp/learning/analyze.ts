/**
 * Motor de analise: texto -> vocabulario realmente novo.
 *
 * Pipeline (deterministico, sem rede e sem LLM no meio):
 *
 *   1. normalizacao do texto (casefold, pontuacao, contracoes) + tokens;
 *   2. deteccao de idioma (ou idioma explicito);
 *   3. inventario da biblioteca (poucas requests grandes, ver inventory.ts);
 *   4. casamento de EXPRESSOES conhecidas (maior janela primeiro), de modo que
 *      "look after" nunca seja reduzido a "look";
 *   5. descoberta de expressoes provaveis ainda nao cadastradas (phrasal verbs
 *      e o padrao verbo + nome + preposicao);
 *   6. classificacao de cada palavra isolada restante;
 *   7. mesclagem de ocorrencias e separacao em ja conhecido / novo / ambiguo.
 *
 * A tool que usa este motor APENAS analisa: nada aqui cria, edita ou apaga
 * cards. Criacao e outro fluxo, com confirmacao explicita do usuario.
 */

import { McpDomainError } from "../domain/errors";
import { buildVocabularyInventory, type InventoryResult } from "./inventory";
import { lemmaKeys, phraseLemmaKeys } from "./lemmas";
import {
  COMMON_PHRASAL,
  PHRASAL_PARTICLES,
  STRONG_PARTICLES,
  detectLanguage,
  explicitLanguage,
  fallbackLanguage,
  isBasicFunctionWord,
  isBasicFunctionWordInAnyLanguage,
  isBasicMwe,
  isContentToken,
} from "./language";
import { editDistanceAtMost, phraseVariants, sentenceAround, tokenizeText, type TextToken } from "./normalize";
import {
  ANALYSIS_LANGUAGES,
  KNOWN_STATUSES,
  STATUS_PRIORITY,
  emptyStatusCounts,
  type AnalysisLanguage,
  type CandidateMatchRef,
  type CandidateStatus,
  type InventoryFilter,
  type LanguageDetection,
  type TextAnalysisResult,
  type TextAnalysisSummary,
  type VocabularyCandidate,
  type VocabularyDataSource,
  type VocabularyEntry,
  type VocabularyIndex,
  type VocabularyInventory,
} from "./types";

export const MAX_TEXT_CHARS = 20000;
export const MAX_TEXT_TOKENS = 4000;
export const MAX_EXPRESSION_TOKENS = 5;
export const MAX_CANDIDATES = 400;
export const MAX_IGNORED_SAMPLE = 25;
export const MAX_RELATED = 3;
export const MAX_SENSES = 5;
export const MAX_FILTER_IDS = 200;

interface WindowKeys {
  exact: string;
  variants: string[];
}

interface Hit {
  entry: VocabularyEntry;
  tier: "exact" | "variant" | "lemma";
}

interface RawCandidate {
  text: string;
  key: string;
  kind: "word" | "expression";
  status: CandidateStatus;
  reason: string;
  index: number;
  startOffset: number;
  endOffset: number;
  occurrences?: number;
  match?: CandidateMatchRef;
  related?: CandidateMatchRef[];
  senses?: Array<{ card_id: string; translation?: string; context_tag?: string; example?: string }>;
}

interface DiscoveredExpression {
  text: string;
  key: string;
  span: number;
}

export interface AnalyzeTextOptions {
  text: unknown;
  /** Fonte de dados (producao: createSupabaseVocabularySource). */
  source?: VocabularyDataSource;
  /** Inventario ja montado (reuso/teste). Tem precedencia sobre a fonte. */
  inventory?: VocabularyInventory;
  filters?: InventoryFilter;
  language?: unknown;
  ignoreBasicFunctionWords?: unknown;
  cacheKey?: string;
  cacheMode?: "use" | "off" | "refresh";
  scopeName?: "personal" | "institution";
}

function firstIn(map: Map<string, VocabularyEntry[]>, key: string): VocabularyEntry | undefined {
  const bucket = map.get(key);
  return bucket && bucket.length ? bucket[0] : undefined;
}

function refOf(entry: VocabularyEntry, matchKind: CandidateMatchRef["match_kind"], senseCount?: number): CandidateMatchRef {
  return {
    card_id: entry.cardId,
    term: entry.term,
    ...(entry.translation ? { translation: entry.translation } : {}),
    ...(entry.listId ? { list_id: entry.listId } : {}),
    match_kind: matchKind,
    ...(senseCount && senseCount > 1 ? { sense_count: senseCount } : {}),
  };
}

/** Sentidos distintos ja existentes para a mesma forma (homonimos). */
function distinctSenses(index: VocabularyIndex, key: string): VocabularyEntry[] {
  const entries = index.byTerm.get(key) ?? [];
  if (entries.length < 2) return [];
  const signatures = new Set(entries.map((entry) => entry.meaningSignature));
  return signatures.size > 1 ? entries : [];
}

function senseRefs(entries: VocabularyEntry[]): Array<{ card_id: string; translation?: string; context_tag?: string; example?: string }> {
  return entries.slice(0, MAX_SENSES).map((entry) => ({
    card_id: entry.cardId,
    ...(entry.translation ? { translation: entry.translation } : {}),
    ...(entry.contextTag ? { context_tag: entry.contextTag } : {}),
    ...(entry.example ? { example: entry.example.slice(0, 160) } : {}),
  }));
}

function windowKeys(tokens: TextToken[], start: number, length: number, language: AnalysisLanguage): WindowKeys {
  const slice = tokens.slice(start, start + length);
  const keys = slice.map((token) => token.key);
  return { exact: keys.join(" "), variants: phraseVariants(keys, language) };
}

function lookupExpression(keys: WindowKeys, index: VocabularyIndex): Hit | null {
  const exact = firstIn(index.expression, keys.exact);
  if (exact) return { entry: exact, tier: "exact" };
  for (const key of keys.variants) {
    const variant = firstIn(index.expression, key);
    if (variant) return { entry: variant, tier: "variant" };
  }
  const viaVariantKey = firstIn(index.variant, keys.exact);
  if (viaVariantKey && viaVariantKey.isExpression) {
    return { entry: viaVariantKey, tier: "variant" };
  }
  return null;
}

/**
 * Casamento de uma palavra isolada, em ordem de forca de evidencia:
 * exata -> variante (acento/ortografia/contracao) -> lema (flexao).
 */
function lookupWord(keys: WindowKeys, lemmaCandidates: string[], index: VocabularyIndex): Hit | null {
  const exact = firstIn(index.exact, keys.exact);
  if (exact) return { entry: exact, tier: "exact" };
  for (const key of [keys.exact, ...keys.variants]) {
    const variant = firstIn(index.variant, key);
    if (variant) return { entry: variant, tier: "variant" };
  }
  for (const key of keys.variants) {
    const variant = firstIn(index.exact, key);
    if (variant) return { entry: variant, tier: "variant" };
  }
  for (const key of lemmaCandidates) {
    const lemma = firstIn(index.lemma, key);
    if (lemma) return { entry: lemma, tier: "lemma" };
  }
  return null;
}

function nearMissThreshold(length: number): number {
  if (length >= 9) return 2;
  if (length >= 6) return 1;
  return 0;
}

function buildNearMissBuckets(index: VocabularyIndex): Map<string, string[]> {
  const buckets = new Map<string, string[]>();
  for (const key of index.exact.keys()) {
    if (key.includes(" ")) continue;
    const first = key.slice(0, 1);
    const bucket = buckets.get(first);
    if (bucket) bucket.push(key);
    else buckets.set(first, [key]);
  }
  for (const bucket of buckets.values()) bucket.sort();
  return buckets;
}

/**
 * Semelhanca proxima (erro de digitacao). Nunca promove a "conhecido": gera
 * POSSIBLE_DUPLICATE para o agente perguntar ao usuario. Sozinha, "word" e
 * "work" nao devem colidir: por isso o corte por tamanho (>= 6) e a distancia.
 */
function findNearMiss(
  key: string,
  buckets: Map<string, string[]>,
): { key: string; distance: number } | null {
  const threshold = nearMissThreshold(key.length);
  if (threshold === 0) return null;
  const bucket = buckets.get(key.slice(0, 1));
  if (!bucket) return null;
  let best: { key: string; distance: number } | null = null;
  for (const candidate of bucket) {
    if (candidate === key) continue;
    if (Math.abs(candidate.length - key.length) > threshold) continue;
    const distance = editDistanceAtMost(key, candidate, threshold);
    if (distance === null) continue;
    if (!best || distance < best.distance || (distance === best.distance && candidate < best.key)) {
      best = { key: candidate, distance };
    }
  }
  return best;
}

/**
 * Expressao provavel ainda nao cadastrada.
 * Particulas fortes (up/out/over/into...) autorizam a descoberta; particulas
 * fracas (for/to/with/...) exigem a lista curada, o que evita "bank of".
 */
function findExpressionShape(
  tokens: TextToken[],
  start: number,
  consumed: boolean[],
  language: AnalysisLanguage,
): { span: number; key: string } | null {
  const particles = PHRASAL_PARTICLES[language];
  const strong = STRONG_PARTICLES[language];
  const curated = COMMON_PHRASAL[language];
  const total = tokens.length;

  if (start + 2 < total && !consumed[start + 1] && !consumed[start + 2]) {
    const three = tokens[start].key + " " + tokens[start + 1].key + " " + tokens[start + 2].key;
    const particleTail = particles.has(tokens[start + 1].key) && particles.has(tokens[start + 2].key);
    const strongTail = particles.has(tokens[start + 1].key) && strong.has(tokens[start + 2].key);
    // Expressao de tres palavras so entra pela lista curada ou por particula
    // forte: evita "invoice arrived for" e outros falsos positivos.
    if ((curated.has(three) || particleTail || strongTail) && !isBasicMwe(three, language)) {
      return { span: 3, key: three };
    }
  }

  if (start + 1 < total && !consumed[start + 1]) {
    const two = tokens[start].key + " " + tokens[start + 1].key;
    const strongParticle = strong.has(tokens[start + 1].key);
    if ((curated.has(two) || strongParticle) && !isBasicMwe(two, language)) {
      return { span: 2, key: two };
    }
  }

  return null;
}

function mergeCandidates(raw: RawCandidate[], text: string): VocabularyCandidate[] {
  const merged = new Map<string, { candidate: RawCandidate; context: string }>();
  for (const item of raw) {
    const mergeKey = item.kind + "::" + item.key;
    const existing = merged.get(mergeKey);
    if (!existing) {
      merged.set(mergeKey, {
        candidate: { ...item, occurrences: 1 },
        context: sentenceAround(text, item.startOffset, item.endOffset, 200),
      });
      continue;
    }
    const current = existing.candidate;
    current.occurrences = (current.occurrences ?? 1) + 1;
    if (item.index < current.index) {
      current.index = item.index;
      current.text = item.text;
      existing.context = sentenceAround(text, item.startOffset, item.endOffset, 200);
    }
    if (STATUS_PRIORITY[item.status] < STATUS_PRIORITY[current.status]) {
      current.status = item.status;
      current.reason = item.reason;
      if (item.match) current.match = item.match;
      if (item.senses?.length) current.senses = item.senses;
    }
    if (!current.match && item.match) current.match = item.match;
    if (item.related?.length) {
      const combined = [...(current.related ?? []), ...item.related];
      const unique = new Map(combined.map((ref) => [ref.term + "|" + (ref.card_id ?? ""), ref]));
      current.related = [...unique.values()].slice(0, MAX_RELATED);
    }
  }
  return [...merged.values()]
    .map(({ candidate, context }) => ({
      text: candidate.text,
      normalized: candidate.key,
      kind: candidate.kind,
      status: candidate.status,
      occurrences: candidate.occurrences ?? 1,
      first_index: candidate.index,
      reason: candidate.reason,
      ...(candidate.match ? { match: candidate.match } : {}),
      ...(candidate.related?.length ? { related: candidate.related } : {}),
      ...(candidate.senses?.length ? { senses: candidate.senses } : {}),
      context,
    }))
    .sort((left, right) => {
      if (left.first_index !== right.first_index) return left.first_index - right.first_index;
      return left.normalized < right.normalized ? -1 : left.normalized > right.normalized ? 1 : 0;
    });
}

function resolveDetection(rawLanguage: unknown): LanguageDetection | null {
  if (typeof rawLanguage !== "string") return null;
  const candidate = rawLanguage.trim().toLowerCase();
  return (ANALYSIS_LANGUAGES as readonly string[]).includes(candidate)
    ? explicitLanguage(candidate as AnalysisLanguage)
    : null;
}

function analyzeTokens(params: {
  text: string;
  tokens: TextToken[];
  inventory: VocabularyInventory;
  language: AnalysisLanguage;
  ignoreBasic: boolean;
  confidence: "high" | "low";
}): VocabularyCandidate[] {
  const { text, tokens, inventory, language, ignoreBasic, confidence } = params;
  const index = inventory.index;
  const total = tokens.length;
  const consumed = new Array<boolean>(total).fill(false);
  const raw: RawCandidate[] = [];

  // 1) Expressoes conhecidas: maior janela primeiro.
  for (let start = 0; start < total; start += 1) {
    if (consumed[start]) continue;
    const maxLength = Math.min(MAX_EXPRESSION_TOKENS, total - start);
    let found: { entry: VocabularyEntry; tier: Hit["tier"]; span: number } | null = null;
    for (let length = maxLength; length >= 1 && !found; length -= 1) {
      const keys = windowKeys(tokens, start, length, language);
      const direct = lookupExpression(keys, index);
      if (direct) {
        found = { entry: direct.entry, tier: direct.tier, span: length };
        break;
      }
      const lemmaKeysForWindow = phraseLemmaKeys(tokens.slice(start, start + length).map((token) => token.key), language);
      for (const key of lemmaKeysForWindow) {
        const lemma = firstIn(index.expressionLemma, key);
        if (lemma) {
          found = { entry: lemma, tier: "lemma", span: length };
          break;
        }
      }
    }
    if (!found) continue;

    const surface = tokens
      .slice(start, start + found.span)
      .map((token) => token.raw)
      .join(" ");
    const senses = distinctSenses(index, found.entry.exactKey);
    raw.push({
      text: surface,
      key: found.entry.exactKey,
      kind: "expression",
      status: senses.length ? "POSSIBLE_DUPLICATE" : "KNOWN_EXPRESSION",
      reason: senses.length
        ? "existing_senses_differ"
        : found.tier === "lemma"
          ? "expression_lemma"
          : found.tier === "variant"
            ? "expression_variant"
            : "expression_exact",
      index: start,
      startOffset: tokens[start].start,
      endOffset: tokens[start + found.span - 1].end,
      match: refOf(found.entry, found.tier === "lemma" ? "lemma" : found.tier === "variant" ? "variant" : "expression", senses.length),
      ...(senses.length ? { senses: senseRefs(senses) } : {}),
    });
    for (let offset = 0; offset < found.span; offset += 1) consumed[start + offset] = true;
    start += found.span - 1;
  }

  // 2) Expressoes provaveis ainda nao cadastradas.
  const expressionHeads = new Map<number, DiscoveredExpression>();
  for (let start = 0; start < total; start += 1) {
    if (consumed[start]) continue;
    if (!isContentToken(tokens[start], language)) continue;
    const shape = findExpressionShape(tokens, start, consumed, language);
    if (!shape) continue;
    const surface = tokens
      .slice(start, start + shape.span)
      .map((token) => token.raw)
      .join(" ");
    expressionHeads.set(start, { text: surface, key: shape.key, span: shape.span });
    raw.push({
      text: surface,
      key: shape.key,
      kind: "expression",
      status: "NEW",
      reason: shape.span >= 3 ? "phrasal_pattern_three_tokens" : "phrasal_pattern",
      index: start,
      startOffset: tokens[start].start,
      endOffset: tokens[start + shape.span - 1].end,
    });
  }

  // 3) Palavras isoladas.
  const nearMissBuckets = buildNearMissBuckets(index);
  for (let position = 0; position < total; position += 1) {
    if (consumed[position]) continue;
    const token = tokens[position];
    const keys: WindowKeys = { exact: token.key, variants: token.variants };
    const hit = lookupWord(keys, lemmaKeys(token.key, language), index);
    const head = expressionHeads.get(position);
    const base = {
      text: token.raw,
      key: token.key,
      kind: "word" as const,
      index: position,
      startOffset: token.start,
      endOffset: token.end,
    };

    if (hit) {
      const senses = distinctSenses(index, hit.entry.exactKey);
      if (head) {
        raw.push({
          ...base,
          status: "AMBIGUOUS",
          reason: "word_only_inside_expression",
          match: refOf(hit.entry, hit.tier === "lemma" ? "lemma" : hit.tier === "variant" ? "variant" : "exact", senses.length),
          related: [{ term: head.text, match_kind: "none" }],
        });
        continue;
      }
      if (senses.length && hit.tier === "exact") {
        raw.push({
          ...base,
          status: "POSSIBLE_DUPLICATE",
          reason: "existing_senses_differ",
          match: refOf(hit.entry, "exact", senses.length),
          senses: senseRefs(senses),
        });
        continue;
      }
      raw.push({
        ...base,
        status: hit.tier === "lemma" ? "KNOWN_LEMMA" : hit.tier === "variant" ? "KNOWN_VARIANT" : "KNOWN_EXACT",
        reason: hit.tier === "lemma" ? "lemma_match" : hit.tier === "variant" ? "variant_match" : "exact_match",
        match: refOf(hit.entry, hit.tier === "lemma" ? "lemma" : hit.tier === "variant" ? "variant" : "exact"),
      });
      continue;
    }

    if (isBasicFunctionWord(token.key, language)) {
      if (!ignoreBasic) {
        raw.push({ ...base, status: "NEW", reason: "basic_function_word_included" });
      } else if (confidence === "high") {
        raw.push({ ...base, status: "IGNORE_BASIC", reason: "basic_function_word" });
      } else {
        raw.push({ ...base, status: "AMBIGUOUS", reason: "language_uncertain" });
      }
      continue;
    }

    const containing = index.components.get(token.key);
    if (containing?.length) {
      raw.push({
        ...base,
        status: "POSSIBLE_DUPLICATE",
        reason: "term_contained_in_known_expression",
        related: containing.slice(0, MAX_RELATED).map((entry) => refOf(entry, "none")),
      });
      continue;
    }

    const nearMiss = findNearMiss(token.key, nearMissBuckets);
    if (nearMiss) {
      const entry = firstIn(index.exact, nearMiss.key);
      raw.push({
        ...base,
        status: "POSSIBLE_DUPLICATE",
        reason: "near_miss:" + nearMiss.key,
        ...(entry ? { match: refOf(entry, "none") } : {}),
      });
      continue;
    }

    raw.push({
      ...base,
      status: "NEW",
      reason: head ? "part_of_discovered_expression" : "no_match",
      ...(head ? { related: [{ term: head.text, match_kind: "none" as const }] } : {}),
    });
  }

  return mergeCandidates(raw, text);
}

/**
 * Analise principal. Aceita um inventario pronto (testes/reuso) ou uma fonte
 * de dados (producao). Nunca escreve nada.
 */
export async function analyzeTextAgainstLibrary(options: AnalyzeTextOptions): Promise<TextAnalysisResult> {
  const rawText = typeof options.text === "string" ? options.text : "";
  if (!rawText.trim()) {
    throw new McpDomainError("invalid_input", 'O campo "text" precisa conter o texto a analisar.', {
      hint: "Envie pelo menos uma frase em " + ANALYSIS_LANGUAGES.join(" ou ") + ".",
    });
  }
  if (rawText.length > MAX_TEXT_CHARS) {
    throw new McpDomainError(
      "invalid_input",
      "O texto excede o limite de " + MAX_TEXT_CHARS + " caracteres desta analise.",
      { hint: "Divida o texto em partes e analise uma por vez." },
    );
  }

  const filters: InventoryFilter = options.filters ?? {};
  validateFilters(filters);

  const detection =
    resolveDetection(options.language) ?? detectLanguage(tokenizeText(rawText, "en"));
  const language = detection.language;
  const tokens = tokenizeText(rawText, language);
  if (tokens.length > MAX_TEXT_TOKENS) {
    throw new McpDomainError(
      "invalid_input",
      "O texto excede o limite de " + MAX_TEXT_TOKENS + " palavras desta analise.",
      { hint: "Divida o texto em partes e analise uma por vez." },
    );
  }

  let inventory = options.inventory;
  let stats = {
    lists: inventory?.lists ?? null,
    cardsTotal: inventory?.cardsTotal ?? null,
    cardsScanned: inventory?.cardsScanned ?? 0,
    pages: inventory?.pages ?? 0,
    queries: 0,
    truncated: inventory?.truncated ?? false,
    fingerprint: inventory?.fingerprint ?? "",
    version: inventory?.version ?? 0,
    fromCache: false,
    durationMs: 0,
  };

  if (!inventory) {
    if (!options.source) {
      throw new McpDomainError(
        "unavailable",
        "O motor de analise precisa de uma fonte de dados ou de um inventario.",
      );
    }
    const built: InventoryResult = await buildVocabularyInventory(options.source, {
      language,
      filters,
      cacheKey: options.cacheKey,
      cacheMode: options.cacheMode ?? "use",
    });
    inventory = built.inventory;
    stats = built.stats;
  }

  const ignoreBasic = options.ignoreBasicFunctionWords !== false;
  const candidates = analyzeTokens({
    text: rawText,
    tokens,
    inventory,
    language,
    ignoreBasic,
    confidence: detection.confidence,
  });

  const alreadyKnownAll = candidates.filter((candidate) => KNOWN_STATUSES.includes(candidate.status));
  const newAll = candidates.filter((candidate) => candidate.status === "NEW");
  const ambiguousAll = candidates.filter(
    (candidate) => candidate.status === "AMBIGUOUS" || candidate.status === "POSSIBLE_DUPLICATE",
  );
  const ignoredBasic = candidates.filter((candidate) => candidate.status === "IGNORE_BASIC");

  const byStatus = emptyStatusCounts();
  for (const candidate of candidates) byStatus[candidate.status] += 1;

  const notes: string[] = [
    "analyze_text_against_library apenas analisa: nenhum card e criado, editado ou apagado; confirme com o usuario antes de criar qualquer item.",
  ];
  if (byStatus.POSSIBLE_DUPLICATE > 0) {
    notes.push(
      "Existem candidatos que podem duplicar significados ja existentes (sentido diferente para a mesma forma, expressao que contem termo conhecido ou erro de digitacao): confirme o sentido com o usuario.",
    );
  }
  if (byStatus.AMBIGUOUS > 0) {
    notes.push(
      "Existem candidatos ambiguos: palavra conhecida usada apenas dentro de uma expressao nova, ou idioma nao identificado com confianca.",
    );
  }
  if (stats.truncated) {
    notes.push("O inventario atingiu o limite de leitura: a analise cobre apenas os cards lidos.");
  }
  if (detection.confidence === "low") {
    notes.push("Idioma sem evidencia suficiente: informe language explicitamente para uma analise mais estavel.");
  }

  const summary: TextAnalysisSummary = {
    analyzed_language: language,
    language_source: detection.source,
    language_confidence: detection.confidence,
    language_scores: detection.scores,
    input: {
      characters: rawText.length,
      tokens: tokens.length,
      unique_surfaces: candidates.length,
      truncated_input: false,
    },
    library: {
      fingerprint: inventory.fingerprint,
      inventory_version: inventory.version,
      language,
      lists: inventory.lists,
      cards_total: inventory.cardsTotal,
      cards_scanned: inventory.cardsScanned,
      pages: inventory.pages,
      queries: stats.queries,
      from_cache: stats.fromCache,
      build_ms: stats.durationMs,
      truncated: inventory.truncated,
      terms: inventory.terms,
      expressions: inventory.expressions,
      missing_list_ids: inventory.missingListIds,
      folders: [...(filters.folderIds ?? [])].sort(),
      lists_filter: [...(filters.listIds ?? [])].sort(),
    },
    counts: {
      total_candidates: candidates.length,
      known: alreadyKnownAll.length,
      new: newAll.length,
      ambiguous: ambiguousAll.filter((candidate) => candidate.status === "AMBIGUOUS").length,
      possible_duplicate: byStatus.POSSIBLE_DUPLICATE,
      ignored_basic: ignoredBasic.reduce((sum, candidate) => sum + candidate.occurrences, 0),
      ignored_basic_unique: ignoredBasic.length,
      by_status: byStatus,
    },
    ignored_basic_sample: ignoredBasic.slice(0, MAX_IGNORED_SAMPLE).map((candidate) => candidate.normalized),
    truncated: {
      candidates: candidates.length > MAX_CANDIDATES,
      already_known: alreadyKnownAll.length > MAX_CANDIDATES,
      new_vocabulary: newAll.length > MAX_CANDIDATES,
      ambiguous: ambiguousAll.length > MAX_CANDIDATES,
    },
    notes,
  };

  return {
    analyzed_language: language,
    candidates: candidates.slice(0, MAX_CANDIDATES),
    already_known: alreadyKnownAll.slice(0, MAX_CANDIDATES),
    new_vocabulary: newAll.slice(0, MAX_CANDIDATES),
    ambiguous: ambiguousAll.slice(0, MAX_CANDIDATES),
    summary,
  };
}

/** Valida os ids informados sem gerar N consultas: o teto e explicito. */
function validateFilters(filters: InventoryFilter): void {
  for (const [field, values] of [
    ["folder_ids", filters.folderIds],
    ["list_ids", filters.listIds],
  ] as const) {
    if (!values) continue;
    if (!Array.isArray(values)) {
      throw new McpDomainError("invalid_input", 'O campo "' + field + '" precisa ser uma lista de UUIDs.');
    }
    if (values.length > MAX_FILTER_IDS) {
      throw new McpDomainError(
        "invalid_input",
        'O campo "' + field + '" aceita no maximo ' + MAX_FILTER_IDS + " ids por analise.",
        { hint: "Reduza o escopo da analise (por exemplo, uma pasta por vez)." },
      );
    }
  }
}
