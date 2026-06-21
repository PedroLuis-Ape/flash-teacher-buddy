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

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const NATIVE_LISTENING_LIMIT_MS = 7_000;

function getNativeRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
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
      return "O reconhecimento de voz do navegador falhou por causa da conexão. Tente novamente.";
    case "language-not-supported":
      return "Este navegador ainda não reconhece o idioma selecionado.";
    default:
      return "Não foi possível reconhecer sua fala neste navegador. Tente novamente ou pule o exercício.";
  }
}

export function usePronunciation({
  lang = "en-US",
}: UsePronunciationProps = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [provider, setProvider] = useState<PronunciationProvider>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasResultRef = useRef(false);
  const recognitionHadErrorRef = useRef(false);
  const mountedRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const SpeechRecognitionAPI = getNativeRecognitionConstructor();
    setIsSupported(Boolean(SpeechRecognitionAPI));

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
        if (!mountedRef.current) return;
        setIsListening(true);
        setError(null);
        setProvider("native");
        hasResultRef.current = false;
        recognitionHadErrorRef.current = false;

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
        if (!mountedRef.current) return;
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
        setError(bestTranscript ? null : "Nenhuma fala foi detectada. Tente novamente.");
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventType) => {
        if (!mountedRef.current) return;
        console.error("[Pronunciation] Native recognition error:", event.error);
        recognitionHadErrorRef.current = true;
        clearTimer();
        setIsListening(false);
        setProvider(null);

        const message = nativeRecognitionErrorMessage(event.error);
        if (message) setError(message);
      };

      recognition.onend = () => {
        if (!mountedRef.current) return;
        clearTimer();
        setIsListening(false);
        setProvider(null);

        if (!hasResultRef.current && !recognitionHadErrorRef.current) {
          setError("Nenhuma fala foi detectada. Tente novamente e fale mais perto do microfone.");
        }
      };

      recognitionRef.current = recognition;
    } catch (initializationError) {
      console.error("[Pronunciation] Native recognition initialization failed:", initializationError);
      recognitionRef.current = null;
      setIsSupported(false);
    }

    return () => {
      mountedRef.current = false;
      clearTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore shutdown errors.
        }
      }
      recognitionRef.current = null;
    };
  }, [clearTimer, lang]);

  const startListening = useCallback(async () => {
    if (isListening) return;

    setTranscript("");
    setAlternatives([]);
    setError(null);
    hasResultRef.current = false;
    recognitionHadErrorRef.current = false;

    const recognition = recognitionRef.current;
    if (!recognition) {
      setIsSupported(false);
      setError("A prática de pronúncia ainda não é compatível com este navegador. Tente usar Chrome ou Edge, ou pule o exercício.");
      return;
    }

    try {
      recognition.lang = lang;
      recognition.start();
    } catch (startError) {
      console.warn("[Pronunciation] Native recognition could not start:", startError);
      setError("Não foi possível iniciar o reconhecimento de voz. Aguarde um instante e tente novamente.");
      setIsListening(false);
      setProvider(null);
    }
  }, [isListening, lang]);

  const stopListening = useCallback(() => {
    clearTimer();
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.stop();
    } catch {
      setIsListening(false);
      setProvider(null);
    }
  }, [clearTimer]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setAlternatives([]);
    setError(null);
    hasResultRef.current = false;
    recognitionHadErrorRef.current = false;
  }, []);

  return {
    isListening,
    isProcessing: false,
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
