// Text-to-Speech utilities using native Web Speech API

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
): "pt-BR" | "en-US" {
  // 1) Use card language if specified
  if (cardLang === "pt-BR" || cardLang === "en-US") return cardLang;
  
  // 2) Use deck language if specified
  if (deckLang === "pt-BR" || deckLang === "en-US") return deckLang;
  
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

export async function speakText(
  text: string, 
  lang: "pt-BR" | "en-US",
  deckLang?: string,
  cardLang?: string
): Promise<void> {
  // Clean text: remove parentheses, emojis, brackets, etc.
  const cleanText = cleanTextForTTS(text);
  
  // Skip if text is empty after cleaning
  if (!cleanText) {
    console.debug('[TTS]', 'Text is empty after cleaning, skipping TTS');
    return;
  }
  
  // Auto-detect language if not explicitly set
  const detectedLang = detectLanguage(cleanText, deckLang, cardLang);
  const finalLang = lang || detectedLang;
  
  const label = `[TTS] (${finalLang})`;
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  
  if (!synth) {
    console.warn(label, "Speech synthesis not supported");
    return;
  }

  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = finalLang;
    
    // Rate: slightly slower for clarity (0.9 default, but respect user preference)
    const userRate = localStorage.getItem("speechRate");
    utterance.rate = userRate ? Number(userRate) : 0.9;
    
    // Pitch: natural/neutral
    utterance.pitch = 1.0;
    
    // Volume: maximum
    utterance.volume = 1.0;

    const preferredVoice = localStorage.getItem("speechVoice");
    const voices = synth.getVoices();

    if (preferredVoice) {
      const voice = voices.find(v => v.name === preferredVoice);
      if (voice) utterance.voice = voice;
    } else {
      const langVoices = voices.filter(v => v.lang?.startsWith(finalLang.split('-')[0]));
      if (langVoices.length > 0) utterance.voice = langVoices[0];
    }

    utterance.onstart = () => console.debug(label, "Web Speech playback started");
    utterance.onend = () => {
      console.debug(label, "Web Speech playback ended");
      resolve();
    };
    utterance.onerror = (e) => {
      console.error(label, "Web Speech error", e);
      resolve();
    };

    try {
      synth.cancel(); // cancel any ongoing speech
      synth.speak(utterance);
    } catch (e) {
      console.error(label, "Failed to speak via Web Speech", e);
      resolve();
    }
  });
}

export function pickLang(
  direction: "pt-en" | "en-pt" | "any",
  text: string
): "pt-BR" | "en-US" {
  // direction pt-en = front is PT, back is EN → speak EN
  // direction en-pt = front is EN, back is PT → speak PT
  if (direction === "pt-en") return "en-US";
  if (direction === "en-pt") return "pt-BR";
  
  // Auto-detect based on accents
  return /[áéíóúâêîôûãõç]/i.test(text) ? "pt-BR" : "en-US";
}

export function getAvailableVoices() {
  const synth = window.speechSynthesis;
  if (!synth) return [];
  
  return synth.getVoices();
}

// Load voices on page load
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}
