import { useEffect, useRef } from "react";
import { toast } from "sonner";

export interface PlayOptions {
  langOverride?: string;
  rate?: number;
}

/**
 * Hook para gerenciar TTS com seleção explícita de voz em inglês
 */
export function useTTS() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
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
  const findEnglishVoice = (): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    
    // Primeiro: buscar exatamente 'en-US'
    let voice = voices.find(v => v.lang === 'en-US');
    if (voice) return voice;
    
    // Segundo: buscar qualquer voz que comece com 'en'
    voice = voices.find(v => v.lang.startsWith('en'));
    if (voice) return voice;
    
    return null;
  };

  const speak = (text: string, options?: PlayOptions) => {
    if (!window.speechSynthesis) {
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
      // Garantir que as vozes estejam carregadas
      const trySetVoice = () => {
        const englishVoice = findEnglishVoice();
        
        if (englishVoice) {
          utterance.voice = englishVoice;
          console.log('[useTTS] Using English voice:', englishVoice.name, englishVoice.lang);
        } else {
          console.warn('[useTTS] No English voice found, using default');
          toast.warning("Voz em inglês não encontrada. Usando voz padrão.", {
            duration: 3000,
          });
        }
        
        window.speechSynthesis.speak(utterance);
      };

      // Vozes podem não estar carregadas ainda
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        // Aguardar carregamento das vozes
        window.speechSynthesis.onvoiceschanged = () => {
          trySetVoice();
        };
        // Fallback: tentar após um delay
        setTimeout(trySetVoice, 100);
      } else {
        trySetVoice();
      }
    } else {
      // Para português ou outros idiomas, usar comportamento padrão
      window.speechSynthesis.speak(utterance);
    }
  };

  const stop = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  return { speak, stop };
}
