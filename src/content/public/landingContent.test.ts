import { describe, expect, it } from "vitest";
import { landingContent, landingFaqSchema } from "./landingContent";

describe("landing authority content", () => {
  it("keeps identity, authorship and the six-step flow in one source", () => {
    expect(landingContent.h1).toContain("APE — App Piteco");
    expect(landingContent.intro).toContain("Apprentice Practice & Enhancement");
    expect(landingContent.author.name).toBe("Pedro Luis de Oliveira Silva");
    expect(landingContent.steps).toHaveLength(6);
  });

  it("keeps visible FAQ content and structured data identical", () => {
    expect(landingFaqSchema.mainEntity).toHaveLength(landingContent.faqs.length);
    landingContent.faqs.forEach((faq, index) => {
      expect(landingFaqSchema.mainEntity[index]).toMatchObject({
        name: faq.question,
        acceptedAnswer: { text: faq.answer },
      });
    });
  });

  it("documents the evidence boundary and all three demo formats", () => {
    expect(landingContent.methodology.text).toContain("não significa garantia");
    expect(landingContent.demo.items.map((item) => item.id)).toEqual(["normal", "glossary", "layers"]);
  });
});
