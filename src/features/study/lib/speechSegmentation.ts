import { cleanTextForTTS } from "./speech";

function stripMarkup(value: string): string {
  let result = "";
  let insideTag = false;

  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code === 60) {
      insideTag = true;
      result += " ";
    } else if (code === 62) {
      insideTag = false;
      result += " ";
    } else if (!insideTag) {
      result += character;
    }
  }

  return result;
}

export function segmentTextForTTS(text: string | null | undefined): string[] {
  if (typeof text !== "string") return [];
  const cleaned = cleanTextForTTS(stripMarkup(text));
  if (!cleaned) return [];

  return cleaned
    .split(/\s+/)
    .map((token) => token.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+|[^A-Za-zÀ-ÖØ-öø-ÿ0-9'’-]+$/g, ""))
    .filter(Boolean);
}
