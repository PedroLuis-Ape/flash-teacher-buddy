export interface CanonicalizedImportValue {
  value: unknown;
  warnings: string[];
}

export class ImportKeyCollisionError extends Error {
  constructor(public readonly path: string, public readonly keys: string[]) {
    super(`Chaves conflitantes em ${path}: ${keys.join(", ")}.`);
    this.name = "ImportKeyCollisionError";
  }
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function applyAlias(
  source: JsonRecord,
  canonical: string,
  aliases: readonly string[],
  path: string,
  warnings: string[],
): JsonRecord {
  const output = { ...source };
  const present = [canonical, ...aliases].filter((key) => output[key] !== undefined);
  if (present.length === 0) return output;

  const selectedKey = output[canonical] !== undefined ? canonical : present[0];
  const selectedValue = output[selectedKey];
  const conflicts = present.filter((key) => !sameValue(output[key], selectedValue));
  if (conflicts.length > 0) {
    throw new ImportKeyCollisionError(`${path}.${canonical}`, present);
  }

  output[canonical] = selectedValue;
  for (const alias of aliases) {
    if (output[alias] !== undefined) {
      if (alias !== canonical) warnings.push(`${path}.${alias} foi normalizado para ${path}.${canonical}.`);
      delete output[alias];
    }
  }
  return output;
}

function aliasMany(
  source: JsonRecord,
  definitions: ReadonlyArray<readonly [string, readonly string[]]>,
  path: string,
  warnings: string[],
): JsonRecord {
  return definitions.reduce(
    (value, [canonical, aliases]) => applyAlias(value, canonical, aliases, path, warnings),
    source,
  );
}

function normalizeSide(value: unknown, upper: boolean): unknown {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLocaleLowerCase();
  if (["a", "lado a", "front", "frente"].includes(normalized)) return upper ? "A" : "a";
  if (["b", "lado b", "back", "verso"].includes(normalized)) return upper ? "B" : "b";
  return value;
}

function canonicalizeGlossaryEntry(value: unknown, path: string, warnings: string[]): unknown {
  if (!isRecord(value)) return value;
  let output = aliasMany(value, [
    ["term", ["word", "termo", "original_text", "originalText", "text"]],
    ["translation", ["definition", "definicao", "definição", "traducao", "tradução", "translated_text", "translatedText"]],
    ["side", ["lado"]],
    ["note", ["notes", "observacao", "observação", "nota"]],
    ["active", ["ativo", "is_active", "isActive"]],
  ], path, warnings);
  output.side = normalizeSide(output.side, true);
  return output;
}

function canonicalizeWordHint(value: unknown, path: string, warnings: string[]): unknown {
  if (!isRecord(value)) return value;
  let output = aliasMany(value, [
    ["text", ["term", "word", "termo", "original_text", "originalText"]],
    ["translation", ["definition", "traducao", "tradução", "translated_text", "translatedText"]],
    ["side", ["lado"]],
    ["note", ["notes", "observacao", "observação", "nota"]],
    ["occurrence", ["ocorrencia", "ocorrência"]],
    ["start_index", ["startIndex", "inicio", "início"]],
    ["end_index", ["endIndex", "fim"]],
  ], path, warnings);
  output.side = normalizeSide(output.side, true);
  return output;
}

const CARD_CONTENT_ALIASES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["front", ["term", "question", "word", "lado_a", "ladoA", "english", "ingles", "inglês"]],
  ["back", ["translation", "definition", "answer", "lado_b", "ladoB", "portuguese", "portugues", "português"]],
  ["key", ["card_key", "cardKey", "record_key", "recordKey"]],
  ["short_observation", ["shortObservation", "observacao_curta", "observação_curta"]],
  ["detailed_explanation", ["detailedExplanation", "explanation", "explicacao_detalhada", "explicação_detalhada"]],
  ["usage_notes", ["usageNotes", "observacoes_de_uso", "observações_de_uso"]],
  ["common_mistakes", ["commonMistakes", "erros_comuns"]],
  ["example", ["example_text", "exampleText", "exemplo"]],
  ["example_translation", ["exampleTranslation", "traducao_exemplo", "tradução_exemplo"]],
  ["context_tag", ["contextTag", "tag_contexto"]],
  ["word_hints", ["wordHints", "context_glossary", "glossario_contextual", "glossário_contextual"]],
];

function canonicalizeCardContent(value: JsonRecord, path: string, warnings: string[]): JsonRecord {
  const output = aliasMany(value, CARD_CONTENT_ALIASES, path, warnings);
  if (Array.isArray(output.word_hints)) {
    output.word_hints = output.word_hints.map((hint, index) => canonicalizeWordHint(hint, `${path}.word_hints[${index}]`, warnings));
  }
  return output;
}

