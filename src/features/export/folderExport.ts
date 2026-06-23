import { supabase } from '@/integrations/supabase/client';
import {
  smartImportPackageSchema,
  withSmartDeclaredTotals,
  type SmartCard,
  type SmartImportFolder,
  type SmartImportList,
  type SmartImportPackage,
  type SmartNormalCard,
  type SmartWordHint,
} from '@/features/smart-import/schema';

export interface FolderExportSource {
  id: string;
  title?: string | null;
}

export interface FolderExportSummary {
  folders: number;
  lists: number;
  cards: number;
  layeredGroups: number;
  emptyLists: number;
}

export interface FolderExportResult {
  packageValue: SmartImportPackage | null;
  jsonText: string;
  plainText: string;
  fileBaseName: string;
  summary: FolderExportSummary;
}

interface FolderRow {
  id: string;
  title: string;
  description?: string | null;
  study_type?: string | null;
  lang_a?: string | null;
  lang_b?: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
  tts_enabled?: boolean | null;
}

interface ListRow {
  id: string;
  folder_id: string;
  title: string;
  description?: string | null;
  study_type?: string | null;
  lang_a?: string | null;
  lang_b?: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
  tts_enabled?: boolean | null;
  primary_side?: string | null;
  order_index?: number | null;
  created_at?: string | null;
}

interface FlashcardRow {
  id: string;
  list_id: string;
  term: string;
  translation: string;
  hint?: string | null;
  context_tag?: string | null;
  example_text?: string | null;
  example_translation?: string | null;
  detailed_explanation?: string | null;
  usage_notes?: string | null;
  common_mistakes?: string | null;
  short_explanation?: string | null;
  word_hints?: unknown;
  parent_card_id?: string | null;
  layer_index?: number | null;
  created_at?: string | null;
}

const QUERY_CHUNK_SIZE = 50;
const PAGE_SIZE = 1_000;

