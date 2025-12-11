import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";

export interface PlayOptions {
  langOverride?: string;
  rate?: number;
}

/**
 * Hook para gerenciar TTS com seleção explícita de voz em inglês
 * Handles async voice loading (especially on Chrome Android)
 */
export function useTTS() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Load voices - they load asynchronously on some browsers
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoicesLoaded(true);
        console.log('[useTTS] Voices loaded:', voices.length);
      }
    };

    // Try immediately
    loadVoices();

    // Also listen for async loading (Chrome Android)
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Cleanup: interromper fala ao desmontar
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /**
   * Encontra a melhor voz em inglês disponível
   */
  const findEnglishVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!window.speechSynthesis) return null;
    
    const voices = window.speechSynthesis.getVoices();
    
    // Primeiro: buscar exatamente 'en-US'
    let voice = voices.find(v => v.lang === 'en-US');
    if (voice) return voice;
    
    // Segundo: buscar 'en-GB'
    voice = voices.find(v => v.lang === 'en-GB');
    if (voice) return voice;
    
    // Terceiro: buscar qualquer voz que comece com 'en'
    voice = voices.find(v => v.lang.startsWith('en'));
    if (voice) return voice;
    
    return null;
  }, []);

  const speak = useCallback((text: string, options?: PlayOptions) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('[useTTS] Web Speech API not supported');
      return;
    }

    // Cancelar qualquer fala em andamento
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    // Configurações
    const targetLang = options?.langOverride || 'en-US';
    utterance.lang = targetLang;
    utterance.rate = options?.rate || 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Se for inglês, buscar voz explicitamente
    if (targetLang.startsWith('en')) {
      const trySpeak = () => {
        const englishVoice = findEnglishVoice();
        
        if (englishVoice) {
          utterance.voice = englishVoice;
          console.log('[useTTS] Using English voice:', englishVoice.name, englishVoice.lang);
        } else {
          console.warn('[useTTS] No English voice found, using default with lang override');
          // Still use the utterance without a specific voice - browser will try to match lang
        }
        
        window.speechSynthesis.speak(utterance);
      };

      // Vozes podem não estar carregadas ainda
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        // Aguardar carregamento das vozes (with timeout)
        let resolved = false;
        
        const voiceHandler = () => {
          if (resolved) return;
          resolved = true;
          trySpeak();
        };
        
        window.speechSynthesis.onvoiceschanged = voiceHandler;
        
        // Fallback: tentar após um delay curto
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            trySpeak();
          }
        }, 150);
      } else {
        trySpeak();
      }
    } else {
      // Para português ou outros idiomas, usar comportamento padrão
      window.speechSynthesis.speak(utterance);
    }
  }, [findEnglishVoice]);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return { speak, stop, voicesLoaded };
}
