import { useEffect, useRef } from "react";
import { audioService, PlayOptions } from "@/lib/AudioService";

/**
 * Hook para gerenciar TTS com cleanup automático
 * Agora usa o AudioService com Web Speech API
 */
export function useTTS() {
  useEffect(() => {
    // Cleanup: interromper fala ao desmontar
    return () => {
      audioService.stop();
    };
  }, []);

  const speak = (text: string, options?: PlayOptions) => {
    audioService.playSmartAudio(text, options);
  };

  const stop = () => {
    audioService.stop();
  };

  return { speak, stop };
}
