/**
 * AudioService - Robust Web Speech API TTS Engine
 * Replaces ElevenLabs with browser-native speech synthesis
 */

export type CardSide = 'front' | 'back';
export type LanguageCode = 'en-US' | 'pt-BR';

export interface PlayOptions {
  side?: CardSide;          // 'front' => en-US, 'back' => pt-BR
  langOverride?: LanguageCode; // if present, overrides 'side' logic
}

class AudioService {
  private static _instance: AudioService;
  private isSpeechAvailable: boolean = false;
  private voices: SpeechSynthesisVoice[] = [];
  private cachedVoices: Partial<Record<LanguageCode, SpeechSynthesisVoice | null>> = {};

  private constructor() {
    this.isSpeechAvailable =
      typeof window !== 'undefined' &&
      typeof window.speechSynthesis !== 'undefined';

    if (this.isSpeechAvailable) {
      this.loadVoices();
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        this.loadVoices(true);
      });
    }
  }

  public static get instance(): AudioService {
    if (!AudioService._instance) {
      AudioService._instance = new AudioService();
    }
    return AudioService._instance;
  }

  /**
   * Load available voices and cache them
   */
  private loadVoices(forceReset: boolean = false): void {
    if (!this.isSpeechAvailable) return;
    
    const list = window.speechSynthesis.getVoices();
    if (list && list.length) {
      this.voices = list;
      if (forceReset) {
        this.cachedVoices = {};
      }
      console.log('[AudioService] Loaded', list.length, 'voices');
    }
  }

  /**
   * Sanitize text - remove parentheses, brackets, curly braces and their content
   */
  private sanitizeText(text: string): string {
    let cleaned = text;
    
    // Remove parentheses and content
    cleaned = cleaned.replace(/\([^)]*\)/g, '');
    
    // Remove square brackets and content
    cleaned = cleaned.replace(/\[[^\]]*\]/g, '');
    
    // Remove curly braces and content
    cleaned = cleaned.replace(/\{[^}]*\}/g, '');
    
    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  /**
   * Try to split text by slash (/) for mixed EN/PT content
   * Returns [segmentEn, segmentPt] or null if not applicable
   */
  private trySplitBySlash(text: string): [string, string] | null {
    // Prefer " / " (with spaces)
    let parts = text.split(' / ');
    
    // Fallback to just "/"
    if (parts.length < 2) {
      parts = text.split('/');
    }
    
    if (parts.length < 2) {
      return null;
    }
    
    // First part is EN, rest is PT
    const segmentEn = parts[0].trim();
    const segmentPt = parts.slice(1).join('/').trim();
    
    if (!segmentEn || !segmentPt) {
      return null;
    }
    
    return [segmentEn, segmentPt];
  }

  /**
   * Chunk text into smaller pieces to prevent browser cutoffs
   * Max length in characters per chunk
   */
  private chunkText(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) {
      return [text];
    }

    const result: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
    
    let current = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      // If adding this sentence keeps us under maxLen, append it
      if ((current + ' ' + trimmedSentence).length <= maxLen) {
        current = current ? current + ' ' + trimmedSentence : trimmedSentence;
      } else {
        // Push current chunk if not empty
        if (current) {
          result.push(current.trim());
        }
        
        // If this single sentence is too long, hard split it
        if (trimmedSentence.length > maxLen) {
          for (let i = 0; i < trimmedSentence.length; i += maxLen) {
            const slice = trimmedSentence.slice(i, i + maxLen).trim();
            if (slice) {
              result.push(slice);
            }
          }
          current = '';
        } else {
          current = trimmedSentence;
        }
      }
    }
    
    if (current) {
      result.push(current.trim());
    }
    
    return result;
  }

  /**
   * Pick the best voice for the given language
   */
  private pickVoice(lang: LanguageCode): SpeechSynthesisVoice | null {
    // Check cache
    if (this.cachedVoices[lang] !== undefined) {
      return this.cachedVoices[lang] || null;
    }

    const langPrefix = lang === 'en-US' ? 'en' : 'pt';
    const candidates = this.voices.filter(v =>
      v.lang.toLowerCase().startsWith(langPrefix)
    );

    if (candidates.length === 0) {
      this.cachedVoices[lang] = null;
      return null;
    }

    // Priority voices
    const priorities = lang === 'en-US'
      ? ['Google US English', 'Microsoft David']
      : ['Google português do Brasil', 'Google Português', 'Microsoft Maria'];

    for (const priority of priorities) {
      const found = candidates.find(v =>
        v.name.toLowerCase().includes(priority.toLowerCase())
      );
      if (found) {
        this.cachedVoices[lang] = found;
        return found;
      }
    }

    // Fallback to first candidate
    const fallback = candidates[0];
    this.cachedVoices[lang] = fallback;
    return fallback;
  }

  /**
   * Create an utterance with proper settings
   */
  private createUtterance(text: string, lang: LanguageCode): SpeechSynthesisUtterance {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    
    // Pick voice
    const voice = this.pickVoice(lang);
    if (voice) {
      utterance.voice = voice;
    }
    
    // Apply speech rate from localStorage if available
    const storedRate = localStorage.getItem('speechRate');
    utterance.rate = storedRate ? Number(storedRate) : 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    return utterance;
  }

  /**
   * Speak a queue of utterances sequentially
   */
  private speakQueue(queue: SpeechSynthesisUtterance[]): void {
    if (!this.isSpeechAvailable || queue.length === 0) {
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    let index = 0;
    
    const speakNext = () => {
      if (index >= queue.length) {
        console.log('[AudioService] Finished speaking queue');
        return;
      }

      const utterance = queue[index];
      index++;

      utterance.onend = speakNext;
      utterance.onerror = (e) => {
        console.error('[AudioService] Utterance error:', e);
        speakNext();
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  }

  /**
   * Main TTS function - smart audio routing
   */
  public playSmartAudio(rawText: string, options?: PlayOptions): void {
    if (!this.isSpeechAvailable) {
      console.warn('[AudioService] Speech synthesis not available');
      return;
    }

    // 1. Sanitize
    const cleaned = this.sanitizeText(rawText);
    if (!cleaned) {
      console.debug('[AudioService] Text empty after sanitization');
      return;
    }

    console.log('[AudioService] Playing:', cleaned);

    // 2. Check for mixed EN/PT (contains "/")
    const split = this.trySplitBySlash(cleaned);
    
    if (split) {
      // Mixed language: EN / PT
      const [segmentEn, segmentPt] = split;
      const queue: SpeechSynthesisUtterance[] = [];

      // English chunks
      const enChunks = this.chunkText(segmentEn, 200);
      for (const chunk of enChunks) {
        queue.push(this.createUtterance(chunk, 'en-US'));
      }

      // Portuguese chunks
      const ptChunks = this.chunkText(segmentPt, 200);
      for (const chunk of ptChunks) {
        queue.push(this.createUtterance(chunk, 'pt-BR'));
      }

      this.speakQueue(queue);
    } else {
      // Single language
      let lang: LanguageCode;
      
      if (options?.langOverride) {
        lang = options.langOverride;
      } else if (options?.side === 'back') {
        lang = 'pt-BR';
      } else {
        lang = 'en-US';
      }

      const chunks = this.chunkText(cleaned, 200);
      const queue = chunks.map(chunk => this.createUtterance(chunk, lang));
      
      this.speakQueue(queue);
    }
  }

  /**
   * Stop all ongoing speech
   */
  public stop(): void {
    if (!this.isSpeechAvailable) return;
    window.speechSynthesis.cancel();
  }
}

export const audioService = AudioService.instance;

/**
 * Helper function for convenience
 */
export function playSmartAudio(text: string, options?: PlayOptions): void {
  audioService.playSmartAudio(text, options);
}
