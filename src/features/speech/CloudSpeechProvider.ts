import { supabase } from "@/integrations/supabase/client";
import type { SpeechOutputOptions, SpeechOutputProvider, SpeechPlaybackResult } from "./types";

type ProviderOptions = Required<Pick<SpeechOutputOptions, "lang" | "rate" | "pitch" | "mode">> & SpeechOutputOptions;

export class CloudSpeechProvider implements SpeechOutputProvider {
  readonly name = "cloud" as const;
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private abortController: AbortController | null = null;

  isSupported(): boolean {
    return typeof window !== "undefined" && typeof fetch === "function" && typeof Audio !== "undefined";
  }

  stop(): void {
    this.abortController?.abort();
    this.abortController = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.audio = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  async speak(text: string, options: ProviderOptions): Promise<SpeechPlaybackResult> {
    const language = options.lang;
    if (!text.trim()) return this.result(false, "empty-text", language, null);
    if (!this.isSupported()) return this.result(false, "unsupported", language, null);

    this.stop();
    const controller = new AbortController();
    this.abortController = controller;
    const forwardAbort = () => controller.abort();
    options.signal?.addEventListener("abort", forwardAbort, { once: true });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return this.result(false, "error", language, null, "AUTH_REQUIRED");

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(`${baseUrl}/functions/v1/tts-synthesize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          language,
          rate: options.rate,
          mode: options.mode,
          voicePreference: options.voicePreference,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        return this.result(false, "error", language, null, payload?.error || `HTTP_${response.status}`);
      }

      const blob = await response.blob();
      if (!blob.size) return this.result(false, "error", language, null, "EMPTY_AUDIO");
      this.objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(this.objectUrl);
      this.audio = audio;
      const startedAt = await this.playAudio(audio, controller.signal);
      return this.result(true, "completed", language, startedAt);
    } catch (error) {
      const aborted = controller.signal.aborted || options.signal?.aborted;
      const code = error instanceof Error ? error.message : "CLOUD_SPEECH_ERROR";
      return this.result(false, aborted ? "cancelled" : "error", language, null, code);
    } finally {
      options.signal?.removeEventListener("abort", forwardAbort);
      if (this.abortController === controller) this.abortController = null;
      if (this.objectUrl) {
        URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = null;
      }
      this.audio = null;
    }
  }

  private playAudio(audio: HTMLAudioElement, signal: AbortSignal): Promise<number> {
    return new Promise((resolve, reject) => {
      let startedAt = 0;
      const cleanup = () => {
        audio.removeEventListener("playing", onPlaying);
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
        signal.removeEventListener("abort", onAbort);
      };
      const onPlaying = () => { startedAt = startedAt || Date.now(); };
      const onEnded = () => { cleanup(); resolve(startedAt || Date.now()); };
      const onError = () => { cleanup(); reject(new Error("AUDIO_PLAYBACK_ERROR")); };
      const onAbort = () => { audio.pause(); cleanup(); reject(new Error("ABORTED")); };
      audio.addEventListener("playing", onPlaying);
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);
      signal.addEventListener("abort", onAbort, { once: true });
      audio.play().catch((error) => {
        cleanup();
        reject(new Error(error instanceof Error && error.name === "NotAllowedError" ? "AUTOPLAY_BLOCKED" : "AUDIO_PLAY_REJECTED"));
      });
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
      provider: "cloud",
      reason,
      language,
      startedAt,
      endedAt: Date.now(),
      ...(errorCode ? { errorCode } : {}),
    };
  }
}
