import { useState, useEffect, useRef, useCallback } from 'react';

interface UsePronunciationProps {
  lang?: string;
}

// Type declarations for Web Speech API
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

export function usePronunciation({ lang = 'en-US' }: UsePronunciationProps = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasResultRef = useRef(false);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true; // Enable interim results for faster feedback
    recognition.maxAlternatives = 3;   // Get up to 3 alternatives
    recognition.lang = lang;

    recognition.onstart = () => {
      console.log('🎤 [Pronunciation] Started listening...');
      setIsListening(true);
      setError(null);
      hasResultRef.current = false;

      // Set timeout for no speech detection (2.5s)
      timeoutRef.current = setTimeout(() => {
        if (!hasResultRef.current && recognitionRef.current) {
          console.log('⏱️ [Pronunciation] Timeout - no speech detected');
          recognitionRef.current.stop();
          setError('Nenhuma fala detectada. Tente novamente.');
        }
      }, 2500);
    };

    recognition.onend = () => {
      console.log('🛑 [Pronunciation] Stopped listening.');
      setIsListening(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    recognition.onresult = (event: SpeechRecognitionEventType) => {
      hasResultRef.current = true;
      
      // Clear timeout since we got a result
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const result = event.results[event.results.length - 1];
      
      // Only process final results
      if (result.isFinal) {
        // Get all alternatives
        const allAlternatives: string[] = [];
        for (let i = 0; i < result.length; i++) {
          const alt = result[i];
          if (alt && alt.transcript) {
            allAlternatives.push(alt.transcript);
          }
        }

        const bestTranscript = allAlternatives[0] || '';
        console.log('📝 [Pronunciation] Final result:', bestTranscript);
        console.log('📝 [Pronunciation] Alternatives:', allAlternatives);
        
        setTranscript(bestTranscript);
        setAlternatives(allAlternatives);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventType) => {
      console.error('⚠️ [Pronunciation] Error:', event.error);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (event.error === 'not-allowed') {
        setError('Permissão de microfone negada.');
      } else if (event.error === 'no-speech') {
        setError('Nenhuma fala detectada. Tente novamente.');
      } else if (event.error === 'aborted') {
        // Ignore aborted errors (user stopped manually)
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
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [lang]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) return;
    setTranscript('');
    setAlternatives([]);
    setError(null);
    hasResultRef.current = false;
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
    setAlternatives([]);
    setError(null);
    setIsListening(false);
    hasResultRef.current = false;
  }, []);

  return {
    isListening,
    transcript,
    alternatives,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript
  };
}
