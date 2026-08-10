import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const study = read("src/pages/Study.tsx");
const mixed = read("src/pages/MixedStudy.tsx");
const recovery = read("src/features/study/components/StudySessionRecovery.tsx");
const engine = read("src/features/study/hooks/useStudyEngine.ts");
const publicClient = read("src/integrations/supabase/publicClient.ts");

describe("authoritative study empty-state contract", () => {
  it.each([
    ["Study", study],
    ["MixedStudy", mixed],
  ])("uses the shared loader, authority probe and resource resolver in %s", (_name, source) => {
    expect(source).toContain("resolveStudyResourceContext");
    expect(source).toContain("fetchStudyDeckPage");
    expect(source).toContain("probeStudyDeckAvailability");
    expect(source).toContain('deckResult.status === "confirmed-empty"');
    expect(source).toContain('deckResult.status === "unconfirmed"');
    expect(source).not.toContain('deckResult.status === "empty"');
  });

  it("keeps resource-unavailable recovery read-only and actionable", () => {
    expect(study).toContain("getOfflineList(resolvedId, userId)");
    expect(study).toContain("offline-resource-recovery");
    expect(study).toContain("O banco não foi alterado");
    expect(study).toContain("readPlatformRuntime().projectId");
    expect(recovery).toContain("diagnostic");
  });

  it("never maps MixedStudy session/filter emptiness to the business empty screen", () => {
    expect(mixed).not.toContain('confirmedEmpty || sessionReadiness.phase === "empty"');
    expect(mixed).toContain("<StudyScopeEmptyState");
    expect(mixed).toContain('technicalId="MX-empty-unclassified"');
  });

  it("keeps filtered scopes distinct from an empty resource in Study", () => {
    expect(study).toContain("const emptyStudyScope =");
    expect(study).toContain("<StudyScopeEmptyState");
    expect(study).toContain('technicalId="ST-current-card-missing"');
  });

  it("does not offer a fresh empty session while the deck itself failed", () => {
    expect(recovery).toContain("allowStartFresh");
    expect(study).toContain("allowStartFresh={!loadFailure && flashcards.length > 0}");
    expect(mixed).toContain("allowStartFresh={!loadFailure && cards.length > 0}");
  });

  it("keeps retry available after a deck timeout", () => {
    expect(study).toContain("isRetrying={loading || studyLoading || preferencesHydrating}");
    expect(study).not.toContain("isRetrying={loading || studyLoading || preferencesHydrating || !sessionPresetReady}");
    expect(engine).toContain('if (!deckReady)');
    expect(engine).toMatch(/if \(!deckReady\)[\s\S]*?setIsLoading\(false\);[\s\S]*?return;/);
  });

  it("gates engine initialization and isolates local collection snapshots", () => {
    expect(engine).toContain("if (!deckReady)");
    expect(engine).toContain("storageResourceId || listId");
    expect(study).toContain("deckReadyForEngine");
  });

  it("uses a session-free client for every public read surface", () => {
    expect(publicClient).toContain("persistSession: false");
    expect(publicClient).toContain("autoRefreshToken: false");
    expect(publicClient).toContain("detectSessionInUrl: false");
    for (const path of [
      "src/pages/PublicFolderRoute.tsx",
      "src/pages/PublicLearningListPage.tsx",
      "src/pages/PublicClassGamesHub.tsx",
      "src/pages/PublicCollection.tsx",
    ]) {
      expect(read(path)).toContain("integrations/supabase/publicClient");
    }
  });
});
