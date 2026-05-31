// Bulk import utilities for flashcards - Language Agnostic
// Format: SIDE_A / SIDE_B (short observation) [detailed hint]

import { FEATURE_FLAGS } from "@/lib/featureFlags";

/**
 * Strip common AI formatting artifacts from a line:
 * - Leading numbering: "1. ", "2) ", "01 - ", "- ", "• "
 * - Markdown bold/italic: **text** → text, *text* → text
 */
function stripAIArtifacts(line: string): string {
  return line
    .replace(/^\d{1,3}[\.\)]\s+/, '')
    .replace(/^\d{1,3}\s*[-–—]\s+/, '')
    .replace(/^[-•]\s+/, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

export type FlashcardPair = {
  sideA: string;
  sideB?: string;
  shortObservation?: string;
  detailedHint?: string;
  // Legacy support
  en?: string;
  pt?: string;
};

/**
 * Normalize multi-line input by joining lines that belong to the same card.
 * Handles cases where [ ] or ( ) start on a new line or contain line breaks.
 */
function normalizeInputLines(input: string): string[] {
  const rawLines = input.split(/\r?\n/);
  const mergedLines: string[] = [];
  let currentBuffer = '';
  let openBrackets = 0; // Balance of [ ]
  let openParens = 0;   // Balance of ( )

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Count opening/closing delimiters in this line
    const bracketsDelta = (trimmed.match(/\[/g) || []).length - (trimmed.match(/\]/g) || []).length;
    const parensDelta = (trimmed.match(/\(/g) || []).length - (trimmed.match(/\)/g) || []).length;

    // CONTINUATION LOGIC:
    // A line is continuation of the previous if:
    // 1. We're inside an open block (brackets > 0 or parens > 0)
    // 2. OR the line starts with [ or ( (indicating metadata of the previous card)
    const isContinuation = 
      openBrackets > 0 || 
      openParens > 0 || 
      trimmed.startsWith('[') || 
      trimmed.startsWith('(');

    if (isContinuation && currentBuffer) {
      // Join with \n to preserve formatting inside hints
      currentBuffer += '\n' + trimmed;
    } else {
      // Not continuation: save previous buffer and start new one
      if (currentBuffer) {
        mergedLines.push(currentBuffer);
      }
      currentBuffer = trimmed;
    }

    // Update balance of open delimiters
    openBrackets += bracketsDelta;
    openParens += parensDelta;
  }

  // Push the last buffer
  if (currentBuffer) {
    mergedLines.push(currentBuffer);
  }

  return mergedLines;
}

/**
 * Extract content from brackets [detailed hint] - parsing from right to left
 * Returns the extracted text and the remaining string
 */
function extractBrackets(text: string): { extracted: string; remaining: string } {
  // Find the last [...] pattern
  const lastOpenBracket = text.lastIndexOf('[');
  const lastCloseBracket = text.lastIndexOf(']');
  
  if (lastOpenBracket !== -1 && lastCloseBracket > lastOpenBracket) {
    const extracted = text.substring(lastOpenBracket + 1, lastCloseBracket).trim();
    const remaining = (text.substring(0, lastOpenBracket) + text.substring(lastCloseBracket + 1)).trim();
    return { extracted, remaining };
  }
  
  return { extracted: '', remaining: text };
}

/**
 * Extract content from parentheses (short observation) - parsing from right to left
 * Returns the extracted text and the remaining string
 */
function extractParentheses(text: string): { extracted: string; remaining: string } {
  // Find the last (...) pattern that's NOT part of a word
  // e.g., "I am happy (very)" should extract "very", but "I am (happy)" too
  const lastOpenParen = text.lastIndexOf('(');
  const lastCloseParen = text.lastIndexOf(')');
  
  if (lastOpenParen !== -1 && lastCloseParen > lastOpenParen) {
    const extracted = text.substring(lastOpenParen + 1, lastCloseParen).trim();
    const remaining = (text.substring(0, lastOpenParen) + text.substring(lastCloseParen + 1)).trim();
    return { extracted, remaining };
  }
  
  return { extracted: '', remaining: text };
}

/**
 * Find the best separator index in a line.
 * Prefers " / " (space-slash-space) to avoid splitting on slashes inside URLs or paths.
 * Falls back to first "/" only if no spaced version is found.
 */
