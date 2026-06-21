export type SpeechMode = "natural" | "word-by-word";
export type SpeechProviderName = "native" | "cloud";

export interface SpeechOutputOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  mode?: SpeechMode;
  voicePreference?: string;
  allowCloudFallback?: boolean;
  signal?: AbortSignal;
}

export interface SpeechPlaybackResult {
  success: boolean;
  provider: SpeechProviderName;
  reason: "completed" | "cancelled" | "unsupported" | "timeout" | "error" | "empty-text";
  language: string;
  startedAt: number | null;
  endedAt: number;
  errorCode?: string;
}

export interface SpeechOutputProvider {
  readonly name: SpeechProviderName;
  isSupported(): boolean;
  speak(text: string, options: Required<Pick<SpeechOutputOptions, "lang" | "rate" | "pitch" | "mode">> & SpeechOutputOptions): Promise<SpeechPlaybackResult>;
  stop(): void;
}

export type PronunciationResultKind = "correct" | "almost" | "incorrect" | "skipped";

export interface PronunciationWordResult {
  word: string;
  score: number | null;
  errorType?: string | null;
}

export interface NormalizedPronunciationResult {
  success: boolean;
  provider: "azure" | "openai-transcription" | "browser";
  assessmentType: "acoustic" | "textual";
  transcript: string;
  normalizedTranscript: string;
  expectedText: string;
  normalizedExpected: string;
  score: number;
  result: PronunciationResultKind;
  confidence: number | null;
  wordResults: PronunciationWordResult[];
  accuracyScore: number | null;
  fluencyScore: number | null;
  completenessScore: number | null;
  prosodyScore: number | null;
  durationMs: number | null;
  warnings: string[];
}
