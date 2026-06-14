/**
 * Phase 7 — groupPlayableMap pure tests.
 */
import { describe, it, expect } from "vitest";
import { buildGroupPlayableMap, playableEntryFor } from "../groupPlayableMap";

describe("buildGroupPlayableMap", () => {
  it("maps a non-layered card to itself", () => {
    const map = buildGroupPlayableMap([
      { id: "c1", status_group_uid: "c1" },
    ]);
    expect(map.byGroup.get("c1")).toBe("c1");
    expect(playableEntryFor(map, "c1")).toBe("c1");
  });

  it("uses layer_index=0 as the entry point of a layered group", () => {
    const map = buildGroupPlayableMap([
      { id: "L2", status_group_uid: "G", parent_card_id: "P", layer_index: 1 },
      { id: "L1", status_group_uid: "G", parent_card_id: "P", layer_index: 0 },
      { id: "L3", status_group_uid: "G", parent_card_id: "P", layer_index: 2 },
    ]);
    expect(map.byGroup.get("G")).toBe("L1");
    expect(playableEntryFor(map, "L2")).toBe("L1");
    expect(playableEntryFor(map, "L3")).toBe("L1");
  });

  it("falls back to smallest id when no layer_index=0 is present", () => {
    const map = buildGroupPlayableMap([
      { id: "b", status_group_uid: "G" },
      { id: "a", status_group_uid: "G" },
      { id: "c", status_group_uid: "G" },
    ]);
    expect(map.byGroup.get("G")).toBe("a");
  });

  it("groups by parent_card_id when status_group_uid is missing (v1 snapshot)", () => {
    const map = buildGroupPlayableMap([
      { id: "x1", parent_card_id: "P" },
      { id: "x2", parent_card_id: "P" },
    ]);
    expect(map.byGroup.get("P")).toBe("x1");
    expect(playableEntryFor(map, "x2")).toBe("x1");
  });

  it("never persists state across calls (pure)", () => {
    const a = buildGroupPlayableMap([{ id: "c", status_group_uid: "c" }]);
    const b = buildGroupPlayableMap([{ id: "d", status_group_uid: "d" }]);
    expect(a.byCard.has("d")).toBe(false);
    expect(b.byCard.has("c")).toBe(false);
  });
});