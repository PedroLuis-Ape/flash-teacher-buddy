// Text-to-Speech utilities using Puter.js with Web Speech API fallback

// Declare Puter types
declare global {
  interface Window {
    puter?: {
      ai?: {
        txt2speech: (text: string, lang: string) => Promise<HTMLAudioElement>;
      };
    };
  }
}

export async function speakText(text: string, lang: "pt-BR" | "en-US"): Promise<void> {
  const label = `[TTS] (${lang})`;
  try {
    // Prefer Puter.js (free, higher quality)
    if (window.puter?.ai?.txt2speech) {
      try {
        // Try exact locale first
        let audio = await window.puter.ai.txt2speech(text, lang);
        audio.volume = 1;
        await audio.play();
        console.debug(label, "Puter.js playback started (exact)");
        return;
      } catch (errExact) {
        console.warn(label, "Puter exact locale failed, trying base lang...", errExact);
        // Fallback to base language code (e.g., en, pt)
        const baseLang = lang.split('-')[0];
        try {
          const audioBase = await window.puter.ai.txt2speech(text, baseLang);
          audioBase.volume = 1;
          await audioBase.play();
          console.debug(label, "Puter.js playback started (base)");
          return;
        } catch (errBase) {
          console.warn(label, "Puter base locale failed, falling back to Web Speech API", errBase);
        }
      }
    }
  } catch (err) {
    console.warn("Puter TTS access failed, falling back to Web Speech API:", err);
  }

  // Fallback to Web Speech API
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  if (!synth) {
    console.warn(label, "Speech synthesis not supported");
    return;
  }

  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = Number(localStorage.getItem("speechRate") || "1");

    const preferredVoice = localStorage.getItem("speechVoice");
    const voices = synth.getVoices();

    if (preferredVoice) {
      const voice = voices.find(v => v.name === preferredVoice);
      if (voice) utterance.voice = voice;
    } else {
      const langVoices = voices.filter(v => v.lang?.startsWith(lang.split('-')[0]));
      if (langVoices.length > 0) utterance.voice = langVoices[0];
    }

    utterance.onstart = () => console.debug(label, "Web Speech playback started");
    utterance.onend = () => {
      console.debug(label, "Web Speech playback ended");
      resolve();
    };
    utterance.onerror = (e) => {
      console.error(label, "Web Speech error", e);
      resolve();
    };

    try {
      synth.cancel(); // cancel any ongoing speech
      synth.speak(utterance);
    } catch (e) {
      console.error(label, "Failed to speak via Web Speech", e);
      resolve();
    }
  });
}

export function pickLang(
  direction: "pt-en" | "en-pt" | "any",
  text: string
): "pt-BR" | "en-US" {
  if (direction === "pt-en") return "en-US";
  if (direction === "en-pt") return "pt-BR";
  
  // Auto-detect based on accents
  return /[áéíóúâêîôûãõç]/i.test(text) ? "pt-BR" : "en-US";
}

export function getAvailableVoices() {
  const synth = window.speechSynthesis;
  if (!synth) return [];
  
  return synth.getVoices();
}

// Load voices on page load (for fallback Web Speech API)
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

// Wait for Puter.js to load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    if (!window.puter) {
      console.warn("Puter.js not loaded, will use Web Speech API fallback");
    }
  });
}
