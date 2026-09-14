import { describe, expect, it } from "vitest";
import {
  FOLDERS_LOCAL_ORDER_KEY,
  FOLDERS_VIEW_MODE_KEY,
  LISTS_LOCAL_ORDER_KEY,
  LISTS_VIEW_MODE_KEY,
  moveResourceWithinFavoriteGroups,
  persistFolderOrder,
  persistListOrder,
  persistViewMode,
  readFolderOrder,
  readListOrder,
  readViewMode,
  sortListsWithLocalOrder,
  sortFoldersWithLocalOrder,
} from "./viewPreferences";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("library view preferences", () => {
  it("reads valid view modes and falls back for unknown values", () => {
    const storage = createStorage();
    storage.setItem(LISTS_VIEW_MODE_KEY, "grid");
    storage.setItem(FOLDERS_VIEW_MODE_KEY, "invalid");

    expect(readViewMode(storage, LISTS_VIEW_MODE_KEY, "list")).toBe("grid");
    expect(readViewMode(storage, FOLDERS_VIEW_MODE_KEY, "grid")).toBe("grid");
  });

  it("persists the selected view mode in the requested device key", () => {
    const storage = createStorage();

    persistViewMode(storage, LISTS_VIEW_MODE_KEY, "grid");

    expect(storage.getItem(LISTS_VIEW_MODE_KEY)).toBe("grid");
    expect(storage.getItem(FOLDERS_VIEW_MODE_KEY)).toBeNull();
  });

  it("applies local folder order before putting favorites first", () => {
    const folders = [
      { id: "alpha", title: "Alpha" },
      { id: "bravo", title: "Bravo" },
      { id: "charlie", title: "Charlie" },
    ];

    const sorted = sortFoldersWithLocalOrder(folders, ["charlie"], ["bravo", "charlie", "alpha"]);

    expect(sorted.map((folder) => folder.id)).toEqual(["charlie", "bravo", "alpha"]);
  });

  it("keeps the existing natural ordering when no local order is saved", () => {
    const folders = [
      { id: "zulu", title: "Zulu" },
      { id: "alpha", title: "Alpha" },
    ];

    const sorted = sortFoldersWithLocalOrder(folders, [], []);

    expect(sorted.map((folder) => folder.id)).toEqual(["alpha", "zulu"]);
  });

  it("keeps the local order key available as a device-only contract", () => {
    const storage = createStorage();
    persistFolderOrder(storage, ["bravo", "alpha", "bravo"]);

    expect(FOLDERS_LOCAL_ORDER_KEY).toBe("piteco.folders.localOrder");
    expect(readFolderOrder(storage)).toEqual(["bravo", "alpha"]);
  });

  it("keeps folder order isolated by user and institution context", () => {
    const storage = createStorage();

    persistFolderOrder(storage, ["folder-a"], "user-a:general");
    persistFolderOrder(storage, ["folder-b"], "user-b:general");

    expect(readFolderOrder(storage, "user-a:general")).toEqual(["folder-a"]);
    expect(readFolderOrder(storage, "user-b:general")).toEqual(["folder-b"]);
  });

  it("persists list order per folder and applies it before favorites", () => {
    const storage = createStorage();
    persistListOrder(storage, "folder-1", ["list-b", "list-a", "list-b"]);

    const lists = [
      { id: "list-a", title: "Alpha" },
      { id: "list-b", title: "Bravo" },
      { id: "list-c", title: "Charlie" },
    ];

    expect(LISTS_LOCAL_ORDER_KEY).toBe("piteco.lists.localOrder");
    expect(readListOrder(storage, "folder-1")).toEqual(["list-b", "list-a"]);
    expect(sortListsWithLocalOrder(lists, ["list-c"], readListOrder(storage, "folder-1")).map((list) => list.id))
      .toEqual(["list-c", "list-b", "list-a"]);
  });

  it("moves a folder only within its favorite or non-favorite group", () => {
    const folders = [
      { id: "favorite-a", title: "Favorite A" },
      { id: "favorite-b", title: "Favorite B" },
      { id: "regular-a", title: "Regular A" },
      { id: "regular-b", title: "Regular B" },
    ];

    const moved = moveResourceWithinFavoriteGroups(
      folders,
      ["favorite-a", "favorite-b"],
      ["favorite-a", "favorite-b", "regular-a", "regular-b"],
      "regular-b",
      -1,
    );

    expect(moved).toEqual(["favorite-a", "favorite-b", "regular-b", "regular-a"]);
  });
});
