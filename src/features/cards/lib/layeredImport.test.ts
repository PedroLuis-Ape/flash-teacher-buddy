import { describe, it, expect } from "vitest";
import { parseLayeredInput, suggestMainTitle } from "./layeredImport";

describe("parseLayeredInput — Format A (header + indented)", () => {
  it("parses a single header with three layers", () => {
    const input = [
      "get",
      "  pegar / conseguir | I got a new phone. | Eu consegui um celular novo.",
      "  entender | I get it. | Eu entendi.",
      "  chegar | I got home late. | Eu cheguei em casa tarde.",
    ].join("\n");
    const { groups } = parseLayeredInput(input);
    expect(groups).toHaveLength(1);
    expect(groups[0].term).toBe("get");
    expect(groups[0].layers).toHaveLength(3);
    expect(groups[0].layers[0]).toMatchObject({
      translation: "pegar / conseguir",
      example: "I got a new phone.",
      exampleTranslation: "Eu consegui um celular novo.",
    });
    expect(groups[0].layers[2].translation).toBe("chegar");
  });

  it("ignores headers with no children", () => {
    const { groups } = parseLayeredInput("get\n");
    expect(groups).toHaveLength(0);
  });
});

describe("parseLayeredInput — Format B (repeated term)", () => {
  it("groups consecutive lines that share term", () => {
    const input = [
      "get | pegar | I got a phone. | Eu peguei um celular.",
      "get | entender | I get it. | Eu entendi.",
      "go | ir | I go home. | Eu vou pra casa.",
    ].join("\n");
    const { groups, leftover } = parseLayeredInput(input);
    expect(groups).toHaveLength(1);
    expect(groups[0].term).toBe("get");
    expect(groups[0].layers).toHaveLength(2);
    expect(leftover.some((l) => l.includes("go"))).toBe(true);
  });

  it("does not group when only one occurrence", () => {
    const input = "get | pegar | I got it. | Eu peguei.";
    const { groups } = parseLayeredInput(input);
    expect(groups).toHaveLength(0);
  });
});

describe("suggestMainTitle", () => {
  it("returns longest common prefix when meaningful", () => {
    expect(suggestMainTitle(["running", "runner", "runs"])).toBe("run");
  });
  it("falls back to first term when prefix too short", () => {
    expect(suggestMainTitle(["abc", "xyz"])).toBe("abc");
  });
  it("handles single term", () => {
    expect(suggestMainTitle(["hello"])).toBe("hello");
  });
});