import { useEffect, useRef } from "react";
import { speakText } from "@/lib/speech";

/**
 * Hook para gerenciar TTS com cleanup automático
 * Garante que a fala seja interrompida quando o componente desmonta
 */
export function useTTS() {
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }

    // Cleanup: interromper fala ao desmontar
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const speak = async (
    text: string,
    lang: "pt-BR" | "en-US",
    deckLang?: string,
    cardLang?: string
  ) => {
    // Cancel any ongoing speech before starting new one
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    return speakText(text, lang, deckLang, cardLang);
  };

  const stop = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
  };

  return { speak, stop };
}
