import { describe, expect, it } from "vitest";
import { sortListsWithFavoritesFirst } from "./listMarkers";

const lists = [
  { id: "3", title: "Lista 10" },
  { id: "1", title: "Lista 2" },
  { id: "2", title: "Lista 1" },
];

describe("list markers", () => {
  it("keeps every favorite above non-favorites", () => {
    const sorted = sortListsWithFavoritesFirst(lists, ["3"]);
    expect(sorted.map((list) => list.id)).toEqual(["3", "2", "1"]);
  });

  it("preserves natural title ordering inside each group", () => {
    const sorted = sortListsWithFavoritesFirst(lists, ["1", "3"]);
    expect(sorted.map((list) => list.title)).toEqual(["Lista 2", "Lista 10", "Lista 1"]);
  });

  it("does not mutate the original list array", () => {
    const original = [...lists];
    sortListsWithFavoritesFirst(lists, ["2"]);
    expect(lists).toEqual(original);
  });
});
