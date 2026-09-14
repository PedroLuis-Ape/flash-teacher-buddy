import { describe, expect, it } from "vitest";
import { PERSONAL_SCOPE } from "../domain/scope";
import { searchMyContent } from "../domain/search";
import {
  CARD_A_1,
  CARD_A_3,
  FOLDER_A,
  LIST_A,
  buildTables,
  callsFor,
  createHarness,
  makeCardRow,
  makeFolderRow,
  makeListRow,
} from "./fixtures";

const EXTRA_FOLDERS = [
  "aaaaaaaa-0003-4000-8000-000000000001",
  "aaaaaaaa-0003-4000-8000-000000000002",
  "aaaaaaaa-0003-4000-8000-000000000003",
];
const EXTRA_LIST = "aaaaaaaa-0003-4000-8000-000000000011";
const EXTRA_CARD = "aaaaaaaa-0003-4000-8000-000000000021";

describe("search_my_content domain", () => {
  it("finds only content owned by the authenticated account", async () => {
    const { db } = createHarness();
    const result = await searchMyContent(db, { scope: PERSONAL_SCOPE, query: "warehouse", limit: 10 });
    expect(result.items.map((item) => item.id)).toEqual([CARD_A_3]);
    expect(result.items[0]).toMatchObject({ type: "flashcard", title: "warehouse", context: "armazém" });
    expect(result.counts).toEqual({ folders: 0, lists: 0, flashcards: 1 });
    expect(result.truncated).toBe(false);
  });

  it("finds lists by title and reports the owning folder", async () => {
    const { db } = createHarness();
    const result = await searchMyContent(db, {
      scope: PERSONAL_SCOPE,
      query: "Phrasal",
      limit: 10,
      types: ["lists"],
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      type: "list",
      id: LIST_A,
      title: "Phrasal Verbs",
      folder_id: FOLDER_A,
      folder_title: "Inglês B1",
    });
  });

  it("caps the response with the required limit and reports truncation", async () => {
    const tables = buildTables();
    const folderA = makeFolderRow({ id: FOLDER_A, title: "Inglês B1" });
    EXTRA_FOLDERS.forEach((id, index) => {
      tables.folders.push(makeFolderRow({ id, title: "Vocab " + (index + 1) }));
    });
    const extraList = makeListRow({ id: EXTRA_LIST, title: "Vocab list" }, folderA);
    tables.lists.push(extraList);
    tables.flashcards.push(makeCardRow({ id: EXTRA_CARD, term: "vocab", translation: "vocabulário" }, extraList));

    const { db } = createHarness(tables);
    const result = await searchMyContent(db, { scope: PERSONAL_SCOPE, query: "vocab", limit: 2 });
    expect(result.counts).toEqual({ folders: 3, lists: 1, flashcards: 1 });
    expect(result.returned).toBe(2);
    expect(result.truncated).toBe(true);
    expect(result.items.map((item) => item.type)).toEqual(["folder", "list"]);
  });

  it("skips the other content types when types is narrowed", async () => {
    const { db, calls } = createHarness();
    await searchMyContent(db, { scope: PERSONAL_SCOPE, query: "work", limit: 5, types: ["folders"] });
    expect(callsFor(calls, "lists")).toHaveLength(0);
    expect(callsFor(calls, "flashcards")).toHaveLength(0);
    expect(callsFor(calls, "folders")).toHaveLength(1);
  });

  it("confines a list-scoped search to that list", async () => {
    const { db, calls } = createHarness();
    const result = await searchMyContent(db, {
      scope: PERSONAL_SCOPE,
      query: "work",
      limit: 5,
      listId: LIST_A,
    });
    expect(result.list_id).toBe(LIST_A);
    expect(result.items.map((item) => item.id)).toEqual([CARD_A_1]);
    expect(callsFor(calls, "folders")).toHaveLength(0);
    expect(callsFor(calls, "flashcards")).toHaveLength(1);
  });

  it("search never reaches a foreign list id", async () => {
    const { db } = createHarness();
    await expect(
      searchMyContent(db, { scope: PERSONAL_SCOPE, query: "warehouse", limit: 5, listId: "bbbbbbbb-0001-4000-8000-000000000001" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects an unusable query and an RLS denial", async () => {
    const { db } = createHarness();
    await expect(searchMyContent(db, { scope: PERSONAL_SCOPE, query: "%%%", limit: 5 })).rejects.toMatchObject({
      code: "invalid_input",
    });
    const denied = createHarness(undefined, {
      deny: { flashcards: { code: "42501", message: "permission denied for table flashcards" } },
    });
    await expect(
      searchMyContent(denied.db, { scope: PERSONAL_SCOPE, query: "work", limit: 5, types: ["flashcards"] }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});
