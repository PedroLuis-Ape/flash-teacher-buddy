import { describe, expect, it } from "vitest";
import { PERSONAL_SCOPE } from "../domain/scope";
import { getList, listLists } from "../domain/lists";
import {
  FOLDER_A,
  FOLDER_A_INSTITUTION,
  INSTITUTION_A,
  LIST_A,
  LIST_A_DELETED,
  LIST_A_INSTITUTION,
  LIST_A_SECOND,
  LIST_A_SYSTEM,
  LIST_B,
  USER_A,
  callsFor,
  createHarness,
  filtersOf,
} from "./fixtures";

describe("list_lists domain", () => {
  it("lists only the user lists inside the account's own personal folders", async () => {
    const { db } = createHarness();
    const result = await listLists(db, { scope: PERSONAL_SCOPE });
    expect(result.items.map((list) => list.id).sort()).toEqual([LIST_A, LIST_A_SECOND].sort());
    expect(result.scope).toBe("personal");
    expect(result.total_count).toBe(2);
    const phrasal = result.items.find((list) => list.id === LIST_A);
    expect(phrasal).toMatchObject({
      title: "Phrasal Verbs",
      folder_id: FOLDER_A,
      folder_title: "Inglês B1",
      primary_side: "a",
      lang_a: "en",
      lang_b: "pt",
    });
  });

  it("excludes system collections, trash, classroom content and other accounts", async () => {
    const { db } = createHarness();
    const result = await listLists(db, { scope: PERSONAL_SCOPE, limit: 50 });
    const ids = result.items.map((list) => list.id);
    for (const forbidden of [LIST_A_SYSTEM, LIST_A_DELETED, LIST_A_INSTITUTION, LIST_B]) {
      expect(ids).not.toContain(forbidden);
    }
  });

  it("filters by folder and by search without losing ownership filters", async () => {
    const { db, calls } = createHarness();
    const result = await listLists(db, { scope: PERSONAL_SCOPE, folderId: FOLDER_A, search: "Phrasal" });
    expect(result.items.map((list) => list.id)).toEqual([LIST_A]);
    const filters = filtersOf(callsFor(calls, "lists")[0]);
    expect(filters).toContain(`folders.owner_id eq ${USER_A}`);
    expect(filters).toContain("folders.system_kind eq user");
    expect(filters).toContain("folders.deleted_at is null");
    expect(filters).toContain("folders.class_id is null");
    expect(filters).toContain("folders.institution_id is null");
    expect(filters).toContain("system_kind eq user");
    expect(filters).toContain("deleted_at is null");
    expect(filters).toContain(`folder_id eq ${FOLDER_A}`);
  });

  it("rejects a malformed folder id", async () => {
    const { db } = createHarness();
    await expect(listLists(db, { scope: PERSONAL_SCOPE, folderId: "nope" })).rejects.toMatchObject({
      code: "invalid_input",
    });
  });
});

describe("get_list domain", () => {
  it("returns metadata, folder and the exact card count without cards", async () => {
    const { db } = createHarness();
    const result = await getList(db, { scope: PERSONAL_SCOPE, listId: LIST_A });
    expect(result.list).toMatchObject({ id: LIST_A, title: "Phrasal Verbs", folder_id: FOLDER_A });
    expect(result.folder).toEqual({ id: FOLDER_A, title: "Inglês B1" });
    expect(result.card_count).toBe(2);
    expect(result.cards).toBeUndefined();
  });

  it("returns one bounded card page when include_cards is true", async () => {
    const { db } = createHarness();
    const result = await getList(db, {
      scope: PERSONAL_SCOPE,
      listId: LIST_A,
      includeCards: true,
      cardsLimit: 1,
    });
    expect(Array.isArray(result.cards)).toBe(true);
    expect((result.cards as unknown[]).length).toBe(1);
    expect(result.cards_page).toMatchObject({ limit: 1, offset: 0, returned: 1, has_more: true, total_count: 2 });
  });

  it("refuses a list owned by another account with a controlled not_found", async () => {
    const { db } = createHarness();
    await expect(getList(db, { scope: PERSONAL_SCOPE, listId: LIST_B })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("refuses a system list and a malformed id", async () => {
    const { db } = createHarness();
    await expect(getList(db, { scope: PERSONAL_SCOPE, listId: LIST_A_SYSTEM })).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(getList(db, { scope: PERSONAL_SCOPE, listId: "not-a-uuid" })).rejects.toMatchObject({
      code: "invalid_input",
    });
  });

  it("reads institution folders only inside the institution scope", async () => {
    const { db } = createHarness();
    const personal = await listLists(db, { scope: PERSONAL_SCOPE, limit: 50 });
    expect(personal.items.map((list) => list.id)).not.toContain(LIST_A_INSTITUTION);
    const institutional = await listLists(db, {
      scope: { kind: "institution", institutionId: INSTITUTION_A },
      limit: 50,
    });
    expect(institutional.items.map((list) => list.id)).toEqual([LIST_A_INSTITUTION]);
    expect(institutional.scope).toBe("institution");
    const detail = await getList(db, {
      scope: { kind: "institution", institutionId: INSTITUTION_A },
      listId: LIST_A_INSTITUTION,
    });
    expect(detail.folder).toEqual({ id: FOLDER_A_INSTITUTION, title: "Biblioteca da instituição" });
    await expect(
      getList(db, { scope: PERSONAL_SCOPE, listId: LIST_A_INSTITUTION }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
