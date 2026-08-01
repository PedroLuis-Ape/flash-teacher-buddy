import { describe, expect, it } from "vitest";
import { getFolderListGamesPath } from "./folderNavigation";

describe("getFolderListGamesPath", () => {
  it("keeps public folders inside the portal scope", () => {
    expect(getFolderListGamesPath("list-123", true)).toBe("/portal/list/list-123/games");
  });

  it("keeps private folders inside the private scope", () => {
    expect(getFolderListGamesPath("list-123", false)).toBe("/list/list-123/games");
  });
});
