import { describe, expect, it } from "vitest";
import {
  collectGuestState,
  discardGuestState,
  guestScopedKeyForUser,
  hasGuestState,
  importGuestStateToAccount,
  markGuestMergeDecision,
  readGuestMergeDecision,
  type GuestStorageLike,
} from "./guestStateBridge";

function memoryStorage(initial: Record<string, string> = {}): GuestStorageLike & { dump: () => Record<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    dump: () => Object.fromEntries(map),
  };
}

const PRESET_GUEST = "studyPreferences:v4:anon:mode:flip:2026-09-13";
const PRESET_USER = "studyPreferences:v4:u1:mode:flip:2026-09-13";
const RESUME_GUEST = "ape_state_study_resume:v2:anon";
const RESUME_USER = "ape_state_study_resume:v2:u1";

describe("ponte visitante -> conta", () => {
  it("detecta somente o escopo anon", () => {
    const storage = memoryStorage({ [PRESET_GUEST]: "{}", [PRESET_USER]: "{}", outro: "x" });
    const snapshot = collectGuestState(storage);
    expect(snapshot.presetKeys).toEqual([PRESET_GUEST]);
    expect(snapshot.resumeKey).toBeNull();
    expect(hasGuestState(storage)).toBe(true);
  });

  it("importa o estado do dispositivo sem sobrescrever a conta", () => {
    const storage = memoryStorage({
      [PRESET_GUEST]: "guest",
      [RESUME_GUEST]: "guest-resume",
      [PRESET_USER]: "account",
    });

    const result = importGuestStateToAccount("u1", storage);
    const dump = storage.dump();

    expect(result.importedPresets).toBe(0);
    expect(result.skippedExisting).toEqual([PRESET_USER]);
    expect(dump[PRESET_USER]).toBe("account");
    expect(dump[RESUME_USER]).toBe("guest-resume");
    expect(result.importedResume).toBe(true);
    expect(dump[PRESET_GUEST]).toBeUndefined();
    expect(dump[RESUME_GUEST]).toBeUndefined();
  });

  it("copia chaves novas e e idempotente", () => {
    const storage = memoryStorage({ [PRESET_GUEST]: "guest" });
    const first = importGuestStateToAccount("u1", storage);
    expect(first.importedPresets).toBe(1);
    expect(storage.dump()[guestScopedKeyForUser("u1", PRESET_GUEST)]).toBe("guest");

    const second = importGuestStateToAccount("u1", storage);
    expect(second.importedPresets).toBe(0);
    expect(hasGuestState(storage)).toBe(false);
  });

  it("conta vence descarta o estado local do visitante", () => {
    const storage = memoryStorage({ [PRESET_GUEST]: "guest", [RESUME_GUEST]: "r" });
    discardGuestState(storage);
    expect(hasGuestState(storage)).toBe(false);
  });

  it("registra a decisao uma unica vez por usuario", () => {
    const storage = memoryStorage();
    expect(readGuestMergeDecision("u1", storage)).toBeNull();
    markGuestMergeDecision("u1", "device", storage);
    expect(readGuestMergeDecision("u1", storage)).toBe("device");
    expect(readGuestMergeDecision("u2", storage)).toBeNull();
  });
});

