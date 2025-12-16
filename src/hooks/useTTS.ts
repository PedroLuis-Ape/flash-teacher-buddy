import { useEffect, useState, useCallback } from "react";

export interface PlayOptions {
  langOverride?: string; // ISO code like "en-US", "pt-BR", "es", "fr", etc.
  rate?: number;   // 0.5 = slow, 1.0 = normal
  pitch?: number;  // default 1
}

// Map short ISO codes to BCP-47 codes
const ISO_TO_BCP47: Record<string, string> = {
  "en": "en-US",
  "pt": "pt-BR",
  "es": "es-ES",
  "fr": "fr-FR",
  "de": "de-DE",
  "it": "it-IT",
  "ja": "ja-JP",
  "zh": "zh-CN",
  "ko": "ko-KR",
  "ru": "ru-RU",
};

/**
 * Clean text for TTS - remove markdown, emojis, brackets, etc.
 */
function cleanTextForTTS(text: string): string {
  return text
    // Remove markdown formatting
    .replace(/[*_~`#]/g, '')
    // Remove brackets and their content
    .replace(/\[.*?\]/g, '')
    // Remove parentheses content (often pronunciation guides)
    .replace(/\(.*?\)/g, '')
    // Remove emojis
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Smart Voice Selection Algorithm
 * Priority: Google > Microsoft/Natural > Exact locale > Prefix match
 */
function pickVoice(langCode: string, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  // Normalize language code
  const normalizedLang = langCode.toLowerCase();
  const prefix = normalizedLang.split("-")[0]; // "en" from "en-US"
  const fullLocale = ISO_TO_BCP47[prefix] || langCode;

  // Filter voices that match our language
  const matchingVoices = voices.filter(v => {
    const voiceLang = v.lang.toLowerCase();
    return voiceLang === normalizedLang || 
           voiceLang === fullLocale.toLowerCase() ||
           voiceLang.startsWith(prefix + "-") ||
           voiceLang.startsWith(prefix);
  });

  if (matchingVoices.length === 0) {
    console.warn(`[TTS] No voices found for language: ${langCode}`);
    return null;
  }

  const voiceName = (v: SpeechSynthesisVoice) => v.name.toLowerCase();

  // Tier 1: Google voices (highest quality on Chrome)
  const googleVoice = matchingVoices.find(v => 
    voiceName(v).includes('google')
  );
  if (googleVoice) {
    console.log(`[TTS] Selected TIER 1 (Google) voice for ${langCode}: ${googleVoice.name}`);
    return googleVoice;
  }

  // Tier 2: Microsoft or Natural voices (high quality)
  const premiumVoice = matchingVoices.find(v => 
    voiceName(v).includes('microsoft') || 
    voiceName(v).includes('natural') ||
    voiceName(v).includes('neural') ||
    voiceName(v).includes('enhanced')
  );
  if (premiumVoice) {
    console.log(`[TTS] Selected TIER 2 (Premium) voice for ${langCode}: ${premiumVoice.name}`);
    return premiumVoice;
  }

  // Tier 3: Apple voices (good quality on Safari/iOS)
  const appleVoice = matchingVoices.find(v => 
    voiceName(v).includes('samantha') || 
    voiceName(v).includes('alex') ||
    voiceName(v).includes('victoria') ||
    voiceName(v).includes('luciana') || // Portuguese
    voiceName(v).includes('mónica') ||  // Spanish
    voiceName(v).includes('thomas') ||  // French
    voiceName(v).includes('anna')       // German
  );
  if (appleVoice) {
    console.log(`[TTS] Selected TIER 3 (Apple) voice for ${langCode}: ${appleVoice.name}`);
    return appleVoice;
  }

  // Tier 4: Exact locale match
  const exactMatch = matchingVoices.find(v => 
    v.lang.toLowerCase() === fullLocale.toLowerCase()
  );
  if (exactMatch) {
    console.log(`[TTS] Selected TIER 4 (Exact locale) voice for ${langCode}: ${exactMatch.name}`);
    return exactMatch;
  }

  // Tier 5: Any matching voice (fallback)
  const fallback = matchingVoices[0];
  console.log(`[TTS] Selected TIER 5 (Fallback) voice for ${langCode}: ${fallback.name}`);
  return fallback;
}

/**
 * High-quality Browser TTS Hook
 * Smart voice selection with Google/Microsoft/Apple priority
 */
export function useTTS() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('[TTS] Web Speech API not supported');
      return;
    }

    const loadVoices = () => {
      const loadedVoices = window.speechSynthesis.getVoices();
      if (loadedVoices.length > 0) {
        setVoices(loadedVoices);
        setVoicesLoaded(true);
        console.log('[TTS] Voices loaded:', loadedVoices.length, 'voices available');
        
        // Log available premium voices for debugging
        const premiumVoices = loadedVoices.filter(v => 
          v.name.toLowerCase().includes('google') ||
          v.name.toLowerCase().includes('microsoft') ||
          v.name.toLowerCase().includes('natural')
        );
        if (premiumVoices.length > 0) {
          console.log('[TTS] Premium voices found:', premiumVoices.map(v => v.name).join(', '));
        }
      }
    };

    // Try immediately (some browsers have voices ready)
    loadVoices();

    // CRITICAL for mobile: Listen for async voice loading
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Cleanup
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  /**
   * Main speak function with smart voice selection
   */
  const speak = useCallback((text: string, options?: PlayOptions) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('[TTS] Web Speech API not supported');
      return;
    }

    try {
      // Cancel any ongoing speech first
      window.speechSynthesis.cancel();

      // Clean text for better TTS
      const cleanedText = cleanTextForTTS(text);
      if (!cleanedText) {
        console.warn('[TTS] No text to speak after cleaning');
        return;
      }

      // Get voices - use cached or fetch fresh
      const currentVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
      
      // Determine language
      let lang = options?.langOverride ?? "en-US";
      if (lang.length === 2) {
        lang = ISO_TO_BCP47[lang] || `${lang}-${lang.toUpperCase()}`;
      }
      
      // Find the best voice using smart algorithm
      const voice = pickVoice(lang, currentVoices);

      // Create utterance
      const utterance = new SpeechSynthesisUtterance(cleanedText);
      
      // Apply voice if found
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = lang;
        console.warn('[TTS] No voice found for', lang, '- using browser default');
      }

      // Apply rate and pitch - DEFAULT 1.0 (normal speed)
      utterance.rate = options?.rate ?? 1.0;
      utterance.pitch = options?.pitch ?? 1.0;
      utterance.volume = 1;

      // Error handling
      utterance.onerror = (event) => {
        console.error('[TTS] Speech error:', event.error);
      };

      console.log('[TTS] Speaking:', cleanedText.substring(0, 40) + (cleanedText.length > 40 ? '...' : ''));

      // Speak!
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('[TTS] Error:', error);
    }
  }, [voices]);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return { speak, stop, voicesLoaded };
}
