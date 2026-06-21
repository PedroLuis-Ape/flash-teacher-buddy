import {
  SPECIAL_EXPLANATIONS_FORMAT,
  SPECIAL_SCHEMA_VERSION,
  type StoredSpecialExportManifest,
} from "./protocol";

export interface SpecialImportExample {
  en?: string;
  pt?: string;
}

export interface NormalizedSpecialImportItem {
  flashcard_id?: string;
  candidate_id?: string;
  card_ref?: string;
  term?: string;
  translation?: string;
  detailed_explanation: string;
  usage_notes?: string;
  common_mistakes?: string;
  example_text?: string;
  example_translation?: string;
  examples?: SpecialImportExample[];
  warnings: string[];
  raw: unknown;
  source_index: number;
}

export interface InvalidSpecialImportItem {
  raw: unknown;
  source_index: number;
  reason: string;
}

export interface ParsedSpecialImport {
  format?: string;
  schema_version?: number;
  export_id?: string;
  source: "v2" | "legacy";
  items: NormalizedSpecialImportItem[];
  invalid: InvalidSpecialImportItem[];
  warnings: string[];
  repaired: boolean;
}

export type ReconciledImportStatus = "valid" | "invalid" | "duplicate" | "outside";

export interface ReconciledSpecialImportRow {
  item: NormalizedSpecialImportItem | null;
  status: ReconciledImportStatus;
  resolved_flashcard_id?: string;
  reason?: string;
  warnings: string[];
}

export interface ReconciledSpecialImport {
  rows: ReconciledSpecialImportRow[];
  missing_expected_ids: string[];
  warnings: string[];
  manifest: StoredSpecialExportManifest | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstDefined(raw: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  }
  return undefined;
}

function toText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(value) && value.every((part) => typeof part === "string")) {
    const joined = value.map((part) => part.trim()).filter(Boolean).join("\n\n");
    return joined || undefined;
  }
  return undefined;
}

function normalizeExamples(value: unknown): SpecialImportExample[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const examples = value.map((entry) => {
    if (typeof entry === "string") return { en: entry.trim() || undefined };
    if (!entry || typeof entry !== "object") return null;
    const raw = entry as Record<string, unknown>;
    const en = toText(firstDefined(raw, ["en", "english", "sentence", "example", "frase"]));
    const pt = toText(firstDefined(raw, ["pt", "portuguese", "translation", "traducao", "tradução"]));
    if (!en && !pt) return null;
    return { en, pt };
  }).filter((entry) => entry !== null) as SpecialImportExample[];
  return examples.length > 0 ? examples : undefined;
}

function normalizeItem(rawValue: unknown, sourceIndex: number): NormalizedSpecialImportItem | InvalidSpecialImportItem {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return { raw: rawValue, source_index: sourceIndex, reason: "Item não é um objeto JSON." };
  }
  const raw = rawValue as Record<string, unknown>;
  const detailedExplanation = toText(firstDefined(raw, [
    "detailed_explanation",
    "detailedExplanation",
    "explanation",
    "explicacao_detalhada",
    "explicação_detalhada",
    "explicacao",
    "explicação",
  ]));
  if (!detailedExplanation) {
    return {
      raw: rawValue,
      source_index: sourceIndex,
      reason: "Campo detailed_explanation ausente ou vazio.",
    };
  }

  const flashcardId = toText(firstDefined(raw, ["flashcard_id", "flashcardId", "card_id", "cardId"]));
  const candidateId = toText(raw.id);
  const cardRef = toText(firstDefined(raw, ["card_ref", "cardRef", "reference", "ref"]));
  const examples = normalizeExamples(firstDefined(raw, ["examples", "exemplos"]));
  const warnings: string[] = [];
  if (!flashcardId && candidateId) warnings.push("Campo genérico id recebido; ele só será aceito se conferir com o manifesto exportado.");
  if (!cardRef) warnings.push("card_ref ausente.");
  if (!examples || examples.length < 2) warnings.push("Menos de dois exemplos válidos foram recebidos.");

  return {
    flashcard_id: flashcardId,
    candidate_id: candidateId,
    card_ref: cardRef,
    term: toText(firstDefined(raw, ["term", "termo", "word"])),
    translation: toText(firstDefined(raw, ["translation", "traducao", "tradução"])),
    detailed_explanation: detailedExplanation,
    usage_notes: toText(firstDefined(raw, ["usage_notes", "usageNotes", "usage", "observacoes_de_uso", "observações_de_uso"])),
    common_mistakes: toText(firstDefined(raw, ["common_mistakes", "commonMistakes", "mistakes", "erros_comuns"])),
    example_text: toText(firstDefined(raw, ["example_text", "exampleText"])),
    example_translation: toText(firstDefined(raw, ["example_translation", "exampleTranslation"])),
    examples,
    warnings,
    raw: rawValue,
    source_index: sourceIndex,
  };
}

