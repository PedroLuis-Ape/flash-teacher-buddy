import { parseGlossaryAndCards } from "@/lib/bulkImport";
import { extractCamadasBlock } from "@/features/cards/lib/layeredImport";
import { parseGlossaryTransfer } from "@/features/study/lib/glossaryTransfer";
import {
  SMART_IMPORT_SCHEMA,
  SMART_IMPORT_VERSION,
  smartImportPackageSchema,
  withSmartDeclaredTotals,
  type SmartGlossaryEntry,
  type SmartImportFolder,
  type SmartImportList,
  type SmartImportPackage,
  type SmartLayer,
  type SmartLayeredCard,
  type SmartNormalCard,
  type SmartWordHint,
} from "./schema";

export type SmartImportSourceFormat = "json-v2" | "csv-v2" | "csv-simple" | "text";

export interface SmartImportContext {
  packageName?: string;
  folderName?: string;
  listName?: string;
  frontLanguage?: string;
  backLanguage?: string;
  labelA?: string;
  labelB?: string;
  primarySide?: "a" | "b";
  studyType?: SmartImportList["study_type"];
  ttsEnabled?: boolean;
}

export interface SmartImportSourceResult {
  packageValue: SmartImportPackage;
  format: SmartImportSourceFormat;
  notes: string[];
  warnings: string[];
}

interface CsvRow {
  line: number;
  values: string[];
}

const normalizeHeader = (value: string) => value.trim().replace(/^\uFEFF/, "").toLocaleLowerCase();
const normalizeKey = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

function contextList(context: SmartImportContext, cards: SmartImportList["cards"], glossary: SmartGlossaryEntry[]): SmartImportPackage {
  return withSmartDeclaredTotals({
    schema: SMART_IMPORT_SCHEMA,
    version: SMART_IMPORT_VERSION,
    package: {
      name: context.packageName?.trim() || "Importação inteligente",
      source_language: context.frontLanguage || "en",
      target_language: context.backLanguage || "pt-BR",
      folders: [{
        name: context.folderName?.trim() || "Destino atual",
        lists: [{
          name: context.listName?.trim() || "Lista atual",
          front_language: context.frontLanguage || "en",
          back_language: context.backLanguage || "pt-BR",
          primary_side: context.primarySide || "a",
          study_type: context.studyType || "language",
          label_a: context.labelA || null,
          label_b: context.labelB || null,
          tts_enabled: context.ttsEnabled ?? true,
          glossary,
          cards,
        }],
      }],
    },
  });
}

function parseCsvRows(input: string, delimiter?: string): CsvRow[] {
  const source = input.replace(/^\uFEFF/, "");
  const firstPhysicalLine = source.split(/\r?\n/, 1)[0] ?? "";
  const chosenDelimiter = delimiter ?? (
    firstPhysicalLine.split("\t").length > firstPhysicalLine.split(",").length
      ? "\t"
      : firstPhysicalLine.split(";").length > firstPhysicalLine.split(",").length
        ? ";"
        : ","
  );

  const rows: CsvRow[] = [];
  let values: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let rowStart = 1;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
        if (char === "\n") line += 1;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === chosenDelimiter) {
      values.push(field.trim());
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      values.push(field.trim());
      field = "";
      if (values.some((value) => value.length > 0)) rows.push({ line: rowStart, values });
      values = [];
      line += 1;
      rowStart = line;
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error(`CSV inválido: aspas não fechadas a partir da linha ${rowStart}.`);
  values.push(field.trim());
  if (values.some((value) => value.length > 0)) rows.push({ line: rowStart, values });
  return rows;
}

function booleanCell(value: string | undefined, fallback = true) {
  const normalized = value?.trim().toLocaleLowerCase() ?? "";
  if (!normalized) return fallback;
  return !["0", "false", "off", "não", "nao", "inactive", "inativo"].includes(normalized);
}

function csvObject(headers: string[], row: CsvRow): Record<string, string> {
  return Object.fromEntries(headers.map((header, index) => [header, row.values[index] ?? ""]));
}

function makeList(name: string, row: Record<string, string>, context: SmartImportContext): SmartImportList {
  return {
    name: name || context.listName || "Principal",
    description: row.list_description || null,
    front_language: row.front_language || context.frontLanguage || "en",
    back_language: row.back_language || context.backLanguage || "pt-BR",
    primary_side: row.primary_side === "b" ? "b" : context.primarySide || "a",
    study_type: (["language", "general", "math", "visual"].includes(row.study_type) ? row.study_type : context.studyType || "language") as SmartImportList["study_type"],
    label_a: row.label_a || context.labelA || null,
    label_b: row.label_b || context.labelB || null,
    tts_enabled: booleanCell(row.tts_enabled, context.ttsEnabled ?? true),
    glossary: [],
    cards: [],
  };
}

