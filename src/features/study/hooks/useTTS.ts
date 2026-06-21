import { useCallback, useEffect, useRef, useState } from "react";
import { cleanTextForTTS } from "@/features/study/lib/speech";
import { normalizeLangCode, toBCP47 } from "@/features/study/lib/languages";
import { buildDidacticSpeechPlan } from "@/features/study/lib/didacticPronunciation";

export type SpeechMode = "natural" | "word-by-word";

export interface PlayOptions {
  langOverride?: string;
  rate?: number;
  pitch?: number;
  mode?: SpeechMode;
  startTimeoutMs?: number;
}

export interface SpeechPlaybackResult {
  success: boolean;
  provider: "native";
  reason: "completed" | "cancelled" | "unsupported" | "empty" | "start-timeout" | "error";
  language: string;
  startedAt: number | null;
  endedAt: number;
  errorCode?: string;
}

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

function splitNaturalSpeech(text: string, maxLength = 180): string[] {
  if (text.length <= maxLength) return [text];
  const sentences = text.match(/[^.!?]+[.!?]?/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = `${current} ${sentence}`.trim();
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = sentence.trim();
  }
  if (current) chunks.push(current);
  return chunks;
}

export function useTTS() {
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeMode, setActiveMode] = useState<SpeechMode | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const sessionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingResolveRef = useRef<((result: SpeechPlaybackResult) => void) | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    clearTimer();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    pendingResolveRef.current?.({
      success: false,
      provider: "native",
      reason: "cancelled",
      language: "",
      startedAt: null,
      endedAt: Date.now(),
    });
    pendingResolveRef.current = null;
    setIsSpeaking(false);
    setActiveMode(null);
  }, [clearTimer]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
      setVoicesLoaded(voicesRef.current.length > 0);
    };
    load();
    const retries = [100, 400, 1000].map((delay) => setTimeout(load, delay));
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => {
      retries.forEach(clearTimeout);
      window.speechSynthesis.removeEventListener?.("voiceschanged", load);
      stop();
    };
  }, [stop]);

  useEffect(() => {
    const cancel = () => stop();
    window.addEventListener("pagehide", cancel);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", cancel);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [stop]);

  const speak = useCallback((text: string, options?: PlayOptions): Promise<SpeechPlaybackResult> => {
    const cleaned = cleanTextForTTS(text);
    const lang = toBCP47(normalizeLangCode(options?.langOverride ?? "en"));
    if (!cleaned) {
      return Promise.resolve({ success: false, provider: "native", reason: "empty", language: lang, startedAt: null, endedAt: Date.now() });
    }
    if (typeof window === "undefined" || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
      return Promise.resolve({ success: false, provider: "native", reason: "unsupported", language: lang, startedAt: null, endedAt: Date.now() });
    }

    stop();
    const session = sessionRef.current;
    const synth = window.speechSynthesis;
    const voice = pickVoice(lang, voicesRef.current.length ? voicesRef.current : synth.getVoices());
    const mode = options?.mode ?? ((options?.rate ?? 1) <= 0.5 ? "word-by-word" : "natural");

    return new Promise((resolve) => {
      pendingResolveRef.current = resolve;
      let startedAt: number | null = null;
      let settled = false;

      const finish = (result: SpeechPlaybackResult) => {
        if (settled || sessionRef.current !== session) return;
        settled = true;
        clearTimer();
        pendingResolveRef.current = null;
        setIsSpeaking(false);
        setActiveMode(null);
        resolve(result);
      };

      const failStart = () => {
        synth.cancel();
        finish({ success: false, provider: "native", reason: "start-timeout", language: lang, startedAt: null, endedAt: Date.now() });
      };

      const markStarted = () => {
        if (startedAt === null) startedAt = Date.now();
        clearTimer();
      };

      const make = (value: string, rate: number, pitch = options?.pitch ?? 1) => {
        const utterance = new SpeechSynthesisUtterance(value);
        utterance.lang = voice?.lang || lang;
        if (voice) utterance.voice = voice;
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.volume = 1;
        utterance.onstart = markStarted;
        return utterance;
      };

      setIsSpeaking(true);
      setActiveMode(mode);
      timerRef.current = setTimeout(failStart, options?.startTimeoutMs ?? 1800);

      if (mode === "natural") {
        const chunks = splitNaturalSpeech(cleaned);
        const playChunk = (index: number) => {
          if (sessionRef.current !== session) return;
          const utterance = make(chunks[index], options?.rate ?? 1);
          utterance.onerror = (event) => finish({ success: false, provider: "native", reason: "error", language: lang, startedAt, endedAt: Date.now(), errorCode: event.error });
          utterance.onend = () => {
            if (index < chunks.length - 1) playChunk(index + 1);
            else finish({ success: true, provider: "native", reason: "completed", language: lang, startedAt, endedAt: Date.now() });
          };
          synth.speak(utterance);
        };
        playChunk(0);
        return;
      }

      const steps = buildDidacticSpeechPlan(cleaned, lang);
      if (steps.length === 0) {
        finish({ success: false, provider: "native", reason: "empty", language: lang, startedAt: null, endedAt: Date.now() });
        return;
      }

      const playStep = (index: number) => {
        if (sessionRef.current !== session) return;
        const step = steps[index];
        const utterance = make(step.text, step.rate, step.pitch);
        utterance.onerror = (event) => finish({ success: false, provider: "native", reason: "error", language: lang, startedAt, endedAt: Date.now(), errorCode: event.error });
        utterance.onend = () => {
          if (index === steps.length - 1) {
            finish({ success: true, provider: "native", reason: "completed", language: lang, startedAt, endedAt: Date.now() });
            return;
          }
          timerRef.current = setTimeout(() => playStep(index + 1), step.pauseAfterMs);
        };
        synth.speak(utterance);
      };
      playStep(0);
    });
  }, [clearTimer, stop]);

  return {
    speak,
    stop,
    voicesLoaded,
    isSpeaking,
    activeMode,
    isSupported: typeof window !== "undefined" && "speechSynthesis" in window,
  };
}
