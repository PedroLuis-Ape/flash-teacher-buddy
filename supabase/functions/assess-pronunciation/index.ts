import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_EXPECTED_LENGTH = 1_000;
const REQUEST_TIMEOUT_MS = 25_000;
const allowedMimes = new Set([
  "audio/webm", "audio/webm;codecs=opus", "audio/mp4", "audio/aac",
  "audio/wav", "audio/x-wav", "audio/ogg", "audio/ogg;codecs=opus", "audio/mpeg",
]);
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function allowRequest(userId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (bucket.count >= 20) return false;
  bucket.count += 1;
  return true;
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

function textualScore(expected: string, actual: string): number {
  const a = normalize(expected);
  const b = normalize(actual);
  if (!a || !b) return 0;
  return Math.max(0, Math.round((1 - levenshtein(a, b) / Math.max(a.length, b.length)) * 100));
}

function resultKind(score: number) {
  return score >= 85 ? "correct" : score >= 65 ? "almost" : "incorrect";
}

function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function azureContentType(mime: string): string | null {
  if (mime.includes("wav")) return "audio/wav; codecs=audio/pcm; samplerate=16000";
  if (mime.includes("ogg")) return "audio/ogg; codecs=opus";
  return null;
}

async function assessWithAzure(input: { audio: File; mimeType: string; expectedText: string; language: string; durationMs: number | null }) {
  const key = Deno.env.get("AZURE_SPEECH_KEY");
  const region = Deno.env.get("AZURE_SPEECH_REGION");
  const contentType = azureContentType(input.mimeType);
  if (!key || !region || !contentType) return null;

  const config = {
    ReferenceText: input.expectedText,
    GradingSystem: "HundredMark",
    Granularity: "Word",
    Dimension: "Comprehensive",
    EnableMiscue: true,
    EnableProsodyAssessment: input.language.toLowerCase() === "en-us",
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(input.language)}&format=detailed`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": contentType,
        "Pronunciation-Assessment": base64Utf8(JSON.stringify(config)),
        Accept: "application/json",
      },
      body: input.audio,
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error("[assess-pronunciation] Azure error", response.status);
      return null;
    }
    const payload = await response.json();
    const best = payload?.NBest?.[0];
    const assessment = best?.PronunciationAssessment;
    if (!best || !assessment) return null;
    const score = Math.round(Number(assessment.PronScore ?? assessment.AccuracyScore ?? 0));
    const transcript = String(best.Display ?? best.Lexical ?? payload.DisplayText ?? "");
    return {
      success: true,
      provider: "azure",
      assessmentType: "acoustic",
      transcript,
      normalizedTranscript: normalize(transcript),
      expectedText: input.expectedText,
      normalizedExpected: normalize(input.expectedText),
      score,
      result: resultKind(score),
      confidence: typeof best.Confidence === "number" ? best.Confidence : null,
      wordResults: Array.isArray(best.Words) ? best.Words.map((word: any) => ({
        word: String(word.Word ?? ""),
        score: typeof word.PronunciationAssessment?.AccuracyScore === "number" ? word.PronunciationAssessment.AccuracyScore : null,
        errorType: word.PronunciationAssessment?.ErrorType ?? null,
      })) : [],
      accuracyScore: typeof assessment.AccuracyScore === "number" ? assessment.AccuracyScore : null,
      fluencyScore: typeof assessment.FluencyScore === "number" ? assessment.FluencyScore : null,
      completenessScore: typeof assessment.CompletenessScore === "number" ? assessment.CompletenessScore : null,
      prosodyScore: typeof assessment.ProsodyScore === "number" ? assessment.ProsodyScore : null,
      durationMs: input.durationMs,
      warnings: [],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function transcribeWithOpenAI(input: { audio: File; expectedText: string; language: string; durationMs: number | null }) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("TRANSCRIPTION_PROVIDER_NOT_CONFIGURED");
  const form = new FormData();
  form.append("file", input.audio, input.audio.name || "attempt.webm");
  form.append("model", Deno.env.get("OPENAI_TRANSCRIPTION_MODEL") || "gpt-4o-mini-transcribe");
  form.append("response_format", "json");
  form.append("language", input.language.split("-")[0]);
  form.append("prompt", `Expected phrase: ${input.expectedText}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error("[assess-pronunciation] transcription error", response.status);
      throw new Error("TRANSCRIPTION_PROVIDER_ERROR");
    }
    const payload = await response.json();
    const transcript = typeof payload.text === "string" ? payload.text.trim() : "";
    if (!transcript) throw new Error("NO_SPEECH_DETECTED");
    const score = textualScore(input.expectedText, transcript);
    const normalizedExpected = normalize(input.expectedText);
    const normalizedTranscript = normalize(transcript);
    const words = new Set(normalizedTranscript.split(" ").filter(Boolean));
    return {
      success: true,
      provider: "openai-transcription",
      assessmentType: "textual",
      transcript,
      normalizedTranscript,
      expectedText: input.expectedText,
      normalizedExpected,
      score,
      result: resultKind(score),
      confidence: null,
      wordResults: normalizedExpected.split(" ").filter(Boolean).map((word) => ({ word, score: words.has(word) ? 100 : 0, errorType: words.has(word) ? null : "missing" })),
      accuracyScore: null,
      fluencyScore: null,
      completenessScore: null,
      prosodyScore: null,
      durationMs: input.durationMs,
      warnings: ["Esta pontuação mede a frase reconhecida; não é uma avaliação acústica de fonemas ou entonação."],
    };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, error: "METHOD_NOT_ALLOWED" });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { success: false, error: "AUTH_REQUIRED" });

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return json(401, { success: false, error: "INVALID_TOKEN" });
  if (!allowRequest(user.id)) return json(429, { success: false, error: "RATE_LIMITED" });

  try {
    const form = await req.formData();
    const audio = form.get("audio");
    const expectedText = String(form.get("expectedText") || "").trim();
    const language = String(form.get("language") || "en-US").slice(0, 20);
    const declaredMime = String(form.get("mimeType") || "").toLowerCase();
    const durationValue = Number(form.get("durationMs"));
    const durationMs = Number.isFinite(durationValue) ? durationValue : null;

    if (!(audio instanceof File)) return json(400, { success: false, error: "AUDIO_REQUIRED" });
    const mimeType = (declaredMime || audio.type || "").split(";").map((part, index) => index === 0 ? part.trim() : part.trim()).join(";");
    if (!allowedMimes.has(mimeType) && !allowedMimes.has(mimeType.split(";")[0])) return json(415, { success: false, error: "UNSUPPORTED_AUDIO_TYPE" });
    if (!audio.size || audio.size > MAX_AUDIO_BYTES) return json(413, { success: false, error: "INVALID_AUDIO_SIZE" });
    if (!expectedText || expectedText.length > MAX_EXPECTED_LENGTH) return json(400, { success: false, error: "INVALID_EXPECTED_TEXT" });
    if (durationMs !== null && (durationMs < 300 || durationMs > 15_500)) return json(400, { success: false, error: "INVALID_DURATION" });

    const azure = await assessWithAzure({ audio, mimeType, expectedText, language, durationMs });
    if (azure) return json(200, azure);
    const transcription = await transcribeWithOpenAI({ audio, expectedText, language, durationMs });
    return json(200, transcription);
  } catch (error) {
    const code = error instanceof Error ? error.message : "ASSESSMENT_INTERNAL_ERROR";
    const status = code === "NO_SPEECH_DETECTED" ? 422 : code.includes("NOT_CONFIGURED") ? 503 : 502;
    return json(status, { success: false, error: code, message: code === "NO_SPEECH_DETECTED" ? "Nenhuma fala foi detectada." : "Não foi possível avaliar esta tentativa." });
  }
});
