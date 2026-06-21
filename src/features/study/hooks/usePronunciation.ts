import { useCallback, useEffect, useRef, useState } from "react";

interface UsePronunciationProps {
  lang?: string;
  expectedText?: string;
}

export type PronunciationProvider = "cloud" | "native" | null;

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEventType {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEventType {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventType) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventType) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface PuterSpeechToTextResult {
  text?: string;
  transcript?: string;
  transcription?: string;
}

interface PuterSpeechToTextOptions {
  provider?: "openai" | "xai";
  model?: string;
  language?: string;
  prompt?: string;
  response_format?: string;
  temperature?: number;
}

interface PuterAI {
  speech2txt?: (
    source: Blob | File | string,
    options?: PuterSpeechToTextOptions,
    testMode?: boolean,
  ) => Promise<string | PuterSpeechToTextResult>;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    puter?: {
      ai?: PuterAI;
    };
  }
}

const CLOUD_RECORDING_LIMIT_MS = 8_000;
const NATIVE_LISTENING_LIMIT_MS = 7_000;
const PUTER_SCRIPT_URL = "https://js.puter.com/v2/";

function canRecordAudio(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

function getNativeRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function selectRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/webm",
  ];

  return candidates.find((candidate) => {
    try {
      return MediaRecorder.isTypeSupported(candidate);
    } catch {
      return false;
    }
  });
}

function normalizeTranscription(result: string | PuterSpeechToTextResult): string {
  if (typeof result === "string") return result.trim();
  return (result.text || result.transcript || result.transcription || "").trim();
}

function languageHint(lang: string): string {
  return lang.trim().toLocaleLowerCase().split("-")[0] || "en";
}

function microphoneErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Permissão de microfone negada. Libere o microfone nas configurações do navegador.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Nenhum microfone foi encontrado neste dispositivo.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "O microfone está ocupado por outro aplicativo. Feche-o e tente novamente.";
  }
  if (name === "SecurityError") {
    return "O navegador bloqueou o microfone. Abra o aplicativo por uma conexão segura (HTTPS).";
  }

  return "Não foi possível iniciar o microfone. Verifique a permissão e tente novamente.";
}

function nativeRecognitionErrorMessage(error: string): string | null {
  switch (error) {
    case "aborted":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return "Permissão de microfone negada. Libere o microfone nas configurações do navegador.";
    case "audio-capture":
      return "Não foi possível acessar o microfone. Verifique se ele está disponível.";
    case "no-speech":
      return "Nenhuma fala foi detectada. Tente novamente e fale mais perto do microfone.";
    case "network":
      return "O reconhecimento nativo falhou por causa da rede. Toque novamente para usar o modo compatível.";
    case "language-not-supported":
      return "Este navegador não reconhece o idioma selecionado. Toque novamente para usar o modo compatível.";
    default:
      return "O reconhecimento nativo falhou. Toque novamente para usar o modo compatível.";
  }
}

let puterLoaderPromise: Promise<PuterAI["speech2txt"]> | null = null;

function waitForPuterSpeechToText(timeoutMs: number): Promise<NonNullable<PuterAI["speech2txt"]>> {
  const existing = window.puter?.ai?.speech2txt;
  if (existing) return Promise.resolve(existing.bind(window.puter?.ai));

  if (puterLoaderPromise) {
    return puterLoaderPromise as Promise<NonNullable<PuterAI["speech2txt"]>>;
  }

  puterLoaderPromise = new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>('script[src*="js.puter.com/v2"]');
    if (!script) {
      script = document.createElement("script");
      script.src = PUTER_SCRIPT_URL;
      script.async = true;
      document.head.appendChild(script);
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const speech2txt = window.puter?.ai?.speech2txt;
      if (speech2txt) {
        window.clearInterval(interval);
        resolve(speech2txt.bind(window.puter?.ai));
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(interval);
        puterLoaderPromise = null;
        reject(new Error("puter-speech2txt-timeout"));
      }
    }, 100);

    script.addEventListener(
      "error",
      () => {
        window.clearInterval(interval);
        puterLoaderPromise = null;
        reject(new Error("puter-script-error"));
      },
      { once: true },
    );
  });

  return puterLoaderPromise as Promise<NonNullable<PuterAI["speech2txt"]>>;
}