function findSeparatorIndex(line: string): { index: number; length: number } {
  // Prefer " / " — the canonical format
  const spacedIdx = line.indexOf(' / ');
  if (spacedIdx > 0) return { index: spacedIdx, length: 3 };

  // Fallback: first "/" not inside a URL-like pattern
  const slashIdx = line.indexOf('/');
  if (slashIdx > 0) {
    // Reject if it looks like a URL (preceded by ":" or "//")
    const before = line.substring(0, slashIdx);
    if (before.endsWith(':') || before.endsWith('/')) {
      return { index: -1, length: 0 };
    }
    return { index: slashIdx, length: 1 };
  }

  return { index: -1, length: 0 };
}

/**
 * V2 — Tolerant separator detection.
 *
 * Tries, in priority order, separators surrounded by whitespace:
 *   " / " → " | " → " => " → " — " → " – " → " - " → "\t"
 *
 * Whitespace requirement avoids splitting on hyphens inside words
 * ("self-care") or pipes inside table syntax fragments.
 *
 * Falls back to legacy `findSeparatorIndex` (single "/") if nothing else
 * matches, so behavior is a strict superset of v1.
 *
 * Pure function — no side effects, safe to enable/disable at any time.
 */
const V2_SEPARATORS: ReadonlyArray<{ token: string; length: number }> = [
  { token: ' / ',  length: 3 },
  { token: ' | ',  length: 3 },
  { token: ' => ', length: 4 },
  { token: ' — ',  length: 3 }, // em-dash
  { token: ' – ',  length: 3 }, // en-dash
  { token: ' - ',  length: 3 },
  { token: '\t',   length: 1 },
];

export function findSeparatorIndexV2(line: string): { index: number; length: number } {
  for (const { token, length } of V2_SEPARATORS) {
    const idx = line.indexOf(token);
    if (idx > 0) return { index: idx, length };
  }
  // Fallback to legacy detector (handles bare "/" with URL guard).
  return findSeparatorIndex(line);
}

export function parsePastedFlashcards(input: string): FlashcardPair[] {
  const lines = normalizeInputLines(input);
  const results: FlashcardPair[] = [];

  const detect = FEATURE_FLAGS.bulk_import_v2 ? findSeparatorIndexV2 : findSeparatorIndex;

  for (const rawLine of lines) {
    if (!rawLine) continue;
    const line = stripAIArtifacts(rawLine);
    if (!line) continue;

    const sep = detect(line);
    
    if (sep.index > 0) {
      const sideA = line.substring(0, sep.index).trim();
      const rest = line.substring(sep.index + sep.length).trim();
      
      const { extracted: detailedHint, remaining: afterBrackets } = extractBrackets(rest);
      const { extracted: shortObservation, remaining: sideB } = extractParentheses(afterBrackets);
      
      results.push({ 
        sideA,
        sideB: sideB.trim() || undefined,
        shortObservation: shortObservation || undefined,
        detailedHint: detailedHint || undefined,
        en: sideA,
        pt: sideB.trim() || undefined,
      });
    } else {
      results.push({ sideA: line, en: line });
    }
  }
  
  return results;
}

