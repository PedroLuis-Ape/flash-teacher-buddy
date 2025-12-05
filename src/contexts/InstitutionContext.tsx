import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshInstitutions = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setInstitutions([]);
        return;
      }

      const { data, error } = await supabase
        .from("institutions")
        .select("*")
        .eq("owner_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInstitutions(data || []);

      // Restore selected institution from localStorage
      const savedId = localStorage.getItem("selectedInstitutionId");
      if (savedId && data) {
        const found = data.find(i => i.id === savedId);
        if (found) {
          setSelectedInstitution(found);
        } else {
          localStorage.removeItem("selectedInstitutionId");
        }
      }
    } catch (error) {
      console.error("Error loading institutions:", error);
      setInstitutions([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteInstitution = async (id: string) => {
    try {
      // 1. Move all folders from this hub to "General" (null)
      const { error: updateError } = await supabase
        .from("folders")
        .update({ institution_id: null })
        .eq("institution_id", id);

      if (updateError) throw updateError;

      // 2. Delete the institution
      const { error: deleteError } = await supabase
        .from("institutions")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      // Update local state
      setInstitutions((prev) => prev.filter((i) => i.id !== id));
      if (selectedInstitution?.id === id) {
        setSelectedInstitution(null);
      }
    } catch (error) {
      console.error("Error deleting institution:", error);
      throw error;
    }
  };

  useEffect(() => {
    refreshInstitutions();
  }, []);

  // Persist selected institution
  useEffect(() => {
    if (selectedInstitution) {
      localStorage.setItem("selectedInstitutionId", selectedInstitution.id);
    } else {
      localStorage.removeItem("selectedInstitutionId");
    }
  }, [selectedInstitution]);

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
