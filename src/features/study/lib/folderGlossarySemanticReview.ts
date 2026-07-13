import { cleanFolderGlossaryText, folderGlossaryIdentity } from "./folderGlossaryCompact";
import type {
  FolderGlossaryCoverageOccurrence,
  FolderGlossaryCoverageReport,
  FolderGlossaryCoverageTerm,
} from "./folderGlossaryCoverage";
import type {
  FolderGlossaryEntry,
  FolderGlossaryInput,
  GlossarySide,
} from "./folderGlossaryTypes";

export const SEMANTIC_REVIEW_SCHEMA = "app-piteco-folder-glossary-semantic-review";
export const SEMANTIC_REVIEW_VERSION = "1.0";
export const SEMANTIC_APPROVAL_THRESHOLD = 0.9;
export const SEMANTIC_WARNING_THRESHOLD = 0.75;

const MAX_EXAMPLES_PER_REVIEW_ENTRY = 12;
const PLACEHOLDER_TEXT = /^(?:[-–—.]+|todo|tbd|n\/?a|null|undefined|translation|tradu[cç][aã]o|preencher|pendente|unknown|desconhecido|não sei)$/iu;

export const SEMANTIC_REVIEW_STATUSES = [
  "approved",
  "approved_with_warning",
  "requires_human_review",
  "conflicting_senses",
  "incorrect",
] as const;

export type SemanticReviewStatus = typeof SEMANTIC_REVIEW_STATUSES[number];

export const SEMANTIC_ISSUE_CODES = [
  "contextual_mismatch",
  "part_of_speech_mismatch",
  "grammatical_form_mismatch",
  "inflection_mismatch",
  "number_mismatch",
  "person_mismatch",
  "tense_aspect_mismatch",
  "register_mismatch",
  "unnatural_target_language",
  "false_friend",
  "excessive_literalness",
  "same_language_risk",
  "conflicting_senses",
  "insufficient_context",
  "incomplete_alternatives",
  "other",
] as const;

export type SemanticIssueCode = typeof SEMANTIC_ISSUE_CODES[number];
export type SemanticEntryKind = "word" | "expression";

export interface SemanticReviewExample {
  list: string;
  side: GlossarySide;
  text: string;
}

export interface SemanticQualityChecks {
  context_match: boolean;
  part_of_speech_match: boolean;
  grammatical_form_match: boolean;
  morphology_preserved: boolean;
  natural_target_language: boolean;
  false_friend_checked: boolean;
  literalness_checked: boolean;
  all_examples_reviewed: boolean;
  same_language_risk: boolean;
  conflicting_senses: boolean;
}

export interface SemanticReviewEntry {
  entry_key: string;
  term: string;
  side: GlossarySide;
  entry_kind: SemanticEntryKind;
  source_language: string;
  target_language: string;
  current_translation: string;
  current_alternatives: string[];
  current_note: string | null;
  translation: string;
  alternatives: string[];
  note: string | null;
  occurrences: number | null;
  examples: SemanticReviewExample[];
  part_of_speech: string;
  grammatical_form: string;
  context_summary: string;
  reviewed_example_indexes: number[];
  evidence_examples: number[];
  semantic_confidence: number;
  ambiguity: boolean;
  review_status: SemanticReviewStatus;
  review_reason: string;
  issues: SemanticIssueCode[];
  quality_checks: SemanticQualityChecks;
  proposal_changed: boolean;
}

export interface SemanticReviewSummary {
  total: number;
  words: number;
  expressions: number;
  approved: number;
  approvedWithWarning: number;
  requiresHumanReview: number;
  conflictingSenses: number;
  incorrect: number;
  pending: number;
  qualityPercent: number;
  qualityLabel: string;
  complete: boolean;
  changedApproved: number;
  changedWarnings: number;
}

export interface SemanticReviewResult {
  auditSignature: string;
  entries: SemanticReviewEntry[];
  summary: SemanticReviewSummary;
}

interface SemanticReviewSourceEntry {
  entry_key: string;
  term: string;
  side: GlossarySide;
  entry_kind: SemanticEntryKind;
  source_language: string;
  target_language: string;
  current_translation: string;
  current_alternatives: string[];
  current_note: string | null;
  occurrences: number | null;
  examples: SemanticReviewExample[];
}

export interface SemanticReviewContext {
  folderId: string;
  folderTitle: string;
  labelA: string;
  labelB: string;
  report: FolderGlossaryCoverageReport;
  glossary: FolderGlossaryEntry[];
}

function sanitizeJsonText(text: string): string {
  const withoutBom = text.replace(/^\uFEFF/u, "").trim();
  const fenced = withoutBom.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  return (fenced?.[1] ?? withoutBom).trim();
}

