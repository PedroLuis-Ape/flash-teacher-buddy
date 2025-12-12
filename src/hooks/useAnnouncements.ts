import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { toast } from 'sonner';

type AnnouncementMode = 'general' | 'direct_assignment';

interface CreateAnnouncementParams {
  class_id: string;
  title: string;
  body: string;
  pinned?: boolean;
  mode?: AnnouncementMode;
  target_student_ids?: string[];
  assignment_id?: string;
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      class_id, 
      title, 
      body, 
      pinned = false,
      mode = 'general',
      target_student_ids,
      assignment_id,
    }: CreateAnnouncementParams) => {
      // Validation
      if (!title.trim()) {
        throw new Error('O título é obrigatório');
      }
      if (!body.trim()) {
        throw new Error('A mensagem é obrigatória');
      }

      if (mode === 'direct_assignment') {
        if (!target_student_ids || target_student_ids.length === 0) {
          throw new Error('Selecione pelo menos um aluno');
        }
        if (!assignment_id) {
          throw new Error('Selecione uma atribuição');
        }
      }

      // The Supabase SDK automatically includes auth headers when using invoke()
      const { data, error } = await supabase.functions.invoke('announcements-create', {
        body: { 
          class_id, 
          title: title.trim(), 
          body: body.trim(), 
          pinned,
          mode,
          target_student_ids,
          assignment_id,
        },
      });

      if (error) {
        console.error('Announcement error:', error);
        
        // Check specifically for 401 authentication errors
        if (error instanceof FunctionsHttpError && error.context?.status === 401) {
          console.error('Erro 401: Usuário não autenticado ou sessão expirada.');
          toast.error('Sessão expirada', {
            description: 'Por favor, faça login novamente.',
          });
          throw new Error('Sua sessão expirou. Por favor, faça login novamente para criar o aviso.');
        }
        
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
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
