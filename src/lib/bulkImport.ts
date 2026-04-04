// Bulk import utilities for flashcards - Language Agnostic
// Format: SIDE_A / SIDE_B (short observation) [detailed hint]

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

export function parsePastedFlashcards(input: string): FlashcardPair[] {
  const lines = normalizeInputLines(input);
  
  return lines
    .filter(Boolean)
    .map(rawLine => {
      const line = stripAIArtifacts(rawLine);
      if (!line) return null;

      const sep = findSeparatorIndex(line);
      
      if (sep.index > 0) {
        const sideA = line.substring(0, sep.index).trim();
        let rest = line.substring(sep.index + sep.length).trim();
        
        // Parse from right to left:
        // 1. First extract brackets [detailed hint]
        const { extracted: detailedHint, remaining: afterBrackets } = extractBrackets(rest);
        
        // 2. Then extract parentheses (short observation)
        const { extracted: shortObservation, remaining: sideB } = extractParentheses(afterBrackets);
        
        return { 
          sideA,
          sideB: sideB.trim() || undefined,
          shortObservation: shortObservation || undefined,
          detailedHint: detailedHint || undefined,
          // Legacy compatibility
          en: sideA,
          pt: sideB.trim() || undefined,
        };
      }
      
      // Single text without separator
      return { 
        sideA: line,
        en: line,
      };
    })
    .filter((p): p is FlashcardPair => p !== null && typeof p === 'object');
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
    for (let i = glossaryStart + 1; i < end; i++) {
      const raw = lines[i].trim();
      if (!raw) continue;
      const line = stripAIArtifacts(raw);
      if (!line) continue;
      const sep = findSeparatorIndex(line);
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
  const glossaryDirection = hasLangs
    ? `\nO glossário deve seguir a direção: ${nameA} → ${nameB} (o termo original no lado esquerdo é em ${nameA}, a tradução no lado direito é em ${nameB}).`
    : "";
  const cardsDirection = hasLangs
    ? `\nO Lado A dos cards deve ser em ${nameA} e o Lado B em ${nameB}.`
    : "";

  return `Você é uma IA responsável por gerar conteúdo estruturado para um aplicativo de flashcards.${glossaryDirection}${cardsDirection}

A resposta deve seguir ESTRITAMENTE o formato descrito abaixo.

PROIBIDO:
- Não escreva nenhuma explicação, comentário ou texto fora do formato.
- Não adicione títulos extras, cabeçalhos ou subtítulos além dos marcadores de seção.
- Não numere as linhas (ex: "1.", "2)", "-").
- Não use formatação markdown (ex: **negrito**, *itálico*, # título).
- Não use bullets ou listas com prefixos.
- Não adicione linhas em branco extras entre as entradas.
- Cada entrada deve ser uma linha simples de texto puro.

A saída deve conter exatamente DUAS SEÇÕES, nesta ordem:

=== GLOSSÁRIO GLOBAL ===

=== CARDS ===

-----------------------------------
SEÇÃO 1 — GLOSSÁRIO GLOBAL
-----------------------------------

Nesta seção devem aparecer palavras ou expressões com tradução direta.

Formato obrigatório de cada linha:
termo_original / tradução

O separador é EXATAMENTE: espaço + barra + espaço ( / ).

Regras:
- Cada entrada deve ocupar apenas uma linha.
- Use APENAS \` / \` (com espaço antes e depois) como separador.
- Não use parênteses ou colchetes nesta seção.
- Não escreva explicações nesta seção.
- Não repita entradas idênticas dentro do glossário.
- Não escreva frases completas aqui.

Exemplo de formato correto:
work / trabalhar
late / atrasado
look for / procurar
home / casa

-----------------------------------
SEÇÃO 2 — CARDS
-----------------------------------

Nesta seção devem aparecer os flashcards.

Formato obrigatório de cada linha:
${hasLangs ? `${nameA}` : "LADO A"} / ${hasLangs ? `${nameB}` : "LADO B"} (observação opcional) [descrição opcional]

O separador entre os dois lados é EXATAMENTE: espaço + barra + espaço ( / ).

Regras:
- Tudo antes de \` / \` é o ${hasLangs ? nameA : "Lado A"}.
- Tudo depois de \` / \` é o ${hasLangs ? nameB : "Lado B"}.
- O que estiver entre parênteses \`( )\` é uma observação curta opcional.
- O que estiver entre colchetes \`[ ]\` é uma descrição detalhada opcional.
- Parênteses e colchetes são opcionais e só devem ser usados quando necessário.
- Cada card deve ocupar uma única linha.
- Não use nenhum outro separador além de \` / \`, \`( )\` e \`[ ]\`.

Exemplo de formato correto:
I work today / Eu trabalho hoje
She is late / Ela está atrasada
They look for help / Eles procuram ajuda (informal)
We go home now / Nós vamos para casa agora [Expressa ação imediata.]`;
}

// Legacy constant for backward compatibility
export const AI_HELPER_PROMPT = buildAIHelperPrompt();


