import { useEffect, useState, useCallback } from "react";
import { cleanTextForTTS } from "@/features/study/lib/speech";
import { toBCP47, normalizeLangCode } from "@/features/study/lib/languages";

export interface PlayOptions {
  langOverride?: string; // ISO code like "en-US", "pt-BR", "es", "fr", etc.
  rate?: number;   // 0.5 = slow, 1.0 = normal
  pitch?: number;  // default 1
}

/**
 * Smart Voice Selection Algorithm
 * Order, for ANY language:
 *   1. Exact BCP-47 locale match (e.g. en-GB, pt-PT, es-MX).
 *   2. Canonical default for the short prefix (e.g. en→en-US, pt→pt-BR).
 *   3. Any voice sharing the prefix (en-*, pt-*, ...).
 * Inside each pool, prefer Google → Microsoft/Natural/Neural →
 * Apple → first available.
 */
function pickVoice(langCode: string, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  // Normalize to BCP-47 via the single source of truth
  const requested = toBCP47(langCode);
  const lowerReq = requested.toLowerCase();
  const prefix = lowerReq.split("-")[0];
  const canonical = toBCP47(prefix).toLowerCase();

  const voiceName = (v: SpeechSynthesisVoice) => v.name.toLowerCase();

  // Helper: rank voices by manufacturer/quality preference
  const pickByQuality = (pool: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    if (pool.length === 0) return null;
    const google = pool.find(v => voiceName(v).includes("google"));
    if (google) return google;
    const premium = pool.find(v =>
      voiceName(v).includes("microsoft") ||
      voiceName(v).includes("natural") ||
      voiceName(v).includes("neural") ||
      voiceName(v).includes("enhanced")
    );
    if (premium) return premium;
    const apple = pool.find(v =>
      voiceName(v).includes("samantha") ||
      voiceName(v).includes("alex") ||
      voiceName(v).includes("victoria")
    );
    if (apple) return apple;
    return pool[0];
  };

  // Pool 1: exact locale (preserves en-GB, pt-PT, es-MX, ...)
  const exact = voices.filter(v => v.lang.toLowerCase() === lowerReq);
  const exactPick = pickByQuality(exact);
  if (exactPick) return exactPick;

  // Pool 2: canonical default for the short prefix (en→en-US, pt→pt-BR)
  if (canonical !== lowerReq) {
    const canon = voices.filter(v => v.lang.toLowerCase() === canonical);
    const canonPick = pickByQuality(canon);
    if (canonPick) return canonPick;
  }

  // Pool 3: any voice sharing the prefix
  const prefixed = voices.filter(v => {
    const vl = v.lang.toLowerCase();
    return vl === prefix || vl.startsWith(prefix + "-");
  });
  const prefixPick = pickByQuality(prefixed);
  if (prefixPick) return prefixPick;

  console.warn(`[TTS] No voice found for language: ${langCode}`);
  return null;
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

      // Determine language via single source of truth.
      // Short codes ("en", "pt") map to canonical BCP-47 ("en-US", "pt-BR").
      // Regional tags ("en-GB", "pt-PT", "es-MX") are preserved.
      const requested = normalizeLangCode(options?.langOverride ?? "en");
      const lang = toBCP47(requested);

      // Find the best voice using smart algorithm
      const voice = pickVoice(lang, currentVoices);

      // Create utterance
      const utterance = new SpeechSynthesisUtterance(cleanedText);

      // Apply voice if found
      if (voice) {
        utterance.voice = voice;
        // Honour the requested locale tag so engines speaking via
        // utterance.lang respect regional variants (en-GB, pt-PT, ...).
        utterance.lang = voice.lang || lang;
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