function canonicalizeCard(value: unknown, path: string, warnings: string[]): unknown {
  if (!isRecord(value)) return value;
  let output = aliasMany(value, [
    ["type", ["tipo"]],
    ["group_title", ["groupTitle", "titulo_grupo", "título_grupo"]],
    ["layers", ["camadas"]],
  ], path, warnings);

  if (typeof output.type === "string") {
    const type = output.type.trim().toLocaleLowerCase();
    if (["layered", "layers", "camadas", "grupo"].includes(type)) output.type = "layered";
    else if (["normal", "card", "flashcard"].includes(type)) output.type = "normal";
  } else if (Array.isArray(output.layers)) {
    output.type = "layered";
    warnings.push(`${path}.type foi inferido como layered porque layers está presente.`);
  }

  if (output.type === "layered") {
    output = applyAlias(output, "key", ["group_key", "groupKey", "record_key", "recordKey"], path, warnings);
    if (Array.isArray(output.layers)) {
      output.layers = output.layers.map((layer, index) => (
        isRecord(layer)
          ? canonicalizeCardContent(layer, `${path}.layers[${index}]`, warnings)
          : layer
      ));
    }
    return output;
  }

  return canonicalizeCardContent(output, path, warnings);
}

function canonicalizeList(value: unknown, path: string, warnings: string[]): unknown {
  if (!isRecord(value)) return value;
  let output = aliasMany(value, [
    ["name", ["title", "nome"]],
    ["description", ["descricao", "descrição"]],
    ["front_language", ["frontLanguage", "source_language", "sourceLanguage", "lang_a", "language_a", "idioma_a"]],
    ["back_language", ["backLanguage", "target_language", "targetLanguage", "lang_b", "language_b", "idioma_b"]],
    ["primary_side", ["primarySide", "lado_principal"]],
    ["study_type", ["studyType", "tipo_estudo"]],
    ["label_a", ["labelA", "rotulo_a", "rótulo_a"]],
    ["label_b", ["labelB", "rotulo_b", "rótulo_b"]],
    ["tts_enabled", ["ttsEnabled", "tts", "audio_enabled"]],
    ["glossary", ["glossario", "glossário", "vocabulary"]],
    ["cards", ["flashcards", "itens"]],
  ], path, warnings);
  output.primary_side = normalizeSide(output.primary_side, false);
  if (Array.isArray(output.glossary)) {
    output.glossary = output.glossary.map((entry, index) => canonicalizeGlossaryEntry(entry, `${path}.glossary[${index}]`, warnings));
  }
  if (Array.isArray(output.cards)) {
    output.cards = output.cards.map((card, index) => canonicalizeCard(card, `${path}.cards[${index}]`, warnings));
  }
  return output;
}

function canonicalizeFolder(value: unknown, path: string, warnings: string[]): unknown {
  if (!isRecord(value)) return value;
  const output = aliasMany(value, [
    ["name", ["title", "nome"]],
    ["description", ["descricao", "descrição"]],
    ["glossary", ["glossario", "glossário", "vocabulary"]],
    ["lists", ["listas"]],
  ], path, warnings);
  if (Array.isArray(output.glossary)) {
    output.glossary = output.glossary.map((entry, index) => canonicalizeGlossaryEntry(entry, `${path}.glossary[${index}]`, warnings));
  }
  if (Array.isArray(output.lists)) {
    output.lists = output.lists.map((list, index) => canonicalizeList(list, `${path}.lists[${index}]`, warnings));
  }
  return output;
}

export function canonicalizeSmartImportKeys(value: unknown): CanonicalizedImportValue {
  const warnings: string[] = [];
  if (!isRecord(value)) return { value, warnings };

  let output = aliasMany(value, [
    ["declared_totals", ["declaredTotals", "totals", "totais_declarados"]],
    ["package", ["pacote"]],
  ], "$", warnings);

  if (isRecord(output.package)) {
    const packageValue = aliasMany(output.package, [
      ["name", ["title", "nome"]],
      ["description", ["descricao", "descrição"]],
      ["source_language", ["sourceLanguage", "lang_a", "idioma_origem"]],
      ["target_language", ["targetLanguage", "lang_b", "idioma_destino"]],
      ["folders", ["pastas"]],
    ], "package", warnings);
    if (Array.isArray(packageValue.folders)) {
      packageValue.folders = packageValue.folders.map((folder, index) => canonicalizeFolder(folder, `package.folders[${index}]`, warnings));
    }
    output.package = packageValue;
  }

  return { value: output, warnings: Array.from(new Set(warnings)) };
}
