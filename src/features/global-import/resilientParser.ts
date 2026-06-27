export interface ResilientJsonCandidate {
  sourceText: string;
  value: unknown;
  repaired: boolean;
  extracted: boolean;
}

export interface ExtractAndRepairJsonOptions {
  maxCandidates?: number;
}

interface JsonSegment {
  text: string;
  complete: boolean;
}

const CLOSE_TO_OPEN: Record<string, string> = {
  "}": "{",
  "]": "[",
};

function stripBom(input: string): string {
  return input.replace(/^\uFEFF/, "");
}

function addCandidate(candidates: string[], seen: Set<string>, value: string | undefined): void {
  const candidate = value?.trim();
  if (!candidate || seen.has(candidate)) return;
  seen.add(candidate);
  candidates.push(candidate);
}

function fencedJsonCandidates(input: string): string[] {
  const result: string[] = [];
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(input)) !== null) {
    if (match[1]?.trim()) result.push(match[1].trim());
  }
  return result;
}

function scanJsonSegments(input: string): JsonSegment[] {
  const segments: JsonSegment[] = [];
  let start = -1;
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

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
      if (start < 0 || stack.length === 0) continue;
      const expectedOpen = CLOSE_TO_OPEN[char];
      if (stack[stack.length - 1] !== expectedOpen) {
        stack.length = 0;
        start = -1;
        continue;
      }
      stack.pop();
      if (stack.length === 0 && start >= 0) {
        segments.push({ text: input.slice(start, index + 1), complete: true });
        start = -1;
      }
    }
  }

  if (start >= 0 && stack.length > 0) {
    segments.push({ text: input.slice(start), complete: false });
  }

  return segments;
}

function removeTrailingCommasOutsideStrings(input: string): { text: string; repaired: boolean } {
  let output = "";
  let inString = false;
  let escaped = false;
  let repaired = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === ",") {
      let lookahead = index + 1;
      while (lookahead < input.length && /\s/.test(input[lookahead])) lookahead += 1;
      if (input[lookahead] === "}" || input[lookahead] === "]") {
        repaired = true;
        continue;
      }
    }

    output += char;
  }

  return { text: output, repaired };
}

function tryParseCandidate(candidate: string): Omit<ResilientJsonCandidate, "extracted"> | null {
  try {
    return { value: JSON.parse(candidate), sourceText: candidate, repaired: false };
  } catch {
    const repaired = removeTrailingCommasOutsideStrings(candidate);
    if (!repaired.repaired) return null;
    try {
      return { value: JSON.parse(repaired.text), sourceText: repaired.text, repaired: true };
    } catch {
      return null;
    }
  }
}

export function hasTruncatedJson(input: string): boolean {
  const trimmed = stripBom(input).trim();
  if (!trimmed) return false;
  return scanJsonSegments(trimmed).some((segment) => !segment.complete);
}

export function buildResilientJsonCandidates(input: string, options: ExtractAndRepairJsonOptions = {}): string[] {
  const trimmed = stripBom(input).trim();
  const candidates: string[] = [];
  const seen = new Set<string>();

  addCandidate(candidates, seen, trimmed);
  fencedJsonCandidates(trimmed).forEach((candidate) => addCandidate(candidates, seen, candidate));
  scanJsonSegments(trimmed)
    .filter((segment) => segment.complete)
    .forEach((segment) => addCandidate(candidates, seen, segment.text));

  return candidates.slice(0, options.maxCandidates ?? 20);
}

export function extractAndRepairJson(input: string, options: ExtractAndRepairJsonOptions = {}): ResilientJsonCandidate | null {
  const trimmed = stripBom(input).trim();
  if (!trimmed) return null;

  const candidates = buildResilientJsonCandidates(trimmed, options);
  for (const candidate of candidates) {
    const parsed = tryParseCandidate(candidate);
    if (!parsed) continue;
    return {
      ...parsed,
      extracted: candidate !== trimmed,
    };
  }

  return null;
}
