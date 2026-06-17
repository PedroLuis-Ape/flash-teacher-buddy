import { describe, expect, it } from "vitest";
import { parseSpecialImportText, reconcileSpecialImport } from "./parser";

const ID = "11111111-1111-4111-8111-111111111111";

describe("special import parser", () => {
  it("accepts legacy arrays", () => {
    const parsed = parseSpecialImportText(JSON.stringify([
      { flashcard_id: ID, detailed_explanation: "Explicação" },
    ]));
    expect(reconcileSpecialImport(parsed, null).rows[0].status).toBe("valid");
  });

  it("repairs trailing commas inside fenced JSON", () => {
    const parsed = parseSpecialImportText(`Texto\n\`\`\`json\n{"items":[{"flashcard_id":"${ID}","explanation":"Ok",}],}\n\`\`\``);
    expect(parsed.repaired).toBe(true);
    expect(parsed.items[0].detailed_explanation).toBe("Ok");
  });

  it("reports truncated output", () => {
    expect(() => parseSpecialImportText('{"items":[{"flashcard_id":"x"'))
      .toThrow(/cortada/i);
  });
});
