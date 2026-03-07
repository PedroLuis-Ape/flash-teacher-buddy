import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const didRestoreRef = useRef(false);

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
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setInstitutions([]);
        return;
      }

      const list = await fetchInstitutions(session.user.id);
      setInstitutions(list);
      restoreSavedSelection(list);
    } catch (error) {
      console.error("Error loading institutions:", error);
      setInstitutions([]);
    } finally {
      setLoading(false);
    }
  }, [fetchInstitutions, restoreSavedSelection]);

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

  // Listen for auth state changes to re-fetch institutions
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        const list = await fetchInstitutions(session.user.id);
        setInstitutions(list);
        restoreSavedSelection(list);
        setLoading(false);
      } else if (event === "SIGNED_OUT") {
        setInstitutions([]);
        setSelectedInstitutionRaw(null);
        setLoading(false);
      }
    });

    // Initial load
    refreshInstitutions();

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <InstitutionContext.Provider
      value={{
        selectedInstitution,
        institutions,
        setSelectedInstitution,
        refreshInstitutions,
        deleteInstitution,
        loading,
      }}
    >
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
