import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const browserExtensionDir = resolve(root, "src/features/browser-extension");

describe("APE browser extension contract", () => {
  it("ships with American English as the initial pronunciation preset", () => {
    const background = read("browser-extension/ape-pronunciation-notes/background.js");
    const manifest = JSON.parse(read("browser-extension/ape-pronunciation-notes/manifest.json"));

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe("APE Pronúncia e Notas");
    expect(background).toContain('languageMode: "manual"');
    expect(background).toContain('defaultLang: "en-US"');
  });

  it("keeps the prompt inline in the authenticated shell without covering public pages", () => {
    const publicShell = read("src/components/layout/PublicShell.tsx");
    const privateShell = read("src/components/layout/PrivateShell.tsx");
    const landing = read("src/components/landing/LandingHome.tsx");
    const installPage = read("public/extensao/index.html");

    expect(publicShell).not.toContain("ExtensionInstallPrompt");
    expect(privateShell).toContain("ExtensionInstallPrompt");
    expect(privateShell).toContain("ExtensionInstallPrompt authenticated");
    expect(landing).toContain('href="/extensao/index.html"');
    expect(installPage).toContain("Chrome Web Store");
    expect(installPage).toContain("store-config.json");
  });

  it("publishes ID, store URL and timings from a single config module", () => {
    const config = read("src/features/browser-extension/extensionConfig.ts");
    const storeConfig = JSON.parse(read("public/extensao/store-config.json"));

    expect(config).toContain('EXTENSION_ID = "gomkkomamhecmmomcpjmioikjadpddnh"');
    expect(config).toContain("SHOW_DELAY_MS = 5_000");
    expect(config).toContain("AUTO_DISMISS_MS = 15_000");
    expect(config).toContain("SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1_000");
    expect(config).toContain('PROMPT_SNOOZE_KEY = "piteco_extension_prompt_dismissed_until"');
    expect(config).toContain('PROMPT_SESSION_KEY = "piteco_extension_prompt_seen_session"');

    expect(storeConfig.chrome).toBe(
      "https://chromewebstore.google.com/detail/gomkkomamhecmmomcpjmioikjadpddnh",
    );
    expect(storeConfig.chrome).not.toContain("utm");
  });

  it("has exactly one install prompt, linked to the store in a new tab", () => {
    expect(existsSync(resolve(browserExtensionDir, "BrowserExtensionQuickInstall.tsx"))).toBe(false);
    expect(
      readdirSync(browserExtensionDir).filter((file) => /InstallPrompt\.tsx$/.test(file)),
    ).toEqual(["ExtensionInstallPrompt.tsx"]);

    const prompt = read("src/features/browser-extension/ExtensionInstallPrompt.tsx");
    expect(prompt).toContain("Instalar extensão");
    expect(prompt).toContain("WEB_STORE_URL");
    expect(prompt).toContain('target="_blank"');
    expect(prompt).toContain('rel="noopener noreferrer"');
    expect(prompt).toContain('aria-label="Fechar convite da extensão"');
    expect(prompt).toContain("translate-y-4 opacity-0");
    expect(prompt).toContain("useBrowserExtensionStatus");
    expect(prompt).toContain("O navegador sempre pede uma confirmação final");
  });

  it("never promises automatic installation", () => {
    const sources = [
      read("src/features/browser-extension/ExtensionInstallPrompt.tsx"),
      read("src/features/browser-extension/BrowserExtensionSettingsSection.tsx"),
      read("src/features/browser-extension/extensionStatus.ts"),
    ];

    sources.forEach((source) => {
      expect(source).not.toMatch(/instala(ç|c)(ã|a)o autom(á|a)tica/i);
      expect(source).not.toContain("chrome.webstore");
      expect(source).not.toContain("<all_urls>");
    });
  });
});
