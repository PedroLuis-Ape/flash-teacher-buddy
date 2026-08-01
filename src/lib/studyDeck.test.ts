import { describe, expect, it } from "vitest";
import { prepareLayeredStudyDeck } from "./studyDeck";

describe("prepareLayeredStudyDeck stable identity", () => {
  it("preserves status_group_uid on the playable entry and its layers", () => {
    const deck = prepareLayeredStudyDeck([
      { id: "parent", term: "Title", parent_card_id: null, status_group_uid: "group" },
      { id: "layer-2", term: "Second", parent_card_id: "parent", status_group_uid: "group", layer_index: 2 },
      { id: "layer-1", term: "First", parent_card_id: "parent", status_group_uid: "group", layer_index: 1 },
    ]);

    expect(deck).toHaveLength(1);
    expect(deck[0].id).toBe("layer-1");
    expect((deck[0] as any).__statusGroupUid).toBe("group");
    expect((deck[0] as any).__layers.map((layer: any) => layer.id)).toEqual(["layer-1", "layer-2"]);
  });

  it("uses stable identity as the group key when a legacy parent changes", () => {
    const deck = prepareLayeredStudyDeck([
      { id: "layer-a", term: "A", parent_card_id: "old-parent", status_group_uid: "group", layer_index: 1 },
      { id: "layer-b", term: "B", parent_card_id: "new-parent", status_group_uid: "group", layer_index: 2 },
    ]);

    expect(deck).toHaveLength(1);
    expect((deck[0] as any).__statusGroupUid).toBe("group");
    expect((deck[0] as any).__layers.map((layer: any) => layer.id)).toEqual(["layer-a", "layer-b"]);
  });
});
