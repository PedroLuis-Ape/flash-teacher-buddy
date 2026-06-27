import { APP_PITECO_SUPER_IMPORT_LIMITS } from "./schema/appPitecoSuperImportSchema";

export interface ParsedGlobalImportText {
  value: unknown;
  extracted: boolean;
  repaired: boolean;
  sourceText: string;
}

function stripSingleOuterFence(input: string): { candidate: string; extracted: boolean } {
  const trimmed = input.replace(/^\uFEFF/, "").trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (!match) return { candidate: trimmed, extracted: false };
  return { candidate: match[1].trim(), extracted: true };
}

export function parseGlobalImportText(input: string): ParsedGlobalImportText {
  const byteSize = new TextEncoder().encode(input).byteLength;
  if (byteSize > APP_PITECO_SUPER_IMPORT_LIMITS.maxFileBytes) {
    throw new Error(`O pacote excede o limite de ${Math.floor(APP_PITECO_SUPER_IMPORT_LIMITS.maxFileBytes / 1024 / 1024)} MB.`);
  }
  if (!input.trim()) throw new Error("O conteúdo está vazio.");

  const { candidate, extracted } = stripSingleOuterFence(input);
  try {
    return {
      value: JSON.parse(candidate),
      repaired: false,
      extracted,
      sourceText: candidate,
    };
  } catch {
    const opens = (candidate.match(/[\[{]/g) ?? []).length;
    const closes = (candidate.match(/[\]}]/g) ?? []).length;
    if (opens > closes) {
      throw new Error("O JSON parece ter sido cortado antes do fim.");
    }
    if (/,[\s\r\n]*[}\]]/.test(candidate)) {
      throw new Error("O JSON contém vírgula final inválida. Gere novamente sem vírgulas finais.");
    }
    if (!extracted && /```/.test(candidate)) {
      throw new Error("Use somente JSON puro ou uma única cerca Markdown envolvendo todo o objeto.");
    }
    throw new Error("A resposta não contém um JSON válido.");
  }
}
