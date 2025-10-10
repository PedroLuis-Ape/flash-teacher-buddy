// Edge-TTS client for high-quality, free text-to-speech

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`;

export async function speak(text: string, voice = "en-US-JennyNeural") {
  try {
    console.log(`[Edge-TTS] Speaking: "${text.substring(0, 50)}..." with voice: ${voice}`);
    
    const url = `${TTS_URL}?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`;
    
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "TTS request failed");
    }

    const blob = await res.blob();
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    
    await audio.play();
    
    // Clean up blob URL after playing
    audio.onended = () => URL.revokeObjectURL(audioUrl);
    
    console.log("[Edge-TTS] Playback started");
  } catch (error) {
    console.error("[Edge-TTS] Error:", error);
    throw error;
  }
}

// Voice mapping for Portuguese and English
export const VOICES = {
  "pt-BR": "pt-BR-AntonioNeural",
  "en-US": "en-US-JennyNeural",
} as const;

export function getVoiceForLang(lang: "pt-BR" | "en-US"): string {
  return VOICES[lang];
}
