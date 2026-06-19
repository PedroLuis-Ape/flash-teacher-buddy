import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
}

const InstitutionContext = createContext<InstitutionContextType | undefined>(undefined);

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const [selectedInstitution, setSelectedInstitutionRaw] = useState<Institution | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const { userId, status } = useAuth();

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
      // Persist the default explicitly. Missing storage and an intentional
      // “Todos” selection must not remain indistinguishable forever.
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

    // The selected institution was removed or no longer belongs to this user.
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
      // Keep both the current selection and persisted preference on temporary
      // network errors. Emptying them here used to look like lost persistence.
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

      return () => {
        cancelled = true;
      };
    }

    // Remove private data from memory between accounts, but preserve each
    // account's namespaced preference for its next login.
    if (status === "anonymous") {
      setInstitutions([]);
      setSelectedInstitutionRaw(null);
      setLoading(false);
    }
  }, [fetchInstitutions, restoreSavedSelection, status, userId]);

  const contextValue = useMemo(() => ({
    selectedInstitution,
    institutions,
    setSelectedInstitution,
    refreshInstitutions,
    deleteInstitution,
    loading,
  }), [selectedInstitution, institutions, setSelectedInstitution, refreshInstitutions, deleteInstitution, loading]);

  return (
    <InstitutionContext.Provider value={contextValue}>
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitution() {
  const context = useContext(InstitutionContext);
  if (context === undefined) {
    throw new Error("useInstitution must be used within InstitutionProvider");
  }
  return context;
}