function cardFromRow(row: Record<string, string>): SmartNormalCard {
  return {
    type: "normal",
    key: row.record_key || row.card_key || null,
    front: row.front,
    back: row.back,
    hint: row.hint || null,
    short_observation: row.short_observation || null,
    detailed_explanation: row.detailed_explanation || null,
    usage_notes: row.usage_notes || null,
    common_mistakes: row.common_mistakes || null,
    example: row.example || null,
    example_translation: row.example_translation || null,
    context_tag: row.context_tag || null,
    tags: row.tags ? row.tags.split(/[|;]/).map((tag) => tag.trim()).filter(Boolean) : undefined,
    word_hints: [],
  };
}

function parseAdvancedCsv(input: string, context: SmartImportContext): SmartImportSourceResult {
  const rows = parseCsvRows(input);
  if (rows.length < 2) throw new Error("O CSV precisa conter cabeçalho e pelo menos uma linha.");
  const headers = rows[0].values.map(normalizeHeader);
  const required = ["record_type", "folder_name", "list_name"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length > 0) throw new Error(`CSV inteligente sem coluna(s): ${missing.join(", ")}.`);

  const folderMap = new Map<string, SmartImportFolder>();
  const listMap = new Map<string, SmartImportList>();
  const cardMap = new Map<string, SmartNormalCard | SmartLayer>();
  const groupMap = new Map<string, SmartLayeredCard>();
  const pendingHints: Array<{ parent: string; hint: SmartWordHint; line: number }> = [];
  const warnings: string[] = [];

  const getList = (record: Record<string, string>) => {
    const folderName = record.folder_name || context.folderName || "Importado";
    const listName = record.list_name || context.listName || "Principal";
    const folderKey = normalizeKey(folderName);
    const listKey = `${folderKey}\u0000${normalizeKey(listName)}`;
    let folder = folderMap.get(folderKey);
    if (!folder) {
      folder = { name: folderName, description: record.folder_description || null, lists: [] };
      folderMap.set(folderKey, folder);
    }
    let list = listMap.get(listKey);
    if (!list) {
      list = makeList(listName, record, context);
      listMap.set(listKey, list);
      folder.lists.push(list);
    }
    return { list, listKey };
  };

  for (const row of rows.slice(1)) {
    const record = csvObject(headers, row);
    const recordType = normalizeKey(record.record_type ?? "");
    const { list, listKey } = getList(record);
    const recordKey = record.record_key || record.card_key;

    if (recordType === "card" || recordType === "normal") {
      if (!record.front || !record.back) {
        warnings.push(`Linha ${row.line}: card ignorado porque front ou back está vazio.`);
        continue;
      }
      const card = cardFromRow(record);
      list.cards.push(card);
      if (recordKey) cardMap.set(`${listKey}\u0000${recordKey}`, card);
      continue;
    }

    if (recordType === "glossary" || recordType === "glossário" || recordType === "glossario") {
      const term = record.term || record.front;
      const translation = record.translation || record.back;
      if (!term || !translation) {
        warnings.push(`Linha ${row.line}: glossário ignorado porque term/front ou translation/back está vazio.`);
        continue;
      }
      list.glossary.push({
        term,
        translation,
        side: record.side?.toUpperCase() === "B" ? "B" : "A",
        note: record.note || null,
        active: booleanCell(record.active, true),
      });
      continue;
    }

    if (recordType === "layer_group" || recordType === "group" || recordType === "grupo") {
      const key = recordKey || record.group_key;
      const title = record.group_title || record.front;
      if (!key || !title) {
        warnings.push(`Linha ${row.line}: grupo ignorado porque record_key e group_title são obrigatórios.`);
        continue;
      }
      const group: SmartLayeredCard = { type: "layered", key, group_title: title, layers: [] };
      groupMap.set(`${listKey}\u0000${key}`, group);
      list.cards.push(group);
      continue;
    }

    if (recordType === "layer" || recordType === "camada") {
      const parent = record.parent_key || record.group_key;
      const group = groupMap.get(`${listKey}\u0000${parent}`);
      if (!group) {
        warnings.push(`Linha ${row.line}: camada sem grupo pai “${parent}”.`);
        continue;
      }
      if (!record.front || !record.back) {
        warnings.push(`Linha ${row.line}: camada ignorada porque front ou back está vazio.`);
        continue;
      }
      const layer: SmartLayer = { ...cardFromRow(record) };
      delete (layer as Partial<SmartNormalCard>).type;
      group.layers.push(layer);
      if (recordKey) cardMap.set(`${listKey}\u0000${recordKey}`, layer);
      continue;
    }

    if (recordType === "word_hint" || recordType === "context_glossary" || recordType === "palavra") {
      const parent = record.parent_key || record.card_key;
      const text = record.term || record.front;
      const translation = record.translation || record.back;
      if (!parent || !text || !translation) {
        warnings.push(`Linha ${row.line}: glossário contextual exige parent_key, term/front e translation/back.`);
        continue;
      }
      pendingHints.push({
        parent: `${listKey}\u0000${parent}`,
        line: row.line,
        hint: {
          side: record.side?.toUpperCase() === "B" ? "B" : "A",
          text,
          translation,
          note: record.note || null,
          occurrence: record.occurrence && record.occurrence !== "all" ? Number(record.occurrence) : "all",
          start_index: record.start_index ? Number(record.start_index) : undefined,
          end_index: record.end_index ? Number(record.end_index) : undefined,
        },
      });
      continue;
    }

    warnings.push(`Linha ${row.line}: record_type “${record.record_type}” não reconhecido.`);
  }

  pendingHints.forEach(({ parent, hint, line }) => {
    const card = cardMap.get(parent);
    if (!card) {
      warnings.push(`Linha ${line}: parent_key não encontrou um card ou camada.`);
      return;
    }
    card.word_hints = [...(card.word_hints ?? []), hint];
  });

  for (const group of groupMap.values()) {
    if (group.layers.length < 2) warnings.push(`Grupo “${group.group_title}” possui menos de duas camadas.`);
  }

  const packageValue = withSmartDeclaredTotals({
    schema: SMART_IMPORT_SCHEMA,
    version: SMART_IMPORT_VERSION,
    package: {
      name: context.packageName || "Pacote CSV inteligente",
      source_language: context.frontLanguage || undefined,
      target_language: context.backLanguage || undefined,
      folders: Array.from(folderMap.values()),
    },
  });
  return { packageValue: smartImportPackageSchema.parse(packageValue), format: "csv-v2", notes: [`CSV inteligente reconhecido com ${rows.length - 1} registro(s).`], warnings };
}