export function usePronunciation({
  lang = "en-US",
  expectedText = "",
}: UsePronunciationProps = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [provider, setProvider] = useState<PronunciationProvider>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasResultRef = useRef(false);
  const nativeHadErrorRef = useRef(false);
  const forceCloudNextRef = useRef(false);
  const providerRef = useRef<PronunciationProvider>(null);
  const sessionRef = useRef(0);
  const mountedRef = useRef(true);

  const updateProvider = useCallback((next: PronunciationProvider) => {
    providerRef.current = next;
    setProvider(next);
  }, []);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const applyTranscript = useCallback((value: string, session: number) => {
    if (!mountedRef.current || sessionRef.current !== session) return;
    setTranscript(value);
    setAlternatives(value ? [value] : []);
    setError(value ? null : "Nenhuma fala foi detectada. Tente novamente.");
  }, []);

  const transcribeRecording = useCallback(async (blob: Blob, session: number) => {
    if (!mountedRef.current || sessionRef.current !== session) return;

    if (blob.size < 600) {
      applyTranscript("", session);
      updateProvider(null);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const speech2txt = await waitForPuterSpeechToText(8_000);
      const result = await speech2txt(blob, {
        provider: "openai",
        model: "gpt-4o-mini-transcribe",
        language: languageHint(lang),
        response_format: "text",
        temperature: 0,
        prompt: expectedText
          ? `The learner is practicing this phrase: "${expectedText}". Transcribe only what was actually spoken.`
          : undefined,
      });

      applyTranscript(normalizeTranscription(result), session);
    } catch (transcriptionError) {
      console.error("[Pronunciation] Cloud transcription failed:", transcriptionError);
      if (mountedRef.current && sessionRef.current === session) {
        setError("Não foi possível analisar o áudio pela nuvem. Verifique a conexão e tente novamente.");
      }
    } finally {
      if (mountedRef.current && sessionRef.current === session) {
        setIsProcessing(false);
        updateProvider(null);
      }
    }
  }, [applyTranscript, expectedText, lang, updateProvider]);

  const startCloudRecording = useCallback(async (session: number) => {
    clearTimer();
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!mountedRef.current || sessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const mimeType = selectRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128_000 })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = (event) => {
        console.error("[Pronunciation] MediaRecorder error:", event);
        clearTimer();
        setIsListening(false);
        setError("A gravação foi interrompida. Tente novamente.");
        updateProvider(null);
        stopStream();
      };
      recorder.onstop = () => {
        clearTimer();
        setIsListening(false);
        recorderRef.current = null;
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        chunksRef.current = [];
        stopStream();
        void transcribeRecording(blob, session);
      };

      updateProvider("cloud");
      setIsListening(true);
      setIsProcessing(false);
      setError(null);
      recorder.start(250);

      timeoutRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, CLOUD_RECORDING_LIMIT_MS);
    } catch (microphoneError) {
      console.error("[Pronunciation] Microphone start failed:", microphoneError);
      clearTimer();
      stopStream();
      setIsListening(false);
      updateProvider(null);
      setError(microphoneErrorMessage(microphoneError));
    }
  }, [clearTimer, stopStream, transcribeRecording, updateProvider]);

  useEffect(() => {
    mountedRef.current = true;
    const SpeechRecognitionAPI = getNativeRecognitionConstructor();
    const cloudSupported = canRecordAudio();
    setIsSupported(Boolean(SpeechRecognitionAPI || cloudSupported));

    if (!SpeechRecognitionAPI) {
      recognitionRef.current = null;
      return () => {
        mountedRef.current = false;
      };
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
        setIsProcessing(false);
        setError(null);
        updateProvider("native");
        hasResultRef.current = false;
        nativeHadErrorRef.current = false;

        clearTimer();
        timeoutRef.current = setTimeout(() => {
          if (!hasResultRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.stop();
            } catch {
              // Recognition may already be ending.
            }
          }
        }, NATIVE_LISTENING_LIMIT_MS);
      };

      recognition.onresult = (event: SpeechRecognitionEventType) => {
        hasResultRef.current = true;
        clearTimer();

        const result = event.results[0];
        if (!result) return;

        const values = Array.from({ length: result.length }, (_, index) => result[index]?.transcript || "")
          .map((value) => value.trim())
          .filter(Boolean);
        const bestTranscript = values[0] || "";
        setTranscript(bestTranscript);
        setAlternatives(values.length ? values : bestTranscript ? [bestTranscript] : []);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventType) => {
        console.error("[Pronunciation] Native recognition error:", event.error);
        nativeHadErrorRef.current = true;
        clearTimer();

        const message = nativeRecognitionErrorMessage(event.error);
        if (message) setError(message);
        if (["network", "language-not-supported", "service-not-allowed"].includes(event.error)) {
          forceCloudNextRef.current = true;
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        clearTimer();
        setIsListening(false);
        updateProvider(null);
        if (!hasResultRef.current && !nativeHadErrorRef.current) {
          setError("Nenhuma fala foi detectada. Tente novamente e fale mais perto do microfone.");
        }
      };

      recognitionRef.current = recognition;
    } catch (initializationError) {
      console.error("[Pronunciation] Native recognition initialization failed:", initializationError);
      recognitionRef.current = null;
      setIsSupported(cloudSupported);
    }

    return () => {
      mountedRef.current = false;
      sessionRef.current += 1;
      clearTimer();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        try {
          recorder.stop();
        } catch {
          // Ignore shutdown errors.
        }
      }
      recorderRef.current = null;
      stopStream();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore shutdown errors.
        }
      }
      recognitionRef.current = null;
    };
  }, [clearTimer, lang, stopStream, updateProvider]);

  const startNativeRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return false;

    try {
      recognition.lang = lang;
      recognition.start();
      return true;
    } catch (startError) {
      console.warn("[Pronunciation] Native recognition could not start:", startError);
      forceCloudNextRef.current = true;
      return false;
    }
  }, [lang]);

  const startListening = useCallback(async () => {
    if (isListening || isProcessing) return;

    sessionRef.current += 1;
    const session = sessionRef.current;
    setTranscript("");
    setAlternatives([]);
    setError(null);
    hasResultRef.current = false;
    nativeHadErrorRef.current = false;

    const cloudSupported = canRecordAudio();
    const nativeSupported = Boolean(recognitionRef.current);

    if (cloudSupported) {
      const cloudWait = forceCloudNextRef.current || !nativeSupported ? 8_000 : 1_800;
      try {
        await waitForPuterSpeechToText(cloudWait);
        if (sessionRef.current !== session) return;
        forceCloudNextRef.current = false;
        await startCloudRecording(session);
        return;
      } catch (puterError) {
        console.warn("[Pronunciation] Cloud provider not ready; trying native recognition:", puterError);
      }
    }

    if (sessionRef.current !== session) return;
    if (nativeSupported && startNativeRecognition()) return;

    setError(
      cloudSupported
        ? "O serviço de transcrição não carregou. Verifique a conexão e tente novamente."
        : "Este navegador não oferece gravação nem reconhecimento de voz compatível.",
    );
  }, [isListening, isProcessing, startCloudRecording, startNativeRecognition]);

  const stopListening = useCallback(() => {
    clearTimer();

    if (providerRef.current === "cloud") {
      const recorder = recorderRef.current;
      if (recorder && recorder.state === "recording") {
        recorder.stop();
      }
      return;
    }

    if (providerRef.current === "native" && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        setIsListening(false);
        updateProvider(null);
      }
    }
  }, [clearTimer, updateProvider]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setAlternatives([]);
    setError(null);
    hasResultRef.current = false;
    nativeHadErrorRef.current = false;
  }, []);

  return {
    isListening,
    isProcessing,
    transcript,
    alternatives,
    error,
    isSupported,
    provider,
    startListening,
    stopListening,
    resetTranscript,
  };
}
