import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FolderText {
  id: string;
  folder_id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useFolderText(folderId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch text for folder
  const { data: folderText, isLoading } = useQuery({
    queryKey: ["folder-text", folderId],
    queryFn: async () => {
      if (!folderId) return null;
      
      const { data, error } = await supabase
        .from("folder_texts")
        .select("*")
        .eq("folder_id", folderId)
        .maybeSingle();
      
      if (error) throw error;
      return data as FolderText | null;
    },
    enabled: !!folderId,
    staleTime: 60_000,
  });

  // Create or update text
  const saveMutation = useMutation({
    mutationFn: async ({ title, content }: { title: string; content: string }) => {
      if (!folderId) throw new Error("Folder ID required");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      if (folderText?.id) {
        // Update existing
        const { error } = await supabase
          .from("folder_texts")
          .update({ title, content })
          .eq("id", folderText.id);
        
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from("folder_texts")
          .insert({
            folder_id: folderId,
            title,
            content,
            created_by: user.id,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Texto salvo!");
      queryClient.invalidateQueries({ queryKey: ["folder-text", folderId] });
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar: " + error.message);
    },
  });

  // Delete text
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!folderText?.id) throw new Error("No text to delete");
      
      const { error } = await supabase
        .from("folder_texts")
        .delete()
        .eq("id", folderText.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Texto excluído!");
      queryClient.invalidateQueries({ queryKey: ["folder-text", folderId] });
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir: " + error.message);
    },
  });

  return {
    folderText,
    isLoading,
    saveText: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    deleteText: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
