import { describe, expect, it } from "vitest";
import { buildFolderGlossaryAiPrompt } from "./lib/folderGlossaryPrompt";
import { buildCompleteAccountGlossaryContract } from "./lib/glossaryPromptContracts";

const decode = (value: string) => new TextDecoder().decode(
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0)),
);

describe("glossary AI contracts", () => {
  it("describes the canonical folder contract and the current sides", () => {
    const prompt = buildFolderGlossaryAiPrompt({
      folderTitle: "Verbo To Be",
      labelA: "Inglês",
      labelB: "Português",
    });

    [
      "InNjaGVtYSI6ICJhcHAtcGl0ZWNvLWZvbGRlci1nbG9zc2FyeSI=",
      "InZlcnNpb24iOiAiMS4wIg==",
      "Im5hbWUiOiAiVmVyYm8gVG8gQmUi",
      "TGFkbyBBOiAiSW5nbMOqcyI=",
      "TGFkbyBCOiAiUG9ydHVndcOqcyI=",
      "SlNPTiBwdXJvIGUgdsOhbGlkbw==",
      "bsOjbyByZXBpdGEgbyBtZXNtbyB0ZXJtIGRlbnRybyBkbyBtZXNtbyBzaWRl",
      "ImVudHJpZXMi",
    ].forEach((expected) => expect(prompt).toContain(decode(expected)));
  });

  it("uses safe labels when folder metadata is blank", () => {
    const prompt = buildFolderGlossaryAiPrompt({
      folderTitle: " ",
      labelA: "",
      labelB: " ",
    });

    [
      "Im5hbWUiOiAiUGFzdGEgc2VtIG5vbWUi",
      "TGFkbyBBOiAiTGFkbyBBIg==",
      "TGFkbyBCOiAiTGFkbyBCIg==",
    ].forEach((expected) => expect(prompt).toContain(decode(expected)));
  });

  it("decodes the complete account contract in every direction", () => {
    for (const side of ["A", "B", "both"] as const) {
      const prompt = buildCompleteAccountGlossaryContract(side);
      expect(prompt.length).toBeGreaterThan(1000);
      [
        "InNjaGVtYSI6ICJhcHAtcGl0ZWNvLWdsb3NzYXJ5Ig==",
        "InZlcnNpb24iOiAy",
        "b3JpZ2luYWxfdGV4dA==",
        "dHJhbnNsYXRlZF90ZXh0",
        "aXNfYWN0aXZl",
      ].forEach((expected) => expect(prompt).toContain(decode(expected)));
    }
  });
});
