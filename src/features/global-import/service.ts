import { supabase } from "@/integrations/supabase/client";
import type { GlobalImportPackage } from "./schema";

export type ContainerConflictPolicy = "use_existing" | "numbered" | "error";
export type CardConflictPolicy = "skip" | "copy" | "error";

export interface ExecuteGlobalImportOptions {
  folderConflict: ContainerConflictPolicy;
  listConflict: ContainerConflictPolicy;
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

function numberedName(baseName: string, occupied: Set<string>): string {
  if (!occupied.has(normalize(baseName))) return baseName;
  let suffix = 2;
  while (occupied.has(normalize(`${baseName} (${suffix})`))) suffix += 1;
  return `${baseName} (${suffix})`;
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

  const created = { cards: [] as string[], lists: [] as string[], folders: [] as string[], batchId: undefined as string | undefined };
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
    let foldersQuery = db
      .from("folders")
      .select("id, title")
      .eq("owner_id", user.id)
      .is("class_id", null)
      .is("deleted_at", null);
    foldersQuery = options.institutionId
      ? foldersQuery.eq("institution_id", options.institutionId)
      : foldersQuery.is("institution_id", null);
    const { data: existingFolders, error: foldersError } = await foldersQuery;
    if (foldersError) throw foldersError;

    const folderByName = new Map<string, { id: string; title: string }>();
    const occupiedFolderNames = new Set<string>();
    for (const folder of existingFolders ?? []) {
      folderByName.set(normalize(folder.title), folder);
      occupiedFolderNames.add(normalize(folder.title));
    }

    for (let folderIndex = 0; folderIndex < packageValue.package.folders.length; folderIndex += 1) {
      const folder = packageValue.package.folders[folderIndex];
      const folderPath = `package.folders[${folderIndex}]`;
      let resolvedFolder = folderByName.get(normalize(folder.name));

      if (resolvedFolder && options.folderConflict === "error") {
        throw new Error(`${folderPath}: a pasta "${folder.name}" já existe.`);
      }

      if (!resolvedFolder || options.folderConflict === "numbered") {
        const title = options.folderConflict === "numbered"
          ? numberedName(folder.name, occupiedFolderNames)
          : folder.name;
        const { data, error } = await db.from("folders").insert({
          owner_id: user.id,
          title,
          description: folder.description || null,
          visibility: "private",
          institution_id: options.institutionId || null,
          lang_a: packageValue.package.source_language || null,
          lang_b: packageValue.package.target_language || null,
        }).select("id, title").single();
        if (error) throw error;
        resolvedFolder = data;
        created.folders.push(data.id);
        report.folders_created += 1;
        logs.push({ entity_type: "folder", entity_id: data.id, action: "created", item_path: folderPath });
        folderByName.set(normalize(data.title), data);
        occupiedFolderNames.add(normalize(data.title));
      } else {
        report.folders_reused += 1;
        logs.push({ entity_type: "folder", entity_id: resolvedFolder.id, action: "reused", item_path: folderPath });
      }

      const { data: existingLists, error: listsError } = await db
        .from("lists")
        .select("id, title, order_index")
        .eq("owner_id", user.id)
        .eq("folder_id", resolvedFolder.id)
        .is("deleted_at", null);
      if (listsError) throw listsError;

      const listByName = new Map<string, { id: string; title: string; order_index: number }>();
      const occupiedListNames = new Set<string>();
      let nextOrder = 0;
      for (const list of existingLists ?? []) {
        listByName.set(normalize(list.title), list);
        occupiedListNames.add(normalize(list.title));
        nextOrder = Math.max(nextOrder, Number(list.order_index ?? 0) + 1);
      }

      for (let listIndex = 0; listIndex < folder.lists.length; listIndex += 1) {
        const list = folder.lists[listIndex];
        const listPath = `${folderPath}.lists[${listIndex}]`;
        let resolvedList = listByName.get(normalize(list.name));

        if (resolvedList && options.listConflict === "error") {
          throw new Error(`${listPath}: a lista "${list.name}" já existe.`);
        }

        if (!resolvedList || options.listConflict === "numbered") {
          const title = options.listConflict === "numbered"
            ? numberedName(list.name, occupiedListNames)
            : list.name;
          const { data, error } = await db.from("lists").insert({
            folder_id: resolvedFolder.id,
            owner_id: user.id,
            title,
            description: list.description || null,
            order_index: nextOrder,
            visibility: "private",
            institution_id: options.institutionId || null,
            lang_a: packageValue.package.source_language || null,
            lang_b: packageValue.package.target_language || null,
          }).select("id, title, order_index").single();
          if (error) throw error;
          resolvedList = data;
          nextOrder += 1;
          created.lists.push(data.id);
          report.lists_created += 1;
          logs.push({ entity_type: "list", entity_id: data.id, action: "created", item_path: listPath });
          listByName.set(normalize(data.title), data);
          occupiedListNames.add(normalize(data.title));
        } else {
          report.lists_reused += 1;
          logs.push({ entity_type: "list", entity_id: resolvedList.id, action: "reused", item_path: listPath });
        }

        const existingCards = await loadAllCards(resolvedList.id);
        const existingKeys = new Set(existingCards.map((card) => `${normalize(card.term)}|${normalize(card.translation)}`));
        const cardsToInsert: Array<Record<string, unknown> & { item_path: string }> = [];

        for (let cardIndex = 0; cardIndex < list.cards.length; cardIndex += 1) {
          const card = list.cards[cardIndex];
          const cardPath = `${listPath}.cards[${cardIndex}]`;
          const key = `${normalize(card.front)}|${normalize(card.back)}`;
          const duplicate = existingKeys.has(key);
          if (duplicate && options.cardConflict === "error") {
            throw new Error(`${cardPath}: o card já existe na lista.`);
          }
          if (duplicate && options.cardConflict === "skip") {
            report.cards_skipped += 1;
            completedCards += 1;
            logs.push({ entity_type: "card", entity_id: null, action: "skipped", item_path: cardPath });
            options.onProgress?.(completedCards, totalCards, `Ignorando duplicado em ${list.name}`);
            continue;
          }

          cardsToInsert.push({
            item_path: cardPath,
            list_id: resolvedList.id,
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
          options.onProgress?.(completedCards, totalCards, `Salvando ${list.name}`);
        }
      }
    }

    const { data: batch, error: batchError } = await db.from("global_import_batches").insert({
      user_id: user.id,
      package_name: packageValue.package.name,
      schema_version: packageValue.version,
      status: "completed",
      options: {
        folder_conflict: options.folderConflict,
        list_conflict: options.listConflict,
        card_conflict: options.cardConflict,
        institution_id: options.institutionId || null,
      },
      summary: report,
    }).select("id").single();
    if (batchError) throw batchError;
    created.batchId = batch.id;
    report.batch_id = batch.id;

    if (logs.length) {
      const historyRows = logs.map((item) => ({ ...item, batch_id: batch.id, user_id: user.id }));
      for (let offset = 0; offset < historyRows.length; offset += CHUNK_SIZE) {
        const { error } = await db.from("global_import_items").insert(historyRows.slice(offset, offset + CHUNK_SIZE));
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
    const baseMessage = error?.message || "Falha durante a importação global.";
    if (rollbackFailures.length) {
      throw new Error(`${baseMessage} A compensação encontrou problemas: ${rollbackFailures.join("; ")}.`);
    }
    throw new Error(`${baseMessage} Nenhum item criado por esta tentativa foi mantido.`);
  }
}
