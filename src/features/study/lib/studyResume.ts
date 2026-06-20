export interface StudyResumeSnapshot {
  version: 1;
  path: string;
  institutionId: string | null;
  updatedAt: number;
}

const STORAGE_PREFIX = "ape_state_study_resume:v1:";
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const PRIVATE_STUDY_PATH = /^\/(list|collection)\/[A-Za-z0-9_-]+\/study$/;

export function studyResumeStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function isSafeStudyResumePath(path: string): boolean {
  try {
    const url = new URL(path, "https://www.apeeducation.org");
    if (url.origin !== "https://www.apeeducation.org") return false;
    if (!PRIVATE_STUDY_PATH.test(url.pathname)) return false;
    return !url.username && !url.password;
  } catch {
    return false;
  }
}

export function writeStudyResume(
  userId: string,
  path: string,
  institutionId: string | null,
  storage: Pick<Storage, "setItem"> = localStorage,
): StudyResumeSnapshot | null {
  if (!userId || !isSafeStudyResumePath(path)) return null;

  const snapshot: StudyResumeSnapshot = {
    version: 1,
    path,
    institutionId,
    updatedAt: Date.now(),
  };

  try {
    storage.setItem(studyResumeStorageKey(userId), JSON.stringify(snapshot));
    return snapshot;
  } catch {
    return null;
  }
}

export function readStudyResume(
  userId: string,
  storage: Pick<Storage, "getItem" | "removeItem"> = localStorage,
  now = Date.now(),
): StudyResumeSnapshot | null {
  if (!userId) return null;

  try {
    const raw = storage.getItem(studyResumeStorageKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StudyResumeSnapshot>;
    const valid =
      parsed.version === 1 &&
      typeof parsed.path === "string" &&
      isSafeStudyResumePath(parsed.path) &&
      (parsed.institutionId === null || typeof parsed.institutionId === "string") &&
      typeof parsed.updatedAt === "number" &&
      now - parsed.updatedAt <= MAX_AGE_MS;

    if (!valid) {
      storage.removeItem(studyResumeStorageKey(userId));
      return null;
    }

    return {
      version: 1,
      path: parsed.path,
      institutionId: parsed.institutionId ?? null,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function clearStudyResume(
  userId: string,
  storage: Pick<Storage, "removeItem"> = localStorage,
): void {
  if (!userId) return;
  try {
    storage.removeItem(studyResumeStorageKey(userId));
  } catch {
    // Storage may be unavailable. Nothing else to do.
  }
}

export function studyResumeMatchesInstitution(
  snapshot: StudyResumeSnapshot,
  institutionId: string | null,
): boolean {
  return snapshot.institutionId === institutionId;
}

export function describeStudyResume(path: string): string {
  try {
    const url = new URL(path, "https://www.apeeducation.org");
    const mode = url.searchParams.get("mode") || "flip";
    const favorites = url.searchParams.get("favorites") === "true";
    const direction = url.searchParams.get("dir") || url.searchParams.get("direction");

    const modeLabel: Record<string, string> = {
      flip: "Virar cards",
      write: "Escrita",
      multiple: "Múltipla escolha",
      "multiple-choice": "Múltipla escolha",
      unscramble: "Organizar frase",
      pronunciation: "Pronúncia",
      mixed: "Modo misto",
    };

    const parts = [modeLabel[mode] || "Estudo"];
    if (favorites) parts.push("favoritos");
    if (direction === "a-b") parts.push("Lado A → B");
    if (direction === "b-a") parts.push("Lado B → A");
    if (direction === "any") parts.push("direção mista");
    return parts.join(" • ");
  } catch {
    return "Retomar estudo";
  }
}