function chunk<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function cleanOptional(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function cleanLine(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
}

function normalizeStudyType(value: unknown): SmartImportList['study_type'] {
  return value === 'general' || value === 'math' || value === 'visual' || value === 'language'
    ? value
    : 'language';
}

function normalizeWordHints(value: unknown): SmartWordHint[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const hints = value.flatMap<SmartWordHint>((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const text = cleanOptional(row.text);
    const translation = cleanOptional(row.translation);
    if (!text || !translation) return [];

    const occurrence = row.occurrence === 'all'
      ? 'all' as const
      : typeof row.occurrence === 'number' && Number.isInteger(row.occurrence) && row.occurrence >= 0
        ? row.occurrence
        : 'all' as const;
    const startIndex = typeof row.start_index === 'number' && Number.isInteger(row.start_index) && row.start_index >= 0
      ? row.start_index
      : undefined;
    const endIndex = typeof row.end_index === 'number' && Number.isInteger(row.end_index) && row.end_index > 0
      ? row.end_index
      : undefined;

    return [{
      side: row.side === 'B' ? 'B' : 'A',
      text,
      translation,
      note: cleanOptional(row.note),
      occurrence,
      ...(startIndex !== undefined && endIndex !== undefined && endIndex > startIndex
        ? { start_index: startIndex, end_index: endIndex }
        : {}),
    }];
  });

  return hints.length > 0 ? hints : undefined;
}

function mapCardContent(card: FlashcardRow) {
  return {
    front: cleanLine(card.term),
    back: cleanLine(card.translation),
    hint: cleanOptional(card.hint),
    short_observation: cleanOptional(card.short_explanation),
    detailed_explanation: cleanOptional(card.detailed_explanation),
    usage_notes: cleanOptional(card.usage_notes),
    common_mistakes: cleanOptional(card.common_mistakes),
    example: cleanOptional(card.example_text),
    example_translation: cleanOptional(card.example_translation),
    context_tag: cleanOptional(card.context_tag),
    word_hints: normalizeWordHints(card.word_hints),
  };
}

function cardsForExport(rows: FlashcardRow[]): SmartCard[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const childrenByParent = new Map<string, FlashcardRow[]>();

  for (const row of rows) {
    if (!row.parent_card_id) continue;
    const children = childrenByParent.get(row.parent_card_id) ?? [];
    children.push(row);
    childrenByParent.set(row.parent_card_id, children);
  }

  for (const children of childrenByParent.values()) {
    children.sort((left, right) => {
      const layerDiff = (left.layer_index ?? Number.MAX_SAFE_INTEGER) - (right.layer_index ?? Number.MAX_SAFE_INTEGER);
      if (layerDiff !== 0) return layerDiff;
      return String(left.created_at ?? '').localeCompare(String(right.created_at ?? ''));
    });
  }

  const exported: SmartCard[] = [];
  const consumed = new Set<string>();

  for (const row of rows) {
    if (row.parent_card_id) continue;
    const children = childrenByParent.get(row.id) ?? [];

    if (children.length >= 2) {
      exported.push({
        type: 'layered',
        group_title: cleanLine(row.term) || cleanLine(row.context_tag) || 'Grupo em camadas',
        layers: children.map((child) => mapCardContent(child)),
      });
      consumed.add(row.id);
      children.forEach((child) => consumed.add(child.id));
      continue;
    }

    const normal: SmartNormalCard = {
      type: 'normal',
      ...mapCardContent(row),
    };
    if (normal.front && normal.back) exported.push(normal);
    consumed.add(row.id);
  }

  for (const row of rows) {
    if (consumed.has(row.id)) continue;
    if (row.parent_card_id && byId.has(row.parent_card_id)) {
      const parentChildren = childrenByParent.get(row.parent_card_id) ?? [];
      if (parentChildren.length >= 2) continue;
    }
    const normal: SmartNormalCard = {
      type: 'normal',
      ...mapCardContent(row),
    };
    if (normal.front && normal.back) exported.push(normal);
  }

  return exported;
}

async function loadFolders(folderIds: string[]): Promise<FolderRow[]> {
  const { data, error } = await (supabase.from('folders') as any)
    .select('id, title, description, study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled')
    .in('id', folderIds)
    .is('deleted_at', null);

  if (error) throw error;
  return (data ?? []) as FolderRow[];
}

async function loadLists(folderIds: string[]): Promise<ListRow[]> {
  const result: ListRow[] = [];
  for (const ids of chunk(folderIds, QUERY_CHUNK_SIZE)) {
    const { data, error } = await (supabase.from('lists') as any)
      .select('id, folder_id, title, description, study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled, primary_side, order_index, created_at')
      .in('folder_id', ids)
      .is('deleted_at', null)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    result.push(...((data ?? []) as ListRow[]));
  }
  return result;
}

async function loadFlashcards(listIds: string[]): Promise<FlashcardRow[]> {
  const result: FlashcardRow[] = [];

  for (const ids of chunk(listIds, QUERY_CHUNK_SIZE)) {
    let offset = 0;
    while (true) {
      const { data, error } = await (supabase.from('flashcards') as any)
        .select('id, list_id, term, translation, hint, context_tag, example_text, example_translation, detailed_explanation, usage_notes, common_mistakes, short_explanation, word_hints, parent_card_id, layer_index, created_at')
        .in('list_id', ids)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      const page = (data ?? []) as FlashcardRow[];
      result.push(...page);
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  return result;
}

function resolveListSettings(list: ListRow, folder: FolderRow) {
  const studyType = normalizeStudyType(list.study_type ?? folder.study_type);
  const frontLanguage = cleanOptional(list.lang_a) ?? cleanOptional(folder.lang_a) ?? (studyType === 'general' ? 'general-a' : 'en');
  const backLanguage = cleanOptional(list.lang_b) ?? cleanOptional(folder.lang_b) ?? (studyType === 'general' ? 'general-b' : 'pt');

  return {
    studyType,
    frontLanguage,
    backLanguage,
    labelA: cleanOptional(list.labels_a) ?? cleanOptional(folder.labels_a),
    labelB: cleanOptional(list.labels_b) ?? cleanOptional(folder.labels_b),
    ttsEnabled: list.tts_enabled ?? folder.tts_enabled ?? true,
  };
}

function folderToSmartImport(
  folder: FolderRow,
  lists: ListRow[],
  cardsByList: Map<string, FlashcardRow[]>,
): { folder: SmartImportFolder | null; emptyLists: number; plainText: string; cardCount: number; layeredGroups: number } {
  const smartLists: SmartImportList[] = [];
  const textParts: string[] = [`=== PASTA: ${cleanLine(folder.title)} ===`];
  let emptyLists = 0;
  let cardCount = 0;
  let layeredGroups = 0;

  for (const list of lists) {
    const cards = cardsForExport(cardsByList.get(list.id) ?? []);
    const settings = resolveListSettings(list, folder);
    textParts.push('', `--- LISTA: ${cleanLine(list.title)} ---`);

    if (cards.length === 0) {
      emptyLists += 1;
      textParts.push('(lista vazia)');
      continue;
    }

    for (const card of cards) {
      if (card.type === 'normal') {
        cardCount += 1;
        textParts.push(`${cleanLine(card.front)} / ${cleanLine(card.back)}`);
      } else {
        layeredGroups += 1;
        textParts.push(`[CAMADAS: ${cleanLine(card.group_title)}]`);
        for (const layer of card.layers) {
          cardCount += 1;
          textParts.push(`${cleanLine(layer.front)} / ${cleanLine(layer.back)}`);
        }
      }
    }

    smartLists.push({
      name: cleanLine(list.title),
      description: cleanOptional(list.description),
      front_language: settings.frontLanguage,
      back_language: settings.backLanguage,
      primary_side: list.primary_side === 'b' ? 'b' : 'a',
      study_type: settings.studyType,
      label_a: settings.labelA,
      label_b: settings.labelB,
      tts_enabled: settings.ttsEnabled,
      glossary: [],
      cards,
    });
  }

  return {
    folder: smartLists.length > 0
      ? {
          name: cleanLine(folder.title),
          description: cleanOptional(folder.description),
          lists: smartLists,
        }
      : null,
    emptyLists,
    plainText: textParts.join('\n'),
    cardCount,
    layeredGroups,
  };
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'pastas-app-piteco';
}

export async function buildFolderExport(
  sources: FolderExportSource[],
  packageName?: string,
): Promise<FolderExportResult> {
  const uniqueSources = Array.from(
    new Map(sources.filter((source) => source.id).map((source) => [source.id, source])).values(),
  );
  if (uniqueSources.length === 0) throw new Error('Nenhuma pasta foi selecionada para exportação.');

  const folderIds = uniqueSources.map((source) => source.id);
  const [folderRows, listRows] = await Promise.all([
    loadFolders(folderIds),
    loadLists(folderIds),
  ]);

  if (folderRows.length === 0) {
    throw new Error('As pastas não foram encontradas ou sua conta não possui permissão para exportá-las.');
  }

  const listIds = listRows.map((list) => list.id);
  const flashcards = listIds.length > 0 ? await loadFlashcards(listIds) : [];
  const cardsByList = new Map<string, FlashcardRow[]>();
  for (const card of flashcards) {
    const rows = cardsByList.get(card.list_id) ?? [];
    rows.push(card);
    cardsByList.set(card.list_id, rows);
  }

  const sourceOrder = new Map(folderIds.map((id, index) => [id, index]));
  folderRows.sort((left, right) => (sourceOrder.get(left.id) ?? 0) - (sourceOrder.get(right.id) ?? 0));

  const smartFolders: SmartImportFolder[] = [];
  const textParts: string[] = [];
  let emptyLists = 0;
  let cards = 0;
  let layeredGroups = 0;

  for (const folder of folderRows) {
    const folderLists = listRows.filter((list) => list.folder_id === folder.id);
    const mapped = folderToSmartImport(folder, folderLists, cardsByList);
    if (mapped.folder) smartFolders.push(mapped.folder);
    emptyLists += mapped.emptyLists;
    cards += mapped.cardCount;
    layeredGroups += mapped.layeredGroups;
    textParts.push(mapped.plainText);
  }

  const resolvedPackageName = cleanLine(packageName)
    || (folderRows.length === 1 ? cleanLine(folderRows[0].title) : 'Pastas exportadas do App Piteco');

  let packageValue: SmartImportPackage | null = null;
  let jsonText = '';
  if (smartFolders.length > 0) {
    const candidate = withSmartDeclaredTotals({
      schema: 'app-piteco-super-import',
      version: '2.0',
      package: {
        name: resolvedPackageName,
        description: folderRows.length === 1
          ? cleanOptional(folderRows[0].description)
          : `Exportação de ${folderRows.length} pastas do App Piteco.`,
        folders: smartFolders,
      },
    });
    packageValue = smartImportPackageSchema.parse(candidate);
    jsonText = JSON.stringify(packageValue, null, 2);
  }

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return {
    packageValue,
    jsonText,
    plainText: textParts.join('\n\n'),
    fileBaseName: `${slugify(resolvedPackageName)}-${date}`,
    summary: {
      folders: folderRows.length,
      lists: listRows.length,
      cards,
      layeredGroups,
      emptyLists,
    },
  };
}

export function downloadExportFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
