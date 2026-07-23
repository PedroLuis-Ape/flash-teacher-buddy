import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("APE browser extension contract", () => {
  it("ships with American English as the initial pronunciation preset", () => {
    const background = read("browser-extension/ape-pronunciation-notes/background.js");
    const manifest = JSON.parse(read("browser-extension/ape-pronunciation-notes/manifest.json"));

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe("APE Pronúncia e Notas");
    expect(background).toContain('languageMode: "manual"');
    expect(background).toContain('defaultLang: "en-US"');
  });

  it("exposes a prominent landing shortcut without requiring authentication", () => {
    const publicShell = read("src/components/layout/PublicShell.tsx");
    const quickInstall = read("src/features/browser-extension/BrowserExtensionQuickInstall.tsx");
    const installPage = read("public/extensao/index.html");

    expect(publicShell).toContain("BrowserExtensionQuickInstall");
    expect(publicShell).toContain('location.pathname === "/"');
    expect(quickInstall).toContain("Instalar a extensão");
    expect(quickInstall).toContain("inglês americano");
    expect(installPage).toContain("Chrome Web Store");
    expect(installPage).toContain("store-config.json");
  });
});
