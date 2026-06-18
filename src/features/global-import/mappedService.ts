import { supabase } from "@/integrations/supabase/client";
import type { GlobalImportPackage } from "./schema";
import type {
  GlobalImportDestinationPlan,
  ImportDestinationCatalog,
} from "./destination";

export type CardConflictPolicy = "skip" | "copy" | "error";

export interface ExecuteMappedImportOptions {
  destinationPlan: GlobalImportDestinationPlan;
  catalog: ImportDestinationCatalog;
  cardConflict: CardConflictPolicy;
  institutionId?: string | null;
  onProgress?: (completed: number, total: number, label: string) => void;
}

export interface GlobalImportExecutionReport {
  batch_id: string;
  package_name: string;
  folders_created: number;
  folders_reused: number;
  lists_created: number;
  lists_reused: number;
  cards_created: number;
  cards_skipped: number;
}

interface CreatedEntities {
  cards: string[];
  lists: string[];
  folders: string[];
  batchId?: string;
}

interface HistoryItem {
  entity_type: "folder" | "list" | "card";
  entity_id: string | null;
  action: "created" | "reused" | "skipped";
  item_path: string;
}

const db = supabase as any;
const CHUNK_SIZE = 200;

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

async function deleteIds(table: string, ids: string[]): Promise<void> {
  for (let index = 0; index < ids.length; index += CHUNK_SIZE) {
    const chunk = ids.slice(index, index + CHUNK_SIZE);
    const { error } = await db.from(table).delete().in("id", chunk);
    if (error) throw error;
  }
}

async function rollbackCreated(created: CreatedEntities): Promise<string[]> {
  const failures: string[] = [];
  for (const [table, ids] of [
    ["flashcards", created.cards],
    ["lists", created.lists],
    ["folders", created.folders],
  ] as const) {
    if (!ids.length) continue;
    try {
      await deleteIds(table, [...ids].reverse());
    } catch (error: any) {
      failures.push(`${table}: ${error?.message || "falha ao desfazer"}`);
    }
  }
  if (created.batchId) {
    try {
      const { error } = await db.from("global_import_batches").delete().eq("id", created.batchId);
      if (error) throw error;
    } catch (error: any) {
      failures.push(`histórico: ${error?.message || "falha ao desfazer"}`);
    }
  }
  return failures;
}

async function loadExistingCardKeys(listId: string): Promise<Set<string>> {
  const keys = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db
      .from("flashcards")
      .select("term, translation")
      .eq("list_id", listId)
      .is("deleted_at", null)
      .range(offset, offset + 999);
    if (error) throw error;
    for (const card of data ?? []) {
      keys.add(`${normalize(card.term)}|${normalize(card.translation)}`);
    }
    if (!data || data.length < 1000) break;
  }
  return keys;
}

async function verifyFolderOwnership(folderId: string, userId: string): Promise<void> {
  const { data, error } = await db
    .from("folders")
    .select("id")
    .eq("id", folderId)
    .eq("owner_id", userId)
    .is("deleted_at", null)
    .single();
  if (error || !data) throw new Error("A pasta selecionada não existe ou não pertence ao usuário.");
}

async function verifyListOwnership(listId: string, folderId: string, userId: string): Promise<void> {
  const { data, error } = await db
    .from("lists")
    .select("id")
    .eq("id", listId)
    .eq("folder_id", folderId)
    .eq("owner_id", userId)
    .is("deleted_at", null)
    .single();
  if (error || !data) throw new Error("A lista selecionada não pertence à pasta escolhida.");
}

