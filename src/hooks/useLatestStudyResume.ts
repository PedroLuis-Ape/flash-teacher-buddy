/**
 * Fonte única de retomada para a Home e para o banner "Continuar".
 *
 * Ordem de decisão:
 * 1. ponteiro local (StudyResumeSnapshotV2) — sessão exata do aparelho;
 * 2. validação/enriquecimento dessa sessão no banco (título e progresso reais);
 * 3. fallback remoto (sessão aberta mais recente) quando não há ponteiro local
 *    — outro aparelho, cache limpo, PWA reinstalada.
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useInstitution } from "@/contexts/InstitutionContext";
import {
  clearStudyResumePointer,
  readStudyResumePointer,
  studyResumePointerMatchesInstitution,
} from "@/features/study/lib/studyResumePointer";
import {
  RESUMABLE_STUDY_SESSION_COLUMNS,
  deriveStudyResumeProgress,
  resumableFromPointer,
  resumableFromRemoteSession,
  type ResumableStudySession,
} from "@/features/study/lib/resumableStudySession";

export const STUDY_RESUME_QUERY_KEY = "study-resume";

function matchesInstitution(row: any, institutionId: string | null): boolean {
  const list = Array.isArray(row?.lists) ? row.lists[0] : row?.lists;
  const listInstitution = list?.institution_id ?? null;
  return institutionId ? listInstitution === institutionId : listInstitution === null;
}

async function fetchLatestStudyResume(
  userId: string,
  institutionId: string | null,
): Promise<ResumableStudySession | null> {
  const pointer = readStudyResumePointer(userId);

  if (pointer && studyResumePointerMatchesInstitution(pointer, institutionId)) {
    const { data, error } = await supabase
      .from("study_sessions")
      .select(RESUMABLE_STUDY_SESSION_COLUMNS)
      .eq("id", pointer.sessionId)
      .eq("user_id", userId)
      .eq("completed", false)
      .maybeSingle();

    if (!error && data) {
      const progress = deriveStudyResumeProgress({
        sessionSnapshot: (data as any).session_snapshot,
        cardsOrder: (data as any).cards_order,
        currentIndex: (data as any).current_index,
      });
      const list = Array.isArray((data as any).lists) ? (data as any).lists[0] : (data as any).lists;
      return resumableFromPointer(pointer, {
        title: typeof list?.title === "string" ? list.title : null,
        totalCards: progress.totalCards,
        progressCount: progress.progressCount,
        progressUnit: progress.progressUnit,
      });
    }

    // A sessão apontada não existe mais (ou foi concluída): o ponteiro inválido
    // é removido em vez de abrir uma sessão aleatória.
    if (!error) clearStudyResumePointer(userId);
    else return resumableFromPointer(pointer);
  }

  const { data: openSessions, error: openError } = await supabase
    .from("study_sessions")
    .select(RESUMABLE_STUDY_SESSION_COLUMNS)
    .eq("user_id", userId)
    .eq("completed", false)
    .order("updated_at", { ascending: false })
    .limit(10);
  if (openError) throw openError;

  const candidate = (openSessions ?? []).find((row) => matchesInstitution(row, institutionId));
  return resumableFromRemoteSession(candidate as any);
}

export function useLatestStudyResume() {
  const { userId } = useAuthUser();
  const { selectedInstitution } = useInstitution();
  const institutionId = selectedInstitution?.id ?? null;
  const queryClient = useQueryClient();

  const query = useQuery<ResumableStudySession | null>({
    queryKey: [STUDY_RESUME_QUERY_KEY, userId, institutionId ?? "general"],
    queryFn: () => fetchLatestStudyResume(userId as string, institutionId),
    enabled: !!userId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const dismiss = useCallback(() => {
    if (userId) clearStudyResumePointer(userId);
    queryClient.setQueryData([STUDY_RESUME_QUERY_KEY, userId, institutionId ?? "general"], null);
  }, [institutionId, queryClient, userId]);

  return {
    resume: query.data ?? null,
    isLoading: !!userId && query.isLoading,
    refetch: () => { void query.refetch(); },
    dismiss,
  };
}
