import { GLOBAL_IMPORT_LIMITS } from "./schema";

export interface ParsedGlobalImportText {
  value: unknown;
  extracted: boolean;
  repaired: boolean;
  sourceText: string;
}

function findBalancedJsonSegments(text: string): string[] {
  const segments: string[] = [];
  const stack: string[] = [];
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      if (stack.length === 0) start = index;
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const expected = char === "}" ? "{" : "[";
      if (stack[stack.length - 1] !== expected) {
        stack.length = 0;
        start = -1;
        continue;
      }
      stack.pop();
      if (stack.length === 0 && start >= 0) {
        segments.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return segments;
}

function candidatesFromInput(input: string): string[] {
  const trimmed = input.replace(/^\uFEFF/, "").trim();
  const candidates = new Set<string>();
  if (trimmed) candidates.add(trimmed);

  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(trimmed)) !== null) {
    if (match[1]?.trim()) candidates.add(match[1].trim());
  }

  for (const segment of findBalancedJsonSegments(trimmed)) {
    candidates.add(segment.trim());
  }

  return [...candidates];
}

function parseCandidate(candidate: string): { value: unknown; repaired: boolean } | null {
  try {
    return { value: JSON.parse(candidate), repaired: false };
  } catch {
    const withoutTrailingCommas = candidate.replace(/,\s*([}\]])/g, "$1");
    if (withoutTrailingCommas === candidate) return null;
    try {
      return { value: JSON.parse(withoutTrailingCommas), repaired: true };
    } catch {
      return null;
    }
  }
}

export function parseGlobalImportText(input: string): ParsedGlobalImportText {
  const byteSize = new TextEncoder().encode(input).byteLength;
  if (byteSize > GLOBAL_IMPORT_LIMITS.maxFileBytes) {
    throw new Error(`O pacote excede o limite de ${Math.floor(GLOBAL_IMPORT_LIMITS.maxFileBytes / 1024 / 1024)} MB.`);
  }
  if (!input.trim()) throw new Error("O conteúdo está vazio.");

  const normalizedInput = input.replace(/^\uFEFF/, "").trim();
  for (const candidate of candidatesFromInput(input)) {
    const parsed = parseCandidate(candidate);
    if (!parsed) continue;
    return {
      value: parsed.value,
      repaired: parsed.repaired,
      extracted: candidate !== normalizedInput,
      sourceText: candidate,
    };
  }

  const opens = (input.match(/[\[{]/g) ?? []).length;
  const closes = (input.match(/[\]}]/g) ?? []).length;
  if (opens > closes) {
    throw new Error("O JSON parece ter sido cortado antes do fim.");
  }

  throw new Error("Não foi possível localizar um pacote JSON válido.");
}
