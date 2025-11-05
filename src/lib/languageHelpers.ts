/**
 * Language Detection and Text Processing Helpers
 * Handles auto-detection, parentheses removal, and annotation extraction
 */

/**
 * Remove parênteses e seu conteúdo (anotações)
 * Ex: "I am (verbo ser)" -> "I am"
 */
export function stripParentheses(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\([^)]*\)/g, '') // Remove tudo entre parênteses
    .replace(/\s+/g, ' ') // Colapsa múltiplos espaços
    .trim();
}

/**
 * Extrai anotações de dentro dos parênteses
 * Ex: "I am (verbo ser) (presente)" -> ["verbo ser", "presente"]
 */
export function extractAnnotations(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(/\(([^)]+)\)/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1, -1).trim());
}

/**
 * Detecta o idioma do texto usando heurística
 * Ordem de prioridade: cardLang -> deckLang -> auto-detect
 * 
 * @param text - Texto para detectar idioma
 * @param deckLang - Idioma do deck (opcional)
 * @param cardLang - Idioma do card (opcional, tem prioridade)
 * @returns "pt-BR" ou "en-US"
 */
export function detectLanguage(
  text: string,
  deckLang?: string,
  cardLang?: string
): "pt-BR" | "en-US" {
  // 1) Use card language if specified (highest priority)
  if (cardLang === "pt-BR" || cardLang === "en-US") return cardLang;
  
  // 2) Use deck language if specified
  if (deckLang === "pt-BR" || deckLang === "en-US") return deckLang;
  
  // 3) Auto-detect based on text characteristics
  const cleanText = stripParentheses(text);
  
  // Check for Portuguese-specific characters
  const ptChars = /[áéíóúâêîôûãõç]/i;
  
  // Check for common Portuguese words
  const ptWords = /\b(o|a|os|as|de|da|do|para|com|em|que|não|ser|estar|ter|você|ele|ela)\b/i;
  
  if (ptChars.test(cleanText) || ptWords.test(cleanText)) {
    return "pt-BR";
  }
  
  // Check ASCII ratio - if mostly English letters, assume English
  const letters = cleanText.split('').filter(c => /[A-Za-z]/.test(c));
  const asciiRatio = letters.length / Math.max(1, cleanText.length);
  
  return asciiRatio > 0.6 ? "en-US" : "pt-BR";
}

/**
 * Prepara texto para comparação de respostas
 * Remove parênteses, normaliza casing, remove pontuação
 */
export function normalizeForComparison(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  return stripParentheses(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[.,!?;:]/g, "") // Remove pontuação leve
    .replace(/\s+/g, " ") // Colapsa espaços
    .trim();
}

/**
 * Compara resposta do usuário com resposta esperada
 * Ignora parênteses, casing, acentos e pontuação
 */
export function compareAnswers(userInput: string, correctAnswer: string): boolean {
  return normalizeForComparison(userInput) === normalizeForComparison(correctAnswer);
}
