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
    // Safe fallback for SpeechRecognition API
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    
    if (!SpeechRecognitionAPI) {
      console.warn('🚫 [Pronunciation] SpeechRecognition not supported in this browser');
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      
      // STABLE SETTINGS - reverted to avoid bugs
      recognition.continuous = false;
      recognition.interimResults = false; // Disabled for stability
      recognition.maxAlternatives = 1;    // Single result for reliability
      recognition.lang = lang;

      recognition.onstart = () => {
        console.log('🎤 [Pronunciation] Started listening...');
        setIsListening(true);
        setError(null);
        hasResultRef.current = false;

        // Set timeout for no speech detection (3s - slightly longer for stability)
        timeoutRef.current = setTimeout(() => {
          if (!hasResultRef.current && recognitionRef.current) {
            console.log('⏱️ [Pronunciation] Timeout - no speech detected');
            try {
              recognitionRef.current.stop();
            } catch (e) {
              console.warn('[Pronunciation] Stop error:', e);
            }
            setError('Nenhuma fala detectada. Tente novamente.');
            setIsListening(false);
          }
        }, 3000);
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

        // Get the final result
        const result = event.results[0];
        if (result) {
          const bestTranscript = result[0]?.transcript || '';
          console.log('📝 [Pronunciation] Result:', bestTranscript);
          
          setTranscript(bestTranscript);
          // Put transcript as single alternative for evaluation
          setAlternatives(bestTranscript ? [bestTranscript] : []);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventType) => {
        console.error('⚠️ [Pronunciation] Error:', event.error);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        if (event.error === 'not-allowed') {
          setError('Permissão de microfone negada. Clique no ícone 🔒 na barra de endereço.');
        } else if (event.error === 'no-speech') {
          setError('Nenhuma fala detectada. Tente novamente.');
        } else if (event.error === 'network') {
          setError('Erro de rede. Verifique sua conexão.');
        } else if (event.error === 'aborted') {
          // Ignore aborted errors (user stopped manually)
        } else {
          setError(`Erro de reconhecimento: ${event.error}`);
        }
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.error('[Pronunciation] Failed to initialize:', e);
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore abort errors
        }
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