export async function executeMappedGlobalImport(
  packageValue: GlobalImportPackage,
  options: ExecuteMappedImportOptions,
): Promise<GlobalImportExecutionReport> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Você precisa estar logado.");

  const created: CreatedEntities = { cards: [], lists: [], folders: [] };
  const history: HistoryItem[] = [];
  const report: GlobalImportExecutionReport = {
    batch_id: "",
    package_name: packageValue.package.name,
    folders_created: 0,
    folders_reused: 0,
    lists_created: 0,
    lists_reused: 0,
    cards_created: 0,
    cards_skipped: 0,
  };
  const folderById = new Map(options.catalog.folders.map((folder) => [folder.id, folder]));
  const listById = new Map(options.catalog.lists.map((list) => [list.id, list]));
  const totalCards = packageValue.package.folders.reduce(
    (folderSum, folder) => folderSum + folder.lists.reduce((listSum, list) => listSum + list.cards.length, 0),
    0,
  );
  let completedCards = 0;

  try {
    for (let folderIndex = 0; folderIndex < packageValue.package.folders.length; folderIndex += 1) {
      const incomingFolder = packageValue.package.folders[folderIndex];
      const folderPlan = options.destinationPlan.folders[folderIndex];
      const folderPath = `package.folders[${folderIndex}]`;
      if (!folderPlan) throw new Error(`${folderPath}: destino não definido.`);

      let folderId: string;
      if (folderPlan.folder.mode === "existing") {
        const folder = folderById.get(folderPlan.folder.folderId);
        if (!folder) throw new Error(`${folderPath}: pasta existente inválida.`);
        await verifyFolderOwnership(folder.id, user.id);
        folderId = folder.id;
        report.folders_reused += 1;
        history.push({ entity_type: "folder", entity_id: folderId, action: "reused", item_path: folderPath });
      } else {
        const { data, error } = await db.from("folders").insert({
          owner_id: user.id,
          title: folderPlan.folder.name.trim(),
          description: incomingFolder.description || null,
          visibility: "private",
          institution_id: options.institutionId || null,
          lang_a: packageValue.package.source_language || null,
          lang_b: packageValue.package.target_language || null,
        }).select("id").single();
        if (error) throw error;
        folderId = data.id;
        created.folders.push(folderId);
        report.folders_created += 1;
        history.push({ entity_type: "folder", entity_id: folderId, action: "created", item_path: folderPath });
      }

      let nextOrder = 0;
      const { data: currentLists, error: currentListsError } = await db
        .from("lists")
        .select("order_index")
        .eq("folder_id", folderId)
        .is("deleted_at", null);
      if (currentListsError) throw currentListsError;
      for (const list of currentLists ?? []) {
        nextOrder = Math.max(nextOrder, Number(list.order_index ?? 0) + 1);
      }

      for (let listIndex = 0; listIndex < incomingFolder.lists.length; listIndex += 1) {
        const incomingList = incomingFolder.lists[listIndex];
        const listPlan = folderPlan.lists[listIndex];
        const listPath = `${folderPath}.lists[${listIndex}]`;
        if (!listPlan) throw new Error(`${listPath}: destino não definido.`);

        let listId: string;
        if (listPlan.mode === "existing") {
          const list = listById.get(listPlan.listId);
          if (!list) throw new Error(`${listPath}: lista existente inválida.`);
          await verifyListOwnership(list.id, folderId, user.id);
          listId = list.id;
          report.lists_reused += 1;
          history.push({ entity_type: "list", entity_id: listId, action: "reused", item_path: listPath });
        } else {
          const { data, error } = await db.from("lists").insert({
            folder_id: folderId,
            owner_id: user.id,
            title: listPlan.name.trim(),
            description: incomingList.description || null,
            order_index: nextOrder,
            visibility: "private",
            institution_id: options.institutionId || null,
            lang_a: packageValue.package.source_language || null,
            lang_b: packageValue.package.target_language || null,
          }).select("id").single();
          if (error) throw error;
          listId = data.id;
          nextOrder += 1;
          created.lists.push(listId);
          report.lists_created += 1;
          history.push({ entity_type: "list", entity_id: listId, action: "created", item_path: listPath });
        }

        const existingKeys = await loadExistingCardKeys(listId);
        const pendingRows: Array<Record<string, unknown> & { itemPath: string }> = [];

        for (let cardIndex = 0; cardIndex < incomingList.cards.length; cardIndex += 1) {
          const card = incomingList.cards[cardIndex];
          const cardPath = `${listPath}.cards[${cardIndex}]`;
          const key = `${normalize(card.front)}|${normalize(card.back)}`;
          const duplicate = existingKeys.has(key);

          if (duplicate && options.cardConflict === "error") {
            throw new Error(`${cardPath}: o card já existe na lista escolhida.`);
          }
          if (duplicate && options.cardConflict === "skip") {
            report.cards_skipped += 1;
            completedCards += 1;
            history.push({ entity_type: "card", entity_id: null, action: "skipped", item_path: cardPath });
            options.onProgress?.(completedCards, totalCards, `Ignorando duplicado em ${incomingList.name}`);
            continue;
          }

          pendingRows.push({
            itemPath: cardPath,
            list_id: listId,
            user_id: user.id,
            term: card.front,
            translation: card.back,
            hint: card.hint || null,
            context_tag: card.context_tag || null,
            example_text: card.example || null,
            example_translation: card.example_translation || null,
          });
          existingKeys.add(key);
        }

        for (let offset = 0; offset < pendingRows.length; offset += CHUNK_SIZE) {
          const chunk = pendingRows.slice(offset, offset + CHUNK_SIZE);
          const rows = chunk.map(({ itemPath: _itemPath, ...row }) => row);
          const { data, error } = await db.from("flashcards").insert(rows).select("id");
          if (error) throw error;
          (data ?? []).forEach((row: { id: string }, rowIndex: number) => {
            created.cards.push(row.id);
            history.push({ entity_type: "card", entity_id: row.id, action: "created", item_path: chunk[rowIndex].itemPath });
          });
          report.cards_created += data?.length ?? 0;
          completedCards += chunk.length;
          options.onProgress?.(completedCards, totalCards, `Salvando ${incomingList.name}`);
        }
      }
    }

    const { data: batch, error: batchError } = await db.from("global_import_batches").insert({
      user_id: user.id,
      package_name: packageValue.package.name,
      schema_version: packageValue.version,
      status: "completed",
      options: {
        card_conflict: options.cardConflict,
        destination_plan: options.destinationPlan,
        institution_id: options.institutionId || null,
      },
      summary: report,
    }).select("id").single();
    if (batchError) throw batchError;
    created.batchId = batch.id;
    report.batch_id = batch.id;

    if (history.length) {
      const rows = history.map((item) => ({ ...item, batch_id: batch.id, user_id: user.id }));
      for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
        const { error } = await db.from("global_import_items").insert(rows.slice(offset, offset + CHUNK_SIZE));
        if (error) throw error;
      }
    }

    const { error: summaryError } = await db
      .from("global_import_batches")
      .update({ summary: report })
      .eq("id", batch.id);
    if (summaryError) throw summaryError;

    return report;
  } catch (error: any) {
    const rollbackFailures = await rollbackCreated(created);
    const message = error?.message || "Falha durante a importação global.";
    if (rollbackFailures.length) {
      throw new Error(`${message} A compensação encontrou problemas: ${rollbackFailures.join("; ")}.`);
    }
    throw new Error(`${message} Nenhum item criado por esta tentativa foi mantido.`);
  }
}