function findBalancedJsonSegments(text: string): string[] {
  const segments: string[] = [];
  let start = -1;
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

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

function buildJsonCandidates(input: string): string[] {
  const trimmed = input.replace(/^\uFEFF/, "").trim();
  const candidates = new Set<string>();
  if (trimmed) candidates.add(trimmed);

  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(trimmed)) !== null) {
    if (match[1]?.trim()) candidates.add(match[1].trim());
  }
  findBalancedJsonSegments(trimmed).forEach((segment) => candidates.add(segment.trim()));
  return Array.from(candidates);
}

function parseCandidate(candidate: string): { value: unknown; repaired: boolean } | null {
  try {
    return { value: JSON.parse(candidate), repaired: false };
  } catch {
    const repaired = candidate.replace(/,\s*([}\]])/g, "$1");
    if (repaired === candidate) return null;
    try {
      return { value: JSON.parse(repaired), repaired: true };
    } catch {
      return null;
    }
  }
}

function unwrapEnvelope(value: unknown): {
  rawItems: unknown[];
  format?: string;
  schemaVersion?: number;
  exportId?: string;
  source: "v2" | "legacy";
} | null {
  if (Array.isArray(value)) return { rawItems: value, source: "legacy" };
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const arrayKeys = ["items", "cards", "results", "explanations"] as const;
  for (const key of arrayKeys) {
    if (Array.isArray(raw[key])) {
      const format = toText(raw.format);
      const schemaVersion = typeof raw.schema_version === "number"
        ? raw.schema_version
        : typeof raw.schemaVersion === "number" ? raw.schemaVersion : undefined;
      const exportId = toText(firstDefined(raw, ["export_id", "exportId"]));
      const source = format === SPECIAL_EXPLANATIONS_FORMAT || schemaVersion === SPECIAL_SCHEMA_VERSION
        ? "v2"
        : "legacy";
      return { rawItems: raw[key] as unknown[], format, schemaVersion, exportId, source };
    }
  }
  if (Array.isArray(raw.data)) {
    return {
      rawItems: raw.data,
      format: toText(raw.format),
      schemaVersion: typeof raw.schema_version === "number" ? raw.schema_version : undefined,
      exportId: toText(firstDefined(raw, ["export_id", "exportId"])),
      source: "legacy",
    };
  }
  if (raw.data && typeof raw.data === "object") return unwrapEnvelope(raw.data);
  if (firstDefined(raw, ["detailed_explanation", "detailedExplanation", "explanation"])) {
    return { rawItems: [raw], source: "legacy" };
  }
  return null;
}

export function parseSpecialImportText(input: string): ParsedSpecialImport {
  if (!input.trim()) throw new Error("Nenhum conteúdo foi informado.");
  const candidates = buildJsonCandidates(input);
  for (const candidate of candidates) {
    const parsed = parseCandidate(candidate);
    if (!parsed) continue;
    const envelope = unwrapEnvelope(parsed.value);
    if (!envelope) continue;

    const items: NormalizedSpecialImportItem[] = [];
    const invalid: InvalidSpecialImportItem[] = [];
    envelope.rawItems.forEach((rawItem, index) => {
      const normalized = normalizeItem(rawItem, index);
      if ("reason" in normalized) invalid.push(normalized);
      else items.push(normalized);
    });
    const warnings: string[] = [];
    if (parsed.repaired) warnings.push("Vírgulas finais inválidas foram removidas automaticamente.");
    if (envelope.source === "legacy") warnings.push("Formato antigo detectado; a importação continuará em modo de compatibilidade.");
    if (envelope.source === "v2" && envelope.format !== SPECIAL_EXPLANATIONS_FORMAT) {
      warnings.push(`Formato inesperado: ${envelope.format ?? "ausente"}.`);
    }
    if (envelope.source === "v2" && envelope.schemaVersion !== SPECIAL_SCHEMA_VERSION) {
      warnings.push(`Versão de schema inesperada: ${envelope.schemaVersion ?? "ausente"}.`);
    }
    return {
      format: envelope.format,
      schema_version: envelope.schemaVersion,
      export_id: envelope.exportId,
      source: envelope.source,
      items,
      invalid,
      warnings,
      repaired: parsed.repaired,
    };
  }

  const opens = (input.match(/[\[{]/g) ?? []).length;
  const closes = (input.match(/[\]}]/g) ?? []).length;
  if (opens > closes) {
    throw new Error("A resposta parece ter sido cortada antes do fim. Peça à IA apenas os cards faltantes ou gere novamente o lote.");
  }
  throw new Error("Não foi possível localizar um objeto ou array JSON válido na resposta.");
}

