import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

export interface PlayOptions {
  langOverride?: string;
  rate?: number; // Default 0.5 for pronunciation practice
}

/**
 * Find the best English voice available
 */
function findEnglishVoice(voices: SpeechSynthesisVoice[], langOverride?: string): SpeechSynthesisVoice | null {
  const target = langOverride || "en-US";
  
  // First: exact match
  let voice = voices.find(v => v.lang === target);
  if (voice) return voice;
  
  // Second: any en-US
  voice = voices.find(v => v.lang === "en-US");
  if (voice) return voice;
  
  // Third: en-GB
  voice = voices.find(v => v.lang === "en-GB");
  if (voice) return voice;
  
  // Fourth: any voice starting with 'en'
  voice = voices.find(v => v.lang.toLowerCase().startsWith("en"));
  if (voice) return voice;
  
  return null;
}

/**
 * Hook para gerenciar TTS com seleção explícita de voz em inglês
 * Forces English voice for pronunciation practice
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

    // Try immediately
    loadVoices();

    // Also listen for async loading (Chrome Android)
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

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const currentVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
    const targetLang = options?.langOverride || "en-US";

    // For English, find an English voice
    if (targetLang.startsWith("en")) {
      const englishVoice = findEnglishVoice(currentVoices, targetLang);
      
      if (!englishVoice) {
        console.warn('[useTTS] English voice not found');
        toast.warning("English voice not found on this device");
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = englishVoice;
      utterance.lang = englishVoice.lang;
      // Default 0.5 for pronunciation practice (slower = clearer)
      utterance.rate = options?.rate ?? 0.5;
      utterance.pitch = 1;
      utterance.volume = 1;

      console.log('[useTTS] Using English voice:', englishVoice.name, englishVoice.lang, 'rate:', utterance.rate);
      window.speechSynthesis.speak(utterance);
    } else {
      // Non-English: use default behavior
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = targetLang;
      utterance.rate = options?.rate ?? 0.5;
      window.speechSynthesis.speak(utterance);
    }
  }, [voices]);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return { speak, stop, voicesLoaded };
}
