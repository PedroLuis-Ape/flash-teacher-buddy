import { describe, expect, it } from "vitest";
import { CONFIRMATION_TTL_SECONDS, createConfirmationToken } from "../domain/confirmation";
import { confirmFolderDeletion, confirmListDeletion, previewFolderDeletion, previewListDeletion, restoreFromTrash } from "../domain/trash";
import {
  CARD_A_1,
  CARD_A_2,
  CARD_A_3,
  FOLDER_A,
  FOLDER_B,
  LIST_A,
  LIST_A_DELETED,
  LIST_A_SECOND,
  LIST_A_SYSTEM,
  LIST_B,
  USER_A,
  confirmationKeyFor,
  createHarness,
  rpcCalls,
} from "./fixtures";

const KEY = confirmationKeyFor();

describe("preview/confirm list deletion", () => {
  it("previews the real consequences and only deletes with the returned token", async () => {
    const harness = createHarness();
    const preview = await previewListDeletion(harness.db, { list_id: LIST_A }, KEY);

    expect(preview).toMatchObject({ dry_run: true, card_count: 2, recoverable: true, retention_days: 7 });
    expect(preview.target).toMatchObject({ type: "list", id: LIST_A, title: "Phrasal Verbs", folder_id: FOLDER_A });
    expect(String(preview.confirmation_token)).toContain(".");
    expect(Array.isArray(preview.consequences)).toBe(true);
    // preview changes nothing
    expect(harness.fake.tables.lists.find((row) => row.id === LIST_A)?.deleted_at).toBeNull();

    const confirmed = await confirmListDeletion(
      harness.db,
      { list_id: LIST_A, confirmation_token: preview.confirmation_token },
      KEY,
    );
    expect(confirmed).toMatchObject({ deleted: true, already_deleted: false, cards_removed: 2 });
    expect(harness.fake.tables.lists.find((row) => row.id === LIST_A)?.deleted_at).toBeTruthy();
    expect(harness.fake.tables.flashcards.find((row) => row.id === CARD_A_1)?.deleted_at).toBeTruthy();
    expect(harness.fake.tables.flashcards.find((row) => row.id === CARD_A_3)?.deleted_at).toBeNull();
    expect(rpcCalls(harness.calls, "soft_delete_list")[0]?.rpcParams).toEqual({
      p_list_id: LIST_A,
      p_user_id: USER_A,
    });
  });

  it("fails safely without a token, with a forged token and with an expired token", async () => {
    const harness = createHarness();

    await expect(
      confirmListDeletion(harness.db, { list_id: LIST_A }, KEY),
    ).rejects.toMatchObject({ code: "confirmation_required" });
    await expect(
      confirmListDeletion(harness.db, { list_id: LIST_A, confirmation_token: "forjado.9999999999" }, KEY),
    ).rejects.toMatchObject({ code: "confirmation_required" });

    const expired = await createConfirmationToken(
      KEY,
      { action: "delete_list", userId: USER_A, objectId: LIST_A, expectedCount: 2 },
      Date.now() - (CONFIRMATION_TTL_SECONDS + 60) * 1000,
    );
    await expect(
      confirmListDeletion(harness.db, { list_id: LIST_A, confirmation_token: expired.token }, KEY),
    ).rejects.toMatchObject({ code: "confirmation_required" });

    // A token for another action/user/state never matches.
    const wrongAction = await createConfirmationToken(
      KEY,
      { action: "delete_folder", userId: USER_A, objectId: LIST_A, expectedCount: 2 },
    );
    await expect(
      confirmListDeletion(harness.db, { list_id: LIST_A, confirmation_token: wrongAction.token }, KEY),
    ).rejects.toMatchObject({ code: "confirmation_required" });

    expect(harness.fake.tables.lists.find((row) => row.id === LIST_A)?.deleted_at).toBeNull();
  });

  it("invalidates the token when the list changed after the preview", async () => {
    const harness = createHarness();
    const preview = await previewListDeletion(harness.db, { list_id: LIST_A }, KEY);
    const listA = harness.fake.tables.lists.find((row) => row.id === LIST_A);
    harness.fake.tables.flashcards.push(
      { id: "aaaaaaaa-0006-4000-8000-000000000001", list_id: LIST_A, user_id: USER_A, term: "new", translation: "novo", deleted_at: null, lists: listA },
    );

    await expect(
      confirmListDeletion(harness.db, { list_id: LIST_A, confirmation_token: preview.confirmation_token }, KEY),
    ).rejects.toMatchObject({ code: "confirmation_required" });

    const fresh = await previewListDeletion(harness.db, { list_id: LIST_A }, KEY);
    expect(fresh.card_count).toBe(3);
    const confirmed = await confirmListDeletion(
      harness.db,
      { list_id: LIST_A, confirmation_token: fresh.confirmation_token },
      KEY,
    );
    expect(confirmed.cards_removed).toBe(3);
  });

  it("is idempotent: deleting twice reports already_deleted instead of failing", async () => {
    const harness = createHarness();
    const first = await previewListDeletion(harness.db, { list_id: LIST_A }, KEY);
    await confirmListDeletion(harness.db, { list_id: LIST_A, confirmation_token: first.confirmation_token }, KEY);

    const again = await confirmListDeletion(harness.db, { list_id: LIST_A }, KEY);
    expect(again).toMatchObject({ deleted: false, already_deleted: true, cards_removed: 0 });
    expect(rpcCalls(harness.calls, "soft_delete_list")).toHaveLength(1);
  });

  it("rejects replay of the same token after the deleted list is restored", async () => {
    const harness = createHarness();
    const preview = await previewListDeletion(harness.db, { list_id: LIST_A }, KEY);
    await confirmListDeletion(harness.db, { list_id: LIST_A, confirmation_token: preview.confirmation_token }, KEY);
    await restoreFromTrash(harness.db, { target: "list", id: LIST_A });

    await expect(
      confirmListDeletion(harness.db, { list_id: LIST_A, confirmation_token: preview.confirmation_token }, KEY),
    ).rejects.toMatchObject({ code: "confirmation_required" });
    expect(rpcCalls(harness.calls, "soft_delete_list")).toHaveLength(1);
  });

  it("never reaches another account (no existence leak) nor a system collection", async () => {
    const harness = createHarness();
    await expect(previewListDeletion(harness.db, { list_id: LIST_B }, KEY)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(previewListDeletion(harness.db, { list_id: LIST_A_SYSTEM }, KEY)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(previewListDeletion(harness.db, { list_id: LIST_A_DELETED }, KEY)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("translates an RLS denial into a controlled forbidden error", async () => {
    const harness = createHarness(undefined, { deny: { lists: { code: "42501", message: "denied" } } });
    await expect(previewListDeletion(harness.db, { list_id: LIST_A }, KEY)).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});

describe("preview/confirm folder deletion", () => {
  it("reports the cascade and soft deletes folder, lists and cards", async () => {
    const harness = createHarness();
    const preview = await previewFolderDeletion(harness.db, { folder_id: FOLDER_A }, KEY);

    expect(preview).toMatchObject({ list_count: 2, card_count: 3, retention_days: 7 });
    expect(preview.target).toMatchObject({ type: "folder", id: FOLDER_A, title: "Inglês B1", scope: "personal" });

    const confirmed = await confirmFolderDeletion(
      harness.db,
      { folder_id: FOLDER_A, confirmation_token: preview.confirmation_token },
      KEY,
    );
    expect(confirmed).toMatchObject({ deleted: true, lists_removed: 2, cards_removed: 3 });
    expect(harness.fake.tables.folders.find((row) => row.id === FOLDER_A)?.deleted_at).toBeTruthy();
    expect(harness.fake.tables.lists.find((row) => row.id === LIST_A_SECOND)?.deleted_at).toBeTruthy();
    expect(harness.fake.tables.flashcards.find((row) => row.id === CARD_A_2)?.deleted_at).toBeTruthy();
    expect(rpcCalls(harness.calls, "soft_delete_folder")[0]?.rpcParams).toEqual({
      p_folder_id: FOLDER_A,
      p_user_id: USER_A,
    });
  });

  it("refuses a foreign folder and requires confirmation", async () => {
    const harness = createHarness();
    await expect(previewFolderDeletion(harness.db, { folder_id: FOLDER_B }, KEY)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(
      confirmFolderDeletion(harness.db, { folder_id: FOLDER_A }, KEY),
    ).rejects.toMatchObject({ code: "confirmation_required" });
  });
});

describe("restore_from_trash", () => {
  it("restores a trashed list with its cards and is idempotent when already active", async () => {
    const harness = createHarness();
    const preview = await previewListDeletion(harness.db, { list_id: LIST_A }, KEY);
    await confirmListDeletion(harness.db, { list_id: LIST_A, confirmation_token: preview.confirmation_token }, KEY);

    const restored = await restoreFromTrash(harness.db, { target: "list", id: LIST_A });
    expect(restored).toMatchObject({ restored: true, target: "list", id: LIST_A });
    expect(harness.fake.tables.lists.find((row) => row.id === LIST_A)?.deleted_at).toBeNull();
    expect(harness.fake.tables.flashcards.find((row) => row.id === CARD_A_1)?.deleted_at).toBeNull();

    const again = await restoreFromTrash(harness.db, { target: "list", id: LIST_A });
    expect(again).toMatchObject({ restored: false, already_active: true });
  });

  it("restores a trashed folder cascade and refuses unknown targets", async () => {
    const harness = createHarness();
    const preview = await previewFolderDeletion(harness.db, { folder_id: FOLDER_A }, KEY);
    await confirmFolderDeletion(harness.db, { folder_id: FOLDER_A, confirmation_token: preview.confirmation_token }, KEY);

    const restored = await restoreFromTrash(harness.db, { target: "folder", id: FOLDER_A });
    expect(restored).toMatchObject({ restored: true, target: "folder" });
    expect(harness.fake.tables.folders.find((row) => row.id === FOLDER_A)?.deleted_at).toBeNull();
    expect(harness.fake.tables.flashcards.find((row) => row.id === CARD_A_3)?.deleted_at).toBeNull();

    await expect(restoreFromTrash(harness.db, { target: "list", id: LIST_B })).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(restoreFromTrash(harness.db, { target: "card", id: LIST_A })).rejects.toMatchObject({
      code: "invalid_input",
    });
  });
});
