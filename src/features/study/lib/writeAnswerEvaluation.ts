/**
 * Avaliação inteligente e determinística de respostas do modo Escrever.
 *
 * Não usa IA externa nem serviços pagos. Executa localmente:
 * - normalização neutra (case, espaços, pontuação leve, parênteses, acentos)
 * - alinhamento token a token via programação dinâmica
 * - classificação em "exact" / "accepted_with_corrections" / "incorrect"
 * - descrição objetiva das diferenças em português
 *
 * Constantes de decisão ficam centralizadas em EVALUATION_THRESHOLDS.
 */

import { levenshtein } from "@/lib/textMatch";
import { stripParentheses } from "@/lib/languageHelpers";
import type { WriteCorrectionMode } from "./writeCorrectionMode";

export type AnswerEvaluationStatus =
  | "exact"
  | "accepted_with_corrections"
  | "incorrect";

export type AnswerDifferenceType =
  | "correct"
  | "typo"
  | "missing"
  | "extra"
  | "replaced";

export interface AnswerDifference {
  type: AnswerDifferenceType;
  expected?: string;
  received?: string;
  expectedIndex?: number;
  receivedIndex?: number;
  /** mensagem legível em português, pronta para exibir */
  message?: string;
}

export interface WriteAnswerEvaluation {
  status: AnswerEvaluationStatus;
  /** true quando deve chamar onCorrect */
  accepted: boolean;
  /** 0..1 — pontuação combinada (palavras + caracteres) */
  accuracy: number;
  /** 0..1 — similaridade de caracteres na frase inteira */
  characterSimilarity: number;
  /** 0..1 — proporção de palavras acertadas (typos contam parcial) */
  wordAccuracy: number;
  /** alternativa aceita mais próxima da resposta do aluno */
  matchedAnswer: string;
  /** operações palavra a palavra, em ordem de leitura */
  differences: AnswerDifference[];
  /** frase curta em português resumindo o resultado */
  summary: string;
}

export const EVALUATION_THRESHOLDS = {
  /** accuracy mínima para aceitar com correções no modo flexível */
  MIN_ACCURACY: 0.85,
  /** wordAccuracy mínima */
  MIN_WORD_ACCURACY: 0.75,
  /** proporção mínima de palavras esperadas presentes */
  MIN_EXPECTED_WORDS_PRESENT: 0.7,
  /** peso das palavras na accuracy final */
  WORD_WEIGHT: 0.65,
  CHAR_WEIGHT: 0.35,
  /** typo dentro de uma palavra: distância <= max(1, ceil(len * this)) */
  TYPO_RATIO: 0.34,
  /** palavras curtas exigem match exato (mais rigor) */
  SHORT_WORD_MAX_LEN: 3,
  /** limite de palavras "problemáticas" em uma resposta aceita */
  MAX_ISSUE_RATIO: 0.35,
} as const;

// ---------- normalização ----------

