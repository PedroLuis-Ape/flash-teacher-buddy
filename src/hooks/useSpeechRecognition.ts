import { useState, useEffect, useRef, useCallback } from 'react';

interface UseSpeechRecognitionProps {
  lang?: string;
  timeoutMs?: number;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

/**
 * Hook para reconhecimento de voz usando Web Speech API
 * @param lang - Idioma (default 'en-US')
 * @param timeoutMs - Timeout em ms para parar de ouvir automaticamente (default 5000)
 */
export function useSpeechRecognition({ 
  lang = 'en-US', 
  timeoutMs = 5000 
}: UseSpeechRecognitionProps = {}): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      console.warn('[useSpeechRecognition] Web Speech API not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang; // CRÍTICO: força idioma
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('[useSpeechRecognition] Started listening in:', lang);
      setIsListening(true);
      isListeningRef.current = true;
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      
      // Mostrar transcrição final ou interina
      const displayTranscript = finalTranscript || interimTranscript;
      if (displayTranscript) {
        setTranscript(displayTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[useSpeechRecognition] Error:', event.error);
      setIsListening(false);
      isListeningRef.current = false;
      
      if (event.error === 'not-allowed') {
        setError('Permissão de microfone negada. Por favor, permita o acesso ao microfone.');
      } else if (event.error === 'no-speech') {
        // Não é um erro crítico, apenas não detectou fala
        setError(null);
      } else if (event.error === 'audio-capture') {
        setError('Nenhum microfone encontrado.');
      } else if (event.error !== 'aborted') {
        setError('Erro no reconhecimento de voz.');
      }
    };

    recognition.onend = () => {
      console.log('[useSpeechRecognition] Stopped');
      setIsListening(false);
      isListeningRef.current = false;
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [lang]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) {
      console.warn('[useSpeechRecognition] Cannot start - not supported or not initialized');
      return;
    }
    
    if (isListeningRef.current) {
      console.log('[useSpeechRecognition] Already listening');
      return;
    }

    setTranscript('');
    setError(null);
    
    try {
      recognitionRef.current.start();
      
      // Timeout de segurança: parar após X segundos de silêncio
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        console.log('[useSpeechRecognition] Timeout - stopping');
        if (recognitionRef.current && isListeningRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {
            // Ignore
          }
        }
      }, timeoutMs);
      
    } catch (err) {
      console.error('[useSpeechRecognition] Start error:', err);
      setError('Erro ao iniciar reconhecimento de voz.');
    }
  }, [isSupported, timeoutMs]);

  const stopListening = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (recognitionRef.current && isListeningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
