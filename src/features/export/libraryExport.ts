import { supabase } from '@/integrations/supabase/client';
import { fetchAllSupabaseRows } from '@/lib/fetchAllSupabaseRows';

/**
 * Exportação GLOBAL da biblioteca pessoal.
 *
 * Regras invioláveis desta exportação:
 * - somente leitura (nenhuma escrita, nenhuma limpeza, nenhuma migração);
 * - estritamente escopada ao usuário autenticado (owner_id / user_id);
 * - fidelidade total: nenhum resumo, nenhuma interpretação, NENHUMA deduplicação;
 * - paginação obrigatória (o limite implícito de 1000 linhas não pode truncar nada).
 *
 * O contrato por pasta (`folderExport.ts`, formato app-piteco-super-import) continua
 * intacto e é usado para reimportação. Este arquivo produz um envelope bruto e
 * versionado, pensado para análise externa (por exemplo, envio a uma IA).
 */

export const LIBRARY_EXPORT_SCHEMA = 'ape-library-export';
export const LIBRARY_EXPORT_VERSION = '1.0';

const FOLDER_COLUMNS =
  'id, owner_id, title, description, visibility, class_id, institution_id, study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled, system_kind, reference_id, created_at, updated_at';

const LIST_COLUMNS =
  'id, folder_id, owner_id, title, description, order_index, visibility, class_id, institution_id, study_type, lang, lang_a, lang_b, labels_a, labels_b, tts_enabled, primary_side, system_kind, reference_id, created_at, updated_at';

const CARD_COLUMNS =
  'id, list_id, collection_id, user_id, term, translation, hint, lang, display_text, eval_text, note_text, audio_url, image_url_a, image_url_b, word_hints, parent_card_id, layer_index, example_text, example_translation, context_tag, short_explanation, detailed_explanation, usage_notes, common_mistakes, accepted_answers_en, accepted_answers_pt, status_group_uid, created_at, updated_at';

const FOLDER_GLOSSARY_COLUMNS =
  'id, folder_id, owner_id, original_text, primary_translation, alternative_translations, note, side, source_language, target_language, is_active, created_at, updated_at';

const LIST_GLOSSARY_COLUMNS =
  'id, list_id, original_text, translated_text, note, side, is_active, created_at, updated_at';

const ACCOUNT_GLOSSARY_COLUMNS =
  'id, owner_id, original_text, translated_text, note, side, is_active, created_at, updated_at';

type Row = Record<string, unknown>;

export interface LibraryExportSummary {
  folders: number;
  lists: number;
  cards: number;
  topLevelCards: number;
  layerCards: number;
  emptyLists: number;
  folderGlossaryEntries: number;
  listGlossaryEntries: number;
  accountGlossaryEntries: number;
  listsWithoutFolder: number;
  cardsWithoutList: number;
}

export interface LibraryExportPayload {
  schema: typeof LIBRARY_EXPORT_SCHEMA;
  version: typeof LIBRARY_EXPORT_VERSION;
  generated_at: string;
  source: string;
  user_id: string;
  notes: string[];
  totals: LibraryExportSummary;
  account_glossary: Row[];
  folders: Array<Row & { glossary: Row[]; lists: Array<Row & { glossary: Row[]; cards: Row[] }> }>;
  lists_without_folder: Array<Row & { glossary: Row[]; cards: Row[] }>;
  cards_without_list: Row[];
}

export interface LibraryExportResult {
  payload: LibraryExportPayload;
  jsonText: string;
  plainText: string;
  fileBaseName: string;
  summary: LibraryExportSummary;
}

async function loadOwned<T extends Row>(
  table: string,
  columns: string,
  ownerColumn: string,
  ownerId: string,
  options: { softDelete?: boolean; order?: string[] } = {},
): Promise<T[]> {
  return fetchAllSupabaseRows<T>((from, to) => {
    let query: any = (supabase.from as any)(table).select(columns).eq(ownerColumn, ownerId);
    if (options.softDelete) query = query.is('deleted_at', null);
    for (const column of options.order ?? ['created_at']) {
      query = query.order(column, { ascending: true });
    }
    return query.order('id', { ascending: true }).range(from, to);
  });
}

function group<T extends Row>(rows: T[], key: string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const value = row[key];
    if (typeof value !== 'string') continue;
    const bucket = map.get(value) ?? [];
    // Sem deduplicação: toda ocorrência é preservada na ordem lida.
    bucket.push(row);
    map.set(value, bucket);
  }
  return map;
}

export interface LibraryExportInput {
  userId: string;
  folders: Row[];
  lists: Row[];
  cards: Row[];
  folderGlossary: Row[];
  listGlossary: Row[];
  accountGlossary: Row[];
}