function parseSimpleCsv(input: string, context: SmartImportContext): SmartImportSourceResult {
  const rows = parseCsvRows(input);
  if (rows.length === 0) throw new Error("O CSV está vazio.");
  const headers = rows[0].values.map(normalizeHeader);
  const hasGlobalHeader = headers.includes("folder_name") && headers.includes("list_name") && headers.includes("front") && headers.includes("back");
  const hasSimpleHeader = headers.some((header) => ["front", "lado a", "english", "inglês", "ingles"].includes(header));
  const contentRows = hasGlobalHeader || hasSimpleHeader ? rows.slice(1) : rows;

  if (hasGlobalHeader) {
    const folders = new Map<string, SmartImportFolder>();
    const lists = new Map<string, SmartImportList>();
    contentRows.forEach((row) => {
      const record = csvObject(headers, row);
      if (!record.front || !record.back) return;
      const folderName = record.folder_name || context.folderName || "Importado";
      const listName = record.list_name || context.listName || "Principal";
      const folderKey = normalizeKey(folderName);
      const listKey = `${folderKey}\u0000${normalizeKey(listName)}`;
      let folder = folders.get(folderKey);
      if (!folder) {
        folder = { name: folderName, lists: [] };
        folders.set(folderKey, folder);
      }
      let list = lists.get(listKey);
      if (!list) {
        list = makeList(listName, record, context);
        lists.set(listKey, list);
        folder.lists.push(list);
      }
      list.cards.push(cardFromRow(record));
    });
    const packageValue = withSmartDeclaredTotals({
      schema: SMART_IMPORT_SCHEMA,
      version: SMART_IMPORT_VERSION,
      package: { name: context.packageName || "Pacote CSV", folders: Array.from(folders.values()) },
    });
    return { packageValue: smartImportPackageSchema.parse(packageValue), format: "csv-simple", notes: ["CSV global de quatro colunas reconhecido."], warnings: [] };
  }

  const cards: SmartNormalCard[] = contentRows
    .filter((row) => row.values[0]?.trim() && row.values[1]?.trim())
    .map((row, index) => ({ type: "normal", key: `csv-${index + 1}`, front: row.values[0].trim(), back: row.values[1].trim(), word_hints: [] }));
  const packageValue = contextList(context, cards, []);
  return { packageValue: smartImportPackageSchema.parse(packageValue), format: "csv-simple", notes: [`CSV simples reconhecido com ${cards.length} card(s).`], warnings: [] };
}