/** Normalização usada APENAS para comparação. Nunca aplicar ao texto exibido. */
export function normalizeForCompare(input: string): string {
  if (!input || typeof input !== "string") return "";
  return stripParentheses(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokeniza mantendo apenas palavras significativas (após normalização). */
function tokenize(normalized: string): string[] {
  if (!normalized) return [];
  return normalized.split(/\s+/).filter(Boolean);
}

/** Extrai palavras preservando o casing original do texto exibido. */
function tokenizeDisplay(original: string): string[] {
  const stripped = stripParentheses(original);
  return stripped
    .replace(/[.,!?;:]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ---------- comparação de palavras ----------

function wordsAreTypo(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return false;
  const shorter = Math.min(a.length, b.length);
  const longer = Math.max(a.length, b.length);
  // Palavras curtas: exigir match exato — não confundir "is"/"it", "do"/"go", "a"/"I".
  if (shorter <= EVALUATION_THRESHOLDS.SHORT_WORD_MAX_LEN) return false;
  const distance = levenshtein(a, b);
  const maxAllowed = Math.max(1, Math.ceil(longer * EVALUATION_THRESHOLDS.TYPO_RATIO));
  return distance <= maxAllowed;
}

function characterSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// ---------- alinhamento token a token ----------

type Op = "match" | "typo" | "replace" | "insert" | "delete";

interface AlignedOp {
  op: Op;
  expected?: string;
  received?: string;
  expectedIndex?: number;
  receivedIndex?: number;
}

/**
 * Programação dinâmica clássica de edit distance sobre tokens,
 * com custos diferenciados para casar/typo/substituir/inserir/remover.
 */
function alignTokens(
  expectedNorm: string[],
  receivedNorm: string[],
  expectedDisplay: string[],
  receivedDisplay: string[],
): AlignedOp[] {
  const m = expectedNorm.length;
  const n = receivedNorm.length;

  const COST_MATCH = 0;
  const COST_TYPO = 0.4;
  const COST_REPLACE = 1;
  const COST_INDEL = 1;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  const trace: Op[][] = Array.from({ length: m + 1 }, () =>
    new Array<Op>(n + 1).fill("match"),
  );

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i * COST_INDEL;
    trace[i][0] = "delete";
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j * COST_INDEL;
    trace[0][j] = "insert";
  }
  trace[0][0] = "match";

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const e = expectedNorm[i - 1];
      const r = receivedNorm[j - 1];
      let diagCost: number;
      let diagOp: Op;
      if (e === r) {
        diagCost = COST_MATCH;
        diagOp = "match";
      } else if (wordsAreTypo(e, r)) {
        diagCost = COST_TYPO;
        diagOp = "typo";
      } else {
        diagCost = COST_REPLACE;
        diagOp = "replace";
      }
      const diag = dp[i - 1][j - 1] + diagCost;
      const del = dp[i - 1][j] + COST_INDEL; // faltou palavra esperada
      const ins = dp[i][j - 1] + COST_INDEL; // sobrou palavra recebida

      let best = diag;
      let op: Op = diagOp;
      if (del < best) {
        best = del;
        op = "delete";
      }
      if (ins < best) {
        best = ins;
        op = "insert";
      }
      dp[i][j] = best;
      trace[i][j] = op;
    }
  }

  // Backtrace
  const ops: AlignedOp[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    const op = trace[i][j];
    if (op === "match" || op === "typo" || op === "replace") {
      ops.push({
        op,
        expected: expectedDisplay[i - 1] ?? expectedNorm[i - 1],
        received: receivedDisplay[j - 1] ?? receivedNorm[j - 1],
        expectedIndex: i - 1,
        receivedIndex: j - 1,
      });
      i--;
      j--;
    } else if (op === "delete") {
      ops.push({
        op: "delete",
        expected: expectedDisplay[i - 1] ?? expectedNorm[i - 1],
        expectedIndex: i - 1,
      });
      i--;
    } else {
      ops.push({
        op: "insert",
        received: receivedDisplay[j - 1] ?? receivedNorm[j - 1],
        receivedIndex: j - 1,
      });
      j--;
    }
  }

  return ops.reverse();
}

function opToDifference(op: AlignedOp): AnswerDifference {
  switch (op.op) {
    case "match":
      return {
        type: "correct",
        expected: op.expected,
        received: op.received,
        expectedIndex: op.expectedIndex,
        receivedIndex: op.receivedIndex,
      };
    case "typo":
      return {
        type: "typo",
        expected: op.expected,
        received: op.received,
        expectedIndex: op.expectedIndex,
        receivedIndex: op.receivedIndex,
        message: `Você escreveu "${op.received}"; o correto é "${op.expected}".`,
      };
    case "replace":
      return {
        type: "replaced",
        expected: op.expected,
        received: op.received,
        expectedIndex: op.expectedIndex,
        receivedIndex: op.receivedIndex,
        message: `Você escreveu "${op.received}"; a resposta esperada usa "${op.expected}".`,
      };
    case "delete":
      return {
        type: "missing",
        expected: op.expected,
        expectedIndex: op.expectedIndex,
        message: `Faltou a palavra "${op.expected}".`,
      };
    case "insert":
      return {
        type: "extra",
        received: op.received,
        receivedIndex: op.receivedIndex,
        message: `Você adicionou a palavra "${op.received}".`,
      };
  }
}

// ---------- avaliação por alternativa ----------

interface SingleEvaluation extends WriteAnswerEvaluation {
  /** custo do alinhamento, menor é melhor (uso interno) */
  _alignCost: number;
}

function evaluateAgainst(
  userAnswer: string,
  reference: string,
  mode: WriteCorrectionMode,
): SingleEvaluation {
  const userNorm = normalizeForCompare(userAnswer);
  const refNorm = normalizeForCompare(reference);

  const exact = userNorm.length > 0 && userNorm === refNorm;

  const expectedNormTokens = tokenize(refNorm);
  const receivedNormTokens = tokenize(userNorm);
  const expectedDisplayTokens = tokenizeDisplay(reference);
  const receivedDisplayTokens = tokenizeDisplay(userAnswer);

  const aligned = alignTokens(
    expectedNormTokens,
    receivedNormTokens,
    expectedDisplayTokens,
    receivedDisplayTokens,
  );

  const differences = aligned.map(opToDifference);

  const totalExpected = expectedNormTokens.length || 1;
  const matchedCount = aligned.filter((o) => o.op === "match").length;
  const typoCount = aligned.filter((o) => o.op === "typo").length;
  const missingCount = aligned.filter((o) => o.op === "delete").length;
  const extraCount = aligned.filter((o) => o.op === "insert").length;
  const replacedCount = aligned.filter((o) => o.op === "replace").length;

  const wordAccuracy = Math.max(
    0,
    Math.min(
      1,
      (matchedCount + typoCount * 0.7) /
        Math.max(totalExpected, receivedNormTokens.length || 1),
    ),
  );
  const charSim = characterSimilarity(userNorm, refNorm);
  const expectedPresentRatio =
    (matchedCount + typoCount) / Math.max(1, totalExpected);
  const issueRatio =
    (missingCount + extraCount + replacedCount) /
    Math.max(1, totalExpected + extraCount);

  const accuracy =
    wordAccuracy * EVALUATION_THRESHOLDS.WORD_WEIGHT +
    charSim * EVALUATION_THRESHOLDS.CHAR_WEIGHT;

  let status: AnswerEvaluationStatus;
  if (exact) {
    status = "exact";
  } else if (mode === "hard") {
    status = "incorrect";
  } else {
    const withinLimits =
      accuracy >= EVALUATION_THRESHOLDS.MIN_ACCURACY &&
      wordAccuracy >= EVALUATION_THRESHOLDS.MIN_WORD_ACCURACY &&
      expectedPresentRatio >= EVALUATION_THRESHOLDS.MIN_EXPECTED_WORDS_PRESENT &&
      issueRatio <= EVALUATION_THRESHOLDS.MAX_ISSUE_RATIO &&
      // não aceitar respostas muito curtas em relação ao esperado
      receivedNormTokens.length >= Math.ceil(totalExpected * 0.6);
    status = withinLimits ? "accepted_with_corrections" : "incorrect";
  }

  const accepted = status === "exact" || status === "accepted_with_corrections";

  const percent = Math.round(accuracy * 100);
  let summary: string;
  if (status === "exact") {
    summary = "Sua resposta está correta.";
  } else if (status === "accepted_with_corrections") {
    summary = `Você acertou ${percent}% da frase. Veja os pequenos ajustes abaixo.`;
  } else {
    summary = `Você acertou aproximadamente ${percent}% da frase. Veja o que revisar.`;
  }

  // custo bruto para escolher melhor alternativa
  const alignCost = missingCount + extraCount + replacedCount + typoCount * 0.4;

  return {
    status,
    accepted,
    accuracy,
    characterSimilarity: charSim,
    wordAccuracy,
    matchedAnswer: reference,
    differences,
    summary,
    _alignCost: alignCost,
  };
}

// ---------- API pública ----------

export interface EvaluateWriteAnswerInput {
  userAnswer: string;
  correctAnswer: string;
  alternatives?: string[];
  mode: WriteCorrectionMode;
}

export function evaluateWriteAnswer(
  input: EvaluateWriteAnswerInput,
): WriteAnswerEvaluation {
  const { userAnswer, correctAnswer, alternatives = [], mode } = input;
  const references = [correctAnswer, ...alternatives].filter(
    (value, index, arr) => value && arr.indexOf(value) === index,
  );

  if (!userAnswer || !userAnswer.trim()) {
    return {
      status: "incorrect",
      accepted: false,
      accuracy: 0,
      characterSimilarity: 0,
      wordAccuracy: 0,
      matchedAnswer: correctAnswer,
      differences: [],
      summary: "Resposta vazia.",
    };
  }

  if (references.length === 0) {
    return {
      status: "incorrect",
      accepted: false,
      accuracy: 0,
      characterSimilarity: 0,
      wordAccuracy: 0,
      matchedAnswer: correctAnswer,
      differences: [],
      summary: "Sem resposta de referência.",
    };
  }

  const scored = references.map((ref) =>
    evaluateAgainst(userAnswer, ref, mode),
  );

  // 1) prefere exato; 2) prefere aceito; 3) maior accuracy; 4) menor custo
  scored.sort((a, b) => {
    const rank = (s: AnswerEvaluationStatus) =>
      s === "exact" ? 0 : s === "accepted_with_corrections" ? 1 : 2;
    const rankDiff = rank(a.status) - rank(b.status);
    if (rankDiff !== 0) return rankDiff;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    return a._alignCost - b._alignCost;
  });

  const best = scored[0];
  const { _alignCost: _drop, ...publicResult } = best;
  void _drop;
  return publicResult;
}

// ---------- helpers de UI ----------

export function summarizeDifferences(
  differences: AnswerDifference[],
  limit = 5,
): { messages: string[]; hiddenCount: number } {
  const meaningful = differences.filter((d) => d.type !== "correct" && d.message);
  const messages = meaningful.slice(0, limit).map((d) => d.message as string);
  const hiddenCount = Math.max(0, meaningful.length - messages.length);
  return { messages, hiddenCount };
}