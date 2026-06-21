import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_TEXT_LENGTH = 2_000;
const REQUEST_TIMEOUT_MS = 20_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function allowRequest(userId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (bucket.count >= 30) return false;
  bucket.count += 1;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, error: "METHOD_NOT_ALLOWED" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { success: false, error: "AUTH_REQUIRED" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return json(401, { success: false, error: "INVALID_TOKEN" });
  if (!allowRequest(user.id)) return json(429, { success: false, error: "RATE_LIMITED" });

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json(503, { success: false, error: "TTS_PROVIDER_NOT_CONFIGURED" });

  let body: { text?: unknown; language?: unknown; rate?: unknown; mode?: unknown; voicePreference?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { success: false, error: "INVALID_JSON" });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const language = typeof body.language === "string" ? body.language.slice(0, 20) : "en-US";
  const mode = body.mode === "word-by-word" ? "word-by-word" : "natural";
  const rate = typeof body.rate === "number" && Number.isFinite(body.rate)
    ? Math.min(2, Math.max(0.5, body.rate))
    : 1;
  const allowedVoices = new Set(["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse", "marin", "cedar"]);
  const requestedVoice = typeof body.voicePreference === "string" ? body.voicePreference : "";
  const voice = allowedVoices.has(requestedVoice) ? requestedVoice : (Deno.env.get("OPENAI_TTS_VOICE") || "coral");

  if (!text) return json(400, { success: false, error: "EMPTY_TEXT" });
  if (text.length > MAX_TEXT_LENGTH) return json(413, { success: false, error: "TEXT_TOO_LONG" });

  const instructions = mode === "word-by-word"
    ? `Speak in ${language}. Pronounce every word separately and clearly, with a noticeable pause between words. Do not add or remove words.`
    : `Speak naturally in ${language}, at approximately ${rate}x speed. Do not add or remove words.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const providerResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_TTS_MODEL") || "gpt-4o-mini-tts",
        voice,
        input: text,
        instructions,
        response_format: "mp3",
      }),
      signal: controller.signal,
    });

    if (!providerResponse.ok) {
      console.error("[tts-synthesize] provider error", providerResponse.status);
      return json(502, { success: false, error: "TTS_PROVIDER_ERROR" });
    }
    const audio = await providerResponse.arrayBuffer();
    if (!audio.byteLength) return json(502, { success: false, error: "EMPTY_PROVIDER_AUDIO" });

    return new Response(audio, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Speech-Provider": "openai",
      },
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return json(timedOut ? 504 : 500, { success: false, error: timedOut ? "TTS_TIMEOUT" : "TTS_INTERNAL_ERROR" });
  } finally {
    clearTimeout(timeout);
  }
});