/** Monta o envelope a partir das linhas cruas. Função pura, sem rede. */
export function assembleLibraryExport(input: LibraryExportInput): LibraryExportResult {
  const listsByFolder = group(input.lists, 'folder_id');
  const cardsByList = group(input.cards, 'list_id');
  const folderGlossaryByFolder = group(input.folderGlossary, 'folder_id');
  const listGlossaryByList = group(input.listGlossary, 'list_id');

  const knownFolderIds = new Set(input.folders.map((folder) => String(folder.id)));
  const knownListIds = new Set(input.lists.map((list) => String(list.id)));

  let emptyLists = 0;
  let layerCards = 0;
  let topLevelCards = 0;
  const textParts: string[] = [];

  const buildList = (list: Row) => {
    const listId = String(list.id);
    const cards = cardsByList.get(listId) ?? [];
    if (cards.length === 0) emptyLists += 1;
    for (const card of cards) {
      if (card.parent_card_id) layerCards += 1;
      else topLevelCards += 1;
    }
    textParts.push(`--- LISTA: ${String(list.title ?? '')} (${cards.length} card(s)) ---`);
    for (const card of cards) {
      textParts.push(`${String(card.term ?? '')} / ${String(card.translation ?? '')}`);
    }
    return { ...list, glossary: listGlossaryByList.get(listId) ?? [], cards };
  };

  const folders = input.folders.map((folder) => {
    const folderId = String(folder.id);
    textParts.push(`=== PASTA: ${String(folder.title ?? '')} ===`);
    const lists = (listsByFolder.get(folderId) ?? []).map(buildList);
    return { ...folder, glossary: folderGlossaryByFolder.get(folderId) ?? [], lists };
  });

  const orphanLists = input.lists
    .filter((list) => typeof list.folder_id !== 'string' || !knownFolderIds.has(String(list.folder_id)))
    .map(buildList);

  const cardsWithoutList = input.cards.filter(
    (card) => typeof card.list_id !== 'string' || !knownListIds.has(String(card.list_id)),
  );

  const summary: LibraryExportSummary = {
    folders: input.folders.length,
    lists: input.lists.length,
    cards: input.cards.length,
    topLevelCards,
    layerCards,
    emptyLists,
    folderGlossaryEntries: input.folderGlossary.length,
    listGlossaryEntries: input.listGlossary.length,
    accountGlossaryEntries: input.accountGlossary.length,
    listsWithoutFolder: orphanLists.length,
    cardsWithoutList: cardsWithoutList.length,
  };

  const payload: LibraryExportPayload = {
    schema: LIBRARY_EXPORT_SCHEMA,
    version: LIBRARY_EXPORT_VERSION,
    generated_at: new Date().toISOString(),
    source: 'App Piteco / APE Education',
    user_id: input.userId,
    notes: [
      'Exportação completa e literal da biblioteca pessoal do usuário autenticado.',
      'Nenhuma deduplicação foi aplicada: repetições são intencionais e informativas.',
      'Cards em camadas mantêm parent_card_id e layer_index para reconstruir a hierarquia.',
      'Operação somente leitura: nada foi alterado no aplicativo.',
    ],
    totals: summary,
    account_glossary: input.accountGlossary,
    folders,
    lists_without_folder: orphanLists,
    cards_without_list: cardsWithoutList,
  };

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return {
    payload,
    jsonText: JSON.stringify(payload, null, 2),
    plainText: textParts.join('\n'),
    fileBaseName: `biblioteca-app-piteco-${date}`,
    summary,
  };
}

/** Lê toda a biblioteca pessoal do usuário e monta o pacote de exportação. */
export async function buildLibraryExport(userId: string): Promise<LibraryExportResult> {
  if (!userId) throw new Error('Entre na sua conta para exportar a biblioteca.');

  const [folders, lists, cards, folderGlossary, accountGlossary] = await Promise.all([
    loadOwned('folders', FOLDER_COLUMNS, 'owner_id', userId, { softDelete: true }),
    loadOwned('lists', LIST_COLUMNS, 'owner_id', userId, { softDelete: true, order: ['order_index', 'created_at'] }),
    loadOwned('flashcards', CARD_COLUMNS, 'user_id', userId, { softDelete: true }),
    loadOwned('folder_glossary', FOLDER_GLOSSARY_COLUMNS, 'owner_id', userId),
    loadOwned('account_glossary', ACCOUNT_GLOSSARY_COLUMNS, 'owner_id', userId),
  ]);

  const listIds = lists.map((list) => String(list.id));
  const listGlossary: Row[] = [];
  for (let index = 0; index < listIds.length; index += 50) {
    const ids = listIds.slice(index, index + 50);
    const rows = await fetchAllSupabaseRows<Row>((from, to) =>
      (supabase.from('list_glossary') as any)
        .select(LIST_GLOSSARY_COLUMNS)
        .in('list_id', ids)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    );
    listGlossary.push(...rows);
  }

  return assembleLibraryExport({
    userId,
    folders,
    lists,
    cards,
    folderGlossary,
    listGlossary,
    accountGlossary,
  });
}
