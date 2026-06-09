// Text-to-Speech utilities (browser-native speech synthesis only)

import { toBCP47 } from "@/features/study/lib/languages";

/**
 * Limpa o texto para TTS:
 * - Remove parênteses e conteúdo entre eles (anotações pedagógicas)
 * - Remove emojis e símbolos não textuais
 * - Remove colchetes e escolhe a primeira opção
 * - Remove espaços múltiplos
 */
function cleanTextForTTS(text: string): string {
  let cleaned = text;
  
  // 1. Remove parênteses e conteúdo (anotações pedagógicas)
  cleaned = cleaned.replace(/\([^)]*\)/g, '');
  
  // 2. Remove emojis (todos os ranges Unicode de emojis)
  cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, ''); // Emoticons
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F5FF}]/gu, ''); // Misc Symbols and Pictographs
  cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, ''); // Transport and Map
  cleaned = cleaned.replace(/[\u{1F700}-\u{1F77F}]/gu, ''); // Alchemical Symbols
  cleaned = cleaned.replace(/[\u{1F780}-\u{1F7FF}]/gu, ''); // Geometric Shapes Extended
  cleaned = cleaned.replace(/[\u{1F800}-\u{1F8FF}]/gu, ''); // Supplemental Arrows-C
  cleaned = cleaned.replace(/[\u{1F900}-\u{1F9FF}]/gu, ''); // Supplemental Symbols and Pictographs
  cleaned = cleaned.replace(/[\u{1FA00}-\u{1FA6F}]/gu, ''); // Chess Symbols
  cleaned = cleaned.replace(/[\u{1FA70}-\u{1FAFF}]/gu, ''); // Symbols and Pictographs Extended-A
  cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, '');   // Misc symbols
  cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, '');   // Dingbats
  cleaned = cleaned.replace(/[\u{FE00}-\u{FE0F}]/gu, '');   // Variation Selectors
  cleaned = cleaned.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, ''); // Regional Indicator Symbols
  
  // 3. Trata colchetes com alternativas [opção1 / opção2] - escolhe a primeira
  cleaned = cleaned.replace(/\[([^\]\/]+)(?:\/[^\]]+)*\]/g, '$1');
  
  // 4. Remove espaços múltiplos e trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * @deprecated Use cleanTextForTTS instead
 */
function stripParentheses(text: string): string {
  return cleanTextForTTS(text);
}

/**
 * Detecta o idioma do texto usando heurística
 * Ordem de prioridade: deckLang -> cardLang -> auto-detect
 */
function detectLanguage(
  text: string,
  deckLang?: string,
  cardLang?: string
): string {
  // 1) Use card language if specified
  if (cardLang) return cardLang;
  
  // 2) Use deck language if specified
  if (deckLang) return deckLang;
  
  // 3) Auto-detect: check for Portuguese-specific characters
  const ptChars = /[áéíóúâêîôûãõç]/i;
  const ptWords = /\b(o|a|os|as|de|da|do|para|com|em|que|não|ser|estar|ter)\b/i;
  
  if (ptChars.test(text) || ptWords.test(text)) {
    return "pt-BR";
  }
  
  // Default to English if mostly ASCII
  const asciiRatio = text.split('').filter(c => /[A-Za-z]/.test(c)).length / Math.max(1, text.length);
  return asciiRatio > 0.6 ? "en-US" : "pt-BR";
}

/**
 * Fallback to browser TTS
 */
function speakWithBrowserTTS(text: string, lang: string): Promise<void> {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  
  if (!synth) {
    console.warn('[TTS] Speech synthesis not supported');
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    synth.cancel(); // Cancel any ongoing speech
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1.0; // Natural pitch
    utterance.volume = 1.0; // Maximum volume
    
    utterance.onend = () => {
      console.log('[TTS] Browser TTS completed');
      resolve();
    };
    
    utterance.onerror = (error) => {
      console.error('[TTS] Browser TTS error:', error);
      resolve(); // Resolve anyway to not block the app
    };
    
    synth.speak(utterance);
  });
}

/**
 * Main TTS function - uses browser-native speech synthesis for all languages.
 */
export async function speakText(
  text: string, 
  lang: string,
  deckLang?: string,
  cardLang?: string
): Promise<void> {
  // Clean text: remove parentheses, emojis, brackets, etc.
  const cleanText = cleanTextForTTS(text);
  
  // Skip if text is empty after cleaning
  if (!cleanText) {
    console.debug('[TTS] Text is empty after cleaning, skipping TTS');
    return;
  }
  
  // Auto-detect language if not explicitly set
  const detectedLang = detectLanguage(cleanText, deckLang, cardLang);
  const finalLang = lang || detectedLang;
  
  console.log(`[TTS] Language: ${finalLang}, Text: "${cleanText.substring(0, 50)}${cleanText.length > 50 ? '...' : ''}"`);

  await speakWithBrowserTTS(cleanText, finalLang);
}

/**
 * Pick language based on direction and text
 * Used by study components to determine which language to speak
 */
export function pickLang(
  direction: "pt-en" | "en-pt" | "any" | string,
  text: string,
  langA?: string,
  langB?: string
): string {
  // Prefer the list's configured languages — never guess when the
  // caller already knows langA/langB.
  const resolvedA = toBCP47(langA || "en");
  const resolvedB = toBCP47(langB || "pt");

  if (direction === "a-b" || direction === "pt-en" || direction === "forward") {
    return resolvedA;
  }
  if (direction === "b-a" || direction === "en-pt" || direction === "backward") {
    return resolvedB;
  }
  // "any" or unknown direction: only auto-detect as a true last resort.
  if (langA || langB) return resolvedA;
  return toBCP47(detectLanguage(text));
}

// Export for use in other modules
export { cleanTextForTTS, stripParentheses, detectLanguage };
