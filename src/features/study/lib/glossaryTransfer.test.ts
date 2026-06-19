import { describe, expect, it } from "vitest";
import {
  glossaryEntryIdentity,
  isGlossaryOverlap,
  parseGlossaryTransfer,
  serializeGlossaryTransfer,
  type GlossaryTransferEntry,
} from "./glossaryTransfer";

const entries: GlossaryTransferEntry[] = [
  { original_text: "because", translated_text: "porque", note: null, side: "A", is_active: true },
  { original_text: "of", translated_text: "de", note: null, side: "A", is_active: true },
  { original_text: "because of", translated_text: "por causa de", note: "expressão", side: "A", is_active: true },
  { original_text: "por causa de", translated_text: "because of", note: null, side: "B", is_active: false },
];

describe("glossary transfer", () => {
  it("parses simple additive glossary lines without collapsing expressions", () => {
    const parsed = parseGlossaryTransfer(`=== GLOSSÁRIO GLOBAL ===
because / porque
of / de
because of / por causa de
=== CARDS ===`);

    expect(parsed.errors).toEqual([]);
    expect(parsed.entries.map((entry) => entry.original_text)).toEqual(["because", "of", "because of"]);
  });

  it("parses side, active state and note metadata inside the glossary section", () => {
    const parsed = parseGlossaryTransfer(`=== GLOSSÁRIO GLOBAL ===
[B][OFF] por causa de / because of || expressão causal
=== CARDS ===`);
    expect(parsed.entries[0]).toEqual({
      original_text: "por causa de",
      translated_text: "because of",
      note: "expressão causal",
      side: "B",
      is_active: false,
    });
  });

  it("round-trips losslessly through JSON", () => {
    const json = serializeGlossaryTransfer(entries, "json");
    const parsed = parseGlossaryTransfer(json);
    expect(parsed.errors).toEqual([]);
    expect(parsed.entries).toEqual(entries);
  });

  it("exports active entries in Super Importer compatible text", () => {
    const text = serializeGlossaryTransfer(entries, "text");
    expect(text).toContain("because / porque");
    expect(text).toContain("because of / por causa de");
    expect(text).not.toContain("[OFF]");
    expect(text).toContain("=== CARDS ===");
  });

  it("uses exact entry identity so shorter and longer terms coexist", () => {
    expect(glossaryEntryIdentity(entries[0])).not.toBe(glossaryEntryIdentity(entries[2]));
  });

  it("detects related overlapping terms on the same side", () => {
    expect(isGlossaryOverlap(entries[0], entries[2])).toBe(true);
    expect(isGlossaryOverlap(entries[1], entries[2])).toBe(true);
    expect(isGlossaryOverlap(entries[2], entries[3])).toBe(false);
  });
});
