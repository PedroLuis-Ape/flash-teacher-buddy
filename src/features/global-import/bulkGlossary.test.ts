import { describe, expect, it } from "vitest";
import { folderListCount, glossaryApplicationsCount } from "./bulkGlossary";

const catalog = {
  folders: [
    { id: "folder-a", title: "A" },
    { id: "folder-b", title: "B" },
    { id: "folder-c", title: "C" },
  ],
  lists: [
    { id: "list-a1", title: "A1", folder_id: "folder-a" },
    { id: "list-a2", title: "A2", folder_id: "folder-a" },
    { id: "list-b1", title: "B1", folder_id: "folder-b" },
  ],
};

describe("bulk glossary selection", () => {
  it("counts every list in selected folders", () => {
    expect(folderListCount(catalog, ["folder-a", "folder-b"])).toBe(3);
    expect(folderListCount(catalog, ["folder-c"])).toBe(0);
  });

  it("stores each glossary entry once", () => {
    expect(glossaryApplicationsCount(35, 14)).toBe(35);
    expect(glossaryApplicationsCount(-1, 14)).toBe(0);
  });
});
