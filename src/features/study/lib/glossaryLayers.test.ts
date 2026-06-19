import { describe, expect, it } from "vitest";
import {
  buildLayeredTextSegments,
  definitionsFromMergedHints,
  findGlossaryOccurrences,
  type LayeredHintDefinition,
} from "./glossaryLayers";

const definition = (text: string, translation: string): LayeredHintDefinition => ({
  key: `${text}:${translation}`,
  text,
  translations: [{ text: translation, source: "global" }],
});

describe("findGlossaryOccurrences", () => {
  it("matches expressions with flexible whitespace and case", () => {
    expect(findGlossaryOccurrences("BECAUSE   OF the rain", "because of")).toEqual([
      { startIndex: 0, endIndex: 12 },
    ]);
  });

  it("does not match a term inside another word", () => {
    expect(findGlossaryOccurrences("the other one", "he")).toEqual([]);
  });

  it("finds repeated expressions", () => {
    expect(findGlossaryOccurrences("because of rain and because of wind", "because of")).toHaveLength(2);
  });
});

describe("buildLayeredTextSegments", () => {
  it("keeps because, of and because of as simultaneous layers", () => {
    const segments = buildLayeredTextSegments("because of the rain", [
      definition("because", "porque"),
      definition("of", "de"),
      definition("because of", "por causa de"),
    ]);

    const because = segments.find((segment) => segment.value === "because");
    const of = segments.find((segment) => segment.value === "of");

    expect(because?.matches.map((match) => match.text)).toEqual(["because of", "because"]);
    expect(of?.matches.map((match) => match.text)).toEqual(["because of", "of"]);
  });

  it("adds a longer expression without deleting existing word layers", () => {
    const base = [definition("because", "porque"), definition("of", "de")];
    const before = buildLayeredTextSegments("because of", base);
    const after = buildLayeredTextSegments("because of", [...base, definition("because of", "por causa de")]);

    expect(before.find((segment) => segment.value === "because")?.matches).toHaveLength(1);
    expect(after.find((segment) => segment.value === "because")?.matches).toHaveLength(2);
    expect(after.find((segment) => segment.value === "of")?.matches).toHaveLength(2);
  });

  it("lets every word in a phrase open the phrase when only the phrase exists", () => {
    const segments = buildLayeredTextSegments("because of", [definition("because of", "por causa de")]);
    expect(segments.find((segment) => segment.value === "because")?.matches[0].text).toBe("because of");
    expect(segments.find((segment) => segment.value === "of")?.matches[0].text).toBe("because of");
  });

  it("preserves multiple translations merged under the same term", () => {
    const definitions = definitionsFromMergedHints([
      {
        text: "because",
        translations: [
          { text: "porque", source: "global" },
          { text: "já que", source: "manual" },
        ],
      },
    ]);
    const segment = buildLayeredTextSegments("because", definitions)[0];
    expect(segment.matches[0].translations.map((translation) => translation.text)).toEqual(["porque", "já que"]);
  });
});
