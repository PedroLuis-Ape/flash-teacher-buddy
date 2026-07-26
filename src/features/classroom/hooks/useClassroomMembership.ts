import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthUser } from '@/hooks/useAuthUser';

export type ClassroomMembershipAction =
  | 'request_join'
  | 'invite'
  | 'approve_request'
  | 'reject_request'
  | 'cancel_request'
  | 'accept_invite'
  | 'reject_invite'
  | 'cancel_invite'
  | 'add_direct'
  | 'remove_member'
  | 'leave';

export interface ClassroomPerson {
  public_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  is_teacher: boolean;
  membership_status: string | null;
}

export interface ClassroomMembershipResult {
  success: boolean;
  status?: string;
  idempotent?: boolean;
  turma_id?: string;
  user_id?: string;
  membership_id?: string;
}

function normalizeSearchQuery(query: string | undefined) {
  return (query ?? '').trim().replace(/\s+/g, ' ');
}

export function useSearchTurmaPeople({
  kind,
  turmaId,
  query,
  enabled = true,
}: {
  kind: 'teacher' | 'student';
  turmaId?: string | null;
  query?: string;
  enabled?: boolean;
}) {
  const { userId, isLoading: authLoading } = useAuthUser();
  const normalizedQuery = normalizeSearchQuery(query);

  return useQuery({
    queryKey: ['classroom-people-search', userId, kind, turmaId ?? null, normalizedQuery],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_turma_people_v1', {
        p_kind: kind,
        p_turma_id: turmaId ?? undefined,
        p_query: normalizedQuery,
        p_limit: 20,
        p_offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as ClassroomPerson[];
    },
    enabled: enabled && !authLoading && Boolean(userId) && normalizedQuery.length >= 2 && (kind === 'teacher' || Boolean(turmaId)),
    staleTime: 15_000,
    retry: false,
  });
}

export function useTurmaMembership(turmaId: string | null | undefined) {
  const { userId, isLoading: authLoading } = useAuthUser();

  return useQuery({
    queryKey: ['turma-membership', userId, turmaId ?? null],
    queryFn: async () => {
      if (!userId || !turmaId) return null;
      const { data, error } = await supabase
        .from('turma_membros')
        .select('id, turma_id, user_id, status, ativo, updated_at')
        .eq('turma_id', turmaId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !authLoading && Boolean(userId && turmaId),
    staleTime: 15_000,
    retry: false,
  });
}

export function useMyPendingTurmaMemberships() {
  const { userId, isLoading: authLoading } = useAuthUser();

  return useQuery({
    queryKey: ['turma-memberships-pending', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_my_turma_memberships_v1');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !authLoading && Boolean(userId),
    staleTime: 15_000,
    retry: false,
  });
}

export function useTransitionTurmaMembership() {
  const queryClient = useQueryClient();
  const { userId } = useAuthUser();

  return useMutation({
    mutationFn: async ({
      turmaId,
      action,
      targetUserId,
      targetPublicId,
    }: {
      turmaId: string;
      action: ClassroomMembershipAction;
      targetUserId?: string;
      targetPublicId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('turma-membership-transition', {
        body: {
          turma_id: turmaId,
          action,
          target_user_id: targetUserId,
          target_public_id: targetPublicId,
        },
      });
      if (error) throw error;
      const membership = data?.membership as ClassroomMembershipResult | undefined;
      if (!membership?.success) throw new Error('O servidor não confirmou a alteração do vínculo.');
      return membership;
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['turma', variables.turmaId] });
      void queryClient.invalidateQueries({ queryKey: ['turma-membership', userId, variables.turmaId] });
      void queryClient.invalidateQueries({ queryKey: ['turma-access-gate', variables.turmaId] });
      void queryClient.invalidateQueries({ queryKey: ['turma-memberships-pending', userId] });
      void queryClient.invalidateQueries({ queryKey: ['turmas'] });
      void queryClient.invalidateQueries({ queryKey: ['classroom-people-search', userId, 'student', variables.turmaId] });
    },
  });
}
