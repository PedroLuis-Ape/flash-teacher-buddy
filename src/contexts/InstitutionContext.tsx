import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "selectedInstitutionId";

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

  // Single setter that always persists to localStorage
  const setSelectedInstitution = useCallback((institution: Institution | null) => {
    setSelectedInstitutionRaw(institution);
    if (institution) {
      localStorage.setItem(STORAGE_KEY, institution.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const fetchInstitutions = useCallback(async (userId: string): Promise<Institution[]> => {
    const { data, error } = await supabase
      .from("institutions")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading institutions:", error);
      return [];
    }
    return Array.isArray(data) ? data : [];
  }, []);

  // Restore saved selection once institutions are available
  const restoreSavedSelection = useCallback((available: Institution[]) => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      const found = available.find((i) => i?.id === savedId);
      if (found) {
        setSelectedInstitutionRaw(found);
      } else {
        // Saved hub no longer exists — fall back to "all"
        localStorage.removeItem(STORAGE_KEY);
        setSelectedInstitutionRaw(null);
      }
    } else {
      // "Todos (sem filtro)" was explicitly chosen or first load
      setSelectedInstitutionRaw(null);
    }
  }, []);

  const refreshInstitutions = useCallback(async () => {
    // Consumes the canonical auth state — no extra getSession() call.
    if (!userId) {
      setInstitutions([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const list = await fetchInstitutions(userId);
      setInstitutions(list);
      restoreSavedSelection(list);
    } catch (error) {
      console.error("Error loading institutions:", error);
      setInstitutions([]);
    } finally {
      setLoading(false);
    }
  }, [userId, fetchInstitutions, restoreSavedSelection]);

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

      setInstitutions((prev) => prev.filter((i) => i.id !== id));
      // If deleted hub was selected, fall back to "all"
      const savedId = localStorage.getItem(STORAGE_KEY);
      if (savedId === id) {
        setSelectedInstitution(null);
      }
    } catch (error) {
      console.error("Error deleting institution:", error);
      throw error;
    }
  }, [setSelectedInstitution]);

  // React to canonical auth state instead of owning a parallel subscription.
  useEffect(() => {
    if (status === "initializing") return;
    if (status === "authenticated" && userId) {
      let cancelled = false;
      setLoading(true);
      fetchInstitutions(userId)
        .then((list) => {
          if (cancelled) return;
          setInstitutions(list);
          restoreSavedSelection(list);
        })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }
    // anonymous or error — reset
    setInstitutions([]);
    setSelectedInstitutionRaw(null);
    setLoading(false);
  }, [status, userId, fetchInstitutions, restoreSavedSelection]);

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
