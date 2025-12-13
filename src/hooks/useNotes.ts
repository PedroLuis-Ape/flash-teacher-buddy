import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function useNotes(userId: string | null) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    if (!userId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setNotes((data as Note[]) || []);
    } catch (error) {
      console.error("Error fetching notes:", error);
      toast.error("Erro ao carregar notas");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const createNote = async (): Promise<Note | null> => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from("notes")
        .insert({ user_id: userId, title: "", content: "" })
        .select()
        .single();

      if (error) throw error;
      
      const newNote = data as Note;
      setNotes((prev) => [newNote, ...prev]);
      return newNote;
    } catch (error) {
      console.error("Error creating note:", error);
      toast.error("Erro ao criar nota");
      return null;
    }
  };

  const updateNote = async (id: string, updates: { title?: string; content?: string }): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("notes")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      
      setNotes((prev) =>
        prev.map((note) =>
          note.id === id
            ? { ...note, ...updates, updated_at: new Date().toISOString() }
            : note
        )
      );
      return true;
    } catch (error) {
      console.error("Error updating note:", error);
      toast.error("Erro ao salvar nota");
      return false;
    }
  };

  const deleteNote = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("notes")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      setNotes((prev) => prev.filter((note) => note.id !== id));
      toast.success("Nota apagada");
      return true;
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Erro ao apagar nota");
      return false;
    }
  };

  return {
    notes,
    loading,
    createNote,
    updateNote,
    deleteNote,
    refetch: fetchNotes,
  };
}
