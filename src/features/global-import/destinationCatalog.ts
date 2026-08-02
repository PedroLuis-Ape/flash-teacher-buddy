import { supabase } from "@/integrations/supabase/client";
import type {
  ImportDestinationCatalog,
  ImportDestinationContext,
  ExistingImportFolder,
} from "./destination";

const db = supabase as any;
const FOLDER_FIELDS = "id, title, institution_id, class_id, lang_a, lang_b, labels_a, labels_b, study_type, tts_enabled";
const LIST_FIELDS = "id, title, folder_id, class_id, lang_a, lang_b, labels_a, labels_b, study_type, tts_enabled";

function uniqueById<T extends { id: string }>(rows: T[] | null | undefined): T[] {
  const unique = new Map<string, T>();
  for (const row of rows ?? []) {
    if (row?.id && !unique.has(row.id)) unique.set(row.id, row);
  }
  return Array.from(unique.values());
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
  const listsQuery = db
    .from("lists")
    .select(LIST_FIELDS)
    .is("deleted_at", null)
    .in("folder_id", folders.map((folder) => folder.id))
    .order("title", { ascending: true });

  const { data: listRows, error: listsError } = await listsQuery;
  if (listsError) throw listsError;

  return normalizeImportDestinationCatalog({ folders, lists: listRows ?? [] });
}

export async function loadExistingListDestinationCatalog(
  listId: string,
): Promise<ImportDestinationCatalog> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Você precisa estar logado.");

  const { data: list, error: listError } = await db
    .from("lists")
    .select(LIST_FIELDS)
    .eq("id", listId)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (listError) throw listError;
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
