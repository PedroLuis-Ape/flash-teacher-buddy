import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CreateClassFolderInput {
  turmaId: string;
  title: string;
  description?: string;
}

export interface CreateClassFolderResult {
  folder_id: string;
  assignment_id: string;
}

export function useCreateClassFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ turmaId, title, description }: CreateClassFolderInput) => {
      const cleanTitle = title.trim();
      if (!cleanTitle) throw new Error('O nome da pasta é obrigatório');

      const { data, error } = await supabase.rpc(
        'create_class_folder_with_assignment' as any,
        {
          _turma_id: turmaId,
          _title: cleanTitle,
          _description: description?.trim() || null,
        } as any,
      );

      if (error) throw error;

      const row = (Array.isArray(data) ? data[0] : data) as CreateClassFolderResult | null;
      if (!row?.folder_id || !row?.assignment_id) {
        throw new Error('A pasta foi criada sem retorno válido do servidor');
      }

      return row;
    },
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: ['atribuicoes', 'by-turma', input.turmaId] });
      queryClient.invalidateQueries({ queryKey: ['atribuicoes'] });
      queryClient.invalidateQueries({ queryKey: ['public-turma', input.turmaId] });
      queryClient.invalidateQueries({ queryKey: ['public-turma-assignment', input.turmaId] });
      queryClient.invalidateQueries({ queryKey: ['public-teacher-turmas'] });
      queryClient.invalidateQueries({ queryKey: ['fontes-atribuicao'] });
    },
  });
}