function parseJsonObject(text: string): Record<string, unknown> {
  const sanitized = sanitizeJsonText(text);
  if (!sanitized) throw new Error("O arquivo de revisão semântica está vazio.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(sanitized) as unknown;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "estrutura inválida";
    throw new Error(`O arquivo de revisão semântica não é um JSON válido: ${detail}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("O arquivo precisa manter o objeto JSON exportado pelo App Piteco.");
  }
  return parsed as Record<string, unknown>;
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") return null;
    const clean = cleanFolderGlossaryText(raw);
    const identity = folderGlossaryIdentity(clean);
    if (!clean || !identity || seen.has(identity)) continue;
    seen.add(identity);
    result.push(clean);
  }
  return result;
}

function parseIndexArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const indexes: number[] = [];
  const seen = new Set<number>();
  for (const raw of value) {
    if (!Number.isInteger(raw) || Number(raw) < 0) return null;
    const index = Number(raw);
    if (seen.has(index)) return null;
    seen.add(index);
    indexes.push(index);
  }
  return indexes.sort((left, right) => left - right);
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function exactObjectKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): string[] {
  const expectedSet = new Set(expected);
  const missing = expected.filter((key) => !(key in value));
  const extras = Object.keys(value).filter((key) => !expectedSet.has(key));
  return [
    ...missing.map((key) => `campo ausente: ${key}`),
    ...extras.map((key) => `campo extra: ${key}`),
  ];
}

function meaningfulText(value: unknown, minimumLength: number): string | null {
  if (typeof value !== "string") return null;
  const clean = cleanFolderGlossaryText(value);
  if (clean.length < minimumLength || PLACEHOLDER_TEXT.test(clean)) return null;
  return clean;
}

function collectEntryExamples(
  entry: FolderGlossaryEntry,
  report: FolderGlossaryCoverageReport,
): SemanticReviewExample[] {
  const entryIdentity = folderGlossaryIdentity(entry.original_text);
  const examples = new Map<string, SemanticReviewExample>();

  for (const term of report.terms) {
    if (term.side !== entry.side) continue;
    const exact = term.normalized === entryIdentity;
    const related = term.matchedGlossaryTerms.some(
      (match) => folderGlossaryIdentity(match) === entryIdentity,
    );
    if (!exact && !related) continue;

    for (const example of term.examples) {
      const key = `${example.cardId}|${example.side}|${example.text}`;
      if (!examples.has(key)) {
        examples.set(key, {
          list: example.listTitle,
          side: example.side,
          text: example.text,
        });
      }
      if (examples.size >= MAX_EXAMPLES_PER_REVIEW_ENTRY) break;
    }
    if (examples.size >= MAX_EXAMPLES_PER_REVIEW_ENTRY) break;
  }

  return Array.from(examples.values());
}

function exactTermForEntry(
  entry: FolderGlossaryEntry,
  report: FolderGlossaryCoverageReport,
): FolderGlossaryCoverageTerm | undefined {
  const identity = folderGlossaryIdentity(entry.original_text);
  return report.terms.find((term) => term.side === entry.side && term.normalized === identity);
}

function semanticEntryKey(side: GlossarySide, term: string): string {
  return `${side}|${folderGlossaryIdentity(term)}`;
}

function buildSemanticReviewSources(input: SemanticReviewContext): SemanticReviewSourceEntry[] {
  const pending = input.report.terms.filter((term) => term.status !== "covered");
  if (pending.length > 0) {
    throw new Error(
      `Complete primeiro a cobertura exata. Ainda existem ${pending.length.toLocaleString("pt-BR")} palavra(s) sem entrada individual ativa no lado correto.`,
    );
  }

  const usedIds = new Set(input.report.usedGlossaryEntryIds);
  const labels: Record<GlossarySide, string> = {
    A: cleanFolderGlossaryText(input.labelA) || "Lado A",
    B: cleanFolderGlossaryText(input.labelB) || "Lado B",
  };

  const sources = input.glossary
    .filter((entry) => entry.is_active && usedIds.has(entry.id))
    .map((entry): SemanticReviewSourceEntry => {
      const entryKind: SemanticEntryKind = /\s/u.test(entry.original_text.trim())
        ? "expression"
        : "word";
      const exactTerm = exactTermForEntry(entry, input.report);
      return {
        entry_key: semanticEntryKey(entry.side, entry.original_text),
        term: entry.original_text,
        side: entry.side,
        entry_kind: entryKind,
        source_language: cleanFolderGlossaryText(entry.source_language) || labels[entry.side],
        target_language: cleanFolderGlossaryText(entry.target_language)
          || labels[entry.side === "A" ? "B" : "A"],
        current_translation: entry.primary_translation,
        current_alternatives: [...entry.alternative_translations],
        current_note: entry.note,
        occurrences: entryKind === "word" ? exactTerm?.occurrenceCount ?? 0 : null,
        examples: collectEntryExamples(entry, input.report),
      };
    })
    .sort((left, right) => left.side.localeCompare(right.side)
      || left.entry_kind.localeCompare(right.entry_kind)
      || left.term.localeCompare(right.term, undefined, { sensitivity: "base" }));

  const exactSourceKeys = new Set(
    sources.filter((entry) => entry.entry_kind === "word").map((entry) => entry.entry_key),
  );
  const missingExactSources = input.report.terms.filter(
    (term) => !exactSourceKeys.has(`${term.side}|${term.normalized}`),
  );
  if (missingExactSources.length > 0) {
    throw new Error(
      `A auditoria encontrou cobertura exata, mas ${missingExactSources.length.toLocaleString("pt-BR")} palavra(s) não puderam ser vinculadas ao glossário carregado. Reanalise a pasta antes de exportar.`,
    );
  }

  if (sources.length === 0 && input.report.distinctTerms > 0) {
    throw new Error("Nenhuma entrada em uso pôde ser preparada para revisão semântica.");
  }
  return sources;
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function semanticAuditSignature(
  input: SemanticReviewContext,
  sources: SemanticReviewSourceEntry[],
): string {
  const evidence = {
    folder_id: input.folderId,
    folder_name: input.folderTitle,
    side_labels: {
      A: input.labelA,
      B: input.labelB,
    },
    entries: sources,
  };
  return `semantic-v1-${fnv1a32(JSON.stringify(evidence))}`;
}

function buildSemanticReviewerPrompt(input: {
  folderTitle: string;
  labelA: string;
  labelB: string;
}): string {
  return `# REVISOR SEMÂNTICO INDEPENDENTE — APP PITECO

## 1. PAPEL
Você é o revisor semântico independente de um glossário educacional. A tradução atual foi criada por outro processo e deve ser tratada como hipótese não confiável. Não confirme uma tradução por deferência, familiaridade ou aparência plausível. Avalie cada entrada do zero usando o termo exato, a direção de idiomas e todos os exemplos fornecidos.

Pasta: "${input.folderTitle}"
Lado A: "${input.labelA}"
Lado B: "${input.labelB}"

## 2. MISSÃO
Para CADA objeto de entries:
1. examine todos os exemplos;
2. determine o sentido realmente usado;
3. verifique classe gramatical e forma gramatical;
4. compare a tradução atual com o contexto;
5. corrija translation, alternatives e note quando necessário;
6. preencha todos os campos semânticos;
7. atribua um review_status de acordo com as regras abaixo.

A revisão cobre palavras individuais e expressões em uso. Uma expressão não apaga o significado das palavras individuais, e uma palavra isolada não substitui a avaliação da expressão completa.

## 3. CAMPOS IMUTÁVEIS
Não altere, remova, reordene semanticamente nem recrie:
- entry_key;
- term;
- side;
- entry_kind;
- source_language;
- target_language;
- current_translation;
- current_alternatives;
- current_note;
- occurrences;
- examples;
- a quantidade ou a ordem de entries.

## 4. CAMPOS EDITÁVEIS
Você deve preencher ou corrigir:
- translation: melhor tradução principal para os exemplos;
- alternatives: apenas sentidos secundários realmente úteis e compatíveis;
- note: contexto, registro, restrição gramatical ou diferença semântica útil;
- part_of_speech;
- grammatical_form;
- context_summary;
- reviewed_example_indexes;
- evidence_examples;
- semantic_confidence;
- ambiguity;
- review_status;
- review_reason;
- issues;
- quality_checks.

## 5. ORDEM OBRIGATÓRIA DE ANÁLISE
A. Identifique o idioma de origem e o idioma de destino pelo side e pelos campos de idioma.
B. Leia TODOS os examples antes de julgar a tradução.
C. Identifique a classe gramatical no contexto: substantivo, verbo, auxiliar, adjetivo, advérbio, pronome, determinante, preposição, conjunção, numeral, interjeição, partícula, nome próprio ou outra categoria adequada.
D. Registre a forma gramatical concreta: infinitivo, presente, passado, particípio, gerúndio, singular, plural, comparativo, possessivo, contração, expressão fixa ou not_applicable quando a categoria não tiver flexão relevante.
E. Determine se todos os exemplos usam o mesmo sentido. Não misture sentidos incompatíveis em uma única tradução principal.
F. Verifique número, pessoa, tempo, aspecto, voz, grau, modalidade e função sintática quando forem relevantes.
G. Verifique naturalidade no idioma de destino. Uma tradução de dicionário pode estar errada no contexto.
H. Procure falsos cognatos, cognatos enganosos, tradução excessivamente literal, registro inadequado e equivalentes artificiais.
I. Compare palavra e expressão. Não use a tradução de um chunk como se fosse a tradução isolada de cada palavra.
J. Calibre a confiança somente depois de concluir as verificações.

## 6. REGRAS PARA FORMAS FLEXIONADAS
Preserve o valor gramatical da forma encontrada quando o idioma de destino o expressar naturalmente. Exemplos:
- plural não deve virar singular sem justificativa;
- particípio passivo não deve virar infinitivo se isso apagar o uso do card;
- passado não deve virar presente quando o contexto depender do tempo;
- auxiliar não deve receber a tradução lexical de um verbo principal;
- contrações devem ser interpretadas pela função real no exemplo.
Não force uma correspondência morfológica artificial quando o idioma de destino exigir outra estrutura natural. Nesse caso, explique a diferença em note e review_reason.

## 7. PALAVRAS FUNCIONAIS
Artigos, pronomes, determinantes, auxiliares, preposições, conectores e partículas também exigem revisão completa. Não marque approved apenas porque são palavras comuns. Confirme a função contextual e evite traduções genéricas que não expliquem o uso apresentado.

## 8. POLISSEMIA E CONFLITO DE SENTIDOS
- Se todos os exemplos compartilham um sentido principal, use esse sentido em translation e sentidos secundários úteis em alternatives.
- Se os exemplos exigem traduções principais incompatíveis para o mesmo termo, use conflicting_senses.
- Não esconda conflito apenas acumulando muitas alternativas.
- Se o contexto for insuficiente para decidir, use requires_human_review e o issue insufficient_context.

## 9. NATURALIDADE E PRECISÃO
A tradução deve:
- estar no idioma de destino;
- ser natural para um falante competente;
- preservar o sentido e a função do termo;
- evitar definições circulares;
- evitar repetir o termo no idioma de origem como suposta tradução;
- evitar explicações longas em translation; use note para explicações;
- não inventar sentidos ausentes nos exemplos;
- não copiar mecanicamente a tradução atual.

## 10. STATUS PERMITIDOS
approved:
- a proposta final está correta para todos os exemplos;
- semantic_confidence deve ser >= ${SEMANTIC_APPROVAL_THRESHOLD};
- ambiguity deve ser false;
- issues deve estar vazio;
- todos os checks centrais devem estar positivos.

approved_with_warning:
- a proposta final é semanticamente utilizável e segura, mas existe ressalva menor de registro, nuance, alternativa ou escopo;
- semantic_confidence deve ser >= ${SEMANTIC_WARNING_THRESHOLD};
- a ressalva deve aparecer em issues, note e review_reason;
- este status exigirá confirmação humana antes da importação.

requires_human_review:
- contexto insuficiente, baixa confiança, nome próprio duvidoso, empréstimo linguístico, equivalência idêntica entre idiomas ou qualquer caso que não deva ser automatizado.

conflicting_senses:
- os exemplos usam sentidos incompatíveis que não cabem com segurança em uma única tradução principal;
- ambiguity deve ser true;
- quality_checks.conflicting_senses deve ser true;
- issues deve incluir conflicting_senses.

incorrect:
- não foi possível produzir uma proposta segura para aprovação, ou existe erro semântico, gramatical ou de idioma que exige correção humana;
- descreva o erro objetivamente e forneça a melhor proposta disponível sem marcá-la como aprovada.

O review_status avalia a proposta FINAL em translation, não apenas current_translation. Se current_translation estiver errada e você conseguir corrigi-la com alta segurança, corrija translation e use approved. Use incorrect quando a correção ainda não for segura para importação automática.

## 11. CONFIANÇA
semantic_confidence é um número entre 0 e 1:
- 0.95–1.00: evidência direta e sem ambiguidade relevante;
- 0.90–0.94: alta confiança, pequenas limitações não materiais;
- 0.75–0.89: utilizável apenas com ressalva ou revisão humana;
- abaixo de 0.75: não automatize.
Não use confiança alta para compensar falta de evidência.

## 12. EVIDÊNCIAS
- reviewed_example_indexes deve conter TODOS os índices de examples, de 0 até examples.length - 1.
- evidence_examples deve conter ao menos um índice e apontar para os exemplos que sustentam a conclusão.
- Não invente, traduza, reescreva ou remova examples.
- Se examples estiver vazio, use requires_human_review, reviewed_example_indexes e evidence_examples vazios, e issue insufficient_context.

## 13. QUALITY_CHECKS
Preencha todos os booleanos:
- context_match;
- part_of_speech_match;
- grammatical_form_match;
- morphology_preserved;
- natural_target_language;
- false_friend_checked;
- literalness_checked;
- all_examples_reviewed;
- same_language_risk;
- conflicting_senses.

false_friend_checked, literalness_checked e all_examples_reviewed devem ser true em uma revisão concluída, mesmo quando o resultado for incorrect. Os demais campos descrevem o resultado encontrado, não o esforço realizado.

## 14. ISSUES
Use somente os códigos permitidos fornecidos em audit.allowed_issue_codes. Não use other quando houver um código específico. issues deve ser vazio apenas em approved.

## 15. REVIEW_REASON
Forneça uma justificativa curta, verificável e específica. Cite a função gramatical ou o contraste contextual relevante, mas não exponha raciocínio interno detalhado. Não escreva elogios, pedidos de desculpa ou comentários sobre o processo.

## 16. CONTRATO DE SAÍDA
- devolva exatamente um objeto JSON puro e válido;
- não use Markdown, bloco de código, introdução ou conclusão;
- mantenha schema, version, folder, audit, reviewer_prompt e entries;
- mantenha todas as entradas e todos os campos;
- não acrescente campos;
- não use NaN, Infinity, comentários ou reticências;
- não deixe strings obrigatórias vazias;
- não deixe null nos campos que devem ser preenchidos;
- não altere os campos imutáveis.

## 17. CHECKLIST FINAL SILENCIOSO
Antes de responder, confirme:
1. todas as entries foram revisadas;
2. todos os examples foram lidos;
3. cada tradução está no idioma de destino;
4. classe e forma gramatical foram preenchidas;
5. número, pessoa, tempo, aspecto e voz foram verificados quando aplicáveis;
6. falsos cognatos e literalidade foram verificados;
7. conflitos de sentidos não foram escondidos;
8. reviewed_example_indexes contém todos os índices;
9. evidence_examples contém índices válidos;
10. confiança e status obedecem aos limites;
11. campos imutáveis e quantidade foram preservados;
12. a resposta contém somente JSON válido.`;
}

const ENTRY_KEYS = [
  "entry_key",
  "term",
  "side",
  "entry_kind",
  "source_language",
  "target_language",
  "current_translation",
  "current_alternatives",
  "current_note",
  "translation",
  "alternatives",
  "note",
  "occurrences",
  "examples",
  "part_of_speech",
  "grammatical_form",
  "context_summary",
  "reviewed_example_indexes",
  "evidence_examples",
  "semantic_confidence",
  "ambiguity",
  "review_status",
  "review_reason",
  "issues",
  "quality_checks",
] as const;

const QUALITY_CHECK_KEYS = [
  "context_match",
  "part_of_speech_match",
  "grammatical_form_match",
  "morphology_preserved",
  "natural_target_language",
  "false_friend_checked",
  "literalness_checked",
  "all_examples_reviewed",
  "same_language_risk",
  "conflicting_senses",
] as const;

export function serializeSemanticReviewRequest(input: SemanticReviewContext): string {
  const sources = buildSemanticReviewSources(input);
  const signature = semanticAuditSignature(input, sources);
  const wordCount = sources.filter((entry) => entry.entry_kind === "word").length;
  const expressionCount = sources.length - wordCount;

  return JSON.stringify({
    schema: SEMANTIC_REVIEW_SCHEMA,
    version: SEMANTIC_REVIEW_VERSION,
    task: "Revise semanticamente cada tradução em uso antes da importação final.",
    folder: { name: input.folderTitle },
    audit: {
      type: "independent-semantic-quality-review",
      generated_at: new Date().toISOString(),
      signature,
      independent_review_required: true,
      input_translation_is_untrusted: true,
      evidence_scope: "sampled-card-examples",
      expected_entries: sources.length,
      word_entries: wordCount,
      expression_entries: expressionCount,
      side_labels: { A: input.labelA, B: input.labelB },
      thresholds: {
        approved: SEMANTIC_APPROVAL_THRESHOLD,
        approved_with_warning: SEMANTIC_WARNING_THRESHOLD,
      },
      allowed_statuses: SEMANTIC_REVIEW_STATUSES,
      allowed_issue_codes: SEMANTIC_ISSUE_CODES,
      immutable_fields: [
        "entry_key",
        "term",
        "side",
        "entry_kind",
        "source_language",
        "target_language",
        "current_translation",
        "current_alternatives",
        "current_note",
        "occurrences",
        "examples",
      ],
      acceptance_criteria: [
        "entries.length deve ser igual a audit.expected_entries",
        "cada entry_key deve aparecer exatamente uma vez",
        "todos os exemplos devem ser revisados",
        "approved exige confiança >= 0.90, nenhuma ambiguidade e nenhum issue",
        "approved_with_warning exige confiança >= 0.75 e uma ressalva explícita",
        "traduções idênticas ao termo entre idiomas diferentes não podem ser aprovadas automaticamente",
        "campos imutáveis, schema, version e audit.signature devem permanecer intactos",
      ],
    },
    reviewer_prompt: buildSemanticReviewerPrompt({
      folderTitle: input.folderTitle,
      labelA: input.labelA,
      labelB: input.labelB,
    }),
    entries: sources.map((entry) => ({
      ...entry,
      translation: entry.current_translation,
      alternatives: entry.current_alternatives,
      note: entry.current_note,
      part_of_speech: "",
      grammatical_form: "",
      context_summary: "",
      reviewed_example_indexes: [],
      evidence_examples: [],
      semantic_confidence: null,
      ambiguity: null,
      review_status: "",
      review_reason: "",
      issues: [],
      quality_checks: {
        context_match: null,
        part_of_speech_match: null,
        grammatical_form_match: null,
        morphology_preserved: null,
        natural_target_language: null,
        false_friend_checked: null,
        literalness_checked: null,
        all_examples_reviewed: null,
        same_language_risk: null,
        conflicting_senses: null,
      },
    })),
  }, null, 2);
}

function validateQualityChecks(
  raw: unknown,
  position: number,
  problems: string[],
): SemanticQualityChecks | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    problems.push(`entrada ${position}: quality_checks deve ser um objeto completo`);
    return null;
  }
  const row = raw as Record<string, unknown>;
  const keyProblems = exactObjectKeys(row, QUALITY_CHECK_KEYS);
  if (keyProblems.length > 0) {
    problems.push(`entrada ${position}: quality_checks inválido (${keyProblems.join(", ")})`);
    return null;
  }
  if (QUALITY_CHECK_KEYS.some((key) => typeof row[key] !== "boolean")) {
    problems.push(`entrada ${position}: todos os quality_checks devem ser booleanos`);
    return null;
  }
  return row as unknown as SemanticQualityChecks;
}

function validateStatusConsistency(
  entry: Omit<SemanticReviewEntry, "proposal_changed">,
  position: number,
  problems: string[],
) {
  const checks = entry.quality_checks;
  if (!checks.false_friend_checked || !checks.literalness_checked || !checks.all_examples_reviewed) {
    problems.push(`entrada ${position} (${entry.term}): a revisão não confirmou todos os checks de processo`);
  }

  const corePositive = checks.context_match
    && checks.part_of_speech_match
    && checks.grammatical_form_match
    && checks.morphology_preserved
    && checks.natural_target_language
    && !checks.same_language_risk
    && !checks.conflicting_senses;

  if (entry.review_status === "approved") {
    if (entry.semantic_confidence < SEMANTIC_APPROVAL_THRESHOLD) {
      problems.push(`entrada ${position} (${entry.term}): approved exige confiança mínima de ${SEMANTIC_APPROVAL_THRESHOLD}`);
    }
    if (entry.ambiguity || entry.issues.length > 0 || !corePositive) {
      problems.push(`entrada ${position} (${entry.term}): approved não aceita ambiguidade, issues ou checks centrais negativos`);
    }
  }

  if (entry.review_status === "approved_with_warning") {
    if (entry.semantic_confidence < SEMANTIC_WARNING_THRESHOLD) {
      problems.push(`entrada ${position} (${entry.term}): approved_with_warning exige confiança mínima de ${SEMANTIC_WARNING_THRESHOLD}`);
    }
    if (!corePositive) {
      problems.push(`entrada ${position} (${entry.term}): uma ressalva aprovada ainda precisa ser semanticamente segura`);
    }
    if (!entry.ambiguity && entry.issues.length === 0) {
      problems.push(`entrada ${position} (${entry.term}): approved_with_warning precisa explicar ao menos uma ressalva`);
    }
  }

  if (entry.review_status === "conflicting_senses") {
    if (!entry.ambiguity || !checks.conflicting_senses || !entry.issues.includes("conflicting_senses")) {
      problems.push(`entrada ${position} (${entry.term}): conflicting_senses exige ambiguidade e marcações de conflito`);
    }
  }

  if (entry.review_status === "incorrect") {
    if (entry.issues.length === 0 || corePositive) {
      problems.push(`entrada ${position} (${entry.term}): incorrect precisa indicar o erro e ao menos um check central negativo`);
    }
  }

  if (entry.review_status === "requires_human_review") {
    if (entry.issues.length === 0 && !entry.ambiguity && entry.semantic_confidence >= SEMANTIC_APPROVAL_THRESHOLD) {
      problems.push(`entrada ${position} (${entry.term}): requires_human_review precisa declarar a causa da revisão humana`);
    }
  }
}

export function parseSemanticReviewCompletionJson(
  text: string,
  input: SemanticReviewContext,
): SemanticReviewResult {
  const document = parseJsonObject(text);
  const rootProblems = exactObjectKeys(document, [
    "schema",
    "version",
    "task",
    "folder",
    "audit",
    "reviewer_prompt",
    "entries",
  ]);
  if (rootProblems.length > 0) {
    throw new Error(`O contrato raiz da revisão semântica foi alterado: ${rootProblems.join("; ")}.`);
  }
  if (document.schema !== SEMANTIC_REVIEW_SCHEMA) {
    throw new Error("Este não é um arquivo de revisão semântica do App Piteco.");
  }
  if (document.version !== SEMANTIC_REVIEW_VERSION) {
    throw new Error(`Versão incompatível da revisão semântica. Esperado ${SEMANTIC_REVIEW_VERSION}.`);
  }

  const folder = document.folder;
  if (!folder || typeof folder !== "object" || Array.isArray(folder)
    || (folder as Record<string, unknown>).name !== input.folderTitle) {
    throw new Error("O arquivo pertence a outra pasta ou o nome da pasta foi alterado.");
  }

  const sources = buildSemanticReviewSources(input);
  const expectedSignature = semanticAuditSignature(input, sources);
  const audit = document.audit;
  if (!audit || typeof audit !== "object" || Array.isArray(audit)) {
    throw new Error('O arquivo precisa manter o objeto "audit" original.');
  }
  const auditRow = audit as Record<string, unknown>;
  if (auditRow.signature !== expectedSignature) {
    throw new Error("A revisão foi criada para uma versão anterior dos cards ou do glossário. Exporte uma nova revisão semântica.");
  }
  if (auditRow.independent_review_required !== true || auditRow.input_translation_is_untrusted !== true) {
    throw new Error("O contrato de revisão independente foi removido ou alterado.");
  }
  if (Number(auditRow.expected_entries) !== sources.length) {
    throw new Error(`Quantidade da auditoria incompatível. Esperado ${sources.length} entradas.`);
  }

  const rows = document.entries;
  if (!Array.isArray(rows)) {
    throw new Error('O arquivo precisa manter a lista "entries" original.');
  }

  const expectedByKey = new Map(sources.map((entry) => [entry.entry_key, entry]));
  const completedByKey = new Map<string, SemanticReviewEntry>();
  const problems: string[] = [];

  rows.forEach((raw, index) => {
    const position = index + 1;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      problems.push(`entrada ${position}: estrutura inválida`);
      return;
    }
    const row = raw as Record<string, unknown>;
    const keyProblems = exactObjectKeys(row, ENTRY_KEYS);
    if (keyProblems.length > 0) {
      problems.push(`entrada ${position}: contrato alterado (${keyProblems.join(", ")})`);
      return;
    }

    const entryKey = typeof row.entry_key === "string" ? row.entry_key : "";
    const expected = expectedByKey.get(entryKey);
    if (!expected) {
      problems.push(`entrada ${position}: entry_key extra ou alterado (${entryKey || "vazio"})`);
      return;
    }
    if (completedByKey.has(entryKey)) {
      problems.push(`entrada duplicada: ${entryKey}`);
      return;
    }

    const immutablePairs: Array<[string, unknown, unknown]> = [
      ["term", row.term, expected.term],
      ["side", row.side, expected.side],
      ["entry_kind", row.entry_kind, expected.entry_kind],
      ["source_language", row.source_language, expected.source_language],
      ["target_language", row.target_language, expected.target_language],
      ["current_translation", row.current_translation, expected.current_translation],
      ["current_alternatives", row.current_alternatives, expected.current_alternatives],
      ["current_note", row.current_note, expected.current_note],
      ["occurrences", row.occurrences, expected.occurrences],
      ["examples", row.examples, expected.examples],
    ];
    const altered = immutablePairs.find(([, returned, original]) => !sameJsonValue(returned, original));
    if (altered) {
      problems.push(`entrada ${position} (${expected.term}): ${altered[0]} foi alterado`);
      return;
    }

    const alternatives = normalizeStringArray(row.alternatives);
    const translation = meaningfulText(row.translation, 1);
    const partOfSpeech = meaningfulText(row.part_of_speech, 2);
    const grammaticalForm = meaningfulText(row.grammatical_form, 2);
    const contextSummary = meaningfulText(row.context_summary, 12);
    const reviewReason = meaningfulText(row.review_reason, 20);
    if (!translation || PLACEHOLDER_TEXT.test(translation)) {
      problems.push(`entrada ${position} (${expected.term}): translation está vazia ou contém placeholder`);
      return;
    }
    if (!alternatives) {
      problems.push(`entrada ${position} (${expected.term}): alternatives deve ser um array de textos`);
      return;
    }
    if (!partOfSpeech || !grammaticalForm || !contextSummary || !reviewReason) {
      problems.push(`entrada ${position} (${expected.term}): campos semânticos obrigatórios estão vazios ou genéricos`);
      return;
    }

    const note = row.note === null
      ? null
      : typeof row.note === "string"
        ? cleanFolderGlossaryText(row.note) || null
        : undefined;
    if (note === undefined) {
      problems.push(`entrada ${position} (${expected.term}): note deve ser texto ou null`);
      return;
    }

    const reviewedIndexes = parseIndexArray(row.reviewed_example_indexes);
    const evidenceIndexes = parseIndexArray(row.evidence_examples);
    const allExampleIndexes = expected.examples.map((_, exampleIndex) => exampleIndex);
    if (!reviewedIndexes || !sameJsonValue(reviewedIndexes, allExampleIndexes)) {
      problems.push(`entrada ${position} (${expected.term}): reviewed_example_indexes deve conter todos os exemplos`);
      return;
    }
    if (!evidenceIndexes || (expected.examples.length > 0 && evidenceIndexes.length === 0)
      || evidenceIndexes.some((exampleIndex) => exampleIndex >= expected.examples.length)) {
      problems.push(`entrada ${position} (${expected.term}): evidence_examples contém índice inválido ou está vazio`);
      return;
    }

    const confidence = Number(row.semantic_confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      problems.push(`entrada ${position} (${expected.term}): semantic_confidence deve estar entre 0 e 1`);
      return;
    }
    if (typeof row.ambiguity !== "boolean") {
      problems.push(`entrada ${position} (${expected.term}): ambiguity deve ser booleano`);
      return;
    }
    if (typeof row.review_status !== "string"
      || !SEMANTIC_REVIEW_STATUSES.includes(row.review_status as SemanticReviewStatus)) {
      problems.push(`entrada ${position} (${expected.term}): review_status inválido`);
      return;
    }

    const issues = normalizeStringArray(row.issues);
    if (!issues || issues.some((issue) => !SEMANTIC_ISSUE_CODES.includes(issue as SemanticIssueCode))) {
      problems.push(`entrada ${position} (${expected.term}): issues contém código inválido`);
      return;
    }
    const qualityChecks = validateQualityChecks(row.quality_checks, position, problems);
    if (!qualityChecks) return;

    const sourceAndTargetDiffer = folderGlossaryIdentity(expected.source_language)
      !== folderGlossaryIdentity(expected.target_language);
    const sameLanguageProposal = sourceAndTargetDiffer
      && folderGlossaryIdentity(expected.term) === folderGlossaryIdentity(translation);
    if (sameLanguageProposal && (row.review_status === "approved" || row.review_status === "approved_with_warning")) {
      problems.push(`entrada ${position} (${expected.term}): tradução idêntica ao termo entre idiomas diferentes não pode ser aprovada automaticamente`);
      return;
    }
    if (sameLanguageProposal && !qualityChecks.same_language_risk) {
      problems.push(`entrada ${position} (${expected.term}): o risco de tradução no mesmo idioma não foi marcado`);
      return;
    }

    const normalizedInput: FolderGlossaryInput = {
      term: expected.term,
      translation,
      alternatives,
      note,
      side: expected.side,
      source_language: expected.source_language,
      target_language: expected.target_language,
      active: true,
    };

    const baseEntry: Omit<SemanticReviewEntry, "proposal_changed"> = {
      ...expected,
      translation: normalizedInput.translation,
      alternatives: normalizedInput.alternatives ?? [],
      note: normalizedInput.note ?? null,
      part_of_speech: partOfSpeech,
      grammatical_form: grammaticalForm,
      context_summary: contextSummary,
      reviewed_example_indexes: reviewedIndexes,
      evidence_examples: evidenceIndexes,
      semantic_confidence: confidence,
      ambiguity: row.ambiguity,
      review_status: row.review_status as SemanticReviewStatus,
      review_reason: reviewReason,
      issues: issues as SemanticIssueCode[],
      quality_checks: qualityChecks,
    };
    validateStatusConsistency(baseEntry, position, problems);

    completedByKey.set(entryKey, {
      ...baseEntry,
      proposal_changed: folderGlossaryIdentity(baseEntry.translation)
          !== folderGlossaryIdentity(expected.current_translation)
        || !sameJsonValue(baseEntry.alternatives.map(folderGlossaryIdentity), expected.current_alternatives.map(folderGlossaryIdentity))
        || folderGlossaryIdentity(baseEntry.note) !== folderGlossaryIdentity(expected.current_note),
    });
  });

  for (const expected of sources) {
    if (!completedByKey.has(expected.entry_key)) {
      problems.push(`entrada ausente: ${expected.entry_key}`);
    }
  }
  if (rows.length !== sources.length) {
    problems.unshift(`quantidade incorreta: esperado ${sources.length}, recebido ${rows.length}`);
  }

  if (problems.length > 0) {
    const visible = problems.slice(0, 10).join("; ");
    const hidden = Math.max(0, problems.length - 10);
    throw new Error(
      `A revisão semântica não passou na validação. ${visible}${hidden > 0 ? `; e mais ${hidden} problema(s)` : ""}. Corrija o JSON ou exporte uma revisão nova.`,
    );
  }

  const entries = sources.map((source) => completedByKey.get(source.entry_key) as SemanticReviewEntry);
  return {
    auditSignature: expectedSignature,
    entries,
    summary: getSemanticReviewSummary(entries),
  };
}

export function getSemanticReviewSummary(
  entries: SemanticReviewEntry[],
): SemanticReviewSummary {
  const count = (status: SemanticReviewStatus) =>
    entries.filter((entry) => entry.review_status === status).length;
  const total = entries.length;
  const approved = count("approved");
  const approvedWithWarning = count("approved_with_warning");
  const rawPercent = total > 0 ? (approved / total) * 100 : 0;
  const qualityPercent = approved === total && total > 0
    ? 100
    : Math.floor(rawPercent * 10) / 10;

  return {
    total,
    words: entries.filter((entry) => entry.entry_kind === "word").length,
    expressions: entries.filter((entry) => entry.entry_kind === "expression").length,
    approved,
    approvedWithWarning,
    requiresHumanReview: count("requires_human_review"),
    conflictingSenses: count("conflicting_senses"),
    incorrect: count("incorrect"),
    pending: total - approved,
    qualityPercent,
    qualityLabel: qualityPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 }),
    complete: total > 0 && approved === total,
    changedApproved: entries.filter(
      (entry) => entry.review_status === "approved" && entry.proposal_changed,
    ).length,
    changedWarnings: entries.filter(
      (entry) => entry.review_status === "approved_with_warning" && entry.proposal_changed,
    ).length,
  };
}

export function getImportableSemanticEntries(
  result: SemanticReviewResult,
  options: {
    includeApproved?: boolean;
    confirmedWarningKeys?: Iterable<string>;
    excludeKeys?: Iterable<string>;
    changedOnly?: boolean;
  } = {},
): FolderGlossaryInput[] {
  const includeApproved = options.includeApproved ?? true;
  const warningKeys = new Set(options.confirmedWarningKeys ?? []);
  const excluded = new Set(options.excludeKeys ?? []);
  const changedOnly = options.changedOnly ?? true;

  return result.entries
    .filter((entry) => !excluded.has(entry.entry_key))
    .filter((entry) => (includeApproved && entry.review_status === "approved")
      || (entry.review_status === "approved_with_warning" && warningKeys.has(entry.entry_key)))
    .filter((entry) => !changedOnly || entry.proposal_changed)
    .map((entry) => ({
      term: entry.term,
      translation: entry.translation,
      alternatives: entry.alternatives,
      note: entry.note,
      side: entry.side,
      source_language: entry.source_language,
      target_language: entry.target_language,
      active: true,
    }));
}
