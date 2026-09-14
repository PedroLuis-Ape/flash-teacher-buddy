/**
 * Contratos do motor linguistico de analise de texto do MCP do Piteco.
 *
 * O motor responde a uma pergunta de produto: "dado este texto, o que e
 * vocabulario REALMENTE novo para esta biblioteca?". Ele nunca decide sozinho
 * criar cards; ele classifica cada candidato e devolve evidencia para o agente
 * (e para o usuario) decidirem.
 *
 * Camadas:
 *   normalization (surface/variantes/contracoes) -> lemmas -> inventario da
 *   biblioteca -> classificacao de candidatos.
 *
 * Nada aqui acessa Supabase: o acesso a dados entra por VocabularyDataSource.
 */

export const ANALYSIS_LANGUAGES = ["en", "pt"] as const;
export type AnalysisLanguage = (typeof ANALYSIS_LANGUAGES)[number];

/** Versao do formato do inventario (muda quando as chaves/lookup mudam). */
export const INVENTORY_VERSION = 1;

/**
 * Classificacao interna de cada candidato. Todo candidato recebe exatamente um
 * destes rotulos; nenhum rotulo "conhecido" e atribuido sem evidencia de chave.
 */
export const CANDIDATE_STATUSES = [
  "IGNORE_BASIC",
  "KNOWN_EXACT",
  "KNOWN_VARIANT",
  "KNOWN_LEMMA",
  "KNOWN_EXPRESSION",
  "POSSIBLE_DUPLICATE",
  "NEW",
  "AMBIGUOUS",
] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

/** Como a correspondencia foi encontrada. */
export type MatchKind = "exact" | "variant" | "lemma" | "expression" | "none";

export type CandidateKind = "word" | "expression";

/** Projecao minima de um card usada para montar o inventario. */
export interface VocabularyCardRow {
  id: string;
  term: string;
  translation?: string;
  hint?: string;
  example_text?: string;
  context_tag?: string;
  list_id?: string;
  layer_index?: number;
  parent_card_id?: string;
  created_at?: string;
}

export interface InventoryFilter {
  folderIds?: string[];
  listIds?: string[];
}

/**
 * Interface de acesso a dados do motor.
 *
 * O motor e deterministico e testavel sem rede: os testes injetam uma
 * implementacao em memoria. Em producao, createSupabaseVocabularySource()
 * implementa esta interface reutilizando a camada de dominio do MCP
 * (client scoped ao token, escopo, erros traduzidos).
 */
export interface VocabularyDataSource {
  /** Numero de listas ativas no escopo (consulta agregada, 1 request). */
  countLists(): Promise<number | null>;
  /** Resolve quais list_ids informados sao acessiveis (1 request, nao N). */
  resolveListIds(listIds: string[]): Promise<{ accessible: string[]; missing: string[] }>;
  /** Total de cards no escopo/filtros (count agregado, 1 request). */
  countCards(filter: InventoryFilter): Promise<number | null>;
  /** Uma pagina de cards (o tamanho da pagina e decidido pelo inventario). */
  readCardPage(filter: InventoryFilter, page: { limit: number; offset: number }): Promise<VocabularyCardRow[]>;
  /** Requests executados ate agora (observabilidade e testes de escala). */
  queryCount(): number;
}

export interface VocabularyEntry {
  cardId: string;
  term: string;
  translation?: string;
  hint?: string;
  example?: string;
  contextTag?: string;
  listId?: string;
  /** Chave de superficie normalizada (casefold, pontuacao, espacos). */
  exactKey: string;
  /** Chaves equivalentes por variante (acento, ortografia, contracao, hifen). */
  variantKeys: string[];
  /** Lemas de palavras isoladas (vazio para expressoes). */
  lemmaKeys: string[];
  tokenCount: number;
  isExpression: boolean;
  /** Assinatura de significado: traducao + contexto (nao so o termo). */
  meaningSignature: string;
}

export interface VocabularyIndex {
  exact: Map<string, VocabularyEntry[]>;
  variant: Map<string, VocabularyEntry[]>;
  lemma: Map<string, VocabularyEntry[]>;
  expression: Map<string, VocabularyEntry[]>;
  expressionLemma: Map<string, VocabularyEntry[]>;
  /** Token -> expressoes conhecidas que contem esse token. */
  components: Map<string, VocabularyEntry[]>;
  /** Chave exata -> cards com esse termo (para detectar sentidos distintos). */
  byTerm: Map<string, VocabularyEntry[]>;
}

