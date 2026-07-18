import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const gate = read("src/components/layout/MobilePortraitOnlyGate.tsx");
const layout = read("src/components/layout/GlobalLayout.tsx");

describe("mobile portrait fallback", () => {
  it("blocks handheld landscape sessions even when the browser ignores orientation lock", () => {
    expect(gate).toContain("(orientation: landscape)");
    expect(gate).toContain("(max-height: 600px)");
    expect(gate).toContain("(pointer: coarse)");
    expect(gate).toContain("Mantenha o celular na vertical");
    expect(gate).toContain('document.body.style.overflow = "hidden"');
  });

  it("retries portrait lock from an explicit user gesture", () => {
    expect(gate).toContain("requestFullscreen");
    expect(gate).toContain('lock?.("portrait-primary")');
    expect(gate).toContain("Tentar voltar ao modo vertical");
  });

  it("covers both regular and mixed study routes", () => {
    expect(layout).toContain('location.pathname.endsWith("/study")');
    expect(layout).toContain('location.pathname.endsWith("/mixed-study")');
    expect(layout).toContain("<MobilePortraitOnlyGate active={portraitOnlySession} />");
  });
});
