# Study Preferences Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist complete study presets globally and per list, synchronized through Supabase with versioned local fallback, without letting URL overrides contaminate saved preferences.

**Architecture:** Pure preset helpers resolve `defaults → global → list override → session overrides`. A repository owns Supabase reads/writes, a cache owns localStorage migration and pending offline writes, and `useStudyPreferences` orchestrates hydration and mutations. `GamesHub` and `Study` consume the effective preset and explicitly choose whether a user action persists globally or for the current private list.

**Tech Stack:** React 18, TypeScript, React Query, Supabase/PostgREST, Vitest, localStorage, PostgreSQL RLS.

## Global Constraints

- Do not persist Foco Vermelho in presets.
- Do not change `study_sessions`, repetition, scoring, completion, or red-focus queue rules.
- URL parameters are temporary session overrides and must never be persisted merely because a route opened.
- Authenticated users use Supabase as source of truth; anonymous users remain local-only.
- The UI must remain functional before the production migration is applied.
- Production data project is `ymahldldyxvwjeruaxpr`; repository configuration may point elsewhere.
- Defaults remain `flip`, `any`, `random`, `all`, `fastMode: false`.

---

## File Structure

- Create `src/features/study/preferences/studyPreset.ts`: types, defaults, normalization, merge and minimal override diff.
- Create `src/features/study/preferences/studyPreset.test.ts`: pure resolution and validation tests.
- Create `src/features/study/preferences/studyPreferenceCache.ts`: v3 keys, v2 migration, pending writes and isolation.
- Create `src/features/study/preferences/studyPreferenceCache.test.ts`: localStorage and offline queue tests.
- Create `src/features/study/preferences/studyPreferenceRepository.ts`: Supabase global/list read, upsert and delete operations with schema-missing fallback classification.
- Create `src/features/study/preferences/studyPreferenceRepository.test.ts`: repository mapping and error classification tests.
- Replace `src/hooks/useStudyPreferences.ts`: orchestrator exposing effective/global/list/session state and explicit mutation methods.
- Modify `src/pages/GamesHub.tsx`: hydrate effective preset, persist manual choices, expose global/list status and reset actions.
- Modify `src/pages/Study.tsx`: consume effective preset and persist only explicit in-game changes; keep red focus temporary.
- Modify `src/features/study/components/GameSettingsModal.impl.tsx`: allow persistent direction change through callback instead of URL-only mutation.
- Modify `src/features/study/components/GameSettingsModal.tsx`: re-export updated props.
- Create `supabase/migrations/20260712170000_user_study_preferences.sql`: two tables, checks, indexes, triggers and RLS.
- Create `src/features/study/preferences/studyPreferencesMigration.test.ts`: migration contract checks.
- Modify `src/integrations/supabase/types.ts`: generated-compatible table types for the new tables.

---

### Task 1: Pure preset contract

**Files:**
- Create: `src/features/study/preferences/studyPreset.ts`
- Test: `src/features/study/preferences/studyPreset.test.ts`

**Interfaces:**
- Produces `StudyPreset`, `StudyPresetOverride`, `StudySessionOverrides`, `DEFAULT_STUDY_PRESET`, `normalizeStudyPreset`, `normalizeStudyPresetOverride`, `resolveStudyPreset`, `diffStudyPreset`, `isEmptyStudyPresetOverride`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_STUDY_PRESET,
  diffStudyPreset,
  resolveStudyPreset,
  normalizeStudyPreset,
} from "./studyPreset";

