import { toBCP47 } from "@/features/study/lib/languages";
import { CloudSpeechProvider } from "./CloudSpeechProvider";
import { NativeSpeechProvider } from "./NativeSpeechProvider";
import type { SpeechOutputOptions, SpeechPlaybackResult } from "./types";

export class SpeechOutputService {
  private readonly native = new NativeSpeechProvider();
  private readonly cloud = new CloudSpeechProvider();

  isSupported(): boolean {
    return this.native.isSupported() || this.cloud.isSupported();
  }

  stop(): void {
    this.native.stop();
    this.cloud.stop();
  }

  async speak(text: string, options: SpeechOutputOptions = {}): Promise<SpeechPlaybackResult> {
    const normalized: Required<Pick<SpeechOutputOptions, "lang" | "rate" | "pitch" | "mode">> & SpeechOutputOptions = {
      ...options,
      lang: toBCP47(options.lang || "en"),
      rate: Math.min(2, Math.max(0.5, options.rate ?? 1)),
      pitch: Math.min(2, Math.max(0, options.pitch ?? 1)),
      mode: options.mode ?? "natural",
      allowCloudFallback: options.allowCloudFallback ?? true,
    };

    const nativeResult = await this.native.speak(text, normalized);
    if (nativeResult.success) return nativeResult;
    if (!normalized.allowCloudFallback || nativeResult.reason === "cancelled" || nativeResult.reason === "empty-text") {
      return nativeResult;
    }

    return this.cloud.speak(text, normalized);
  }
}
