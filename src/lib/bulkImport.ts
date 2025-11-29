// Bulk import utilities for flashcards
// Format: TERM / DEFINITION (short observation) [detailed hint]

export type FlashcardPair = {
  en?: string;
  pt?: string;
  shortObservation?: string;
  detailedHint?: string;
};

function guessLang(s: string): "en" | "pt" {
  const t = ` ${s.toLowerCase()} `;
  
  // Check for Portuguese accents
  if (/[áéíóúâêîôûãõç]/.test(t)) return "pt";
  
  // Check for common English words
  const enHits = [
    " the ", " a ", " an ", " to ", " of ", " in ", 
    " on ", " for ", " with ", " is ", " are "
  ].filter(w => t.includes(w)).length;
  
  return enHits >= 1 ? "en" : "pt";
}

/**
 * Extract content from parentheses (short observation)
 * Returns the extracted text and the remaining string
 */
function extractParentheses(text: string): { extracted: string; remaining: string } {
  const matches: string[] = [];
  let remaining = text;
  
  // Extract all (content) matches
  const regex = /\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1].trim());
  }
  
  // Remove parentheses from text
  remaining = text.replace(regex, '').trim();
  
  return {
    extracted: matches.join(' ').trim(),
    remaining
  };
}

/**
 * Extract content from brackets [detailed hint]
 * Returns the extracted text and the remaining string
 */
function extractBrackets(text: string): { extracted: string; remaining: string } {
  const matches: string[] = [];
  let remaining = text;
  
  // Extract all [content] matches
  const regex = /\[([^\]]+)\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1].trim());
  }
  
  // Remove brackets from text
  remaining = text.replace(regex, '').trim();
  
  return {
    extracted: matches.join('\n').trim(),
    remaining
  };
}

export function parsePastedFlashcards(input: string): FlashcardPair[] {
  return input
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      // Try to split by " / " separator
      const slashIndex = line.indexOf('/');
      
      if (slashIndex > 0) {
        const frontRaw = line.substring(0, slashIndex).trim();
        let backRaw = line.substring(slashIndex + 1).trim();
        
        // Extract brackets [detailed hint] first (before parentheses)
        const { extracted: detailedHint, remaining: afterBrackets } = extractBrackets(backRaw);
        
        // Extract parentheses (short observation)
        const { extracted: shortObservation, remaining: backText } = extractParentheses(afterBrackets);
        
        const langFront = guessLang(frontRaw);
        const langBack = guessLang(backText);
        
        // Assign based on detected language
        if (langFront === "en" || langBack === "pt") {
          return { 
            en: frontRaw, 
            pt: backText,
            shortObservation: shortObservation || undefined,
            detailedHint: detailedHint || undefined
          };
        } else {
          return { 
            en: backText, 
            pt: frontRaw,
            shortObservation: shortObservation || undefined,
            detailedHint: detailedHint || undefined
          };
        }
      }
      
      // Single text, try to detect language
      const lang = guessLang(line);
      return lang === "en" ? { en: line } : { pt: line };
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
    if (!pair.en || !pair.pt) return true; // Keep incomplete for review
    
    const key = `${pair.en.toLowerCase().trim()}|${pair.pt.toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    
    seen.add(key);
    return true;
  });
}

// AI Helper prompt for generating cards in the correct format
export const AI_HELPER_PROMPT = `Você é uma IA que vai criar cards de estudo para o aplicativo APE (flashcards de inglês).

Gere uma lista de cards seguindo EXATAMENTE este formato, com UM card por linha:

INGLÊS / PORTUGUÊS (observação curta opcional) [descrição detalhada opcional]

Regras importantes:
- Tudo antes da barra \`/\` é o termo em inglês (frase ou palavra).
- Tudo depois da barra \`/\` é a tradução principal em português.
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
