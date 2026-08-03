import { describe, expect, it } from "vitest";
import { createMasterySession } from "./studySessionFlow";
import { buildStudyQueue } from "./studyQueue";
import { filterCardsForStudyScope } from "./studyScopePolicy";
import { buildStudySessionScopeKey } from "./studySessionContext";

const cards = [
  { id: "c1" },
  { id: "c2" },
  // Grupo em camadas: identidade canônica no parent, id jogável na camada 1.
  { id: "layer-1", parent_card_id: "group-a", __layers: [{ id: "layer-1", parent_card_id: "group-a" }] },
];
const favorites = ["c2", "group-a"];

describe("favorites scope harmony across formats", () => {
  const scoped = filterCardsForStudyScope({
    cards,
    favoriteIds: favorites,
    redListIds: [],
    settings: { subset: "favorites" },
  });

  it("keeps layered favorites eligible through the canonical identity", () => {
    expect(scoped.map((card) => card.id)).toEqual(["c2", "layer-1"]);
  });

  it("mastery (gamificado) only enqueues favorites in every internal queue", () => {
    const session = createMasterySession(scoped.map((card) => card.id), { shuffle: false });
    const allowed = new Set(["c2", "layer-1"]);
    expect(session.totalEligible).toBe(2);
    for (const ids of [session.currentRoundIds, session.unseenIds, session.retryIds, session.masteredIds]) {
      expect(ids.every((id) => allowed.has(id))).toBe(true);
    }
  });

  it("extenso (continuous) only enqueues favorites", () => {
    const { queue, scope } = buildStudyQueue({
      cards,
      favoriteIds: favorites,
      redListIds: [],
      settings: { subset: "favorites", mode: "sequential" },
    });
    expect(scope).toBe("favorites");
    expect(queue).toEqual(["c2", "layer-1"]);
  });

  it("isolates every deck x format combination in the session identity", () => {
    const keys = new Set([
      buildStudySessionScopeKey({ mode: "mixed", subset: "all", studyFlowMode: "mastery_rounds" }),
      buildStudySessionScopeKey({ mode: "mixed", subset: "all", studyFlowMode: "continuous" }),
      buildStudySessionScopeKey({ mode: "mixed", subset: "favorites", studyFlowMode: "mastery_rounds" }),
      buildStudySessionScopeKey({ mode: "mixed", subset: "favorites", studyFlowMode: "continuous" }),
    ]);
    expect(keys.size).toBe(4);
  });
});
