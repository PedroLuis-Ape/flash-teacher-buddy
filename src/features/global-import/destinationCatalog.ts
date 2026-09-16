import { supabase } from "@/integrations/supabase/client";
import type {
  ImportDestinationCatalog,
  ImportDestinationContext,
  ExistingImportFolder,
} from "./destination";

const db = supabase as any;
const FOLDER_FIELDS = "id, title, institution_id, class_id, lang_a, lang_b, labels_a, labels_b, study_type, tts_enabled";
const LEGACY_LIST_FIELDS = "id, title, folder_id, class_id, lang_a, lang_b, labels_a, labels_b, study_type, tts_enabled, system_kind";
const LIST_FIELDS = `${LEGACY_LIST_FIELDS}, language_settings_mode`;

function uniqueById<T extends { id: string }>(rows: T[] | null | undefined): T[] {
  const unique = new Map<string, T>();
  for (const row of rows ?? []) {
    if (row?.id && !unique.has(row.id)) unique.set(row.id, row);
  }
  return Array.from(unique.values());
}

function isMissingLanguageSettingsMode(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { message?: unknown; details?: unknown; hint?: unknown };
  const text = [record.message, record.details, record.hint]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return text.includes("language_settings_mode");
}

export function normalizeImportDestinationCatalog(
  input: ImportDestinationCatalog,
): ImportDestinationCatalog {
  const folders = uniqueById(input.folders);
  const validFolderIds = new Set(folders.map((folder) => folder.id));
  return {
    folders,
    lists: uniqueById(input.lists).filter((list) => validFolderIds.has(list.folder_id)),
  };
}

export async function loadImportDestinationCatalog(
  context: ImportDestinationContext,
): Promise<ImportDestinationCatalog> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Você precisa estar logado.");

  let foldersQuery = db
    .from("folders")
    .select(FOLDER_FIELDS)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .order("title", { ascending: true });

  if (context.scope === "classroom") {
    const { data: turma, error: turmaError } = await db
      .from("turmas")
      .select("id, owner_teacher_id")
      .eq("id", context.turmaId)
      .eq("owner_teacher_id", user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (turmaError) throw turmaError;
    if (!turma) throw new Error("Turma inválida ou sem permissão.");
    foldersQuery = foldersQuery.eq("class_id", context.turmaId);
  } else {
    foldersQuery = foldersQuery.is("class_id", null);
    foldersQuery = context.institutionId
      ? foldersQuery.eq("institution_id", context.institutionId)
      : foldersQuery.is("institution_id", null);
  }

  const { data: folderRows, error: foldersError } = await foldersQuery;
  if (foldersError) throw foldersError;
  const folders = uniqueById(folderRows) as ExistingImportFolder[];
  if (!folders.length) return { folders: [], lists: [] };

  // A pasta já foi validada por owner, instituição/turma e exclusão lógica.
  // Assim como a Biblioteca e a tela da pasta, ela é a autoridade do escopo:
  // listas legadas podem não repetir owner_id/class_id corretamente.
  const runListsQuery = (fields: string) => db
    .from("lists")
    .select(fields)
    .is("deleted_at", null)
    .in("folder_id", folders.map((folder) => folder.id))
    .order("title", { ascending: true });

  let listsResult = await runListsQuery(LIST_FIELDS);
  // Deploy-safe rollout: the web app can ship before the additive migration.
  // Until the column exists, the catalog simply treats every row as legacy.
  if (listsResult.error && isMissingLanguageSettingsMode(listsResult.error)) {
    listsResult = await runListsQuery(LEGACY_LIST_FIELDS);
  }
  if (listsResult.error) throw listsResult.error;

  return normalizeImportDestinationCatalog({ folders, lists: listsResult.data ?? [] });
}

export async function loadExistingListDestinationCatalog(
  listId: string,
): Promise<ImportDestinationCatalog> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Você precisa estar logado.");

  const runListQuery = (fields: string) => db
    .from("lists")
    .select(fields)
    .eq("id", listId)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  let listResult = await runListQuery(LIST_FIELDS);
  if (listResult.error && isMissingLanguageSettingsMode(listResult.error)) {
    listResult = await runListQuery(LEGACY_LIST_FIELDS);
  }
  if (listResult.error) throw listResult.error;
  const list = listResult.data;
  if (!list) throw new Error("Lista inválida ou sem permissão para importar.");

  const { data: folder, error: folderError } = await db
    .from("folders")
    .select(FOLDER_FIELDS)
    .eq("id", list.folder_id)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (folderError) throw folderError;
  if (!folder) throw new Error("A pasta da lista não foi encontrada.");

  return { folders: [folder], lists: [list] };
}
