// Text-to-Speech utilities using Web Speech API

export function speakText(text: string, lang: "pt-BR" | "en-US") {
  const synth = window.speechSynthesis;
  if (!synth) {
    console.warn("Speech synthesis not supported");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = Number(localStorage.getItem("speechRate") || "1");
  
  const preferredVoice = localStorage.getItem("speechVoice");
  const voices = synth.getVoices();
  
  if (preferredVoice) {
    const voice = voices.find(v => v.name === preferredVoice);
    if (voice) utterance.voice = voice;
  } else {
    // Auto-select best voice for language
    const langVoices = voices.filter(v => v.lang.startsWith(lang.split('-')[0]));
    if (langVoices.length > 0) {
      utterance.voice = langVoices[0];
    }
  }
  
  synth.cancel(); // Cancel any ongoing speech
  synth.speak(utterance);
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

// Load voices on page load (some browsers need this)
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}
