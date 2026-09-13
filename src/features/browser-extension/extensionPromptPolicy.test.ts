/**
 * Auditoria dos 7 gates do convite da extensão + política de superfície.
 *
 * A pergunta que estes testes respondem: para cada estado, QUAL gate impede a
 * exibição. A landing pública é elegível SEM login; o login aparece no
 * snapshot apenas como diagnóstico (`authenticated`), nunca como gate.
 */

import { describe, expect, it } from "vitest";
import {
  evaluateExtensionPromptGates,
  resolveExtensionPromptSurface,
  type ExtensionPromptGateInput,
} from "./extensionPromptPolicy";

/** Landing pública, desktop Chromium, extensão ausente, storage limpo. */
const landing: ExtensionPromptGateInput = {
  route: "/",
  authenticatedSession: false,
  browserCompatible: true,
  isDesktop: true,
  extensionStatus: "missing",
  snoozeActive: false,
  seenThisSession: false,
  dismissedThisMount: false,
};

const withLanding = (
  overrides: Partial<ExtensionPromptGateInput>,
): ExtensionPromptGateInput => ({ ...landing, ...overrides });

describe("gates do convite — landing pública sem login", () => {
  it("elegível quando a extensão está ausente, sem snooze e sem marca de sessão", () => {
    expect(evaluateExtensionPromptGates(landing)).toEqual({
      route: "/",
      extensionDetected: false,
      browserCompatible: true,
      isDesktop: true,
      authenticated: false,
      snoozeActive: false,
      seenThisSession: false,
      finalEligibility: true,
      reasonNotShown: null,
    });
  });

  it("login não é gate: sessão autenticada na landing continua elegível", () => {
    const gates = evaluateExtensionPromptGates(withLanding({ authenticatedSession: true }));
    expect(gates.authenticated).toBe(true);
    expect(gates.finalEligibility).toBe(true);
    expect(gates.reasonNotShown).toBeNull();
  });

  it("extensão detectada impede a exibição em qualquer superfície", () => {
    const gates = evaluateExtensionPromptGates(withLanding({ extensionStatus: "installed" }));
    expect(gates.extensionDetected).toBe(true);
    expect(gates.finalEligibility).toBe(false);
    expect(gates.reasonNotShown).toBe("extension-installed");
  });

  it("snooze ativo impede a exibição", () => {
    const gates = evaluateExtensionPromptGates(withLanding({ snoozeActive: true }));
    expect(gates.snoozeActive).toBe(true);
    expect(gates.reasonNotShown).toBe("snooze-active");
  });

  it("marca de sessão impede a exibição", () => {
    const gates = evaluateExtensionPromptGates(withLanding({ seenThisSession: true }));
    expect(gates.seenThisSession).toBe(true);
    expect(gates.reasonNotShown).toBe("seen-this-session");
  });

  it("mobile impede a exibição", () => {
    const gates = evaluateExtensionPromptGates(withLanding({ isDesktop: false }));
    expect(gates.isDesktop).toBe(false);
    expect(gates.reasonNotShown).toBe("mobile");
  });

  it("navegador incompatível impede a exibição", () => {
    const gates = evaluateExtensionPromptGates(
      withLanding({ browserCompatible: false, extensionStatus: "unsupported" }),
    );
    expect(gates.browserCompatible).toBe(false);
    expect(gates.reasonNotShown).toBe("browser-incompatible");
  });

  it("ping ainda em andamento não mostra o convite", () => {
    const gates = evaluateExtensionPromptGates(withLanding({ extensionStatus: "unknown" }));
    expect(gates.reasonNotShown).toBe("extension-status-unknown");
  });

  it("convite já dispensado nesta montagem não reaparece", () => {
    const gates = evaluateExtensionPromptGates(withLanding({ dismissedThisMount: true }));
    expect(gates.reasonNotShown).toBe("dismissed-this-mount");
  });
});

describe("superfície do convite", () => {
  it("landing pública é elegível sem login", () => {
    expect(
      resolveExtensionPromptSurface({ pathname: "/", authenticatedSession: false, safeMode: false }),
    ).toBe("public-landing");
  });

  it("alias /landing e barra final também são a landing pública", () => {
    expect(
      resolveExtensionPromptSurface({
        pathname: "/landing",
        authenticatedSession: false,
        safeMode: false,
      }),
    ).toBe("public-landing");
    expect(
      resolveExtensionPromptSurface({ pathname: "/", authenticatedSession: true, safeMode: false }),
    ).toBe("public-landing");
  });

  it("app autenticado continua elegível nas rotas privadas", () => {
    expect(
      resolveExtensionPromptSurface({
        pathname: "/dashboard",
        authenticatedSession: true,
        safeMode: false,
      }),
    ).toBe("authenticated-app");
  });

  it("rotas públicas que não são a landing não montam o convite", () => {
    ["/auth", "/portal", "/pt-br", "/ingles-para-iniciantes"].forEach((pathname) => {
      expect(
        resolveExtensionPromptSurface({ pathname, authenticatedSession: false, safeMode: false }),
      ).toBeNull();
    });
  });

  it("rota privada sem sessão autenticada não monta o convite", () => {
    expect(
      resolveExtensionPromptSurface({
        pathname: "/dashboard",
        authenticatedSession: false,
        safeMode: false,
      }),
    ).toBeNull();
  });

  it("rotas de estudo em tela cheia nunca montam o convite", () => {
    ["/list/abc/study", "/list/abc/mixed-study", "/portal/list/abc/study"].forEach((pathname) => {
      expect(
        resolveExtensionPromptSurface({ pathname, authenticatedSession: true, safeMode: false }),
      ).toBeNull();
    });
  });

  it("Safe Mode suprime o convite em qualquer superfície", () => {
    expect(
      resolveExtensionPromptSurface({ pathname: "/", authenticatedSession: true, safeMode: true }),
    ).toBeNull();
  });
});