export interface VocabularyInventory {
  version: number;
  language: AnalysisLanguage;
  fingerprint: string;
  entries: VocabularyEntry[];
  index: VocabularyIndex;
  terms: number;
  expressions: number;
  cardsIndexed: number;
  cardsScanned: number;
  cardsTotal: number | null;
  lists: number | null;
  truncated: boolean;
  missingListIds: string[];
  pages: number;
  queries: number;
}

export interface InventoryBuildStats {
  lists: number | null;
  cardsTotal: number | null;
  cardsScanned: number;
  pages: number;
  queries: number;
  truncated: boolean;
  fingerprint: string;
  version: number;
  fromCache: boolean;
  durationMs: number;
}

export interface CandidateMatchRef {
  /** Ausente quando a referencia e uma expressao candidata ainda nao existente. */
  card_id?: string;
  term: string;
  translation?: string;
  list_id?: string;
  match_kind: MatchKind;
  sense_count?: number;
}

export interface CandidateSenseRef {
  card_id: string;
  translation?: string;
  context_tag?: string;
  example?: string;
}

export interface VocabularyCandidate {
  /** Superficie como aparece no texto (primeira ocorrencia). */
  text: string;
  /** Chave normalizada usada na comparacao. */
  normalized: string;
  kind: CandidateKind;
  status: CandidateStatus;
  occurrences: number;
  /** Indice do token de inicio (primeira ocorrencia) no texto analisado. */
  first_index: number;
  reason?: string;
  match?: CandidateMatchRef;
  related?: CandidateMatchRef[];
  /** Sentidos distintos ja existentes (usado em POSSIBLE_DUPLICATE). */
  senses?: CandidateSenseRef[];
  /** Sentenca onde o candidato aparece (evidencia de contexto, limitada). */
  context?: string;
}

export interface LanguageDetection {
  language: AnalysisLanguage;
  source: "explicit" | "detected" | "fallback";
  confidence: "high" | "low";
  scores: Record<AnalysisLanguage, number>;
}

export interface TextAnalysisSummary {
  analyzed_language: AnalysisLanguage;
  language_source: LanguageDetection["source"];
  language_confidence: LanguageDetection["confidence"];
  language_scores: Record<AnalysisLanguage, number>;
  input: {
    characters: number;
    tokens: number;
    unique_surfaces: number;
    truncated_input: boolean;
  };
  library: {
    fingerprint: string;
    inventory_version: number;
    language: AnalysisLanguage;
    lists: number | null;
    cards_total: number | null;
    cards_scanned: number;
    pages: number;
    queries: number;
    from_cache: boolean;
    build_ms: number;
    truncated: boolean;
    terms: number;
    expressions: number;
    missing_list_ids: string[];
    folders: string[];
    lists_filter: string[];
  };
  counts: {
    total_candidates: number;
    known: number;
    new: number;
    ambiguous: number;
    possible_duplicate: number;
    ignored_basic: number;
    ignored_basic_unique: number;
    by_status: Record<CandidateStatus, number>;
  };
  ignored_basic_sample: string[];
  truncated: { candidates: boolean; already_known: boolean; new_vocabulary: boolean; ambiguous: boolean };
  notes: string[];
}

export interface TextAnalysisResult {
  analyzed_language: AnalysisLanguage;
  candidates: VocabularyCandidate[];
  already_known: VocabularyCandidate[];
  new_vocabulary: VocabularyCandidate[];
  ambiguous: VocabularyCandidate[];
  summary: TextAnalysisSummary;
}

export const KNOWN_STATUSES: CandidateStatus[] = [
  "KNOWN_EXACT",
  "KNOWN_VARIANT",
  "KNOWN_LEMMA",
  "KNOWN_EXPRESSION",
];

/** Ordem de forca de evidencia usada ao mesclar ocorrencias do mesmo item. */
export const STATUS_PRIORITY: Record<CandidateStatus, number> = {
  KNOWN_EXACT: 0,
  KNOWN_VARIANT: 1,
  KNOWN_EXPRESSION: 2,
  KNOWN_LEMMA: 3,
  AMBIGUOUS: 4,
  POSSIBLE_DUPLICATE: 5,
  NEW: 6,
  IGNORE_BASIC: 7,
};

export function emptyStatusCounts(): Record<CandidateStatus, number> {
  return {
    IGNORE_BASIC: 0,
    KNOWN_EXACT: 0,
    KNOWN_VARIANT: 0,
    KNOWN_LEMMA: 0,
    KNOWN_EXPRESSION: 0,
    POSSIBLE_DUPLICATE: 0,
    NEW: 0,
    AMBIGUOUS: 0,
  };
}
