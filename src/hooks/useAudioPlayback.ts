import { useCallback } from "react";
import { useSpeechOutput } from "@/features/speech/useSpeechOutput";
import type { SpeechMode } from "@/features/speech/types";
export { WORD_BY_WORD_RATE, WORD_PAUSE_MS } from "@/features/speech/NativeSpeechProvider";
export type { SpeechMode } from "@/features/speech/types";

export interface PlayOptions {
  langOverride?: string;
  rate?: number;
  pitch?: number;
  mode?: SpeechMode;
  voicePreference?: string;
  allowCloudFallback?: boolean;
  signal?: AbortSignal;
}

/**
 * Compatibility adapter used by the study views.
 * All playback now flows through the single native-first/cloud-fallback layer.
 */
export function useTTS() {
  const output = useSpeechOutput();
  const speak = useCallback((text: string, options: PlayOptions = {}) => {
    const mode = options.mode ?? ((options.rate ?? 1) <= 0.5 ? "word-by-word" : "natural");
    return output.speak(text, {
      lang: options.langOverride,
      rate: options.rate,
      pitch: options.pitch,
      mode,
      voicePreference: options.voicePreference,
      allowCloudFallback: options.allowCloudFallback,
      signal: options.signal,
    });
  }, [output.speak]);

  return {
    ...output,
    speak,
  };
}