describe("studyPreset", () => {
  it("normalizes invalid values to safe defaults", () => {
    expect(normalizeStudyPreset({ mode: "bad", direction: "bad" })).toEqual(DEFAULT_STUDY_PRESET);
  });

  it("resolves defaults then global then list then session", () => {
    expect(resolveStudyPreset({
      globalPreset: { ...DEFAULT_STUDY_PRESET, mode: "mixed", direction: "a-b" },
      listOverride: { mode: "write" },
      sessionOverrides: { direction: "b-a" },
    })).toEqual({ ...DEFAULT_STUDY_PRESET, mode: "write", direction: "b-a" });
  });

  it("computes only fields different from global", () => {
    expect(diffStudyPreset(
      { ...DEFAULT_STUDY_PRESET, mode: "write", fastMode: true },
      { ...DEFAULT_STUDY_PRESET, mode: "mixed", fastMode: true },
    )).toEqual({ mode: "write" });
  });

  it("has no redFocus field", () => {
    expect("redFocus" in DEFAULT_STUDY_PRESET).toBe(false);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- src/features/study/preferences/studyPreset.test.ts`
Expected: FAIL because `./studyPreset` does not exist.

- [ ] **Step 3: Implement the pure contract**

```ts
export type StudyModePreset = "flip" | "write" | "multiple-choice" | "unscramble" | "mixed" | "pronunciation";
export type StudyDirectionPreset = "a-b" | "b-a" | "any";
export type StudyOrderPreset = "random" | "sequential";
export type StudyScopePreset = "all" | "favorites";

export type StudyPreset = {
  mode: StudyModePreset;
  direction: StudyDirectionPreset;
  order: StudyOrderPreset;
  scope: StudyScopePreset;
  fastMode: boolean;
};

export type StudyPresetOverride = Partial<StudyPreset>;
export type StudySessionOverrides = Partial<Pick<StudyPreset, "mode" | "direction" | "order" | "scope" | "fastMode">>;

export const DEFAULT_STUDY_PRESET: StudyPreset = Object.freeze({
  mode: "flip",
  direction: "any",
  order: "random",
  scope: "all",
  fastMode: false,
});

export function normalizeStudyPreset(value: unknown): StudyPreset;
export function normalizeStudyPresetOverride(value: unknown): StudyPresetOverride;
export function resolveStudyPreset(input: {
  globalPreset?: StudyPreset | null;
  listOverride?: StudyPresetOverride | null;
  sessionOverrides?: StudySessionOverrides | null;
}): StudyPreset;
export function diffStudyPreset(value: StudyPreset, globalPreset: StudyPreset): StudyPresetOverride;
export function isEmptyStudyPresetOverride(value: StudyPresetOverride | null | undefined): boolean;
```

Validate each enum explicitly and preserve `false` booleans. `resolveStudyPreset` normalizes each layer and merges in the documented order.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/features/study/preferences/studyPreset.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/study/preferences/studyPreset.ts src/features/study/preferences/studyPreset.test.ts
git commit -m "feat: define study preset resolution"
```

### Task 2: Versioned local cache and v2 migration

**Files:**
- Create: `src/features/study/preferences/studyPreferenceCache.ts`
- Test: `src/features/study/preferences/studyPreferenceCache.test.ts`

**Interfaces:**
- Consumes `StudyPreset`, `StudyPresetOverride`, `normalizeStudyPreset`.
- Produces `readGlobalCache`, `writeGlobalCache`, `readListOverrideCache`, `writeListOverrideCache`, `removeListOverrideCache`, `readPendingPreferenceWrites`, `enqueuePendingPreferenceWrite`, `replacePendingPreferenceWrites`, `migrateLegacyStudyPreferences`.

- [ ] **Step 1: Write failing tests**

```ts
it("migrates legacy v2 favoritesOnly into scope", () => {
  localStorage.setItem("studyPreferences:user-1", JSON.stringify({
    version: 2,
    mode: "mixed",
    direction: "a-b",
    order: "sequential",
    favoritesOnly: true,
    fastMode: true,
  }));
  expect(migrateLegacyStudyPreferences("user-1")).toEqual({
    mode: "mixed", direction: "a-b", order: "sequential", scope: "favorites", fastMode: true,
  });
});

it("isolates global and list caches by user", () => {
  writeGlobalCache("user-1", DEFAULT_STUDY_PRESET);
  writeListOverrideCache("user-1", "list-1", { mode: "write" });
  expect(readListOverrideCache("user-2", "list-1")).toBeNull();
});

it("keeps pending writes ordered", () => {
  enqueuePendingPreferenceWrite("user-1", { kind: "global-upsert", preset: DEFAULT_STUDY_PRESET });
  enqueuePendingPreferenceWrite("user-1", { kind: "list-delete", listId: "list-1" });
  expect(readPendingPreferenceWrites("user-1")).toHaveLength(2);
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- src/features/study/preferences/studyPreferenceCache.test.ts`
Expected: FAIL because cache module does not exist.

- [ ] **Step 3: Implement cache**

Use exact keys:

```ts
const globalKey = (userId: string) => `studyPreferences:v3:${userId}:global`;
const listKey = (userId: string, listId: string) => `studyPreferences:v3:${userId}:list:${listId}`;
const pendingKey = (userId: string) => `studyPreferences:v3:${userId}:pending`;
```

Legacy migration reads `studyPreferences:<userId>` and `studyPreferences:anon`, maps `favoritesOnly` to `scope`, normalizes values, writes v3 once and never creates list overrides.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/features/study/preferences/studyPreferenceCache.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/study/preferences/studyPreferenceCache.ts src/features/study/preferences/studyPreferenceCache.test.ts
git commit -m "feat: add versioned study preference cache"
```

### Task 3: Supabase migration and repository

**Files:**
- Create: `supabase/migrations/20260712170000_user_study_preferences.sql`
- Create: `src/features/study/preferences/studyPreferenceRepository.ts`
- Test: `src/features/study/preferences/studyPreferenceRepository.test.ts`
- Test: `src/features/study/preferences/studyPreferencesMigration.test.ts`
- Modify: `src/integrations/supabase/types.ts`

**Interfaces:**
- Produces `StudyPreferenceRepository` with `readGlobal(userId)`, `upsertGlobal(userId, preset)`, `readListOverride(userId, listId)`, `upsertListOverride(userId, listId, override)`, `deleteListOverride(userId, listId)`.
- Produces `isMissingStudyPreferenceSchemaError(error)`.

- [ ] **Step 1: Write failing repository tests**

```ts
it("maps database card_order and fast_mode fields", async () => {
  const repo = createStudyPreferenceRepository(fakeClientReturning({
    mode: "mixed", direction: "a-b", card_order: "sequential", scope: "all", fast_mode: true,
  }));
  await expect(repo.readGlobal("user-1")).resolves.toEqual({
    mode: "mixed", direction: "a-b", order: "sequential", scope: "all", fastMode: true,
  });
});

it("classifies missing table errors for local fallback", () => {
  expect(isMissingStudyPreferenceSchemaError({ code: "42P01" })).toBe(true);
  expect(isMissingStudyPreferenceSchemaError({ code: "PGRST205" })).toBe(true);
});
```

- [ ] **Step 2: Write migration contract test**

Read the migration file and assert it contains both tables, CHECK constraints for all enums, RLS enablement, four policies per table, `(SELECT auth.uid())`, and indexes for `updated_at`/`list_id` access.

- [ ] **Step 3: Run tests and verify failure**

Run: `npm test -- src/features/study/preferences/studyPreferenceRepository.test.ts src/features/study/preferences/studyPreferencesMigration.test.ts`
Expected: FAIL because repository and migration do not exist.

- [ ] **Step 4: Create migration**

The SQL must:

```sql
CREATE TABLE IF NOT EXISTS public.user_study_preferences (...);
CREATE TABLE IF NOT EXISTS public.user_list_study_preferences (...);
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
```

Use `CHECK` constraints for mode, direction, card_order and scope. Add `updated_at` trigger using the repository's existing timestamp trigger pattern or a dedicated `set_updated_at()` function created with `CREATE OR REPLACE FUNCTION`. Policies must be named deterministically and cover SELECT, INSERT, UPDATE and DELETE for `authenticated` only.

- [ ] **Step 5: Implement repository and types**

Use `.maybeSingle()` reads, `.upsert(..., { onConflict: "user_id" })` globally, `.upsert(..., { onConflict: "user_id,list_id" })` for list overrides, and `.delete()` for empty overrides. Never swallow permission errors; only schema-missing/network errors are fallback candidates in the hook.

- [ ] **Step 6: Run tests**

Run: `npm test -- src/features/study/preferences/studyPreferenceRepository.test.ts src/features/study/preferences/studyPreferencesMigration.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260712170000_user_study_preferences.sql src/features/study/preferences/studyPreferenceRepository.ts src/features/study/preferences/*.test.ts src/integrations/supabase/types.ts
git commit -m "feat: persist study presets in supabase"
```

### Task 4: Orchestrating hook with explicit session overrides

**Files:**
- Replace: `src/hooks/useStudyPreferences.ts`
- Test: `src/hooks/useStudyPreferences.test.tsx`

**Interfaces:**
- Consumes cache/repository/preset modules and `userId`, optional `listId`, `isPrivateList`.
- Produces:

```ts
{
  effectivePreset: StudyPreset;
  globalPreset: StudyPreset;
  listOverride: StudyPresetOverride | null;
  source: "defaults" | "global" | "list";
  isHydrating: boolean;
  updateForCurrentScope(partial: Partial<StudyPreset>): void;
  saveAsGlobal(preset?: StudyPreset): Promise<void>;
  resetListOverride(): Promise<void>;
  setSessionOverrides(overrides: StudySessionOverrides): void;
}
```

- [ ] **Step 1: Write failing hook tests**

Cover:
- cached value renders immediately;
- server global replaces cache after hydration;
- list override wins global;
- URL/session overrides change `effectivePreset` only;
- manual list update writes minimal override;
- empty override deletes list row;
- missing schema leaves local behavior functional;
- pending offline write flushes after `online`.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/hooks/useStudyPreferences.test.tsx`
Expected: FAIL because the hook still exposes `{ prefs, updatePrefs }`.

- [ ] **Step 3: Implement hook**

Hydration order:
1. read v3 cache or migrate v2;
2. set immediate global/list state;
3. parse URL into session overrides without persistence;
4. authenticated: read Supabase global/list in parallel;
5. if no server global, import migrated/local global once;
6. update cache from confirmed server values;
7. flush pending writes on mount and `online`.

Writes update React state and cache synchronously, then debounce Supabase writes by 300 ms. A failed retryable write is appended/replaced in pending storage. Use last-write-wins timestamps for pending deduplication.

- [ ] **Step 4: Run hook tests**

Run: `npm test -- src/hooks/useStudyPreferences.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useStudyPreferences.ts src/hooks/useStudyPreferences.test.tsx
git commit -m "feat: synchronize study preferences"
```

### Task 5: Games Hub integration

**Files:**
- Modify: `src/pages/GamesHub.tsx`
- Test: `src/pages/GamesHub.preferences.test.tsx`

**Interfaces:**
- Consumes the new hook with `listId` and private-list scope.
- Persists selectors as list override for private lists, global otherwise.

- [ ] **Step 1: Write failing integration tests**

Test that:
- global preset initializes controls;
- list override initializes controls;
- changing direction/order calls `updateForCurrentScope`;
- opening a `?mode=write&dir=b-a` link does not call persistence;
- clicking a game persists selected mode as an explicit manual choice;
- reset action calls `resetListOverride`;
- save-as-global action calls `saveAsGlobal`.

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- src/pages/GamesHub.preferences.test.tsx`
Expected: FAIL against the old hook API.

- [ ] **Step 3: Implement UI integration**

Display a compact status line:
- `Padrão global` when no list override;
- `Personalizado nesta lista` when override exists.

Add two outline actions for private lists:
- `Restaurar padrão global nesta lista`;
- `Usar estas configurações como padrão global`.

Build navigation URLs from `effectivePreset`, but do not feed URL values back into persistence during hydration.

- [ ] **Step 4: Run integration test**

Run: `npm test -- src/pages/GamesHub.preferences.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/GamesHub.tsx src/pages/GamesHub.preferences.test.tsx
git commit -m "feat: remember game hub presets"
```

### Task 6: In-game settings integration

**Files:**
- Modify: `src/pages/Study.tsx`
- Modify: `src/features/study/components/GameSettingsModal.impl.tsx`
- Modify: `src/features/study/components/GameSettingsModal.tsx`
- Test: `src/features/study/components/GameSettingsModal.test.tsx`
- Test: `src/pages/Study.preferences.test.tsx`

**Interfaces:**
- Modal adds optional `direction`, `onDirectionChange` props.
- Study persists only explicit user actions through `updateForCurrentScope`.

- [ ] **Step 1: Write failing tests**

Test that:
- inverting direction invokes `onDirectionChange` and does not directly mutate history;
- order, favorites and fast mode persist through current scope;
- red focus changes engine state but never calls preference persistence;
- restarting uses the current effective settings;
- URL mode/direction remain temporary until user manually changes a control.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/features/study/components/GameSettingsModal.test.tsx src/pages/Study.preferences.test.tsx`
Expected: FAIL because modal direction is URL-only and Study uses old hook API.

- [ ] **Step 3: Implement integration**

Map:
- `effectivePreset.scope` ↔ engine `subset`;
- `effectivePreset.order` ↔ engine `mode`;
- `effectivePreset.direction` ↔ `flipDirection`;
- `effectivePreset.fastMode` ↔ `fastMode`.

When `redFocus` is toggled, do not include it in `updateForCurrentScope`. When favorites are unavailable, use `all` for the active deck without overwriting saved `scope: favorites`.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/features/study/components/GameSettingsModal.test.tsx src/pages/Study.preferences.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Study.tsx src/pages/Study.preferences.test.tsx src/features/study/components/GameSettingsModal*
git commit -m "feat: persist explicit in-game settings"
```

### Task 7: Full regression and release verification

**Files:**
- Modify tests only if a regression exposes an invalid assumption.

- [ ] **Step 1: Run focused preference suite**

Run: `npm test -- src/features/study/preferences src/hooks/useStudyPreferences.test.tsx src/pages/GamesHub.preferences.test.tsx src/pages/Study.preferences.test.tsx`
Expected: PASS.

- [ ] **Step 2: Run core quality**

Run: `npm run typecheck && npm test && npm run lint && npm run build`
Expected: all commands exit 0.

- [ ] **Step 3: Run repository check**

Run: `npm run check`
Expected: environment, security, dependencies, store, typecheck, tests, lint and build all pass.

- [ ] **Step 4: Verify migration locally in CI**

Expected migration/reset workflows rebuild the local Supabase and all importer/classroom smoke tests pass.

- [ ] **Step 5: Manual preview acceptance**

1. Set global `Misto / A→B / Aleatória / Todos`.
2. Customize one list to `Escrita / B→A / Sequencial / Favoritos / Fast Mode`.
3. Leave and reopen; verify the custom list restores all fields.
4. Open another list; verify it uses global.
5. Reset the first list; verify it returns to global.
6. Open a URL with `?mode=flip&dir=any`; verify the session uses it but reopening normally restores the saved preset.
7. Toggle Foco Vermelho; verify it remains sequential, unique, temporary and absent on next normal entry.
8. Disable network, change a preference, reconnect and verify synchronization.

- [ ] **Step 6: Commit release fixes if needed**

```bash
git add -A
git commit -m "test: verify study preference persistence"
```

## Production Migration

After code merge, apply `supabase/migrations/20260712170000_user_study_preferences.sql` to project `ymahldldyxvwjeruaxpr` if migrations are not automatically deployed. The frontend must already work via local fallback before this action, but cross-device synchronization starts only after the tables exist.
