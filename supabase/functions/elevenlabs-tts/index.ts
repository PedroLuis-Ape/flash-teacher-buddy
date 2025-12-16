import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Multilingual voice mappings - these voices work well with eleven_multilingual_v2
const VOICE_MAPPING: Record<string, string> = {
  // English voices
  "en": "EXAVITQu4vr4xnSDxMaL",      // Sarah - clear female
  "en-US": "EXAVITQu4vr4xnSDxMaL",
  "en-GB": "IKne3meq5aSn9XLyUdCD",   // Charlie - British male
  // Portuguese
  "pt": "TX3LPaxmHKxFdv7VOQHJ",      // Liam - works well with Portuguese
  "pt-BR": "TX3LPaxmHKxFdv7VOQHJ",
  "pt-PT": "TX3LPaxmHKxFdv7VOQHJ",
  // Spanish
  "es": "pFZP5JQG7iQjIQuC4Bku",      // Lily - works well with Spanish
  "es-ES": "pFZP5JQG7iQjIQuC4Bku",
  "es-MX": "pFZP5JQG7iQjIQuC4Bku",
  // French
  "fr": "XrExE9yKIg1WjnnlVkGX",      // Matilda - works well with French
  "fr-FR": "XrExE9yKIg1WjnnlVkGX",
  // German
  "de": "onwK4e9ZLuTAKqWW03F9",      // Daniel - works well with German
  "de-DE": "onwK4e9ZLuTAKqWW03F9",
  // Italian
  "it": "cgSgspJ2msm6clMCkdW9",      // Jessica - works well with Italian
  "it-IT": "cgSgspJ2msm6clMCkdW9",
};

// Default fallback voice (multilingual capable)
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice_id, lang } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.error("[ElevenLabs TTS] Invalid text input");
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      console.error("[ElevenLabs TTS] API key not configured");
      return new Response(
        JSON.stringify({ error: "TTS service not configured" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Resolve voice ID: explicit voice_id > language mapping > default
    let resolvedVoiceId = voice_id;
    if (!resolvedVoiceId && lang) {
      resolvedVoiceId = VOICE_MAPPING[lang] || VOICE_MAPPING[lang.split('-')[0]];
    }
    if (!resolvedVoiceId) {
      resolvedVoiceId = DEFAULT_VOICE_ID;
    }

    console.log(`[ElevenLabs TTS] Generating audio for: "${text.substring(0, 50)}..." with voice: ${resolvedVoiceId}, lang: ${lang || 'auto'}`);

    const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}`;
    
    const response = await fetch(elevenLabsUrl, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ElevenLabs TTS] API error (${response.status}):`, errorText);
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "Invalid API key" }),
          { 
            status: 401, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { 
            status: 429, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to generate speech" }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const audioData = await response.arrayBuffer();
    console.log(`[ElevenLabs TTS] Successfully generated ${audioData.byteLength} bytes of audio`);

    return new Response(audioData, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("[ElevenLabs TTS] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
