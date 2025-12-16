import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

export interface PlayOptions {
  langOverride?: string; // ISO code like "en-US", "pt-BR", "es", "fr", etc.
  rate?: number;   // 0.5 = lento, 1.0 = normal
  pitch?: number;  // default 1
}

// Map short ISO codes to BCP-47 codes for browser TTS fallback
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
 * Pick the best voice for a given language
 * Prioritizes natural-sounding voices over robotic ones
 */
function pickVoice(lang: string, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
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
 * Suporta múltiplos idiomas com controle de velocidade
 * Falls back to browser TTS if ElevenLabs fails
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
        console.log('[useTTS] Browser voices loaded:', loadedVoices.length);
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

  /**
   * Browser-based TTS fallback
   */
  const speakWithBrowser = useCallback((text: string, options?: PlayOptions) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('[useTTS] Web Speech API not supported');
      return;
    }

    // Cancel any ongoing speech first
    window.speechSynthesis.cancel();

    // Get voices - use cached or fetch fresh
    const currentVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
    
    // Determine language - convert short codes to BCP-47
    let lang = options?.langOverride ?? "en-US";
    if (lang.length === 2) {
      lang = ISO_TO_BCP47[lang] || `${lang}-${lang.toUpperCase()}`;
    }
    
    // Find the best voice for this language
    const voice = pickVoice(lang, currentVoices);

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply voice if found
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
      console.log('[useTTS] Browser voice:', voice.name, voice.lang);
    } else {
      utterance.lang = lang;
      console.warn('[useTTS] No browser voice for', lang, '- using default');
    }

    // Apply rate - DEFAULT 1.0 (normal speed)
    utterance.rate = options?.rate ?? 1.0;
    utterance.pitch = options?.pitch ?? 1.0;
    utterance.volume = 1;

    console.log('[useTTS] Browser speaking:', text.substring(0, 30) + '...', 'lang:', utterance.lang);

    // Speak!
    window.speechSynthesis.speak(utterance);
  }, [voices]);

  /**
   * Main speak function - tries ElevenLabs first, falls back to browser TTS
   */
  const speak = useCallback(async (text: string, options?: PlayOptions) => {
    // Cancel any ongoing browser speech
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // Determine language
    let lang = options?.langOverride ?? "en-US";
    
    // Try ElevenLabs first for better quality
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      if (supabaseUrl && supabaseKey) {
        const response = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ text, lang }),
        });

        if (response.ok) {
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          
          // Apply rate (note: HTML5 audio playbackRate)
          audio.playbackRate = options?.rate ?? 1.0;
          
          audio.onended = () => URL.revokeObjectURL(audioUrl);
          await audio.play();
          console.log('[useTTS] ElevenLabs playback started for:', text.substring(0, 30));
          return;
        }
        
        console.warn('[useTTS] ElevenLabs failed, falling back to browser TTS');
      }
    } catch (error) {
      console.warn('[useTTS] ElevenLabs error, falling back to browser TTS:', error);
    }

    // Fallback to browser TTS
    speakWithBrowser(text, options);
  }, [speakWithBrowser]);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return { speak, stop, voicesLoaded, speakWithBrowser };
}
