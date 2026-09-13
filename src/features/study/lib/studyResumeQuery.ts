/**
 * Query única do card "Voltar para onde parou".
 *
 * Antes: o ponteiro local (`ape_state_study_resume:v2:<scope>`) era a
 * prioridade absoluta e só era consultado o remoto quando ele não existia.
 * Como apenas `/study` publicava o ponteiro, qualquer sessão criada em outra
 * superfície (Prática Mista, outro aparelho, outra aba) ficava invisível e o
 * card permanecia preso na lista antiga, mesmo com a sessão nova aberta em
 * `study_sessions`.
 *
 * Agora: o ponteiro continua sendo a identidade exata da sessão do aparelho,
 * mas a decisão é por ÚLTIMA ATIVIDADE REAL (`updated_at` das sessões abertas
 * do usuário) e o ponteiro é realinhado para a sessão vencedora.
 */
import {
  clearStudyResumePointer,
  isStudySessionCompleted,
  readStudyResumePointer,
  studyResumePointerMatchesInstitution,
  writeStudyResumePointer,
  type StudyResumeSnapshotV2,
} from "./studyResumePointer";
import {
  RESUMABLE_STUDY_SESSION_COLUMNS,
  deriveStudyResumeProgress,
  resumableFromPointer,
  resumableFromRemoteSession,
  type ResumableStudySession,
} from "./resumableStudySession";
import { selectLatestStudyResume } from "./studyResumeSelection";

type StudyResumeRow = Record<string, any>;

export interface StudyResumeResponse {
  data: unknown;
  error: { message?: string } | null;
}

export interface StudyResumeQueryBuilder extends PromiseLike<StudyResumeResponse> {
  select(columns: string): StudyResumeQueryBuilder;
  eq(column: string, value: unknown): StudyResumeQueryBuilder;
  order(column: string, options: { ascending: boolean }): StudyResumeQueryBuilder;
  limit(count: number): StudyResumeQueryBuilder;
  maybeSingle(): PromiseLike<StudyResumeResponse>;
}

export interface StudyResumeQueryClient {
  from(table: string): StudyResumeQueryBuilder;
}

export type StudyResumeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface LatestStudyResumeInput {
  userId: string;
  institutionId: string | null;
  client: StudyResumeQueryClient;
  storage?: StudyResumeStorage | null;
  now?: number;
}

/** Mesmo limite histórico: sessões abertas recentes são poucas por usuário. */
const RECENT_OPEN_SESSION_LIMIT = 10;

function listFromRow(row: StudyResumeRow): StudyResumeRow | null {
  const list = Array.isArray(row?.lists) ? row.lists[0] : row?.lists;
  return list && typeof list.id === "string" ? list : null;
}

interface PointerCandidateOutcome {
  /** A sessão apontada não existe mais (concluída, removida ou sem acesso). */
  missing: boolean;
  session: ResumableStudySession | null;
}

async function readPointerCandidate(input: {
  userId: string;
  pointer: StudyResumeSnapshotV2;
  client: StudyResumeQueryClient;
}): Promise<PointerCandidateOutcome | null> {
  const { pointer } = input;
  let query = input.client
    .from("study_sessions")
    .select(RESUMABLE_STUDY_SESSION_COLUMNS)
    .eq("id", pointer.sessionId)
    .eq("user_id", input.userId)
    .eq("mode", pointer.gameMode)
    .eq("completed", false);
  if (pointer.resourceKind === "list") {
    query = query.eq("list_id", pointer.resourceId);
  }
  const { data, error } = await query.maybeSingle();
  // Falha de transporte não autoriza apagar o ponteiro: o chamador mantém a
  // sessão do aparelho como candidata degradada.
  if (error) return null;

  const row = (data ?? null) as StudyResumeRow | null;
  if (!row) return { missing: true, session: null };

  const remoteResume = resumableFromRemoteSession(row);
  if (pointer.resourceKind === "list" && !remoteResume) {
    return { missing: true, session: null };
  }

  const progress = remoteResume ?? deriveStudyResumeProgress({
    sessionSnapshot: row.session_snapshot,
    cardsOrder: row.cards_order,
    currentIndex: row.current_index,
  });
  const list = listFromRow(row);
  return {
    missing: false,
    session: resumableFromPointer(pointer, {
      title: remoteResume?.title ?? (typeof list?.title === "string" ? list.title : null),
      totalCards: progress.totalCards,
      progressCount: progress.progressCount,
      progressUnit: progress.progressUnit,
    }),
  };
}

