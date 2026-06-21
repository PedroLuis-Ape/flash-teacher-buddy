import { cleanTextForTTS } from "@/features/study/lib/speech";
import { buildDidacticSpeechPlan } from "@/features/study/lib/didacticPronunciation";
import { toBCP47 } from "@/features/study/lib/languages";
import type { SpeechOutputOptions, SpeechOutputProvider, SpeechPlaybackResult } from "./types";

export const WORD_BY_WORD_RATE = 0.72;
export const WORD_PAUSE_MS = 350;
const START_WATCHDOG_MS = 2200;
const NATURAL_CHUNK_LIMIT = 220;

type ProviderOptions = Required<Pick<SpeechOutputOptions, "lang" | "rate" | "pitch" | "mode">> & SpeechOutputOptions;

type PlaybackStep = {
  text: string;
  rate: number;
  pitch: number;
  pauseAfterMs: number;
};

function pickVoice(lang: string, preference?: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const requested = toBCP47(lang).toLowerCase();
  const prefix = requested.split("-")[0];
  const rank = (pool: SpeechSynthesisVoice[]) => {
    if (preference) {
      const preferred = pool.find((voice) => voice.name.toLowerCase().includes(preference.toLowerCase()));
      if (preferred) return preferred;
    }
    return pool.find((voice) => voice.name.toLowerCase().includes("google"))
      || pool.find((voice) => /microsoft|natural|neural|enhanced/i.test(voice.name))
      || pool[0]
      || null;
  };

  return rank(voices.filter((voice) => voice.lang.toLowerCase() === requested))
    || rank(voices.filter((voice) => voice.lang.toLowerCase().startsWith(`${prefix}-`)));
}

function chunkNaturalText(text: string): string[] {
  if (text.length <= NATURAL_CHUNK_LIMIT) return [text];
  const sentences = text.match(/[^.!?]+[.!?]?/g)?.map((part) => part.trim()).filter(Boolean) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }
    if (`${current} ${sentence}`.length <= NATURAL_CHUNK_LIMIT) {
      current = `${current} ${sentence}`;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function createPlaybackSteps(text: string, language: string, options: ProviderOptions): PlaybackStep[] {
  if (options.mode === "word-by-word") {
    return buildDidacticSpeechPlan(text, language).map((step) => ({
      text: step.text,
      rate: step.rate,
      pitch: step.pitch,
      pauseAfterMs: step.pauseAfterMs,
    }));
  }

  return chunkNaturalText(text).map((part) => ({
    text: part,
    rate: options.rate,
    pitch: options.pitch,
    pauseAfterMs: 0,
  }));
}

export class NativeSpeechProvider implements SpeechOutputProvider {
  readonly name = "native" as const;
  private session = 0;
  private timers = new Set<ReturnType<typeof setTimeout>>();

  isSupported(): boolean {
    return typeof window !== "undefined"
      && "speechSynthesis" in window
      && "SpeechSynthesisUtterance" in window;
  }

  stop(): void {
    this.session += 1;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    if (this.isSupported()) window.speechSynthesis.cancel();
  }

  async speak(text: string, options: ProviderOptions): Promise<SpeechPlaybackResult> {
    const language = toBCP47(options.lang);
    const cleaned = cleanTextForTTS(text);
    if (!cleaned) return this.result(false, "empty-text", language, null);
    if (!this.isSupported()) return this.result(false, "unsupported", language, null);

    this.stop();
    const session = this.session;
    const startedAtRef: { value: number | null } = { value: null };
    const voice = pickVoice(language, options.voicePreference);
    const steps = createPlaybackSteps(cleaned, language, options);

    try {
      for (let index = 0; index < steps.length; index += 1) {
        if (session !== this.session || options.signal?.aborted) {
          return this.result(false, "cancelled", language, startedAtRef.value);
        }

        const step = steps[index];
        const outcome = await this.playPart(
          step.text,
          language,
          voice,
          step.rate,
          step.pitch,
          session,
          options.signal,
        );
        if (outcome.startedAt && startedAtRef.value === null) startedAtRef.value = outcome.startedAt;
        if (!outcome.success) return this.result(false, outcome.reason, language, startedAtRef.value, outcome.errorCode);

        if (step.pauseAfterMs > 0 && index < steps.length - 1) {
          await this.delay(step.pauseAfterMs, session, options.signal);
        }
      }
      return this.result(true, "completed", language, startedAtRef.value);
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "NATIVE_SPEECH_ERROR";
      return this.result(false, options.signal?.aborted ? "cancelled" : "error", language, startedAtRef.value, errorCode);
    }
  }

  private playPart(
    value: string,
    language: string,
    voice: SpeechSynthesisVoice | null,
    rate: number,
    pitch: number,
    session: number,
    signal?: AbortSignal,
  ): Promise<{ success: boolean; reason: SpeechPlaybackResult["reason"]; startedAt: number | null; errorCode?: string }> {
    return new Promise((resolve) => {
      let settled = false;
      let startedAt: number | null = null;
      const utterance = new SpeechSynthesisUtterance(value);
      utterance.lang = voice?.lang || language;
      utterance.voice = voice;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = 1;

      const finish = (success: boolean, reason: SpeechPlaybackResult["reason"], errorCode?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        this.timers.delete(watchdog);
        signal?.removeEventListener("abort", onAbort);
        resolve({ success, reason, startedAt, errorCode });
      };
      const onAbort = () => {
        window.speechSynthesis.cancel();
        finish(false, "cancelled", "ABORTED");
      };
      const watchdog = setTimeout(() => {
        window.speechSynthesis.cancel();
        finish(false, "timeout", "NATIVE_START_TIMEOUT");
      }, START_WATCHDOG_MS);
      this.timers.add(watchdog);

      utterance.onstart = () => {
        if (session !== this.session) return finish(false, "cancelled", "STALE_SESSION");
        startedAt = Date.now();
      };
      utterance.onend = () => finish(true, "completed");
      utterance.onerror = (event) => finish(false, event.error === "canceled" ? "cancelled" : "error", event.error || "NATIVE_UTTERANCE_ERROR");
      signal?.addEventListener("abort", onAbort, { once: true });
      window.speechSynthesis.speak(utterance);
    });
  }

  private delay(ms: number, session: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        if (session !== this.session || signal?.aborted) reject(new Error("ABORTED"));
        else resolve();
      }, ms);
      this.timers.add(timer);
    });
  }

  private result(
    success: boolean,
    reason: SpeechPlaybackResult["reason"],
    language: string,
    startedAt: number | null,
    errorCode?: string,
  ): SpeechPlaybackResult {
    return {
      success,
      provider: "native",
      reason,
      language,
      startedAt,
      endedAt: Date.now(),
      ...(errorCode ? { errorCode } : {}),
    };
  }
}
