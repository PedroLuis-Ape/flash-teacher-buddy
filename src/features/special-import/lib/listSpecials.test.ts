import { describe, expect, it } from "vitest";
import { buildListSpecialPlan, chunkArray } from "./listSpecials";

describe("buildListSpecialPlan", () => {
  it("includes standalone cards and every layer while excluding the aggregator", () => {
    const plan = buildListSpecialPlan([
      { id: "standalone-1" },
      { id: "principal" },
      { id: "layer-1", parent_card_id: "principal" },
      { id: "layer-2", parent_card_id: "principal" },
      { id: "standalone-2" },
    ]);

    expect(plan.eligibleIds).toEqual([
      "standalone-1",
      "layer-1",
      "layer-2",
      "standalone-2",
    ]);
    expect(plan.eligibleCount).toBe(4);
    expect(plan.standaloneCount).toBe(2);
    expect(plan.layerCount).toBe(2);
    expect(plan.aggregatorCount).toBe(1);
  });

  it("ignores deleted rows and duplicate ids", () => {
    const plan = buildListSpecialPlan([
      { id: "card-1" },
      { id: "card-1" },
      { id: "card-2", deleted_at: "2026-07-02T00:00:00Z" },
      { id: "layer", parent_card_id: "missing-principal" },
    ]);

    expect(plan.eligibleIds).toEqual(["card-1", "layer"]);
    expect(plan.eligibleCount).toBe(2);
    expect(plan.standaloneCount).toBe(1);
    expect(plan.layerCount).toBe(1);
  });

  it("returns an empty plan for an empty list", () => {
    expect(buildListSpecialPlan([])).toEqual({
      eligibleIds: [],
      eligibleCount: 0,
      standaloneCount: 0,
      layerCount: 0,
      aggregatorCount: 0,
    });
  });
});

describe("chunkArray", () => {
  it("splits large writes into stable blocks", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
