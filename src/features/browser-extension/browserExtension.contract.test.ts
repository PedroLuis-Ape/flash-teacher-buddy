import { existsSync, readFileSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const browserExtensionDir = resolve(root, "src/features/browser-extension");

/**
 * Fontes de produção (sem testes) para contar pontos de montagem.
 * Só `.tsx`: um elemento JSX não pode existir em arquivo `.ts`, e varrer
 * o resto da árvore deixaria o teste desnecessariamente lento.
 */
function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(entryPath);
    if (!entry.name.endsWith(".tsx") || /\.test\.tsx$/.test(entry.name)) return [];
    return [entryPath];
  });
}

async function countPromptMounts(): Promise<number> {
  const sources = await Promise.all(
    listSourceFiles(resolve(root, "src")).map((file) => readFile(file, "utf8")),
  );
  return sources.reduce(
    (total, source) => total + (source.match(/<BrowserExtensionPromptMount/g)?.length ?? 0),
    0,
  );
}

describe("APE browser extension contract", () => {
  it("ships with American English as the initial pronunciation preset", () => {
    const background = read("browser-extension/ape-pronunciation-notes/background.js");
    const manifest = JSON.parse(read("browser-extension/ape-pronunciation-notes/manifest.json"));

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe("APE Pronúncia e Notas");
    expect(background).toContain('languageMode: "manual"');
    expect(background).toContain('defaultLang: "en-US"');
  });

  it("mounts the prompt exactly once, from the shared layout, without an auth gate", async () => {
    const globalLayout = read("src/components/layout/GlobalLayout.tsx");
    const privateShell = read("src/components/layout/PrivateShell.tsx");
    const publicShell = read("src/components/layout/PublicShell.tsx");
    const mount = read("src/features/browser-extension/BrowserExtensionPromptMount.tsx");
    const policy = read("src/features/browser-extension/extensionPromptPolicy.ts");
    const landing = read("src/components/landing/LandingHome.tsx");
    const installPage = read("public/extensao/index.html");

    // UMA instância para toda a aplicação: o shell público e o autenticado
    // apenas compartilham o mesmo ponto de montagem em GlobalLayout.
    expect(await countPromptMounts()).toBe(1);
    expect(globalLayout).toContain("<BrowserExtensionPromptMount />");
    expect(privateShell).not.toContain("<BrowserExtensionPromptMount");
    expect(privateShell).not.toContain("<ExtensionInstallPrompt");
    expect(publicShell).not.toContain("<ExtensionInstallPrompt");
    expect(mount).toContain("<ExtensionInstallPrompt");

    // A landing pública é elegível SEM login; o gate de auth foi removido.
    expect(policy).toContain("isPublicLandingPath");
    expect(policy).toContain("public-landing");
    expect(policy).not.toContain("authenticatedSession && isPublicLandingPath");

    expect(landing).toContain('href="/extensao/index.html"');
    expect(installPage).toContain("Chrome Web Store");
    expect(installPage).toContain("store-config.json");
  }, 20_000);

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
