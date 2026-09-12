import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BROWSER_EXTENSION_CONFIG_URL,
  PENDING_BROWSER_EXTENSION_CONFIG,
  describeBrowserExtensionAvailability,
  isOfficialStoreUrl,
  normalizeBrowserExtensionConfig,
  resolveBrowserExtensionCta,
  type BrowserExtensionConfig,
} from "./browserExtensionIntegration";

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

const base: BrowserExtensionConfig = {
  platform: "chrome",
  status: "published",
  chrome: "https://chromewebstore.google.com/detail/ape-notes/abcdefghijklmnop",
  edge: "https://microsoftedge.microsoft.com/addons/detail/ape-notes/abcdefghijklmnop",
  version: "1.0.0",
  approvedAt: "2026-09-13",
};

describe("integracao App Piteco <-> extensao oficial", () => {
  it("mantem a configuracao central como pendente enquanto nao aprovada", () => {
    const config = JSON.parse(read("public/extensao/store-config.json"));
    expect(config.status).not.toBe("published");
    expect(config.chrome).toBe("");
    expect(config.edge).toBe("");
    expect(BROWSER_EXTENSION_CONFIG_URL).toBe("/extensao/store-config.json");
  });

  it("degrada para pendente em payload invalido ou inesperado", () => {
    expect(normalizeBrowserExtensionConfig(null).status).toBe("pending_review");
    expect(normalizeBrowserExtensionConfig({ status: "hackeado" }).status).toBe("pending_review");
    expect(normalizeBrowserExtensionConfig({ platform: "firefox" }).platform).toBe("chrome");
    expect(PENDING_BROWSER_EXTENSION_CONFIG.chrome).toBeNull();
  });

  it("so aceita HTTPS do dominio oficial da loja", () => {
    expect(isOfficialStoreUrl(base.chrome)).toBe(true);
    expect(isOfficialStoreUrl(base.edge, "edge")).toBe(true);
    expect(isOfficialStoreUrl("http://chromewebstore.google.com/detail/x")).toBe(false);
    expect(isOfficialStoreUrl("https://exemplo.com/ape-notes")).toBe(false);
    expect(isOfficialStoreUrl("https://chromewebstore.google.com.evil.com/x")).toBe(false);
    expect(isOfficialStoreUrl(null)).toBe(false);
  });

  it("libera CTA publico somente no estado published", () => {
    expect(resolveBrowserExtensionCta(base)?.href).toBe(base.chrome);
    for (const status of ["development", "pending_review", "approved", "temporarily_unavailable"] as const) {
      expect(resolveBrowserExtensionCta({ ...base, status })).toBeNull();
    }
    // publicado, mas com URL ausente ou fora da loja oficial: continua bloqueado
    expect(resolveBrowserExtensionCta({ ...base, chrome: "" })).toBeNull();
    expect(resolveBrowserExtensionCta({ ...base, chrome: "https://exemplo.com/x" })).toBeNull();
  });

  it("descreve disponibilidade sem afirmar o que nao existe", () => {
    expect(describeBrowserExtensionAvailability(base)).toBe("available");
    expect(describeBrowserExtensionAvailability(PENDING_BROWSER_EXTENSION_CONFIG)).toBe("pending");
    expect(
      describeBrowserExtensionAvailability({ ...base, status: "temporarily_unavailable" }),
    ).toBe("unavailable");
  });

  it("pagina publica respeita a maquina de estados e nao indexa antes de publicar", () => {
    const page = read("public/extensao/index.html");
    expect(page).toContain('content="noindex,follow"');
    expect(page).toContain('state !== "published" || !target');
    expect(page).toContain('parsed.protocol !== "https:"');
    expect(page).toContain("microsoftedge.microsoft.com");
    expect(page).toContain("store-config.json");
    expect(page).toContain("Chrome Web Store");
  });

  it("nenhum endereco de loja ficticio foi espalhado pelo produto", () => {
    const appSource = read("src/features/browser-extension/BrowserExtensionQuickInstall.tsx");
    const integration = read("src/features/browser-extension/browserExtensionIntegration.ts");
    const config = read("public/extensao/store-config.json");
    const storeIdPattern = /chromewebstore\.google\.com\/detail\/[a-z0-9]{20,}/i;
    expect(storeIdPattern.test(config)).toBe(false);
    expect(storeIdPattern.test(appSource)).toBe(false);
    expect(integration).not.toMatch(/https:\/\/chromewebstore\.google\.com\/detail\/ape/i);
  });

  it("promocao in-app continua sem CTA publico enquanto nao publicada", () => {
    const publicShell = read("src/components/layout/PublicShell.tsx");
    expect(publicShell).not.toContain("BrowserExtensionQuickInstall");
  });
});

