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

      // The Supabase SDK automatically includes auth headers when using invoke()
      // DO NOT manually set Authorization headers as it can cause issues
      const { data, error } = await supabase.functions.invoke('announcements-create', {
        body: { 
          class_id, 
          title: title.trim(), 
          body: body.trim(), 
          pinned 
        },
      });

      if (error) {
        console.error('Announcement error:', error);
        throw new Error(error.message || 'Erro ao criar aviso');
      }
      if (data?.error) {
        throw new Error(data.error);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['turma'] });
    },
  });
}
