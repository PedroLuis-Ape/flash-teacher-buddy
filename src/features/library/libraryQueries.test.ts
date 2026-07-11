import { describe, expect, it } from "vitest";
import {
  insertFolderIntoSnapshot,
  libraryKeys,
  normalizeLibrarySnapshot,
  removeFoldersFromSnapshot,
  type LibraryFolder,
  type LibrarySnapshot,
} from "./libraryQueries";

describe("library query keys", () => {
  it("isolates cache by user and institution", () => {
    expect(libraryKeys.snapshot("user-1", null)).not.toEqual(
      libraryKeys.snapshot("user-1", "institution-1"),
    );
    expect(libraryKeys.snapshot("user-1", null)).not.toEqual(
      libraryKeys.snapshot("user-2", null),
    );
  });
});

describe("library snapshot helpers", () => {
  it("derives folder and list counts", () => {
    const snapshot = normalizeLibrarySnapshot({
      folders: [{
        id: "folder-1",
        title: "English",
        description: null,
        visibility: "private",
        owner_id: "user-1",
        lists: [
          { id: "list-1", deleted_at: null },
          { id: "list-deleted", deleted_at: "2026-01-01" },
        ],
      }],
      lists: [{
        id: "list-1",
        title: "Verbs",
        description: null,
        folder_id: "folder-1",
        folders: { title: "English" },
      }],
      cardCounts: [{ list_id: "list-1", card_count: "25" }],
    });

    expect(snapshot.folders[0]).toMatchObject({ list_count: 1, card_count: 25 });
    expect(snapshot.lists[0]).toMatchObject({ folder_title: "English", card_count: 25 });
  });

  it("removes a folder and its lists from cached data", () => {
    const snapshot: LibrarySnapshot = {
      folders: [
        { id: "a", title: "A", description: null, visibility: "private", owner_id: "u", list_count: 1, card_count: 2, isOwner: true },
        { id: "b", title: "B", description: null, visibility: "private", owner_id: "u", list_count: 0, card_count: 0, isOwner: true },
      ],
      lists: [{ id: "l", title: "L", description: null, folder_id: "a", folder_title: "A", card_count: 2 }],
    };

    expect(removeFoldersFromSnapshot(snapshot, new Set(["a"]))).toEqual({
      folders: [snapshot.folders[1]],
      lists: [],
    });
  });

  it("inserts a created folder at the start without duplicates", () => {
    const folder: LibraryFolder = {
      id: "folder-1",
      title: "English",
      description: null,
      visibility: "private",
      owner_id: "user-1",
      list_count: 0,
      card_count: 0,
      isOwner: true,
    };

    const first = insertFolderIntoSnapshot(undefined, folder);
    const second = insertFolderIntoSnapshot(first, folder);
    expect(second.folders).toEqual([folder]);
  });
});
