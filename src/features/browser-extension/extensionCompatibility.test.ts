/**
 * Compatibilidade do convite da extensão: decidida por SINAIS DE NAVEGADOR
 * (Chromium desktop), NUNCA pela existência de `chrome.runtime`.
 *
 * Bug corrigido (2026-09-13): em uma página comum, `window.chrome.runtime` só
 * existe quando alguma extensão instalada declara `externally_connectable` para
 * aquele domínio. A persona-alvo do convite é o Chrome desktop SEM a extensão —
 * exatamente onde o canal é `undefined`. Usar o canal como gate de
 * compatibilidade escondia o convite de quem deveria vê-lo.
 */

import { describe, expect, it } from "vitest";
import type { CompatibilityEnvironment } from "./extensionRuntime";
import { detectExtensionCompatibility, isMobileEnvironment } from "./extensionStatus";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const EDGE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";
const FIREFOX_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0";
const SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15";
const ANDROID_CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1";

/** Catálogo real do Chrome e do Edge (ordem observada no navegador). */
const CHROME_BRANDS = ["Not_A Brand", "Chromium", "Google Chrome"];
const EDGE_BRANDS = ["Not_A Brand", "Chromium", "Microsoft Edge"];

function env(overrides: Partial<CompatibilityEnvironment> = {}): CompatibilityEnvironment {
  return { userAgent: CHROME_UA, extensionMessaging: false, ...overrides };
}

describe("compatibilidade — Chromium desktop é decidido pelo navegador", () => {
  it("Chromium desktop SEM chrome.runtime continua compatível (produção sem a extensão)", () => {
    expect(detectExtensionCompatibility(env({ extensionMessaging: false }))).toBe(true);
    expect(
      detectExtensionCompatibility(
        env({ extensionMessaging: false, userAgentMobile: false, brands: CHROME_BRANDS }),
      ),
    ).toBe(true);
    expect(
      detectExtensionCompatibility(
        env({ extensionMessaging: false, userAgentMobile: false, brands: EDGE_BRANDS }),
      ),
    ).toBe(true);
  });

  it("Edge e Chromium por user-agent (sem Client Hints) também são compatíveis", () => {
    expect(detectExtensionCompatibility(env({ userAgent: EDGE_UA }))).toBe(true);
    expect(detectExtensionCompatibility(env({ userAgent: CHROME_UA, brands: [] }))).toBe(true);
  });

  it("Firefox (Gecko) nunca é compatível", () => {
    expect(detectExtensionCompatibility(env({ userAgent: FIREFOX_UA }))).toBe(false);
    expect(
      detectExtensionCompatibility(env({ userAgent: FIREFOX_UA, brands: ["Firefox"] })),
    ).toBe(false);
  });

  it("Safari (WebKit puro) nunca é compatível", () => {
    expect(detectExtensionCompatibility(env({ userAgent: SAFARI_UA }))).toBe(false);
  });

  it("mobile é incompatível mesmo com user-agent de Chromium", () => {
    expect(
      detectExtensionCompatibility(env({ userAgent: CHROME_UA, userAgentMobile: true })),
    ).toBe(false);
    expect(detectExtensionCompatibility(env({ userAgent: ANDROID_CHROME_UA }))).toBe(false);
    expect(detectExtensionCompatibility(env({ userAgent: IPHONE_UA }))).toBe(false);
  });

  it("ambiente sem informação nenhuma falha fechado (não mostra o convite)", () => {
    expect(detectExtensionCompatibility({ userAgent: "", extensionMessaging: false })).toBe(false);
    expect(detectExtensionCompatibility({ extensionMessaging: false })).toBe(false);
  });

  it("isMobileEnvironment prioriza Client Hints e cai no user-agent quando não há hints", () => {
    expect(isMobileEnvironment(env({ userAgent: CHROME_UA, userAgentMobile: true }))).toBe(true);
    expect(isMobileEnvironment(env({ userAgent: ANDROID_CHROME_UA, userAgentMobile: false }))).toBe(
      false,
    );
    expect(isMobileEnvironment(env({ userAgent: ANDROID_CHROME_UA }))).toBe(true);
    expect(isMobileEnvironment(env({ userAgent: CHROME_UA }))).toBe(false);
  });
});
