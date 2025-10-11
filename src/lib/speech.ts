// Text-to-Speech utilities using native Web Speech API

export async function speakText(text: string, lang: "pt-BR" | "en-US"): Promise<void> {
  const label = `[TTS] (${lang})`;
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
  if (direction === "pt-en") return "pt-BR";
  if (direction === "en-pt") return "en-US";
  
  // Auto-detect based on accents
  return /[áéíóúâêîôûãõç]/i.test(text) ? "pt-BR" : "en-US";
}

export function getAvailableVoices() {
  const synth = window.speechSynthesis;
  if (!synth) return [];
  
  return synth.getVoices();
}

// Load voices on page load
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}
