/**
 * useOffline — React hooks for offline list management.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  saveOfflineList,
  getOfflineList,
  removeOfflineList,
  isListAvailableOffline,
  type OfflineListData,
} from "@/lib/offlineStore";
import { toast } from "sonner";

/** Detect online/offline */
export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}

/** Status of a single list's offline availability */
export function useOfflineStatus(listId: string | undefined) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!listId) return;
    const data = await getOfflineList(listId);
    setIsAvailable(!!data);
    setLastSync(data?.downloadedAt ?? null);
  }, [listId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const download = useCallback(async () => {
    if (!listId) return;
    setIsDownloading(true);
    try {
      // Fetch list metadata
      const { data: listData, error: listErr } = await supabase
        .from("lists")
        .select("title, lang_a, lang_b, labels_a, labels_b, study_type, tts_enabled, folder_id")
        .eq("id", listId)
        .maybeSingle();

      if (listErr || !listData) throw new Error("Falha ao buscar dados da lista");

      // Fetch all flashcards
      const { data: cards, error: cardsErr } = await supabase
        .from("flashcards")
        .select("id, term, translation, hint, accepted_answers_en, accepted_answers_pt, image_url_a, image_url_b, word_hints")
        .eq("list_id", listId)
        .is("deleted_at", null);

      if (cardsErr) throw new Error("Falha ao buscar flashcards");

      // Fetch favorites for this list
      const { data: { user } } = await supabase.auth.getUser();
      let favIds: string[] = [];
      if (user) {
        const cardIds = (cards || []).map(c => c.id);
        if (cardIds.length > 0) {
          const { data: favs } = await supabase
            .from("user_favorites")
            .select("resource_id")
            .eq("user_id", user.id)
            .eq("resource_type", "flashcard")
            .in("resource_id", cardIds);
          favIds = (favs || []).map(f => f.resource_id);
        }
      }

      const offlineData: OfflineListData = {
        listId,
        listMeta: {
          title: listData.title,
          lang_a: listData.lang_a || "en",
          lang_b: listData.lang_b || "pt",
          labels_a: listData.labels_a || "Termo",
          labels_b: listData.labels_b || "Definição",
          study_type: listData.study_type || "language",
          tts_enabled: listData.tts_enabled ?? true,
          folder_id: listData.folder_id || undefined,
        },
        flashcards: cards || [],
        favorites: favIds,
        downloadedAt: new Date().toISOString(),
        version: 1,
      };

      await saveOfflineList(offlineData);
      toast.success(`"${listData.title}" disponível offline (${(cards || []).length} cards)`);
      await refresh();
    } catch (err: any) {
      console.error("Offline download error:", err);
      toast.error(err.message || "Erro ao baixar para offline");
    } finally {
      setIsDownloading(false);
    }
  }, [listId, refresh]);

  const remove = useCallback(async () => {
    if (!listId) return;
    await removeOfflineList(listId);
    toast.info("Lista removida do armazenamento offline");
    await refresh();
  }, [listId, refresh]);

  return { isAvailable, isDownloading, lastSync, download, remove };
}
