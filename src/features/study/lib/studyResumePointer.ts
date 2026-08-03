/**
 * Ponteiro de retomada v2.
 *
 * Diferente da v1 (que guardava apenas um path e era escrita a cada mudança de
 * URL), o ponteiro v2 só é criado quando existe uma sessão válida, aponta para
 * uma `sessionId` específica e carrega o resumo das configurações efetivamente
 * usadas por aquela sessão.
 */
import {
  isSafeStudyResumePath,
  studyResumeStorageKey as legacyStudyResumeStorageKey,
} from "./studyResume";
import {
  normalizeStudySettingsSnapshotV2,
  type StudySettingsSnapshotV2,
} from "./studySettingsSnapshotV2";

export interface StudyResumeSnapshotV2 {
  version: 2;
  userId: string;
  sessionId: string;
  resourceKind: "list" | "collection";
  resourceId: string;
  gameMode: string;
  institutionId: string | null;
  path: string;
  settingsSummary: StudySettingsSnapshotV2;
  currentIndex: number;
  currentCardId: string | null;
  layerIndex: number | null;
  updatedAt: number;
}

const STORAGE_PREFIX = "ape_state_study_resume:v2:";
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export function studyResumePointerKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function studySessionCompletionKey(userId: string, sessionId: string): string {
  return `ape_state_study_session_completed:v1:${userId}:${sessionId}`;
}

export function markStudySessionCompleted(
  userId: string,
  sessionId: string,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  if (!userId || !sessionId) return;
  try {
    storage.setItem(studySessionCompletionKey(userId, sessionId), String(Date.now()));
  } catch {
    // storage indisponível — a conclusão remota continua sendo a fonte durável
  }
}

export function isStudySessionCompleted(
  userId: string,
  sessionId: string,
  storage: Pick<Storage, "getItem"> = localStorage,
): boolean {
  if (!userId || !sessionId) return false;
  try {
    return Boolean(storage.getItem(studySessionCompletionKey(userId, sessionId)));
  } catch {
    return false;
  }
}

export type StudyResumePointerInput = Omit<StudyResumeSnapshotV2, "version" | "updatedAt">;

export function writeStudyResumePointer(
  input: StudyResumePointerInput,
  storage: Pick<Storage, "setItem" | "removeItem"> = localStorage,
): StudyResumeSnapshotV2 | null {
  if (!input.userId || !input.sessionId || !input.resourceId) return null;
  if (!isSafeStudyResumePath(input.path)) return null;

  const snapshot: StudyResumeSnapshotV2 = {
    ...input,
    version: 2,
    settingsSummary: normalizeStudySettingsSnapshotV2(input.settingsSummary),
    currentIndex: Number.isFinite(input.currentIndex) ? Math.max(0, Math.trunc(input.currentIndex)) : 0,
    currentCardId: input.currentCardId ?? null,
    layerIndex: Number.isFinite(input.layerIndex as number) ? (input.layerIndex as number) : null,
    updatedAt: Date.now(),
  };

  try {
    storage.setItem(studyResumePointerKey(input.userId), JSON.stringify(snapshot));
    // O ponteiro v1 (baseado apenas em URL) deixa de ser fonte de verdade.
    storage.removeItem(legacyStudyResumeStorageKey(input.userId));
    return snapshot;
  } catch {
    return null;
  }
}

export function readStudyResumePointer(
  userId: string,
  storage: Pick<Storage, "getItem" | "removeItem"> = localStorage,
  now = Date.now(),
): StudyResumeSnapshotV2 | null {
  if (!userId) return null;
  try {
    const raw = storage.getItem(studyResumePointerKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StudyResumeSnapshotV2>;

    const valid = parsed.version === 2
      && parsed.userId === userId
      && typeof parsed.sessionId === "string" && parsed.sessionId.length > 0
      && (parsed.resourceKind === "list" || parsed.resourceKind === "collection")
      && typeof parsed.resourceId === "string" && parsed.resourceId.length > 0
      && typeof parsed.gameMode === "string" && parsed.gameMode.length > 0
      && typeof parsed.path === "string" && isSafeStudyResumePath(parsed.path)
      && (parsed.institutionId === null || typeof parsed.institutionId === "string")
      && typeof parsed.updatedAt === "number"
      && now - parsed.updatedAt <= MAX_AGE_MS;

    if (!valid) {
      storage.removeItem(studyResumePointerKey(userId));
      return null;
    }

    if (isStudySessionCompleted(userId, parsed.sessionId as string, storage as Pick<Storage, "getItem">)) {
      storage.removeItem(studyResumePointerKey(userId));
      return null;
    }

    return {
      version: 2,
      userId,
      sessionId: parsed.sessionId as string,
      resourceKind: parsed.resourceKind as "list" | "collection",
      resourceId: parsed.resourceId as string,
      gameMode: parsed.gameMode as string,
      institutionId: parsed.institutionId ?? null,
      path: parsed.path as string,
      settingsSummary: normalizeStudySettingsSnapshotV2(parsed.settingsSummary),
      currentIndex: typeof parsed.currentIndex === "number" ? parsed.currentIndex : 0,
      currentCardId: typeof parsed.currentCardId === "string" ? parsed.currentCardId : null,
      layerIndex: typeof parsed.layerIndex === "number" ? parsed.layerIndex : null,
      updatedAt: parsed.updatedAt as number,
    };
  } catch {
    return null;
  }
}

/** Remove o ponteiro apenas quando ele aponta para a sessão informada. */
export function clearStudyResumePointerForSession(
  userId: string,
  sessionId: string,
  storage: Pick<Storage, "getItem" | "removeItem"> = localStorage,
): boolean {
  const current = readStudyResumePointer(userId, storage);
  if (!current || current.sessionId !== sessionId) return false;
  try {
    storage.removeItem(studyResumePointerKey(userId));
    return true;
  } catch {
    return false;
  }
}

export function clearStudyResumePointer(
  userId: string,
  storage: Pick<Storage, "removeItem"> = localStorage,
): void {
  if (!userId) return;
  try {
    storage.removeItem(studyResumePointerKey(userId));
  } catch {
    // nada a fazer
  }
}

export function studyResumePointerMatchesInstitution(
  snapshot: StudyResumeSnapshotV2,
  institutionId: string | null,
): boolean {
  return snapshot.institutionId === institutionId;
}
