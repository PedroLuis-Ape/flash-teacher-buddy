import { supabase } from "@/integrations/supabase/client";
import type { GlobalImportPackage } from "./schema";
import {
  validateDestinationPlan,
  type GlobalImportDestinationPlan,
  type ImportDestinationCatalog,
} from "./destination";

export type CardConflictPolicy = "skip" | "copy" | "error";

export interface ExecuteGlobalImportOptions {
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

export interface GlobalImportHistoryRow {
  id: string;
  package_name: string;
  status: "completed" | "undone";
  summary: GlobalImportExecutionReport;
  created_at: string;
  undone_at: string | null;
}

interface ImportLogItem {
  entity_type: "folder" | "list" | "card";
  entity_id: string | null;
  action: "created" | "reused" | "skipped";
  item_path: string;
}

const CHUNK_SIZE = 200;
const db = supabase as any;

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

async function deleteInChunks(table: string, ids: string[]): Promise<void> {
  for (let index = 0; index < ids.length; index += CHUNK_SIZE) {
    const chunk = ids.slice(index, index + CHUNK_SIZE);
    const { error } = await db.from(table).delete().in("id", chunk);
    if (error) throw error;
  }
}

async function rollbackCreated(created: {
  cards: string[];
  lists: string[];
  folders: string[];
  batchId?: string;
}): Promise<string[]> {
  const failures: string[] = [];
  for (const [table, ids] of [
    ["flashcards", created.cards],
    ["lists", created.lists],
    ["folders", created.folders],
  ] as const) {
    if (!ids.length) continue;
    try {
      await deleteInChunks(table, [...ids].reverse());
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

async function loadAllCards(listId: string): Promise<Array<{ term: string; translation: string }>> {
  const result: Array<{ term: string; translation: string }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db
      .from("flashcards")
      .select("term, translation")
      .eq("list_id", listId)
      .is("deleted_at", null)
      .range(offset, offset + 999);
    if (error) throw error;
    result.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return result;
}

export async function executeGlobalImport(
  packageValue: GlobalImportPackage,
  options: ExecuteGlobalImportOptions,
): Promise<GlobalImportExecutionReport> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Você precisa estar logado.");

  const planErrors = validateDestinationPlan(packageValue, options.catalog, options.destinationPlan);
  if (planErrors.length) throw new Error(planErrors.join("\n"));

  const folderById = new Map(options.catalog.folders.map((folder) => [folder.id, folder]));
  const listById = new Map(options.catalog.lists.map((list) => [list.id, list]));
  const created = {
    cards: [] as string[],
    lists: [] as string[],
    folders: [] as string[],
    batchId: undefined as string | undefined,
  };
  const logs: ImportLogItem[] = [];
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
  const totalCards = packageValue.package.folders.reduce(
    (folderSum, folder) => folderSum + folder.lists.reduce((listSum, list) => listSum + list.cards.length, 0),
    0,
  );
  let completedCards = 0;

  try {
    for (let folderIndex = 0; folderIndex < packageValue.package.folders.length; folderIndex += 1) {
      const incomingFolder = packageValue.package.folders[folderIndex];
      const folderPath = `package.folders[${folderIndex}]`;
      const folderPlan = options.destinationPlan.folders[folderIndex];
      let folderId: string;
      let folderTitle: string;

      if (folderPlan.folder.mode === "existing") {
        const existingFolder = folderById.get(folderPlan.folder.folderId);
        if (!existingFolder) throw new Error(`${folderPath}: pasta existente inválida.`);
        folderId = existingFolder.id;
        folderTitle = existingFolder.title;
        report.folders_reused += 1;
        logs.push({ entity_type: "folder", entity_id: folderId, action: "reused", item_path: folderPath });
      } else {
        folderTitle = folderPlan.folder.name.trim();
        const { data, error } = await db.from("folders").insert({
          owner_id: user.id,
          title: folderTitle,
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
        logs.push({ entity_type: "folder", entity_id: folderId, action: "created", item_path: folderPath });
      }

      const { data: siblingLists, error: siblingError } = await db
        .from("lists")
        .select("order_index")
        .eq("folder_id", folderId)
        .is("deleted_at", null);
      if (siblingError) throw siblingError;
      let nextOrder = Math.max(0, ...(siblingLists ?? []).map((list: any) => Number(list.order_index ?? -1) + 1));

      for (let listIndex = 0; listIndex < incomingFolder.lists.length; listIndex += 1) {
        const incomingList = incomingFolder.lists[listIndex];
        const listPath = `${folderPath}.lists[${listIndex}]`;
        const listPlan = folderPlan.lists[listIndex];
        let listId: string;
        let listTitle: string;

        if (listPlan.mode === "existing") {
          const existingList = listById.get(listPlan.listId);
          if (!existingList || existingList.folder_id !== folderId) {
            throw new Error(`${listPath}: a lista escolhida não pertence à pasta de destino.`);
          }
          listId = existingList.id;
          listTitle = existingList.title;
          report.lists_reused += 1;
          logs.push({ entity_type: "list", entity_id: listId, action: "reused", item_path: listPath });
        } else {
          listTitle = listPlan.name.trim();
          const { data, error } = await db.from("lists").insert({
            folder_id: folderId,
            owner_id: user.id,
            title: listTitle,
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
          logs.push({ entity_type: "list", entity_id: listId, action: "created", item_path: listPath });
        }

        const existingCards = await loadAllCards(listId);
        const existingKeys = new Set(
          existingCards.map((card) => `${normalize(card.term)}|${normalize(card.translation)}`),
        );
        const cardsToInsert: Array<Record<string, unknown> & { item_path: string }> = [];

        for (let cardIndex = 0; cardIndex < incomingList.cards.length; cardIndex += 1) {
          const card = incomingList.cards[cardIndex];
          const cardPath = `${listPath}.cards[${cardIndex}]`;
          const key = `${normalize(card.front)}|${normalize(card.back)}`;
          const duplicate = existingKeys.has(key);

          if (duplicate && options.cardConflict === "error") {
            throw new Error(`${cardPath}: o card já existe na lista “${listTitle}”.`);
          }
          if (duplicate && options.cardConflict === "skip") {
            report.cards_skipped += 1;
            completedCards += 1;
            logs.push({ entity_type: "card", entity_id: null, action: "skipped", item_path: cardPath });
            options.onProgress?.(completedCards, totalCards, `Ignorando duplicado em ${folderTitle} / ${listTitle}`);
            continue;
          }

          cardsToInsert.push({
            item_path: cardPath,
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

        for (let offset = 0; offset < cardsToInsert.length; offset += CHUNK_SIZE) {
          const chunk = cardsToInsert.slice(offset, offset + CHUNK_SIZE);
          const rows = chunk.map(({ item_path: _itemPath, ...row }) => row);
          const { data, error } = await db.from("flashcards").insert(rows).select("id");
          if (error) throw error;
          (data ?? []).forEach((row: { id: string }, rowIndex: number) => {
            created.cards.push(row.id);
            logs.push({ entity_type: "card", entity_id: row.id, action: "created", item_path: chunk[rowIndex].item_path });
          });
          report.cards_created += data?.length ?? 0;
          completedCards += chunk.length;
          options.onProgress?.(completedCards, totalCards, `Salvando ${folderTitle} / ${listTitle}`);
        }
      }
    }

    const { data: batch, error: batchError } = await db.from("global_import_batches").insert({
      user_id: user.id,
      package_name: packageValue.package.name,
      schema_version: packageValue.version,
      status: "completed",
      options: {
        destination_plan: options.destinationPlan,
        card_conflict: options.cardConflict,
        institution_id: options.institutionId || null,
      },
      summary: report,
    }).select("id").single();
    if (batchError) throw batchError;
    created.batchId = batch.id;
    report.batch_id = batch.id;

    const historyRows = logs.map((item) => ({
      ...item,
      batch_id: batch.id,
      user_id: user.id,
    }));
    for (let offset = 0; offset < historyRows.length; offset += CHUNK_SIZE) {
      const { error } = await db.from("global_import_items").insert(historyRows.slice(offset, offset + CHUNK_SIZE));
      if (error) throw error;
    }

    const { error: summaryError } = await db
      .from("global_import_batches")
      .update({ summary: report })
      .eq("id", batch.id);
    if (summaryError) throw summaryError;

    return report;
  } catch (error: any) {
    const rollbackFailures = await rollbackCreated(created);
    const baseMessage = error?.message || "Falha durante a importação global.";
    if (rollbackFailures.length) {
      throw new Error(`${baseMessage} A compensação encontrou problemas: ${rollbackFailures.join("; ")}.`);
    }
    throw new Error(`${baseMessage} Nenhum item criado por esta tentativa foi mantido.`);
  }
}

export async function loadGlobalImportHistory(limit = 10): Promise<GlobalImportHistoryRow[]> {
  const { data, error } = await db
    .from("global_import_batches")
    .select("id, package_name, status, summary, created_at, undone_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function undoGlobalImport(batchId: string): Promise<void> {
  const { data: batch, error: batchError } = await db
    .from("global_import_batches")
    .select("id, status")
    .eq("id", batchId)
    .single();
  if (batchError) throw batchError;
  if (batch.status !== "completed") throw new Error("Esta importação já foi desfeita.");

  const { data: items, error: itemsError } = await db
    .from("global_import_items")
    .select("entity_type, entity_id, action, id")
    .eq("batch_id", batchId)
    .eq("action", "created")
    .order("id", { ascending: false });
  if (itemsError) throw itemsError;

  const cards = (items ?? []).filter((item: any) => item.entity_type === "card" && item.entity_id).map((item: any) => item.entity_id);
  const lists = (items ?? []).filter((item: any) => item.entity_type === "list" && item.entity_id).map((item: any) => item.entity_id);
  const folders = (items ?? []).filter((item: any) => item.entity_type === "folder" && item.entity_id).map((item: any) => item.entity_id);

  await deleteInChunks("flashcards", cards);
  await deleteInChunks("lists", lists);
  await deleteInChunks("folders", folders);

  const { error: updateError } = await db
    .from("global_import_batches")
    .update({ status: "undone", undone_at: new Date().toISOString() })
    .eq("id", batchId);
  if (updateError) throw updateError;
}
