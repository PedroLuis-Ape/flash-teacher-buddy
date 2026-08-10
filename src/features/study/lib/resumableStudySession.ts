/**
 * Modelo único de retomada consumido pela Home e pelo banner "Continuar".
 *
 * Antes existiam dois sistemas: `useHomeData().last` (apenas list_id/mode/
 * current_index, navegando para o Hub) e o ponteiro `StudyResumeSnapshotV2`
 * (sessão exata). Este módulo é a fonte única: o ponteiro local vence, a
 * sessão remota é o fallback/validação.
 */
import {
  normalizeStudySettingsSnapshotV2,
  type StudySettingsSnapshotV2,
} from "./studySettingsSnapshotV2";
import type { StudyResumeSnapshotV2 } from "./studyResumePointer";
import { buildStudyPathFromRemoteSession } from "./studyResumeRoute";

export interface ResumableStudySession {
  sessionId: string;
  resourceKind: "list" | "collection";
  resourceId: string;
  title: string;
  gameMode: string;
  path: string;
  currentIndex: number;
  totalCards: number;
  progressCount: number;
  progressUnit: "respondidos" | "dominados";
  currentCardId: string | null;
  layerIndex: number | null;
  settings: StudySettingsSnapshotV2;
  institutionId: string | null;
  updatedAt: number;
  source: "local-pointer" | "remote-session";
}

export interface RemoteStudySessionRow {
  id?: unknown;
  list_id?: unknown;
  mode?: unknown;
  session_scope_key?: unknown;
  current_index?: unknown;
  cards_order?: unknown;
  settings_snapshot?: unknown;
  session_snapshot?: unknown;
  updated_at?: unknown;
  completed?: unknown;
  lists?: unknown;
}

function visibleListFromRemoteSession(row: RemoteStudySessionRow): {
  id: string;
  title?: unknown;
  institution_id?: unknown;
  deleted_at?: unknown;
} | null {
  const candidate = (Array.isArray(row.lists) ? row.lists[0] : row.lists) as
    | { id?: unknown; title?: unknown; institution_id?: unknown; deleted_at?: unknown }
    | null
    | undefined;
  return candidate && typeof candidate.id === "string" && candidate.deleted_at == null
    ? { ...candidate, id: candidate.id }
    : null;
}

interface MasteryLikeSnapshot {
  version?: unknown;
  masteredIds?: unknown;
  totalEligible?: unknown;
}

interface ContinuousLikeSnapshot {
  results?: unknown;
  cardsOrder?: unknown;
  currentIndex?: unknown;
}

/**
 * `current_index` é uma posição zero-based e não equivale ao total respondido.
 * O modo extenso conta resultados registrados; o gamificado conta dominados.
 */
export function deriveStudyResumeProgress(input: {
  sessionSnapshot?: unknown;
  cardsOrder?: unknown;
  currentIndex?: unknown;
  totalEligibleFallback?: number;
}): { progressCount: number; totalCards: number; progressUnit: "respondidos" | "dominados" } {
  const snapshot = (input.sessionSnapshot && typeof input.sessionSnapshot === "object"
    ? input.sessionSnapshot
    : {}) as MasteryLikeSnapshot & ContinuousLikeSnapshot;

  const mastered = Array.isArray(snapshot.masteredIds) ? snapshot.masteredIds.length : null;
  if (snapshot.version === 2 && mastered !== null) {
    const totalEligible = Number(snapshot.totalEligible);
    return {
      progressCount: mastered,
      totalCards: Number.isFinite(totalEligible) && totalEligible > 0
        ? totalEligible
        : input.totalEligibleFallback ?? mastered,
      progressUnit: "dominados",
    };
  }

  const order = Array.isArray(snapshot.cardsOrder)
    ? snapshot.cardsOrder
    : Array.isArray(input.cardsOrder) ? input.cardsOrder : [];
  const total = order.length || input.totalEligibleFallback || 0;
  const results = Array.isArray(snapshot.results) ? snapshot.results : null;
  const answered = results
    ? new Set(
      results
        .map((row) => (row && typeof row === "object" ? (row as { flashcardId?: unknown }).flashcardId : null))
        .filter((id): id is string => typeof id === "string"),
    ).size
    : Math.max(0, Number(snapshot.currentIndex ?? input.currentIndex) || 0);

  return {
    progressCount: total > 0 ? Math.min(answered, total) : answered,
    totalCards: total,
    progressUnit: "respondidos",
  };
}

/** Converte o ponteiro local (sessão exata do próprio aparelho). */
export function resumableFromPointer(
  pointer: StudyResumeSnapshotV2,
  extra: {
    title?: string | null;
    totalCards?: number;
    progressCount?: number;
    progressUnit?: "respondidos" | "dominados";
  } = {},
): ResumableStudySession {
  return {
    sessionId: pointer.sessionId,
    resourceKind: pointer.resourceKind,
    resourceId: pointer.resourceId,
    title: extra.title?.trim() || "Sessão de estudo",
    gameMode: pointer.gameMode,
    path: pointer.path,
    currentIndex: pointer.currentIndex,
    totalCards: extra.totalCards ?? 0,
    progressCount: extra.progressCount ?? pointer.currentIndex,
    progressUnit: extra.progressUnit ?? "respondidos",
    currentCardId: pointer.currentCardId,
    layerIndex: pointer.layerIndex,
    settings: pointer.settingsSummary,
    institutionId: pointer.institutionId,
    updatedAt: pointer.updatedAt,
    source: "local-pointer",
  };
}

/** Reconstrói uma retomada segura a partir da sessão remota aberta mais recente. */
export function resumableFromRemoteSession(
  row: RemoteStudySessionRow | null | undefined,
): ResumableStudySession | null {
  if (!row || row.completed === true) return null;
  const sessionId = typeof row.id === "string" ? row.id : null;
  const listId = typeof row.list_id === "string" ? row.list_id : null;
  const mode = typeof row.mode === "string" && row.mode.length > 0 ? row.mode : null;
  if (!sessionId || !listId || !mode) return null;

  // A study-session row can outlive, or remain readable after losing access
  // to, its related list. Such a row must not create a resume link that is
  // guaranteed to fail with ST-resource-unavailable.
  const list = visibleListFromRemoteSession(row);
  if (!list || list.id !== listId) return null;

  const settings = normalizeStudySettingsSnapshotV2(row.settings_snapshot);
  const path = buildStudyPathFromRemoteSession({ listId, mode, settings });
  if (!path) return null;

  const progress = deriveStudyResumeProgress({
    sessionSnapshot: row.session_snapshot,
    cardsOrder: row.cards_order,
    currentIndex: row.current_index,
  });

  const updatedAtMs = Date.parse(String(row.updated_at ?? ""));

  return {
    sessionId,
    resourceKind: "list",
    resourceId: listId,
    title: typeof list?.title === "string" && list.title.trim().length > 0 ? list.title : "Sessão de estudo",
    gameMode: mode,
    path,
    currentIndex: Math.max(0, Number(row.current_index) || 0),
    totalCards: progress.totalCards,
    progressCount: progress.progressCount,
    progressUnit: progress.progressUnit,
    currentCardId: null,
    layerIndex: null,
    settings,
    institutionId: typeof list?.institution_id === "string" ? list.institution_id : null,
    updatedAt: Number.isFinite(updatedAtMs) ? updatedAtMs : 0,
    source: "remote-session",
  };
}

export const RESUMABLE_STUDY_SESSION_COLUMNS =
  "id, list_id, mode, session_scope_key, current_index, cards_order, settings_snapshot, session_snapshot, updated_at, completed, lists(id, title, institution_id, deleted_at)";
