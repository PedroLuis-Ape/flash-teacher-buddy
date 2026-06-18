import { supabase } from "@/integrations/supabase/client";
import type { ImportDestinationCatalog } from "./destination";

const db = supabase as any;

export async function loadImportDestinationCatalog(): Promise<ImportDestinationCatalog> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Você precisa estar logado.");

  const [{ data: folders, error: foldersError }, { data: lists, error: listsError }] = await Promise.all([
    db
      .from("folders")
      .select("id, title")
      .eq("owner_id", user.id)
      .is("class_id", null)
      .is("deleted_at", null)
      .order("title", { ascending: true }),
    db
      .from("lists")
      .select("id, title, folder_id")
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .order("title", { ascending: true }),
  ]);

  if (foldersError) throw foldersError;
  if (listsError) throw listsError;

  return {
    folders: folders ?? [],
    lists: lists ?? [],
  };
}