export function reconcileSpecialImport(
  parsed: ParsedSpecialImport,
  manifest: StoredSpecialExportManifest | null,
): ReconciledSpecialImport {
  const warnings = [...parsed.warnings];
  if (parsed.export_id && !manifest) {
    warnings.push(`O manifesto local da exportação ${parsed.export_id} não foi encontrado. A conferência de cards faltantes ficará indisponível.`);
  }
  if (manifest && parsed.export_id && parsed.export_id !== manifest.export_id) {
    warnings.push("O export_id da resposta não corresponde ao manifesto localizado.");
  }

  const expectedById = new Map(manifest?.cards.map((card) => [card.flashcard_id, card]) ?? []);
  const expectedByRef = new Map(manifest?.cards.map((card) => [card.card_ref, card]) ?? []);
  const acceptedIds = new Set<string>();
  const rows: ReconciledSpecialImportRow[] = [];

  for (const item of parsed.items) {
    const rowWarnings = [...item.warnings];
    const explicitId = item.flashcard_id ?? item.candidate_id;
    let resolvedId: string | undefined;

    if (manifest) {
      const byRef = item.card_ref ? expectedByRef.get(item.card_ref) : undefined;
      const byId = explicitId ? expectedById.get(explicitId) : undefined;
      if (byRef && explicitId && byRef.flashcard_id !== explicitId) {
        rows.push({
          item,
          status: "invalid",
          reason: "card_ref e flashcard_id apontam para cards diferentes.",
          warnings: rowWarnings,
        });
        continue;
      }
      resolvedId = byRef?.flashcard_id ?? byId?.flashcard_id;
      if (!resolvedId && explicitId) {
        rows.push({
          item,
          status: "outside",
          resolved_flashcard_id: explicitId,
          reason: "O card não pertence ao lote exportado.",
          warnings: rowWarnings,
        });
        continue;
      }
      if (!resolvedId) {
        rows.push({
          item,
          status: "invalid",
          reason: "Não foi possível relacionar o item ao manifesto por card_ref ou flashcard_id.",
          warnings: rowWarnings,
        });
        continue;
      }
      if (!item.flashcard_id) rowWarnings.push("flashcard_id recuperado com segurança pelo manifesto local.");
    } else {
      resolvedId = item.flashcard_id;
      if (!resolvedId) {
        rows.push({
          item,
          status: "invalid",
          reason: "flashcard_id ausente. Um campo id genérico só pode ser aceito quando existe manifesto local.",
          warnings: rowWarnings,
        });
        continue;
      }
    }

    if (!UUID_RE.test(resolvedId)) {
      rows.push({ item, status: "invalid", reason: "flashcard_id não é um UUID válido.", warnings: rowWarnings });
      continue;
    }
    if (acceptedIds.has(resolvedId)) {
      rows.push({
        item,
        status: "duplicate",
        resolved_flashcard_id: resolvedId,
        reason: "Este card apareceu mais de uma vez na resposta.",
        warnings: rowWarnings,
      });
      continue;
    }
    acceptedIds.add(resolvedId);
    rows.push({ item, status: "valid", resolved_flashcard_id: resolvedId, warnings: rowWarnings });
  }

  parsed.invalid.forEach((invalid) => rows.push({
    item: null,
    status: "invalid",
    reason: `Item ${invalid.source_index + 1}: ${invalid.reason}`,
    warnings: [],
  }));

  const missingExpectedIds = manifest
    ? manifest.cards.map((card) => card.flashcard_id).filter((id) => !acceptedIds.has(id))
    : [];

  return {
    rows,
    missing_expected_ids: missingExpectedIds,
    warnings,
    manifest,
  };
}