export function deduplicateFlashcards(
  pairs: FlashcardPair[],
  existingCards: { term: string; translation: string }[]
): FlashcardPair[] {
  const seen = new Set<string>();
  
  // Add existing cards to seen set
  existingCards.forEach(card => {
    const key = `${card.term.toLowerCase().trim()}|${card.translation.toLowerCase().trim()}`;
    seen.add(key);
  });
  
  // Filter out duplicates
  return pairs.filter(pair => {
    const a = pair.sideA || pair.en;
    const b = pair.sideB || pair.pt;
    
    if (!a || !b) return true; // Keep incomplete for review
    
    const key = `${a.toLowerCase().trim()}|${b.toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    
    seen.add(key);
    return true;
  });
}

// ---------- Duplicate Analysis (visible, non-destructive) ----------

export type DuplicateInfo = {
  pair: FlashcardPair;
  index: number;
  isDuplicateInBatch: boolean;
  isDuplicateExisting: boolean;
  /** Human-readable reason ("" when not a duplicate). */
  duplicateReason: "" | "Duplicado nesta importação" | "Já existe na lista" | "Duplicado nesta importação + já existe na lista";
};

function normCell(s: string | undefined | null): string {
  return (s ?? "").toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Annotate each card with duplicate metadata WITHOUT removing anything.
 * The UI is responsible for highlighting and for deciding (via a switch)
 * whether duplicates are actually inserted.
 */
export function analyzeFlashcardDuplicates(
  pairs: FlashcardPair[],
  existingCards: { term: string; translation: string }[],
): DuplicateInfo[] {
  const existingKeys = new Set<string>();
  for (const c of existingCards) {
    existingKeys.add(`${normCell(c.term)}|${normCell(c.translation)}`);
  }
  // First pass: count how many times each key appears in the batch.
  const batchCounts = new Map<string, number>();
  for (const p of pairs) {
    const a = normCell(p.sideA || p.en);
    const b = normCell(p.sideB || p.pt);
    if (!a || !b) continue;
    const key = `${a}|${b}`;
    batchCounts.set(key, (batchCounts.get(key) ?? 0) + 1);
  }
  // Second pass: annotate every row (ALL duplicate occurrences are flagged,
  // not just the second+, so the user sees both lines highlighted).
  return pairs.map((pair, index) => {
    const a = normCell(pair.sideA || pair.en);
    const b = normCell(pair.sideB || pair.pt);
    const key = `${a}|${b}`;
    const hasBoth = !!a && !!b;
    const inBatch = hasBoth && (batchCounts.get(key) ?? 0) > 1;
    const inExisting = hasBoth && existingKeys.has(key);
    let reason: DuplicateInfo["duplicateReason"] = "";
    if (inBatch && inExisting) reason = "Duplicado nesta importação + já existe na lista";
    else if (inExisting) reason = "Já existe na lista";
    else if (inBatch) reason = "Duplicado nesta importação";
    return {
      pair,
      index,
      isDuplicateInBatch: inBatch,
      isDuplicateExisting: inExisting,
      duplicateReason: reason,
    };
  });
}

// ---------- Glossary-Aware Parser ----------

export type GlossaryParsed = {
  original_text: string;
  translated_text: string;
};

// Tolerant markers: accept === or --- or mixed, with or without accents
const GLOSSARY_MARKER = /^[=\-]{2,}\s*GLOSS[AÁaá]RIO\s+GLOBAL\s*[=\-]{2,}$/i;
const CARDS_MARKER = /^[=\-]{2,}\s*CARDS\s*[=\-]{2,}$/i;

/**
 * Parse input that may contain two sections:
 * === GLOSSÁRIO GLOBAL ===
 * ... glossary lines ...
 * === CARDS ===
 * ... card lines ...
 *
 * If no markers found, treats entire input as cards (backward compat).
 */
export function parseGlossaryAndCards(input: string): {
  glossaryLines: GlossaryParsed[];
  cards: FlashcardPair[];
} {
  const lines = input.split(/\r?\n/);
  
  let glossaryStart = -1;
  let cardsStart = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (GLOSSARY_MARKER.test(trimmed)) glossaryStart = i;
    else if (CARDS_MARKER.test(trimmed)) cardsStart = i;
  }
  
  // No markers → legacy: everything is cards
  if (glossaryStart === -1 && cardsStart === -1) {
    return { glossaryLines: [], cards: parsePastedFlashcards(input) };
  }
  
  // Extract glossary section
  const glossaryLines: GlossaryParsed[] = [];
  if (glossaryStart !== -1) {
    const end = cardsStart !== -1 ? cardsStart : lines.length;
    const detect = FEATURE_FLAGS.bulk_import_v2 ? findSeparatorIndexV2 : findSeparatorIndex;
    for (let i = glossaryStart + 1; i < end; i++) {
      const raw = lines[i].trim();
      if (!raw) continue;
      const line = stripAIArtifacts(raw);
      if (!line) continue;
      const sep = detect(line);
      if (sep.index <= 0) continue;
      const original = line.substring(0, sep.index).trim();
      const translated = line.substring(sep.index + sep.length).trim();
      if (original && translated) {
        glossaryLines.push({ original_text: original, translated_text: translated });
      }
    }
  }
  
  // Extract cards section
  let cardsText = '';
  if (cardsStart !== -1) {
    cardsText = lines.slice(cardsStart + 1).join('\n');
  }
  
  return {
    glossaryLines,
    cards: cardsText.trim() ? parsePastedFlashcards(cardsText) : [],
  };
}

/**
 * Deduplicate glossary entries against existing ones.
 */
export function deduplicateGlossary(
  parsed: GlossaryParsed[],
  existing: { original_text: string; translated_text: string }[]
): GlossaryParsed[] {
  const seen = new Set<string>();
  
  existing.forEach(e => {
    seen.add(`${e.original_text.toLowerCase().trim()}|${e.translated_text.toLowerCase().trim()}`);
  });
  
  return parsed.filter(g => {
    const key = `${g.original_text.toLowerCase().trim()}|${g.translated_text.toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Language code → display name mapping
const LANG_NAMES: Record<string, string> = {
  en: "Inglês", pt: "Português", fr: "Francês", es: "Espanhol",
  de: "Alemão", it: "Italiano", ja: "Japonês", ko: "Coreano",
  zh: "Chinês", ru: "Russo", ar: "Árabe", nl: "Holandês",
};

function langName(code?: string): string {
  if (!code) return "";
  return LANG_NAMES[code.toLowerCase()] || code;
}

/**
 * Build the AI helper prompt dynamically using the list's language pair.
 * Falls back to generic "Lado A / Lado B" when no languages are set.
 */
export function buildAIHelperPrompt(langA?: string, langB?: string): string {
  const hasLangs = langA && langB;
  const nameA = langName(langA);
  const nameB = langName(langB);
  const sideA = hasLangs ? nameA : "Lado A";
  const sideB = hasLangs ? nameB : "Lado B";

  return `Você é uma IA responsável por gerar conteúdo estruturado para um aplicativo de flashcards.

DIREÇÃO DA LISTA:
O conteúdo deve seguir a direção configurada pelo aplicativo.
O Lado A dos cards deve ser o primeiro idioma da lista.
O Lado B dos cards deve ser o segundo idioma da lista.

REGRA MAIS IMPORTANTE:
Por padrão, gere APENAS cards normais dentro da seção === CARDS ===.
Não crie glossário, camadas ou dicas detalhadas automaticamente.
Use glossário, camadas ou dicas detalhadas SOMENTE se o usuário pedir explicitamente.

Se o usuário pedir apenas "faça uma lista", "gere cards", "crie flashcards", "crie frases" ou algo parecido, gere somente cards normais.

Use === GLOSSÁRIO GLOBAL === somente se o usuário pedir glossário.
Use [CAMADAS] somente se o usuário pedir camadas.
Use dicas detalhadas entre colchetes somente se o usuário pedir dicas detalhadas.

A resposta deve seguir ESTRITAMENTE o formato descrito abaixo.

PROIBIDO:

Não escreva nenhuma explicação, comentário ou texto fora do formato final.

Não adicione títulos extras, cabeçalhos ou subtítulos além dos marcadores permitidos.

Não numere as linhas.

Não use bullets ou listas com prefixos.

Não use markdown.

Não use negrito, itálico ou títulos com #.

Não adicione linhas em branco extras entre as entradas.

Cada entrada deve ocupar uma única linha simples de texto puro.

Cada linha de card normal deve ter exatamente DOIS campos: ${sideA} / ${sideB}.

Nunca use quatro campos.

Não escreva: termo / tradução / frase / tradução da frase.

Não invente camadas se o usuário não pediu camadas.

Não invente glossário se o usuário não pediu glossário.

Não invente dica detalhada se o usuário não pediu dica detalhada.

SEÇÃO PRINCIPAL OBRIGATÓRIA:

A saída deve ter sempre a seção:

=== CARDS ===

Dentro dela ficam os cards normais.

Formato obrigatório:
${sideA} / ${sideB}

O separador entre os dois lados deve ser exatamente:
espaço + barra + espaço

Exemplos para Português → Inglês:
casa / house
cachorro / dog
Eu estudo inglês todos os dias. / I study English every day.
Ela pesquisou a palavra. / She looked up the word.

Exemplos para Inglês → Português:
house / casa
dog / cachorro
I study English every day. / Eu estudo inglês todos os dias.
She looked up the word. / Ela pesquisou a palavra.

GLOSSÁRIO GLOBAL — OPCIONAL:

Use a seção === GLOSSÁRIO GLOBAL === somente se o usuário pedir glossário.

Quando usado, o glossário deve vir antes da seção === CARDS ===.

Formato:
${sideA} / ${sideB}

Exemplo em Português → Inglês:

=== GLOSSÁRIO GLOBAL ===
casa / house
cachorro / dog
trabalho / work

=== CARDS ===
Eu trabalho todos os dias. / I work every day.
O aplicativo funciona bem. / The app works well.

DICAS DETALHADAS — OPCIONAL:

Use dica detalhada somente se o usuário pedir explicitamente.

A dica detalhada deve aparecer entre colchetes no final da linha.
A dica deve explicar o uso do card, mas sem criar campos extras.

Formato:
${sideA} / ${sideB} [dica detalhada]

Exemplo:
Eu estudo inglês todos os dias. / I study English every day. [Use o Simple Present para hábitos e rotinas.]
Ela pesquisou a palavra online. / She looked up the word online. ["Look up" pode significar pesquisar uma informação.]

Não use dica detalhada se o usuário não pedir.

BLOCO [CAMADAS] — OPCIONAL:

Use [CAMADAS] somente se o usuário pedir explicitamente camadas.

As camadas servem para agrupar FRASES jogáveis sob um termo principal.
O termo principal é apenas o nome do grupo.
O termo principal NÃO vira card jogável.
Apenas as frases dentro do grupo viram cards jogáveis.

O bloco [CAMADAS] deve ficar dentro da seção === CARDS ===.
Não crie uma seção separada chamada === CAMADAS ===.

Formato correto:

=== CARDS ===

[CAMADAS]
termo principal
frase no ${sideA} / frase no ${sideB}
frase no ${sideA} / frase no ${sideB}
frase no ${sideA} / frase no ${sideB}

Regras do bloco [CAMADAS]:

A linha do marcador deve ser exatamente: [CAMADAS]

A linha do nome do grupo não deve conter " / ".

O nome do grupo pode ser uma palavra, verbo frasal ou expressão curta.

Cada linha abaixo do nome do grupo deve ser uma frase completa no formato ${sideA} / ${sideB}.

Cada grupo precisa ter pelo menos 2 frases.

É permitido criar vários grupos no mesmo bloco.

Para iniciar um novo grupo, escreva outro nome de grupo sem " / ".

Não escreva "termo / tradução" dentro de [CAMADAS].

Dentro de [CAMADAS], use frases completas, não traduções soltas.

Não repita nos cards normais as mesmas frases usadas em [CAMADAS].

Exemplo correto com camadas em Português → Inglês:

=== CARDS ===

[CAMADAS]
look up
Eu pesquisei a palavra online. / I looked up the word online.
As coisas finalmente estão melhorando. / Things are finally looking up.
Ela admira o irmão mais velho. / She looks up to her older brother.

take off
O avião decolou às 8 da manhã. / The plane took off at 8 a.m.
Por favor, tire os sapatos. / Please take off your shoes.
O negócio dele fez muito sucesso no ano passado. / His business took off last year.

QUANDO O USUÁRIO NÃO PEDIR CAMADAS:

Se o usuário não pedir camadas, não use [CAMADAS].

Exemplo correto sem camadas:

=== CARDS ===
Eu pesquisei a palavra online. / I looked up the word online.
As coisas finalmente estão melhorando. / Things are finally looking up.
Ela admira o irmão mais velho. / She looks up to her older brother.

QUANDO O USUÁRIO PEDIR PHRASAL VERBS:

Se o usuário pedir phrasal verbs sem pedir camadas, gere cards normais com frases.
Não use [CAMADAS] automaticamente.

Se o usuário pedir phrasal verbs com camadas, use [CAMADAS] e agrupe as frases pelo verbo frasal.

REGRA FINAL:
Na dúvida, gere apenas cards normais.
Só use glossário, dica detalhada ou camadas quando o usuário pedir claramente.

REGRA SOBRE CSV:
CSV é opcional. Não gere CSV automaticamente.
Use CSV somente quando o usuário pedir explicitamente ("gere em CSV", "quero CSV", "formato CSV", "arquivo CSV" ou equivalente).

Quando o usuário pedir CSV, a saída deve ser texto puro em CSV, sem markdown, sem explicações e sem blocos de código.

Formato CSV recomendado (apenas DUAS colunas):
${sideA},${sideB}
casa,house
cachorro,dog
Eu estudo inglês todos os dias.,I study English every day.

Regras para CSV:
- Use apenas duas colunas. Primeira coluna = Lado A. Segunda coluna = Lado B.
- Nunca use quatro colunas. Não escreva termo,tradução,frase,tradução da frase.
- Se uma célula tiver vírgula, coloque a célula entre aspas: "Sim, eu gosto.","Yes, I like it."
- Se uma célula tiver aspas, escape duplicando: "ele disse ""oi""","he said ""hi"""
- Não misture [CAMADAS] dentro de CSV. Não misture === CARDS === dentro de CSV.
- CSV é apenas para cards simples. Para camadas, use o formato normal do app com [CAMADAS].`;
}

// Legacy constant for backward compatibility
export const AI_HELPER_PROMPT = buildAIHelperPrompt();


