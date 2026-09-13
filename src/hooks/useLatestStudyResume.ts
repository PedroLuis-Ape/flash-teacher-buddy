/**
 * Fonte única de retomada para a Home e para o banner "Continuar".
 *
 * Decisão (implementada em `features/study/lib/studyResumeQuery`):
 * 1. a sessão de estudo REALMENTE mais recente entre o ponteiro local
 *    (`ape_state_study_resume:v2:<scope>`) e as sessões abertas duráveis;
 * 2. empate fica com o ponteiro — identidade exata do aparelho;
 * 3. o ponteiro é realinhado para a sessão vencedora, para que o botão
 *    Continuar abra exatamente a lista exibida no card.
 */
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useInstitution } from "@/contexts/InstitutionContext";
import {
  clearStudyResumePointer,
  markStudySessionCompleted,
} from "@/features/study/lib/studyResumePointer";
import {
  fetchLatestStudyResume,
  type StudyResumeQueryClient,
} from "@/features/study/lib/studyResumeQuery";
import { STUDY_RESUME_QUERY_KEY } from "@/features/study/lib/studyResumeCache";
import type { ResumableStudySession } from "@/features/study/lib/resumableStudySession";

export { STUDY_RESUME_QUERY_KEY };

const resumeClient = supabase as unknown as StudyResumeQueryClient;

export function useLatestStudyResume() {
  const { userId } = useAuthUser();
  const { selectedInstitution } = useInstitution();
  const institutionId = selectedInstitution?.id ?? null;
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => [STUDY_RESUME_QUERY_KEY, userId, institutionId ?? "general"] as const,
    [institutionId, userId],
  );

  const query = useQuery<ResumableStudySession | null>({
    queryKey,
    queryFn: () => fetchLatestStudyResume({
      userId: userId as string,
      institutionId,
      client: resumeClient,
    }),
    enabled: !!userId,
    // A Home deve refletir imediatamente a última sessão praticada. Uma janela
    // de staleTime aqui fazia o card "Voltar para onde parou" reaproveitar o
    // recurso anterior logo após "Salvar e sair".
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const dismiss = useCallback(() => {
    if (!userId) return;
    const current = queryClient.getQueryData<ResumableStudySession | null>(queryKey);
    if (current?.sessionId) {
      // Descartar sem concluir também não pode ressuscitar a sessão: a marca
      // local vale até a conclusão remota confirmar.
      markStudySessionCompleted(userId, current.sessionId);
    }
    clearStudyResumePointer(userId);
    queryClient.setQueryData(queryKey, null);
  }, [queryClient, queryKey, userId]);

  return {
    resume: query.data ?? null,
    isLoading: !!userId && query.isLoading,
    refetch: () => { void query.refetch(); },
    dismiss,
  };
}
