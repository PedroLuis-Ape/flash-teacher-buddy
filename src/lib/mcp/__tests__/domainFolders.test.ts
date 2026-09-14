import { describe, expect, it } from "vitest";
import { PERSONAL_SCOPE } from "../domain/scope";
import { listFolders } from "../domain/folders";
import { FOLDER_A, FOLDER_A_CLASS, FOLDER_A_DELETED, FOLDER_A_INSTITUTION, FOLDER_A_SYSTEM, FOLDER_B, USER_A, callsFor, createHarness, filtersOf } from "./fixtures";

describe("list_folders domain", () => {
  it("returns only the personal folders of account A", async () => {
    const { db } = createHarness();
    const result = await listFolders(db, { scope: PERSONAL_SCOPE });
    expect(result.items.map((folder) => folder.id)).toEqual([FOLDER_A]);
    expect(result.items[0]).toMatchObject({
      title: "Inglês B1",
      description: "Curso de inglês intermediário",
      visibility: "private",
      lang_a: "en",
      lang_b: "pt",
      tts_enabled: true,
      list_count: 1,
    });
    expect(result.total_count).toBe(1);
    expect(result.scope).toBe("personal");
    expect(result.has_more).toBe(false);
  });

  it("never returns another account, system, classroom, institution or deleted folders", async () => {
    const { db } = createHarness();
    const result = await listFolders(db, { scope: PERSONAL_SCOPE, limit: 50 });
    const ids = result.items.map((folder) => folder.id);
    for (const forbidden of [FOLDER_B, FOLDER_A_SYSTEM, FOLDER_A_CLASS, FOLDER_A_INSTITUTION, FOLDER_A_DELETED]) {
      expect(ids).not.toContain(forbidden);
    }
  });

  it("narrows ownership, system_kind, trash and scope in the query", async () => {
    const { db, calls } = createHarness();
    await listFolders(db, { scope: PERSONAL_SCOPE });
    const filters = filtersOf(callsFor(calls, "folders")[0]);
    expect(filters).toContain(`owner_id eq ${USER_A}`);
    expect(filters).toContain("system_kind eq user");
    expect(filters).toContain("deleted_at is null");
    expect(filters).toContain("class_id is null");
    expect(filters).toContain("institution_id is null");
  });

  it("sanitizes the search term before building the PostgREST filter", async () => {
    const { db, calls } = createHarness();
    await listFolders(db, { scope: PERSONAL_SCOPE, search: "Inglês, 100%_" });
    const filters = filtersOf(callsFor(calls, "folders")[0]);
    expect(filters).toContain("or(title.ilike.%Inglês 100%,description.ilike.%Inglês 100%)");
  });

  it("caps the page size and validates pagination", async () => {
    const { db } = createHarness();
    const capped = await listFolders(db, { scope: PERSONAL_SCOPE, limit: 500 });
    expect(capped.limit).toBe(50);
    await expect(listFolders(db, { scope: PERSONAL_SCOPE, limit: 0 })).rejects.toMatchObject({ code: "invalid_input" });
    await expect(listFolders(db, { scope: PERSONAL_SCOPE, offset: -1 })).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("rejects an empty search term instead of silently listing everything", async () => {
    const { db } = createHarness();
    await expect(listFolders(db, { scope: PERSONAL_SCOPE, search: ",,," })).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("translates an RLS denial into a controlled forbidden error", async () => {
    const { db } = createHarness(undefined, { deny: { folders: { code: "42501", message: "permission denied for table folders" } } });
    await expect(listFolders(db, { scope: PERSONAL_SCOPE })).rejects.toMatchObject({ code: "forbidden" });
  });
});
