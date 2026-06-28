import { describe, expect, it } from "vitest";
import { sortListsWithFavoritesFirst, sortResourcesWithFavoritesFirst } from "./listMarkers";

const lists = [
  { id: "3", title: "Lista 10" },
  { id: "1", title: "Lista 2" },
  { id: "2", title: "Lista 1" },
];

describe("resource markers", () => {
  it("keeps every favorite list above non-favorites", () => {
    const sorted = sortListsWithFavoritesFirst(lists, ["3"]);
    expect(sorted.map((list) => list.id)).toEqual(["3", "2", "1"]);
  });

  it("keeps every favorite folder above non-favorites", () => {
    const folders = [
      { id: "basic", title: "Básico" },
      { id: "advanced", title: "Avançado" },
      { id: "travel", title: "Viagem" },
    ];
    const sorted = sortResourcesWithFavoritesFirst(folders, ["travel"]);
    expect(sorted.map((folder) => folder.id)).toEqual(["travel", "advanced", "basic"]);
  });

  it("preserves natural title ordering inside each group", () => {
    const sorted = sortListsWithFavoritesFirst(lists, ["1", "3"]);
    expect(sorted.map((list) => list.title)).toEqual(["Lista 2", "Lista 10", "Lista 1"]);
  });

  it("does not mutate the original array", () => {
    const original = [...lists];
    sortListsWithFavoritesFirst(lists, ["2"]);
    expect(lists).toEqual(original);
  });
});
