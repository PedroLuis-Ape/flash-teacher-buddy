import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { mergeGlossaryAndManual } from "./glossaryMerge";
import { buildLayeredTextSegments, definitionsFromMergedHints } from "./glossaryLayers";
import { discoverExpressionCandidates } from "./glossaryExpressions";
import { entriesFromCards } from "./folderGlossarySyncApi";
import { mapCardContent } from "@/features/export/folderExport";
import { wordHintToLegacy } from "@/features/smart-import/adapters";
import { smartNormalCardSchema } from "@/features/smart-import/schema";

describe("contextual glossary preservation", () => {
  it("keeps work out senses distinct through the actual backup adapters and sync", () => {
    for (const [term, translation, meaning] of [
      ["The plan worked out.", "O plano deu certo.", "deu certo"],
      ["I worked out yesterday.", "Eu malhei ontem.", "malhei"],
    ]) {
      const row = { id: term, list_id: "list", term, translation, word_hints: [{
        text: "worked out", translation: meaning, side: "A", scope: "contextual",
        kind: "expression", expression: "work out", startIndex: term.indexOf("worked"), endIndex: term.indexOf("worked") + 10,
      }] };
      const exported = smartNormalCardSchema.parse({ type: "normal", ...JSON.parse(JSON.stringify(mapCardContent(row))) });
      const hints = exported.word_hints!.map(wordHintToLegacy);
      expect(hints).toEqual(expect.arrayContaining([expect.objectContaining(row.word_hints[0])]));
      const restored = { ...row, word_hints: hints };
      expect(entriesFromCards([restored], false)).toEqual([]);
      const resolved = mergeGlossaryAndManual(restored.term, "A", [], hints);
      expect(resolved[0].translations[0].text).toBe(meaning);
    }
  });

  it("keeps separate indexed senses of the same word", () => {
    const text = "bank bank";
    const merged = mergeGlossaryAndManual(text, "A", [], [
      { text: "bank", translation: "banco", startIndex: 0, endIndex: 4 },
      { text: "bank", translation: "margem", startIndex: 5, endIndex: 9 },
    ]);
    const words = buildLayeredTextSegments(text, definitionsFromMergedHints(merged)).filter(s => s.matches.length);
    expect(words.map(s => s.matches[0].translations[0].text)).toEqual(["banco", "margem"]);
  });

  it("binds only verb and particle in a discontinuous expression", () => {
    const merged = mergeGlossaryAndManual("Turn the light off.", "A", [], [{
      text: "turn off", translation: "desligar", kind: "expression", expression: "turn off",
      segments: [{ text: "Turn", startIndex: 0, endIndex: 4 }, { text: "off", startIndex: 15, endIndex: 18 }],
    }]);
    const segments = buildLayeredTextSegments("Turn the light off.", definitionsFromMergedHints(merged));
    expect(segments.filter(s => s.matches.length).map(s => s.value)).toEqual(["Turn", "off"]);
  });

  it.each([
    ["The plan worked out.", "work out"], ["Can you work it out?", "work out"],
    ["She gave up smoking.", "give up"], ["Turn off the light.", "turn off"],
    ["Turn the light off.", "turn off"], ["I ran into an old friend.", "run into"],
    ["Look after the children.", "look after"], ["The plane took off.", "take off"],
  ])("finds a pending candidate in %s, without assigning meaning", (text, expression) => {
    expect(discoverExpressionCandidates(text)).toContainEqual(expect.objectContaining({ expression, status: "pending_review" }));
  });

  it("does not confuse workout, arbitrary bigrams or different sentences", () => {
    expect(discoverExpressionCandidates("My workout. The green car. Turn around. Off we go.")).toEqual([]);
  });

  it("preserves whitespace in backup and does not promote legacy hints", () => {
    const card = { id: "card", list_id: "list", term: "  bank\n bank  ", translation: " banco e margem ", word_hints: [
      { text: "bank", translation: "margem", startIndex: 8, endIndex: 12 },
    ] };
    const result = smartNormalCardSchema.parse({ type: "normal", ...mapCardContent(card) });
    expect(result.front).toBe(card.term);
    expect(result.word_hints![0].start_index).toBe(8);
    expect(entriesFromCards([card], false)).toEqual([]);
  });
});