export async function undoGlobalImport(batchId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Você precisa estar logado.");

  const { data: batch, error: batchError } = await db
    .from("global_import_batches")
    .select("id, status")
    .eq("id", batchId)
    .eq("user_id", user.id)
    .single();
  if (batchError || !batch) throw new Error("Importação não encontrada.");
  if (batch.status === "undone") throw new Error("Esta importação já foi desfeita.");

  const { data: items, error: itemsError } = await db
    .from("global_import_items")
    .select("entity_type, entity_id, action")
    .eq("batch_id", batchId)
    .eq("user_id", user.id)
    .eq("action", "created");
  if (itemsError) throw itemsError;

  const cards = (items ?? []).filter((item: any) => item.entity_type === "card" && item.entity_id).map((item: any) => item.entity_id);
  const lists = (items ?? []).filter((item: any) => item.entity_type === "list" && item.entity_id).map((item: any) => item.entity_id);
  const folders = (items ?? []).filter((item: any) => item.entity_type === "folder" && item.entity_id).map((item: any) => item.entity_id);

  await deleteIds("flashcards", cards);
  await deleteIds("lists", lists.reverse());
  await deleteIds("folders", folders.reverse());

  const { error: updateError } = await db
    .from("global_import_batches")
    .update({ status: "undone", undone_at: new Date().toISOString() })
    .eq("id", batchId)
    .eq("user_id", user.id);
  if (updateError) throw updateError;
}
