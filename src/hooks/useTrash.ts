import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/contexts/InstitutionContext";
import { toast } from "sonner";

export interface TrashItem {
  id: string;
  type: "folder" | "list" | "flashcard";
  title: string;
  deleted_at: string;
  parent_title?: string;
}

export function useTrash() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { selectedInstitution } = useInstitution();

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;
      const institutionId = selectedInstitution?.id || null;

      // Build folder query with institution filter
      let foldersQuery = supabase
        .from("folders")
        .select("id, title, deleted_at")
        .eq("owner_id", userId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (institutionId) {
        foldersQuery = foldersQuery.eq("institution_id", institutionId);
      } else {
        foldersQuery = foldersQuery.is("institution_id", null);
      }

      // Build lists query with institution filter via folders
      let listsQuery = supabase
        .from("lists")
        .select("id, title, deleted_at, folders!inner(title, institution_id)")
        .eq("owner_id", userId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (institutionId) {
        listsQuery = listsQuery.eq("folders.institution_id", institutionId);
      } else {
        listsQuery = listsQuery.is("folders.institution_id", null);
      }

      // Build flashcards query with institution filter via lists→folders
      let flashcardsQuery = supabase
        .from("flashcards")
        .select("id, term, translation, deleted_at, lists!inner(title, folders!inner(institution_id))")
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      // For flashcards, filter client-side since nested filtering is complex
      const [foldersRes, listsRes, flashcardsRes] = await Promise.all([
        foldersQuery,
        listsQuery,
        flashcardsQuery,
      ]);

      const result: TrashItem[] = [];

      (foldersRes.data || []).forEach((f: any) =>
        result.push({ id: f.id, type: "folder", title: f.title || "Pasta sem nome", deleted_at: f.deleted_at })
      );

      (listsRes.data || []).forEach((l: any) =>
        result.push({
          id: l.id,
          type: "list",
          title: l.title || "Lista sem nome",
          deleted_at: l.deleted_at,
          parent_title: l.folders?.title,
        })
      );

      (flashcardsRes.data || []).forEach((fc: any) =>
        result.push({
          id: fc.id,
          type: "flashcard",
          title: `${fc.term || "?"} → ${fc.translation || "?"}`,
          deleted_at: fc.deleted_at,
          parent_title: fc.lists?.title,
        })
      );

      // Sort by deleted_at descending
      result.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());
      setItems(result);
    } catch (err) {
      console.error("Error loading trash:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const restoreItem = useCallback(async (item: TrashItem) => {
    try {
      let rpcName = "";
      if (item.type === "folder") rpcName = "restore_folder";
      else if (item.type === "list") rpcName = "restore_list";
      else rpcName = "restore_flashcard";

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const paramName = item.type === "folder" ? "p_folder_id" : item.type === "list" ? "p_list_id" : "p_flashcard_id";

      const { data, error } = await supabase.rpc(rpcName as any, {
        [paramName]: item.id,
        p_user_id: session.user.id,
      } as any);

      if (error) throw error;
      const result = data as any;
      if (result && !result.success) throw new Error(result.error || "Erro ao restaurar");

      toast.success("✅ Item restaurado!");
      await loadTrash();
    } catch (err: any) {
      toast.error("❌ Erro ao restaurar: " + (err.message || ""));
    }
  }, [loadTrash]);

  const permanentDelete = useCallback(async (item: TrashItem) => {
    try {
      const table = item.type === "folder" ? "folders" : item.type === "list" ? "lists" : "flashcards";
      const { error } = await supabase.from(table).delete().eq("id", item.id);
      if (error) throw error;

      toast.success("🗑️ Item excluído permanentemente!");
      await loadTrash();
    } catch (err: any) {
      toast.error("❌ Erro ao excluir: " + (err.message || ""));
    }
  }, [loadTrash]);

  const emptyTrash = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const userId = session.user.id;

      // Delete in order: flashcards → lists → folders
      await supabase.from("flashcards").delete().eq("user_id", userId).not("deleted_at", "is", null);
      await supabase.from("lists").delete().eq("owner_id", userId).not("deleted_at", "is", null);
      await supabase.from("folders").delete().eq("owner_id", userId).not("deleted_at", "is", null);

      toast.success("🗑️ Lixeira esvaziada!");
      setItems([]);
    } catch (err: any) {
      toast.error("❌ Erro ao esvaziar lixeira: " + (err.message || ""));
    }
  }, []);

  return { items, loading, loadTrash, restoreItem, permanentDelete, emptyTrash };
}
