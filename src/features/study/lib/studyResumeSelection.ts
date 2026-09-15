/**
 * Decisão única de qual sessão o card "Voltar para onde parou" representa.
 *
 * CONTRATO ATUAL (P0 2026-09-15): a fonte é a ÚLTIMA INTERAÇÃO REAL DO USUÁRIO
 * (`study_sessions.last_activity_at`, mantido só pelo RPC
 * `touch_study_session_activity_v1`, e o ponteiro local publicado por
 * atividade). Sync técnico, retry, outbox, reconciliação e restauração NÃO são
 * atividade — por isso `updated_at` deixou de ser autoridade.
 *
 * Consequências obrigatórias:
 * - se a última atividade rastreada pertence a uma sessão concluída/descartada,
 *   o card fica SEM retomada (`null`); uma sessão velha ainda aberta nunca
 *   ressuscita no lugar dela;
 * - assim que o usuário tem qualquer atividade rastreada, sessões legadas
 *   ordenadas por `updated_at` deixam de participar da decisão;
 * - usuário ainda sem nenhuma atividade rastreada continua com o comportamento
 *   legado (sessões abertas por `updated_at`), para não perder retomadas
 *   criadas antes desta versão.
 */
import type { ResumableStudySession } from "./resumableStudySession";

/**
 * Tolerância para o desvio entre o relógio do aparelho (ponteiro local) e o
 * relógio do servidor. Existe só para não descartar a sessão que o próprio
 * aparelho acabou de praticar.
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

function inScope(
  input: StudyResumeSelectionInput,
  candidate: ResumableStudySession | null | undefined,
): ResumableStudySession | null {
  if (!candidate) return null;
  return studyResumeMatchesInstitution(candidate, input.institutionId) ? candidate : null;
}

function hasTrackedActivity(session: ResumableStudySession | null): boolean {
  return Boolean(session && session.lastActivityAt !== null);
}

/** Caminho LEGADO: nenhuma atividade rastreada, ordena sessões abertas por `updated_at`. */
export function selectLatestStudyResume(input: StudyResumeSelectionInput): ResumableStudySession | null {
  const toleranceMs = input.toleranceMs ?? STUDY_RESUME_RECENCY_TOLERANCE_MS;
  const pointer = inScope(input, input.pointer);

  let newestRemote: ResumableStudySession | null = null;
  for (const candidate of input.remote ?? []) {
    const scoped = inScope(input, candidate);
    if (!scoped || scoped.completed) continue;
    if (!newestRemote || scoped.updatedAt > newestRemote.updatedAt) newestRemote = scoped;
  }

  if (!pointer) return newestRemote;
  if (!newestRemote) return pointer;
  return newestRemote.updatedAt - pointer.updatedAt > toleranceMs ? newestRemote : pointer;
}

export interface StudyResumeActivitySelection {
  /** Sessão retomável, ou `null` quando a última atividade não é retomável. */
  resume: ResumableStudySession | null;
  /** A decisão usou o contrato de atividade real ou o caminho legado? */
  contract: "activity" | "legacy";
  /** Última atividade vencedora, mesmo quando ela é uma sessão concluída. */
  latestActivity: ResumableStudySession | null;
}

/**
 * Seleção pelo contrato de atividade real, com degradação para o caminho legado
 * quando o usuário ainda não tem nenhuma atividade rastreada.
 */
export function selectStudyResumeByActivity(
  input: StudyResumeSelectionInput,
): StudyResumeActivitySelection {
  const toleranceMs = input.toleranceMs ?? STUDY_RESUME_RECENCY_TOLERANCE_MS;
  const pointer = inScope(input, input.pointer);
  const remote = (input.remote ?? [])
    .map((candidate) => inScope(input, candidate))
    .filter((candidate): candidate is ResumableStudySession => candidate !== null);

  const tracked = remote.filter(hasTrackedActivity);
  const pointerTracked = hasTrackedActivity(pointer) ? pointer : null;

  if (tracked.length === 0 && !pointerTracked) {
    return {
      resume: selectLatestStudyResume(input),
      contract: "legacy",
      latestActivity: null,
    };
  }

  let winner: ResumableStudySession | null = null;
  for (const candidate of tracked) {
    if (!winner || (candidate.lastActivityAt as number) > (winner.lastActivityAt as number)) {
      winner = candidate;
    }
  }

  if (pointerTracked) {
    // Empate/desvio de relógio fica com o ponteiro: ele é a identidade exata do
    // aparelho (card, índice e camada) e responde antes do touch remoto.
    if (!winner) winner = pointerTracked;
    else if (winner.sessionId === pointerTracked.sessionId) winner = pointerTracked;
    else if ((winner.lastActivityAt as number) - (pointerTracked.lastActivityAt as number) <= toleranceMs) {
      winner = pointerTracked;
    }
  }

  return {
    resume: winner && !winner.completed ? winner : null,
    contract: "activity",
    latestActivity: winner,
  };
}
