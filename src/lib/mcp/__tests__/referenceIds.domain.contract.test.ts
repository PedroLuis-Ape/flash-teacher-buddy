import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getList, listLists } from "../domain/lists";
import { listFolders } from "../domain/folders";
import { PERSONAL_SCOPE } from "../domain/scope";
import {
  FOLDER_A,
  LIST_A,
  buildTables,
  createHarness,
} from "./fixtures";

function tablesWithReferences() {
  const tables = buildTables();
  const folder = tables.folders.find((row) => row.id === FOLDER_A);
  const list = tables.lists.find((row) => row.id === LIST_A);
  if (!folder || !list) throw new Error("fixture incompleta");

  folder.reference_id = "F-K7M2Q9";
  list.reference_id = "L-7M2Q9K";
  list.folders = folder;
  return tables;
}

describe("reference ids in the authorized library domain", () => {
  it("resolves a list reference only after applying ownership and scope filters", async () => {
    const { db, calls } = createHarness(tablesWithReferences());
    const result = await getList(db, { scope: PERSONAL_SCOPE, listId: " l-7m2q9k " });

    expect(result.list).toMatchObject({ id: LIST_A, reference_id: "L-7M2Q9K" });
    expect(result.folder).toMatchObject({ id: FOLDER_A, reference_id: "F-K7M2Q9" });
    const listCall = calls.find((call) => call.operation !== "rpc" && call.table === "lists");
    expect(listCall && "filters" in listCall ? listCall.filters : []).toEqual(
      expect.arrayContaining([
        { op: "eq", column: "reference_id", value: "L-7M2Q9K" },
        { op: "eq", column: "folders.owner_id", value: db.userId },
        { op: "is", column: "folders.institution_id", value: null },
      ]),
    );
  });

  it("returns both identifiers from folder and list collections", async () => {
    const { db } = createHarness(tablesWithReferences());
    const folders = await listFolders(db, { scope: PERSONAL_SCOPE });
    const lists = await listLists(db, { scope: PERSONAL_SCOPE });

    expect(folders.items[0]).toMatchObject({ id: FOLDER_A, reference_id: "F-K7M2Q9" });
    expect(lists.items.find((item) => item.id === LIST_A)).toMatchObject({
      id: LIST_A,
      reference_id: "L-7M2Q9K",
    });
  });
});

describe("reference id migration contract", () => {
  const migration = readFileSync(
    new URL("../../../..//supabase/migrations/20260914130000_piteco_reference_ids.sql", import.meta.url),
    "utf8",
  );

  it("defines readable six-character F-/L- ids, backfill, uniqueness and immutable triggers", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS reference_id\s+text/i);
    expect(migration).toMatch(/candidate\s*:=\s*'F-'[\s\S]*FOR i IN 1\.\.6/i);
    expect(migration).toMatch(/generate_list_reference_id[\s\S]*FOR i IN 1\.\.6/i);
    expect(migration).toMatch(/UPDATE public\.folders[\s\S]*WHERE[\s\S]*reference_id IS NULL/i);
    expect(migration).toMatch(/UPDATE public\.lists[\s\S]*WHERE[\s\S]*reference_id IS NULL/i);
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS folders_reference_id/i);
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS lists_reference_id/i);
    expect(migration).toMatch(/BEFORE INSERT OR UPDATE ON public\.folders/i);
    expect(migration).toMatch(/BEFORE INSERT OR UPDATE ON public\.lists/i);
    expect(migration).toMatch(/reference_id IS DISTINCT FROM OLD\.reference_id/i);
    expect(migration).toMatch(/RAISE EXCEPTION[\s\S]*immutable/i);
  });

  it("does not introduce a service-role path", () => {
    expect(migration).not.toMatch(/service_role/i);
  });
});
