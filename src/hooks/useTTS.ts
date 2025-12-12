import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

export interface PlayOptions {
  langOverride?: "en-US" | "pt-BR";
  rate?: number;   // 0.5 = lento, 1.0 = normal
  pitch?: number;  // default 1
}

/**
 * Pick the best voice for a given language
 * Prioritizes natural-sounding voices over robotic ones
 */
function pickVoice(lang: "en-US" | "pt-BR", voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const prefix = lang.split("-")[0]; // "en" or "pt"

  // Priority 1: Exact match
  let voice = voices.find(v => v.lang === lang);
  if (voice) return voice;

  // Priority 2: Any voice with the same language prefix
  voice = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
  if (voice) return voice;

  // For English, try common fallbacks
  if (prefix === "en") {
    voice = voices.find(v => v.lang === "en-GB");
    if (voice) return voice;
  }

  // For Portuguese, try pt-PT as fallback
  if (prefix === "pt") {
    voice = voices.find(v => v.lang === "pt-PT");
    if (voice) return voice;
  }

  return null;
}

/**
 * Hook para gerenciar TTS com seleção de voz natural
 * Suporta inglês e português com controle de velocidade
 */
export function useTTS() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      const loadedVoices = window.speechSynthesis.getVoices();
      if (loadedVoices.length > 0) {
        setVoices(loadedVoices);
        setVoicesLoaded(true);
        console.log('[useTTS] Voices loaded:', loadedVoices.length);
      }
    };

    // Try immediately (some browsers have voices ready)
    loadVoices();

    // Also listen for async loading (Chrome, Android)
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Cleanup
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback((text: string, options?: PlayOptions) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('[useTTS] Web Speech API not supported');
      return;
    }

    // Cancel any ongoing speech first
    window.speechSynthesis.cancel();

    // Get voices - use cached or fetch fresh
    const currentVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
    
    // Determine language - default to en-US for study mode
    const lang = options?.langOverride ?? "en-US";
    
    // Find the best voice for this language
    const voice = pickVoice(lang, currentVoices);

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply voice if found
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
      console.log('[useTTS] Using voice:', voice.name, voice.lang);
    } else {
      utterance.lang = lang;
      console.warn('[useTTS] No voice found for', lang, '- using default');
    }

    // Apply rate - DEFAULT 1.0 (normal speed)
    // Use 0.5 for slow pronunciation practice
    utterance.rate = options?.rate ?? 1.0;
    
    // Apply pitch - default 1.0
    utterance.pitch = options?.pitch ?? 1.0;
    
    // Full volume
    utterance.volume = 1;

    console.log('[useTTS] Speaking:', text.substring(0, 30) + '...', 'lang:', utterance.lang, 'rate:', utterance.rate);

    // Speak!
    window.speechSynthesis.speak(utterance);
  }, [voices]);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return { speak, stop, voicesLoaded };
}
