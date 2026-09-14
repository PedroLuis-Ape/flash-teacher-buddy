import { describe, expect, it } from "vitest";
import { createFolder, updateFolder } from "../domain/folderWrites";
import { createList, duplicateList, moveList, reorderLists, updateList } from "../domain/listWrites";
import {
  CARD_A_1,
  EXTRA_COPY_FOLDER,
  EXTRA_LAYER_CARD,
  FOLDER_A,
  FOLDER_A_CLASS,
  FOLDER_A_INSTITUTION,
  FOLDER_B,
  INSTITUTION_A,
  INSTITUTION_B,
  LIST_A,
  LIST_A_SECOND,
  LIST_B,
  USER_A,
  buildTables,
  callsFor,
  createHarness,
  makeCardRow,
  makeFolderRow,
} from "./fixtures";

describe("folder writes", () => {
  it("creates a folder owned by the authenticated account (never by the model)", async () => {
    const harness = createHarness();
    const result = await createFolder(harness.db, {
      title: "  Inglês B2  ",
      description: "Curso",
      visibility: "class",
    });

    expect(result.created).toBe(true);
    expect(result.folder).toMatchObject({
      title: "Inglês B2",
      description: "Curso",
      visibility: "class",
      scope: "personal",
    });
    const inserted = harness.fake.tables.folders.find((row) => row.title === "Inglês B2");
    expect(inserted?.owner_id).toBe(USER_A);
    expect(inserted?.institution_id).toBeNull();
    expect(callsFor(harness.calls, "folders").some((call) => call.operation === "insert")).toBe(true);
  });

  it("creates inside an owned institution and refuses a foreign one", async () => {
    const harness = createHarness();
    const created = await createFolder(harness.db, { title: "Hub", institution_id: INSTITUTION_A });
    expect(created.folder).toMatchObject({ institution_id: INSTITUTION_A, scope: "institution" });

    await expect(
      createFolder(harness.db, { title: "Alheia", institution_id: INSTITUTION_B }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("updates only the informed fields and can move the folder between workspaces", async () => {
    const harness = createHarness();
    const renamed = await updateFolder(harness.db, { folder_id: FOLDER_A, title: "Inglês B1 (novo)" });
    expect(renamed.updated).toBe(true);
    expect(renamed.moved).toBe(false);
    expect(renamed.folder).toMatchObject({ id: FOLDER_A, title: "Inglês B1 (novo)", scope: "personal" });

    const moved = await updateFolder(harness.db, { folder_id: FOLDER_A, institution_id: INSTITUTION_A });
    expect(moved.moved).toBe(true);
    expect(moved.folder).toMatchObject({ institution_id: INSTITUTION_A, scope: "institution" });

    const back = await updateFolder(harness.db, { folder_id: FOLDER_A, institution_id: null });
    expect(back.moved).toBe(true);
    expect(back.folder).toMatchObject({ institution_id: null, scope: "personal" });
  });

  it("refuses a foreign folder, a classroom folder and an empty patch", async () => {
    const harness = createHarness();
    await expect(updateFolder(harness.db, { folder_id: FOLDER_B, title: "x" })).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(updateFolder(harness.db, { folder_id: FOLDER_A_CLASS, title: "x" })).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(updateFolder(harness.db, { folder_id: FOLDER_A })).rejects.toMatchObject({
      code: "invalid_input",
    });
  });
});

describe("list writes", () => {
  it("creates a list inside the owned folder, inheriting its workspace and order", async () => {
    const harness = createHarness();
    const result = await createList(harness.db, {
      folder_id: FOLDER_A,
      title: "Phrasal Verbs 2",
      description: "Novo deck",
      lang_a: "English",
      lang_b: "pt-BR",
      labels_a: "Inglês",
      tts_enabled: false,
      primary_side: "b",
    });

    expect(result.created).toBe(true);
    expect(result.list).toMatchObject({
      title: "Phrasal Verbs 2",
      folder_id: FOLDER_A,
      folder_title: "Inglês B1",
      lang_a: "en",
      lang_b: "pt-BR",
      primary_side: "b",
      order_index: 2,
    });
    const inserted = harness.fake.tables.lists.find((row) => row.title === "Phrasal Verbs 2");
    expect(inserted?.owner_id).toBe(USER_A);
    expect(inserted?.institution_id).toBeNull();
    expect(inserted?.tts_enabled).toBe(false);
  });

  it("mirrors the institution of an institutional folder", async () => {
    const harness = createHarness();
    const result = await createList(harness.db, { folder_id: FOLDER_A_INSTITUTION, title: "Turma A" });
    const inserted = harness.fake.tables.lists.find((row) => row.title === "Turma A");
    expect(inserted?.institution_id).toBe(INSTITUTION_A);
    expect(result.list).toMatchObject({ folder_id: FOLDER_A_INSTITUTION });
  });

  it("validates the closed study-settings domain", async () => {
    const harness = createHarness();
    await expect(
      createList(harness.db, { folder_id: FOLDER_A, title: "x", study_type: "math" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(
      createList(harness.db, { folder_id: FOLDER_A, title: "x", primary_side: "c" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(
      createList(harness.db, { folder_id: FOLDER_B, title: "x" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("updates list metadata and settings without touching foreign lists", async () => {
    const harness = createHarness();
    const updated = await updateList(harness.db, {
      list_id: LIST_A,
      title: "Phrasal Verbs B1",
      description: null,
      study_type: "general",
      tts_enabled: true,
    });
    expect(updated.updated).toBe(true);
    expect(updated.list).toMatchObject({ id: LIST_A, title: "Phrasal Verbs B1", lang_a: "en" });
    expect(harness.fake.tables.lists.find((row) => row.id === LIST_A)?.study_type).toBe("general");

    await expect(updateList(harness.db, { list_id: LIST_B, title: "x" })).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(updateList(harness.db, { list_id: LIST_A })).rejects.toMatchObject({
      code: "invalid_input",
    });
  });

  it("moves a list to another folder and mirrors the destination workspace", async () => {
    const harness = createHarness();
    const moved = await moveList(harness.db, { list_id: LIST_A, folder_id: FOLDER_A_INSTITUTION });
    expect(moved.moved).toBe(true);
    expect(moved.from).toMatchObject({ folder_id: FOLDER_A, folder_title: "Inglês B1" });
    expect(moved.to).toMatchObject({ folder_id: FOLDER_A_INSTITUTION });
    const row = harness.fake.tables.lists.find((candidate) => candidate.id === LIST_A);
    expect(row?.folder_id).toBe(FOLDER_A_INSTITUTION);
    expect(row?.institution_id).toBe(INSTITUTION_A);

    const again = await moveList(harness.db, { list_id: LIST_A, folder_id: FOLDER_A_INSTITUTION });
    expect(again).toMatchObject({ moved: false, already_in_folder: true });

    await expect(moveList(harness.db, { list_id: LIST_A, folder_id: FOLDER_B })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("reorders only lists that belong to the folder", async () => {
    const harness = createHarness();
    const result = await reorderLists(harness.db, { folder_id: FOLDER_A, list_ids: [LIST_A_SECOND, LIST_A] });
    expect(result).toMatchObject({ reordered: 2, folder_id: FOLDER_A });
    expect(harness.fake.tables.lists.find((row) => row.id === LIST_A_SECOND)?.order_index).toBe(0);
    expect(harness.fake.tables.lists.find((row) => row.id === LIST_A)?.order_index).toBe(1);

    await expect(
      reorderLists(harness.db, { folder_id: FOLDER_A, list_ids: [LIST_A, LIST_B] }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("duplicates a list with fresh card and group identity, skipping deleted cards", async () => {
    const tables = buildTables();
    const listA = tables.lists.find((row) => row.id === LIST_A);
    tables.flashcards.push(
      makeCardRow(
        { id: EXTRA_LAYER_CARD, term: "worked", translation: "trabalhou", parent_card_id: CARD_A_1, status_group_uid: CARD_A_1 },
        listA,
      ),
    );
    tables.folders.push(makeFolderRow({ id: EXTRA_COPY_FOLDER, title: "Destino" }));
    const harness = createHarness(tables);

    const result = await duplicateList(harness.db, {
      list_id: LIST_A,
      folder_id: EXTRA_COPY_FOLDER,
      title: "Cópia de Phrasal Verbs",
    });

    expect(result).toMatchObject({ created: true, source_list_id: LIST_A, copied_cards: 3, copied_layers: 1 });
    const createdListId = String((result.list as Record<string, unknown>).id);
    expect(createdListId).not.toBe(LIST_A);

    const copied = harness.fake.tables.flashcards.filter((row) => row.list_id === createdListId);
    expect(copied).toHaveLength(3);
    const newPrincipal = copied.find((row) => row.term === "work");
    const newLayer = copied.find((row) => row.term === "worked");
    expect(newPrincipal?.id).not.toBe(CARD_A_1);
    expect(newLayer?.parent_card_id).toBe(newPrincipal?.id);
    expect(newLayer?.status_group_uid).toBe(newPrincipal?.id);
    expect(copied.every((row) => row.user_id === USER_A)).toBe(true);
    expect(copied.some((row) => row.term === "ghost")).toBe(false);
    const newList = harness.fake.tables.lists.find((row) => row.id === createdListId);
    expect(newList?.folder_id).toBe(EXTRA_COPY_FOLDER);
  });

  it("refuses duplicating a foreign or deleted list", async () => {
    const harness = createHarness();
    await expect(duplicateList(harness.db, { list_id: LIST_B })).rejects.toMatchObject({ code: "not_found" });
    await expect(duplicateList(harness.db, { list_id: FOLDER_A, folder_id: FOLDER_B })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
