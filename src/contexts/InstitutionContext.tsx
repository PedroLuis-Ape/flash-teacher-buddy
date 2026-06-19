import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLibraryChangeRevision } from "@/hooks/useLibraryChangeRevision";
import {
  migrateLegacyInstitution,
  readPersistedInstitution,
  writePersistedInstitution,
} from "@/lib/persistentStorage";

interface Institution {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

interface InstitutionContextType {
  selectedInstitution: Institution | null;
  institutions: Institution[];
  setSelectedInstitution: (institution: Institution | null) => void;
  refreshInstitutions: () => Promise<void>;
  deleteInstitution: (id: string) => Promise<void>;
  loading: boolean;
  libraryRevision: number;
}

const InstitutionContext = createContext<InstitutionContextType | undefined>(undefined);

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const [selectedInstitution, setSelectedInstitutionRaw] = useState<Institution | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const { userId, status } = useAuth();
  const libraryRevision = useLibraryChangeRevision();

  const setSelectedInstitution = useCallback((institution: Institution | null) => {
    setSelectedInstitutionRaw(institution);
    if (userId) writePersistedInstitution(userId, institution?.id ?? null);
  }, [userId]);

  const fetchInstitutions = useCallback(async (ownerId: string): Promise<Institution[]> => {
    const { data, error } = await supabase
      .from("institutions")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }, []);

  const restoreSavedSelection = useCallback((ownerId: string, available: Institution[]) => {
    const saved = migrateLegacyInstitution(ownerId) ?? readPersistedInstitution(ownerId);
    if (!saved) {
      writePersistedInstitution(ownerId, null);
      setSelectedInstitutionRaw(null);
      return;
    }
    if (saved.institutionId === null) {
      setSelectedInstitutionRaw(null);
      return;
    }
    const found = available.find((institution) => institution.id === saved.institutionId);
    if (found) {
      setSelectedInstitutionRaw(found);
      return;
    }
    writePersistedInstitution(ownerId, null);
    setSelectedInstitutionRaw(null);
  }, []);

  const refreshInstitutions = useCallback(async () => {
    if (!userId || status !== "authenticated") return;
    setLoading(true);
    try {
      const list = await fetchInstitutions(userId);
      setInstitutions(list);
      restoreSavedSelection(userId, list);
    } catch (error) {
      console.error("Error loading institutions:", error);
    } finally {
      setLoading(false);
    }
  }, [fetchInstitutions, restoreSavedSelection, status, userId]);

  const deleteInstitution = useCallback(async (id: string) => {
    try {
      const { error: updateError } = await supabase
        .from("folders")
        .update({ institution_id: null })
        .eq("institution_id", id);
      if (updateError) throw updateError;
      const { error: deleteError } = await supabase
        .from("institutions")
        .delete()
        .eq("id", id);
      if (deleteError) throw deleteError;
      setInstitutions((previous) => previous.filter((institution) => institution.id !== id));
      if (selectedInstitution?.id === id) setSelectedInstitution(null);
    } catch (error) {
      console.error("Error deleting institution:", error);
      throw error;
    }
  }, [selectedInstitution?.id, setSelectedInstitution]);

  useEffect(() => {
    if (status === "initializing") return;
    if (status === "authenticated" && userId) {
      let cancelled = false;
      setLoading(true);
      fetchInstitutions(userId)
        .then((list) => {
          if (cancelled) return;
          setInstitutions(list);
          restoreSavedSelection(userId, list);
        })
        .catch((error) => {
          if (!cancelled) console.error("Error loading institutions:", error);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }
    if (status === "anonymous") {
      setInstitutions([]);
      setSelectedInstitutionRaw(null);
      setLoading(false);
    }
  }, [fetchInstitutions, restoreSavedSelection, status, userId]);

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    let cancelled = false;

    const syncVisibleCounts = async () => {
      const institutionId = selectedInstitution?.id ?? null;
      let foldersQuery = supabase
        .from("folders")
        .select("title, lists(id, deleted_at)")
        .eq("owner_id", userId)
        .is("class_id", null)
        .is("deleted_at", null);
      foldersQuery = institutionId
        ? foldersQuery.eq("institution_id", institutionId)
        : foldersQuery.is("institution_id", null);

      const [{ data: folders }, countsResult] = await Promise.all([
        foldersQuery,
        supabase.rpc("get_user_card_counts", {
          _user_id: userId,
          _institution_id: institutionId,
        }),
      ]);
      if (cancelled) return;

      const perList = new Map<string, number>();
      for (const row of (Array.isArray(countsResult.data) ? countsResult.data : []) as any[]) {
        const count = Number(row?.card_count);
        if (typeof row?.list_id === "string") {
          perList.set(row.list_id, Number.isFinite(count) ? count : 0);
        }
      }

      const totals = new Map<string, { lists: number; cards: number }>();
      for (const folder of (folders ?? []) as any[]) {
        const lists = (folder.lists ?? []).filter((list: any) => list?.deleted_at == null);
        totals.set(folder.title, {
          lists: lists.length,
          cards: lists.reduce((sum: number, list: any) => sum + (perList.get(list.id) ?? 0), 0),
        });
      }

      document.querySelectorAll<HTMLElement>(".space-ui-folder-card").forEach((card) => {
        const title = card.querySelector<HTMLElement>(".ape-card-title")?.textContent?.trim();
        if (!title) return;
        const total = totals.get(title);
        const subtitle = card.querySelector<HTMLElement>("p.text-muted-foreground");
        if (!total || !subtitle) return;
        subtitle.textContent = `${total.lists} ${total.lists === 1 ? "lista" : "listas"} • ${total.cards} ${total.cards === 1 ? "card" : "cards"}`;
      });
    };

    void syncVisibleCounts();
    return () => { cancelled = true; };
  }, [libraryRevision, selectedInstitution?.id, status, userId]);

  const contextValue = useMemo(() => ({
    selectedInstitution,
    institutions,
    setSelectedInstitution,
    refreshInstitutions,
    deleteInstitution,
    loading,
    libraryRevision,
  }), [selectedInstitution, institutions, setSelectedInstitution, refreshInstitutions, deleteInstitution, loading, libraryRevision]);

  return (
    <InstitutionContext.Provider value={contextValue}>
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitution() {
  const context = useContext(InstitutionContext);
  if (context === undefined) throw new Error("useInstitution must be used within InstitutionProvider");
  return context;
}

export function useOptionalInstitution() {
  return useContext(InstitutionContext);
}
