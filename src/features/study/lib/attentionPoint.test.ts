import { describe, expect, it } from "vitest";
import {
  ATTENTION_POINT_TAGS,
  specialTagToAttentionTag,
  suggestAttentionToken,
  tokenizeAttentionText,
} from "./attentionPoint";

describe("attention point tokenization", () => {
  it("keeps punctuation for display while exposing a clean focus value", () => {
    expect(tokenizeAttentionText("It was strange, indeed.")).toEqual([
      { index: 0, raw: "It", value: "It" },
      { index: 1, raw: "was", value: "was" },
      { index: 2, raw: "strange,", value: "strange" },
      { index: 3, raw: "indeed.", value: "indeed" },
    ]);
  });

  it("suggests the only expected token that differs", () => {
    expect(suggestAttentionToken("It was such a strange message.", "It was such a strang message.")).toBe(4);
  });

  it("does not guess when token count or differences are ambiguous", () => {
    expect(suggestAttentionToken("It was such a strange message.", "It was strange message.")).toBeNull();
    expect(suggestAttentionToken("I use a strange phrase.", "I use an odd phrase.")).toBeNull();
  });

  it("maps only unsupported presentation labels to the existing other tag", () => {
    expect(ATTENTION_POINT_TAGS.map((tag) => tag.label)).toEqual([
      "Ortografia",
      "Não lembro",
      "Vocabulário",
      "Uso",
      "Outro",
    ]);
    expect(specialTagToAttentionTag("vocabulary")).toBe("vocabulary");
    expect(specialTagToAttentionTag("natural_usage")).toBe("usage");
    expect(specialTagToAttentionTag("grammar")).toBe("other");
  });
});

