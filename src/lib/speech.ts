// Text-to-Speech utilities with ElevenLabs integration for English

import { supabase } from '@/integrations/supabase/client';

// Cache for audio to avoid repeated API calls in the same session
const audioCache = new Map<string, string>();

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

/**
 * Call ElevenLabs TTS API for English text
 * Returns audio URL on success, null on failure
 */
async function callElevenLabsTTS(text: string): Promise<string | null> {
  try {
    const cacheKey = `elevenlabs:${text}`;
    
    // Check cache first
    if (audioCache.has(cacheKey)) {
      console.log('[TTS] Using cached ElevenLabs audio');
      return audioCache.get(cacheKey)!;
    }

    console.log('[TTS] Calling ElevenLabs API for:', text.substring(0, 50));
    
    const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
      body: { text },
    });

    if (error) {
      console.error('[TTS] ElevenLabs API error:', error);
      return null;
    }

    // Convert response to audio blob
    const audioBlob = new Blob([data], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Cache the result (limit cache size to avoid memory issues)
    if (audioCache.size > 50) {
      const firstKey = audioCache.keys().next().value;
      const oldUrl = audioCache.get(firstKey);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, audioUrl);
    
    return audioUrl;
  } catch (error) {
    console.error('[TTS] Error calling ElevenLabs:', error);
    return null;
  }
}

/**
 * Play audio from URL
 */
function playAudioUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    
    audio.onended = () => {
      console.log('[TTS] Audio playback completed');
      resolve();
    };
    
    audio.onerror = (error) => {
      console.error('[TTS] Audio playback error:', error);
      reject(error);
    };
    
    audio.play().catch((error) => {
      console.error('[TTS] Failed to start audio:', error);
      reject(error);
    });
  });
}

/**
 * Fallback to browser TTS
 */
function speakWithBrowserTTS(text: string, lang: "pt-BR" | "en-US"): Promise<void> {
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
 * Main TTS function - uses ElevenLabs for English, browser TTS for Portuguese
 */
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
    console.debug('[TTS] Text is empty after cleaning, skipping TTS');
    return;
  }
  
  // Auto-detect language if not explicitly set
  const detectedLang = detectLanguage(cleanText, deckLang, cardLang);
  const finalLang = lang || detectedLang;
  
  console.log(`[TTS] Language: ${finalLang}, Text: "${cleanText.substring(0, 50)}${cleanText.length > 50 ? '...' : ''}"`);
  
  // For English, try ElevenLabs first, fallback to browser TTS
  if (finalLang === 'en-US') {
    try {
      const audioUrl = await callElevenLabsTTS(cleanText);
      
      if (audioUrl) {
        console.log('[TTS] Using ElevenLabs for English');
        await playAudioUrl(audioUrl);
        return;
      } else {
        console.log('[TTS] ElevenLabs failed, falling back to browser TTS');
      }
    } catch (error) {
      console.warn('[TTS] ElevenLabs playback error, falling back to browser TTS:', error);
    }
  }
  
  // Fallback to browser TTS (for Portuguese or if ElevenLabs fails)
  console.log('[TTS] Using browser TTS');
  await speakWithBrowserTTS(cleanText, finalLang);
}

/**
 * Pick language based on direction and text
 * Used by study components to determine which language to speak
 */
export function pickLang(
  direction: "pt-en" | "en-pt" | "any",
  text: string
): "pt-BR" | "en-US" {
  if (direction === "pt-en") {
    // PT -> EN means the back/hidden side is English
    return "en-US";
  } else if (direction === "en-pt") {
    // EN -> PT means the back/hidden side is Portuguese
    return "pt-BR";
  } else {
    // "any" or fallback: auto-detect
    return detectLanguage(text);
  }
}

// Export for use in other modules
export { cleanTextForTTS, stripParentheses, detectLanguage };
