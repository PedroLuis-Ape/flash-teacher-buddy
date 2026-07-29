import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settingsSource = readFileSync(
  new URL("./GameSettingsModal.impl.tsx", import.meta.url),
  "utf8",
);

describe("game settings session format", () => {
  it("shows the flow selector in every playable mode except flip", () => {
    expect(settingsSource).toContain(
      'const supportsFlowModes = Boolean(urlMode) && urlMode !== "flip"',
    );
    expect(settingsSource).toContain('title="Formato da sessão"');
  });

  it("uses clear mobile-facing labels for both session formats", () => {
    expect(settingsSource).toContain("Modo gamificado");
    expect(settingsSource).toContain("Modo extenso");
    expect(settingsSource).toContain("Percorra todos os cards uma vez, do início ao fim");
  });
});
