import { useState, useEffect, useRef, useCallback } from 'react';

interface UsePronunciationProps {
  lang?: string;
}

// Type declarations for Web Speech API
interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult[];
  [index: number]: SpeechRecognitionResult[];
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

export function usePronunciation({ lang = 'en-US' }: UsePronunciationProps = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang;

    recognition.onstart = () => {
      console.log('🎤 [Pronunciation] Started listening...');
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      console.log('🛑 [Pronunciation] Stopped listening.');
      setIsListening(false);
    };

    recognition.onresult = (event: SpeechRecognitionEventType) => {
      const currentTranscript = event.results[0][0].transcript;
      console.log('📝 [Pronunciation] Result:', currentTranscript);
      setTranscript(currentTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventType) => {
      console.error('⚠️ [Pronunciation] Error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Permissão de microfone negada.');
      } else if (event.error === 'no-speech') {
        setError('Nenhuma fala detectada. Tente novamente.');
      } else {
        setError(`Erro: ${event.error}`);
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [lang]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) return;
    setTranscript('');
    setError(null);
    try {
      recognitionRef.current.lang = lang;
      recognitionRef.current.start();
    } catch (err) {
      console.warn('[Pronunciation] Start called while active');
    }
  }, [lang, isSupported]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
    setIsListening(false);
  }, []);

  return {
    isListening,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript
  };
}
