import { cleanTextForTTS } from "./speech";

export function segmentTextForTTS(text: string | null | undefined): string[] {
  if (typeof text !== "string") return [];
  const cleaned = cleanTextForTTS(text);
  if (!cleaned) return [];

  return cleaned
    .split(/\s+/)
    .map((token) => token.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+|[^A-Za-zÀ-ÖØ-öø-ÿ0-9'’-]+$/g, ""))
    .filter(Boolean);
}
