import { describe, expect, it } from "vitest";
import { buildFolderGlossaryAiPrompt } from "./lib/folderGlossaryPrompt";

const decode = (value: string) => new TextDecoder().decode(
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0)),
);

describe("folder glossary AI prompt", () => {
  it("describes the canonical JSON contract and the current folder sides", () => {
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
});
