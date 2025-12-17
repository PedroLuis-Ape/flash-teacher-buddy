// Bulk import utilities for flashcards - Language Agnostic
// Format: SIDE_A / SIDE_B (short observation) [detailed hint]

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

export function parsePastedFlashcards(input: string): FlashcardPair[] {
  const lines = normalizeInputLines(input);
  
  return lines
    .filter(Boolean)
    .map(line => {
      // Try to split by " / " separator
      const slashIndex = line.indexOf('/');
      
      if (slashIndex > 0) {
        const sideA = line.substring(0, slashIndex).trim();
        let rest = line.substring(slashIndex + 1).trim();
        
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
          // Legacy compatibility - map to en/pt for existing code
          en: sideA,
          pt: sideB.trim() || undefined,
        };
      }
      
      // Single text without separator
      return { 
        sideA: line,
        en: line,
      };
    });
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

// AI Helper prompt for generating cards in the correct format
export const AI_HELPER_PROMPT = `Você é uma IA que vai criar cards de estudo para um aplicativo de flashcards.

Gere uma lista de cards seguindo EXATAMENTE este formato, com UM card por linha:

LADO A / LADO B (observação curta opcional) [descrição detalhada opcional]

Regras importantes:
- Tudo antes da barra \`/\` é o Lado A (pergunta/termo fonte).
- Tudo depois da barra \`/\` é o Lado B (resposta/tradução).
- O que estiver entre parênteses \`( )\` é APENAS uma observação curta opcional (ex.: outra tradução possível, um comentário rápido).
  - Essa observação NÃO deve ser tratada como parte da resposta que o aluno precisa digitar.
- O que estiver entre colchetes \`[ ]\` é uma descrição detalhada opcional, mais longa, para aparecer como dica na lâmpada.
  - Pode ter várias linhas, exemplos, explicações de uso etc.
- NÃO crie parênteses ou colchetes sozinho, a não ser que o usuário peça explicitamente observações e descrições detalhadas.
- Não use nenhum outro tipo de separador; apenas a barra \`/\`, parênteses \`( )\` e colchetes \`[ ]\` como descrito.

Exemplo de saída:
I am / Eu sou (também pode significar "estou" em alguns contextos) [Usado para falar de identidade, profissão ou características fixas do sujeito.]
She is late / Ela está atrasada (informal) [Usado quando a pessoa chega depois do horário combinado; comum em contextos de trabalho ou estudo.]
They are happy / Eles estão felizes [Expressa estado emocional temporário. Compare com "They are tall" que seria característica permanente.]`;