function removeGlossarySection(input: string) {
  const lines = input.split(/\r?\n/);
  const glossaryStart = lines.findIndex((line) => /^[=\-]{2,}\s*GLOSS[AÁ]RIO(?:\s+GLOBAL)?\s*[=\-]{2,}$/i.test(line.trim()));
  if (glossaryStart < 0) return input;
  const nextSection = lines.findIndex((line, index) => index > glossaryStart && /^([=\-]{2,}.*[=\-]{2,}|\[[^\]]+\])$/i.test(line.trim()));
  return [...lines.slice(0, glossaryStart), ...(nextSection >= 0 ? lines.slice(nextSection) : [])].join("\n");
}

function parseText(input: string, context: SmartImportContext): SmartImportSourceResult {
  const glossaryResult = parseGlossaryTransfer(input, "A");
  const camadas = extractCamadasBlock(removeGlossarySection(input));
  const flatSource = camadas.cleanedInput;
  const { cards } = parseGlossaryAndCards(flatSource);

  const normalCards: SmartNormalCard[] = cards
    .filter((pair) => (pair.sideA || pair.en) && (pair.sideB || pair.pt))
    .map((pair, index) => ({
      type: "normal",
      key: `text-${index + 1}`,
      front: pair.sideA || pair.en || "",
      back: pair.sideB || pair.pt || "",
      short_observation: pair.shortObservation || null,
      hint: pair.detailedHint || null,
      word_hints: [],
    }));

  const layeredCards: SmartLayeredCard[] = camadas.groups.map((group, groupIndex) => ({
    type: "layered",
    key: `group-${groupIndex + 1}`,
    group_title: group.term,
    layers: group.layers.map((layer, layerIndex) => ({
      key: `group-${groupIndex + 1}-layer-${layerIndex + 1}`,
      front: layer.term || group.term,
      back: layer.translation,
      example: layer.example || null,
      example_translation: layer.exampleTranslation || null,
      context_tag: layer.contextTag || group.term,
      hint: layer.shortExplanation || null,
      word_hints: [],
    })),
  }));

  const glossary: SmartGlossaryEntry[] = glossaryResult.entries.map((entry) => ({
    term: entry.original_text,
    translation: entry.translated_text,
    side: entry.side,
    note: entry.note ?? null,
    active: entry.is_active,
  }));

  const packageValue = contextList(context, [...normalCards, ...layeredCards], glossary);
  const warnings = [
    ...glossaryResult.errors,
    ...camadas.sentenceWarnings.map((value) => `Possível título de grupo muito longo: ${value}`),
    ...camadas.singletonWarnings.map((value) => `Grupo “${value}” foi tratado como card normal porque possui menos de duas frases.`),
  ];
  return {
    packageValue: smartImportPackageSchema.parse(packageValue),
    format: "text",
    notes: [`Texto reconhecido: ${normalCards.length} card(s), ${layeredCards.length} grupo(s) e ${glossary.length} entrada(s) de glossário.`],
    warnings,
  };
}

export function looksLikeAdvancedSmartCsv(input: string) {
  const firstLine = input.trim().replace(/^```(?:csv)?\s*/i, "").split(/\r?\n/, 1)[0]?.toLocaleLowerCase() ?? "";
  return firstLine.includes("record_type") && firstLine.includes("folder_name") && firstLine.includes("list_name");
}

export function looksLikeAnyCsv(input: string) {
  const trimmed = input.trim();
  if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("[")) return false;
  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? "";
  return /[,;\t]/.test(firstLine) && !/^===/.test(firstLine);
}

export function parseSmartImportSource(input: string, context: SmartImportContext = {}): SmartImportSourceResult {
  const trimmed = input.replace(/^\uFEFF/, "").trim().replace(/^```(?:json|csv|txt)?\s*/i, "").replace(/\s*```$/i, "");
  if (!trimmed) throw new Error("O conteúdo está vazio.");

  if (trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("O JSON está inválido ou incompleto.");
    }
    const result = smartImportPackageSchema.safeParse(parsed);
    if (!result.success) {
      const first = result.error.issues[0];
      throw new Error(`${first.path.join(".") || "$"}: ${first.message}`);
    }
    return { packageValue: result.data, format: "json-v2", notes: ["Contrato app-piteco-super-import 2.0 reconhecido."], warnings: [] };
  }

  if (looksLikeAdvancedSmartCsv(trimmed)) return parseAdvancedCsv(trimmed, context);
  if (looksLikeAnyCsv(trimmed)) return parseSimpleCsv(trimmed, context);
  return parseText(trimmed, context);
}
