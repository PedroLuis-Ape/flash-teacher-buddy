/**
 * Decisão única de qual sessão o card "Voltar para onde parou" representa.
 *
 * Regra de negócio: a fonte é a ÚLTIMA ATIVIDADE REAL de estudo, não a lista
 * criada/editada por último, nem a de maior progresso. O ponteiro local
 * (`ape_state_study_resume:v2:<scope>`) é apenas o cache da sessão exata do
 * aparelho: ele vence empates, mas nunca pode manter o card preso em uma lista
 * antiga quando existe atividade durável mais recente (outra superfície de
 * estudo, outro aparelho, retomada em outra aba).
 */
import type { ResumableStudySession } from "./resumableStudySession";

/**
 * Tolerância para o desvio entre o relógio do aparelho (ponteiro local) e o
 * relógio do servidor (`study_sessions.updated_at`). Existe só para não
 * descartar a sessão que o próprio aparelho acabou de praticar.
 */
export const STUDY_RESUME_RECENCY_TOLERANCE_MS = 5_000;

export function studyResumeMatchesInstitution(
  resume: Pick<ResumableStudySession, "institutionId">,
  institutionId: string | null,
): boolean {
  return (resume.institutionId ?? null) === (institutionId ?? null);
}

export interface StudyResumeSelectionInput {
  pointer?: ResumableStudySession | null;
  remote?: readonly ResumableStudySession[] | null;
  institutionId: string | null;
  toleranceMs?: number;
}

export function selectLatestStudyResume(input: StudyResumeSelectionInput): ResumableStudySession | null {
  const toleranceMs = input.toleranceMs ?? STUDY_RESUME_RECENCY_TOLERANCE_MS;
  const pointer = input.pointer && studyResumeMatchesInstitution(input.pointer, input.institutionId)
    ? input.pointer
    : null;

  let newestRemote: ResumableStudySession | null = null;
  for (const candidate of input.remote ?? []) {
    if (!candidate || !studyResumeMatchesInstitution(candidate, input.institutionId)) continue;
    if (!newestRemote || candidate.updatedAt > newestRemote.updatedAt) newestRemote = candidate;
  }

  if (!pointer) return newestRemote;
  if (!newestRemote) return pointer;
  return newestRemote.updatedAt - pointer.updatedAt > toleranceMs ? newestRemote : pointer;
}
