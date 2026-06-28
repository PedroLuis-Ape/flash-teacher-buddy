import { supabase } from "@/integrations/supabase/client";
import type { ImportDestinationCatalog } from "./destination";

const db = supabase as any;
const FOLDER_FIELDS = "id, title, lang_a, lang_b, labels_a, labels_b, study_type, tts_enabled";
const LIST_FIELDS = "id, title, folder_id, lang_a, lang_b, labels_a, labels_b, study_type, tts_enabled";

export async function loadImportDestinationCatalog(
  turmaId?: string | null,
): Promise<ImportDestinationCatalog> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Você precisa estar logado.");

  let foldersQuery = db
    .from("folders")
    .select(FOLDER_FIELDS)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .order("title", { ascending: true });

  let listsQuery = db
    .from("lists")
    .select(LIST_FIELDS)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .order("title", { ascending: true });

  if (turmaId) {
    const { data: turma, error: turmaError } = await db
      .from("turmas")
      .select("id, owner_teacher_id")
      .eq("id", turmaId)
      .eq("owner_teacher_id", user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (turmaError) throw turmaError;
    if (!turma) throw new Error("Turma inválida ou sem permissão.");

    foldersQuery = foldersQuery.eq("class_id", turmaId);
    listsQuery = listsQuery.eq("class_id", turmaId);
  } else {
    foldersQuery = foldersQuery.is("class_id", null);
    listsQuery = listsQuery.is("class_id", null);
  }

  const [{ data: folders, error: foldersError }, { data: lists, error: listsError }] = await Promise.all([
    foldersQuery,
    listsQuery,
  ]);

  if (foldersError) throw foldersError;
  if (listsError) throw listsError;

  return {
    folders: folders ?? [],
    lists: lists ?? [],
  };
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
