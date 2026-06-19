export interface PersistedInstitutionSelection {
  version: 2;
  institutionId: string | null;
  updatedAt: number;
}

const INSTITUTION_PREFIX = "ape_pref_institution:v2:";
const LEGACY_INSTITUTION_KEY = "selectedInstitutionId";

export function institutionStorageKey(userId: string): string {
  return `${INSTITUTION_PREFIX}${userId}`;
}

export function readPersistedInstitution(userId: string): PersistedInstitutionSelection | null {
  try {
    const raw = localStorage.getItem(institutionStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedInstitutionSelection>;
    if (parsed.version !== 2) return null;
    if (parsed.institutionId !== null && typeof parsed.institutionId !== "string") return null;
    return {
      version: 2,
      institutionId: parsed.institutionId ?? null,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export function writePersistedInstitution(userId: string, institutionId: string | null): void {
  try {
    const payload: PersistedInstitutionSelection = {
      version: 2,
      institutionId,
      updatedAt: Date.now(),
    };
    localStorage.setItem(institutionStorageKey(userId), JSON.stringify(payload));
  } catch {
    // Storage may be unavailable or full. The in-memory selection still works.
  }
}

export function migrateLegacyInstitution(userId: string): PersistedInstitutionSelection | null {
  const current = readPersistedInstitution(userId);
  if (current) return current;

  try {
    const legacyId = localStorage.getItem(LEGACY_INSTITUTION_KEY);
    if (legacyId) {
      writePersistedInstitution(userId, legacyId);
      localStorage.removeItem(LEGACY_INSTITUTION_KEY);
      return readPersistedInstitution(userId);
    }
  } catch {
    // Ignore malformed/unavailable legacy storage.
  }

  return null;
}

const RECOVERY_PRESERVE_PREFIXES = [
  "sb-",
  "ape_outbox_",
  "ape_pref_",
  "ape_state_",
  "studyPreferences:",
  "flip-progress-",
  "study-completed:",
] as const;

export function shouldPreserveOnRecovery(key: string): boolean {
  return RECOVERY_PRESERVE_PREFIXES.some((prefix) => key.startsWith(prefix));
}
