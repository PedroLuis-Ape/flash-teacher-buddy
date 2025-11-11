// Text-to-Speech utilities using native Web Speech API

/**
 * Remove parênteses do texto (anotações não devem ser faladas)
 */
function stripParentheses(text: string): string {
  return text.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
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
  // Clean text: remove parentheses (annotations)
  const cleanText = stripParentheses(text);
  
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
    utterance.rate = Number(localStorage.getItem("speechRate") || "1");

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