async function readRecentOpenSessions(input: {
  userId: string;
  client: StudyResumeQueryClient;
  storage: StudyResumeStorage | null;
}): Promise<ResumableStudySession[] | null> {
  const { data, error } = await input.client
    .from("study_sessions")
    .select(RESUMABLE_STUDY_SESSION_COLUMNS)
    .eq("user_id", input.userId)
    .eq("completed", false)
    .order("updated_at", { ascending: false })
    .limit(RECENT_OPEN_SESSION_LIMIT);
  if (error) return null;

  const rows = Array.isArray(data) ? (data as StudyResumeRow[]) : [];
  const candidates: ResumableStudySession[] = [];
  for (const row of rows) {
    const resume = resumableFromRemoteSession(row);
    if (!resume) continue;
    // Conclusão confirmada localmente (a gravação remota ainda pode estar na
    // fila) já terminou para o usuário e não pode ressuscitar no card.
    if (input.storage && isStudySessionCompleted(input.userId, resume.sessionId, input.storage)) continue;
    candidates.push(resume);
  }
  return candidates;
}

export async function fetchLatestStudyResume(
  input: LatestStudyResumeInput,
): Promise<ResumableStudySession | null> {
  const { userId, client } = input;
  if (!userId) return null;

  const storage = input.storage ?? null;
  const now = input.now ?? Date.now();
  const storedPointer = storage ? readStudyResumePointer(userId, storage, now) : null;
  const pointer = storedPointer && studyResumePointerMatchesInstitution(storedPointer, input.institutionId)
    ? storedPointer
    : null;

  const [pointerOutcome, remoteSessions] = await Promise.all([
    pointer ? readPointerCandidate({ userId, pointer, client }) : Promise.resolve(null),
    readRecentOpenSessions({ userId, client, storage }),
  ]);

  // `missing` = a linha apontada não existe mais: o ponteiro não pode ser
  // usado como candidato. Só a falha de transporte mantém a sessão do aparelho.
  const pointerSession = pointerOutcome
    ? (pointerOutcome.missing ? null : pointerOutcome.session)
    : (pointer ? resumableFromPointer(pointer) : null);
  const remote = remoteSessions ?? [];
  // Sem nenhuma das duas fontes confiáveis, o card não pode inventar sessão.
  if (!remoteSessions && !pointerSession) throw new Error("study-resume-unavailable");

  const winner = selectLatestStudyResume({
    pointer: pointerSession,
    remote,
    institutionId: input.institutionId,
  });

  if (storage) {
    if (pointer && pointerOutcome?.missing) clearStudyResumePointer(userId, storage);
    const winnerCameFromPointer = Boolean(pointerSession && winner && winner.sessionId === pointerSession.sessionId);
    if (winner && !winnerCameFromPointer) {
      // O ponteiro é um cache da sessão exata do aparelho: realinhar mantém o
      // botão Continuar apontando para a mesma lista exibida no card.
      writeStudyResumePointer({
        userId,
        sessionId: winner.sessionId,
        resourceKind: winner.resourceKind,
        resourceId: winner.resourceId,
        gameMode: winner.gameMode,
        institutionId: winner.institutionId,
        path: winner.path,
        settingsSummary: winner.settings,
        currentIndex: winner.currentIndex,
        currentCardId: winner.currentCardId,
        layerIndex: winner.layerIndex,
      }, storage);
    }
  }

  return winner;
}
