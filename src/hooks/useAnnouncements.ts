import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CreateAnnouncementParams {
  class_id: string;
  title: string;
  body: string;
  pinned?: boolean;
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ class_id, title, body, pinned = false }: CreateAnnouncementParams) => {
      // Validation
      if (!title.trim()) {
        throw new Error('O título é obrigatório');
      }
      if (!body.trim()) {
        throw new Error('A mensagem é obrigatória');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('announcements-create', {
        body: { 
          class_id, 
          turma_id: class_id, // Include both for backend compatibility
          title, 
          body, 
          pinned 
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['turma'] });
    },
  });
}
