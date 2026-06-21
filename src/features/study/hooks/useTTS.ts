import { useCallback, useEffect, useRef, useState } from "react";
import { cleanTextForTTS } from "@/features/study/lib/speech";
import { segmentTextForTTS } from "@/features/study/lib/speechSegmentation";
import { normalizeLangCode, toBCP47 } from "@/features/study/lib/languages";

export type SpeechMode = "natural" | "word-by-word";

export interface PlayOptions {
  langOverride?: string;
  rate?: number;
  pitch?: number;
  mode?: SpeechMode;
}

export const WORD_BY_WORD_RATE = 0.72;
export const WORD_PAUSE_MS = 350;

function pickVoice(lang: string, voices: SpeechSynthesisVoice[]) {
  const requested = toBCP47(lang).toLowerCase();
  const prefix = requested.split("-")[0];
  const rank = (pool: SpeechSynthesisVoice[]) =>
    pool.find((v) => v.name.toLowerCase().includes("google")) ||
    pool.find((v) => /microsoft|natural|neural|enhanced/i.test(v.name)) ||
    pool[0] || null;

  return rank(voices.filter((v) => v.lang.toLowerCase() === requested)) ||
    rank(voices.filter((v) => v.lang.toLowerCase().startsWith(`${prefix}-`)));
}

export function useTTS() {
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeMode, setActiveMode] = useState<SpeechMode | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const sessionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setActiveMode(null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
      setVoicesLoaded(voicesRef.current.length > 0);
    };
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", load);
      stop();
    };
  }, [stop]);

  const speak = useCallback((text: string, options?: PlayOptions) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const cleaned = cleanTextForTTS(text);
    if (!cleaned) return;

    stop();
    const session = sessionRef.current;
    const synth = window.speechSynthesis;
    const lang = toBCP47(normalizeLangCode(options?.langOverride ?? "en"));
    const voice = pickVoice(lang, voicesRef.current.length ? voicesRef.current : synth.getVoices());
    const mode = options?.mode ?? ((options?.rate ?? 1) <= 0.5 ? "word-by-word" : "natural");

    const done = () => {
      if (sessionRef.current !== session) return;
      setIsSpeaking(false);
      setActiveMode(null);
    };
    const make = (value: string, rate: number) => {
      const utterance = new SpeechSynthesisUtterance(value);
      utterance.lang = voice?.lang || lang;
      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      utterance.pitch = options?.pitch ?? 1;
      utterance.volume = 1;
      return utterance;
    };

    setIsSpeaking(true);
    setActiveMode(mode);

    if (mode === "natural") {
      const utterance = make(cleaned, options?.rate ?? 1);
      utterance.onend = done;
      utterance.onerror = done;
      synth.speak(utterance);
      return;
    }

    const words = segmentTextForTTS(cleaned);
    const play = (index: number) => {
      if (sessionRef.current !== session) return;
      if (index >= words.length) return done();
      const utterance = make(words[index], WORD_BY_WORD_RATE);
      const next = () => {
        if (sessionRef.current !== session) return;
        if (index === words.length - 1) return done();
        timerRef.current = setTimeout(() => play(index + 1), WORD_PAUSE_MS);
      };
      utterance.onend = next;
      utterance.onerror = next;
      synth.speak(utterance);
    };
    play(0);
  }, [stop]);

  return {
    speak,
    stop,
    voicesLoaded,
    isSpeaking,
    activeMode,
    isSupported: typeof window !== "undefined" && "speechSynthesis" in window,
  };
}
