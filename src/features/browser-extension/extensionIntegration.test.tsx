/**
 * Cenários A..J do convite/status da extensão "Salvar nas Notas".
 *
 * Ambiente: node + react-test-renderer (não há jsdom neste repositório).
 * window/document/navigator/chrome são injetados por teste; o app nunca
 * pode lançar quando esses recursos não existem.
 */

import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BrowserExtensionPromptMount } from "./BrowserExtensionPromptMount";
import { BrowserExtensionSettingsSection } from "./BrowserExtensionSettingsSection";
import { ExtensionInstallPrompt } from "./ExtensionInstallPrompt";
import {
  AUTO_DISMISS_MS,
  EXIT_ANIMATION_MS,
  EXTENSION_ID,
  PING_TIMEOUT_MS,
  PROMPT_SESSION_KEY,
  PROMPT_SNOOZE_KEY,
  SHOW_DELAY_MS,
  SNOOZE_DURATION_MS,
  WEB_STORE_URL,
} from "./extensionConfig";
import { detectExtensionCompatibility, pingExtension } from "./extensionStatus";
import type { ExtensionPromptGateSnapshot } from "./extensionPromptPolicy";

/** Sessão simulada do ponto de montagem (`GlobalLayout` → `useAuth`). */
const authState = vi.hoisted(() => ({ status: "anonymous" as string }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    status: authState.status,
    user: authState.status === "authenticated" ? { id: "user-1" } : null,
  }),
}));

type SendMessageHandler = (
  extensionId: string,
  message: unknown,
  callback?: (response?: unknown) => void,
) => void;

interface BrowserHarness {
  sendMessage: ReturnType<typeof vi.fn>;
  local: Storage;
  session: Storage;
}

const GLOBAL_KEYS = ["window", "document", "localStorage", "sessionStorage", "chrome"];
const DESKTOP_CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const DESKTOP_FIREFOX_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0";
const DESKTOP_SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15";
/** Catálogo real de Client Hints do Chrome desktop. */
const CHROME_BRANDS = ["Not_A Brand", "Chromium", "Google Chrome"];

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  } as Storage;
}

function installBrowser(options: {
  handler?: SendMessageHandler;
  mobile?: boolean;
  userAgent?: string;
  brands?: readonly string[];
  hasChannel?: boolean;
} = {}): BrowserHarness {
  const scope = globalThis as unknown as Record<string, unknown>;
  const listeners = new Map<string, Set<() => void>>();

  const addEventListener = (_type: string, listener: unknown) => {
    if (typeof listener !== "function") return;
    const bucket = listeners.get(_type) ?? new Set<() => void>();
    bucket.add(listener as () => void);
    listeners.set(_type, bucket);
  };
  const removeEventListener = (_type: string, listener: unknown) => {
    listeners.get(_type)?.delete(listener as () => void);
  };

  const local = createMemoryStorage();
  const session = createMemoryStorage();

  scope.window = scope;
  scope.localStorage = local;
  scope.sessionStorage = session;
  scope.document = { visibilityState: "visible", addEventListener, removeEventListener };

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent: options.userAgent ?? DESKTOP_CHROME_UA,
      userAgentData:
        options.mobile === undefined && options.brands === undefined
          ? undefined
          : { mobile: options.mobile, brands: options.brands },
    },
  });

  const sendMessage = vi.fn(options.handler);
  scope.chrome = options.hasChannel === false ? {} : { runtime: { id: EXTENSION_ID, sendMessage } };

  return { sendMessage, local, session };
}

const missingExtension = (): SendMessageHandler => (_id, _message, callback) => callback?.(undefined);
const installedExtension = (): SendMessageHandler => (_id, _message, callback) =>
  callback?.({ installed: true, extension: "salvar-nas-notas", version: "1.9.0" });

async function render(element: ReactElement): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = create(element);
  });
  return renderer as ReactTestRenderer;
}

/** Deixa o ping (microtasks) e os efeitos do React assentarem. */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(0);
    await Promise.resolve();
  });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
}

function findByHref(renderer: ReactTestRenderer, href: string) {
  return renderer.root.findAllByType("a").find((node) => node.props.href === href);
}

function findCloseButton(renderer: ReactTestRenderer) {
  return renderer.root
    .findAllByType("button")
    .find((node) => node.props["aria-label"] === "Fechar convite da extensão");
}

function statusLabel(renderer: ReactTestRenderer): string {
  const node = renderer.root.find((child) => child.props["data-testid"] === "extension-status");
  return node.children.join("");
}

/** Snapshot auditável dos gates (`window.pitecoExtensionPromptDebug`, só em DEV). */
function readGateSnapshot(): ExtensionPromptGateSnapshot {
  const snapshot = (
    globalThis as unknown as { pitecoExtensionPromptDebug?: ExtensionPromptGateSnapshot }
  ).pitecoExtensionPromptDebug;
  expect(snapshot).toBeDefined();
  return snapshot as ExtensionPromptGateSnapshot;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-13T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  const scope = globalThis as unknown as Record<string, unknown>;
  GLOBAL_KEYS.forEach((key) => {
    delete scope[key];
  });
});

describe("convite da extensão — cenários A..J", () => {
  it("A — landing pública sem login é elegível e mostra o convite após o delay", async () => {
    const harness = installBrowser({ handler: missingExtension(), mobile: false });
    const renderer = await render(<ExtensionInstallPrompt />);

    await settle();
    expect(harness.sendMessage).toHaveBeenCalledWith(
      EXTENSION_ID,
      { type: "PITECO_EXTENSION_PING" },
      expect.any(Function),
    );

    await advance(SHOW_DELAY_MS - 1);
    expect(renderer.toJSON()).toBeNull();

    await advance(1);
    expect(renderer.toJSON()).not.toBeNull();
  });

  it("B — mobile não é compatível e não mostra o convite", async () => {
    const harness = installBrowser({ handler: missingExtension(), mobile: true });
    const renderer = await render(<ExtensionInstallPrompt />);

    await advance(SHOW_DELAY_MS + AUTO_DISMISS_MS);

    expect(renderer.toJSON()).toBeNull();
    expect(harness.sendMessage).not.toHaveBeenCalled();

    // Fallback por user-agent quando userAgentData não existe (Safari iOS).
    expect(
      detectExtensionCompatibility({
        userAgentMobile: undefined,
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        extensionMessaging: true,
      }),
    ).toBe(false);
  });

  it("C — Firefox/Safari desktop ficam incompatíveis (sem canal externo)", async () => {
    installBrowser({ hasChannel: false, mobile: false, userAgent: DESKTOP_FIREFOX_UA });
    const prompt = await render(<ExtensionInstallPrompt />);
    const settings = await render(<BrowserExtensionSettingsSection />);

    await advance(SHOW_DELAY_MS + AUTO_DISMISS_MS);

    expect(prompt.toJSON()).toBeNull();
    expect(statusLabel(settings)).toBe("Indisponível neste navegador");
    expect(
      detectExtensionCompatibility({ userAgent: DESKTOP_FIREFOX_UA, extensionMessaging: false }),
    ).toBe(false);
    expect(
      detectExtensionCompatibility({ userAgent: DESKTOP_SAFARI_UA, extensionMessaging: false }),
    ).toBe(false);
  });

  it("D — desktop Chromium com extensão instalada: ping correto e sem convite", async () => {
    const harness = installBrowser({ handler: installedExtension(), mobile: false });
    const renderer = await render(<ExtensionInstallPrompt />);

    await settle();
    await advance(SHOW_DELAY_MS + AUTO_DISMISS_MS);

    expect(harness.sendMessage).toHaveBeenCalledWith(
      EXTENSION_ID,
      { type: "PITECO_EXTENSION_PING" },
      expect.any(Function),
    );
    expect(renderer.toJSON()).toBeNull();
  });

  it("E — desktop Chromium sem extensão mostra o convite só depois do delay", async () => {
    installBrowser({ handler: missingExtension(), mobile: false });
    const renderer = await render(<ExtensionInstallPrompt />);

    await settle();
    await advance(SHOW_DELAY_MS - 1);
    expect(renderer.toJSON()).toBeNull();

    await advance(1);
    expect(renderer.toJSON()).not.toBeNull();
  });

  it("F — fechar no X remove o convite e grava snooze de 7 dias", async () => {
    const harness = installBrowser({ handler: missingExtension(), mobile: false });
    const renderer = await render(<ExtensionInstallPrompt />);

    await settle();
    await advance(SHOW_DELAY_MS);
    const closeButton = findCloseButton(renderer);
    expect(closeButton).toBeDefined();

    const clickedAt = Date.now();
    await act(async () => {
      closeButton?.props.onClick();
    });

    const stored = Number(harness.local.getItem(PROMPT_SNOOZE_KEY));
    expect(Number.isFinite(stored)).toBe(true);
    expect(stored - clickedAt).toBeGreaterThanOrEqual(SNOOZE_DURATION_MS);
    expect(stored - clickedAt).toBeLessThan(SNOOZE_DURATION_MS + 1_000);
    expect(harness.session.getItem(PROMPT_SESSION_KEY)).toBe("1");

    await advance(EXIT_ANIMATION_MS);
    expect(renderer.toJSON()).toBeNull();
  });

  it("G — dentro do snooze o convite não aparece", async () => {
    const harness = installBrowser({ handler: missingExtension(), mobile: false });
    harness.local.setItem(PROMPT_SNOOZE_KEY, String(Date.now() + 60 * 60 * 1_000));

    const renderer = await render(<ExtensionInstallPrompt />);
    await advance(SHOW_DELAY_MS + AUTO_DISMISS_MS);

    expect(renderer.toJSON()).toBeNull();
  });

  it("H — auto-dismiss remove o convite pelo resto da sessão", async () => {
    const harness = installBrowser({ handler: missingExtension(), mobile: false });
    const first = await render(<ExtensionInstallPrompt />);

    await settle();
    await advance(SHOW_DELAY_MS);
    expect(first.toJSON()).not.toBeNull();

    await advance(AUTO_DISMISS_MS);
    await advance(EXIT_ANIMATION_MS);
    expect(first.toJSON()).toBeNull();
    expect(harness.session.getItem(PROMPT_SESSION_KEY)).toBe("1");
    expect(harness.local.getItem(PROMPT_SNOOZE_KEY)).toBeNull();

    const second = await render(<ExtensionInstallPrompt />);
    await advance(SHOW_DELAY_MS + AUTO_DISMISS_MS);
    expect(second.toJSON()).toBeNull();
  });

  it("I — CTA abre a Chrome Web Store em nova aba (o app não instala nada)", async () => {
    installBrowser({ handler: missingExtension(), mobile: false });
    const prompt = await render(<ExtensionInstallPrompt />);

    await settle();
    await advance(SHOW_DELAY_MS);
    const cta = findByHref(prompt, WEB_STORE_URL);
    expect(cta?.props.href).toBe(
      "https://chromewebstore.google.com/detail/gomkkomamhecmmomcpjmioikjadpddnh",
    );
    expect(cta?.props.target).toBe("_blank");
    expect(cta?.props.rel).toBe("noopener noreferrer");
    expect(WEB_STORE_URL).not.toContain("utm");

    const settings = await render(<BrowserExtensionSettingsSection />);
    await settle();
    expect(findByHref(settings, WEB_STORE_URL)?.props.target).toBe("_blank");
  });

  it("J — erro do canal não quebra o app e mantém o fluxo normal", async () => {
    const harness = installBrowser({
      handler: () => {
        throw new Error("Could not establish connection.");
      },
      mobile: false,
    });
    const renderer = await render(<ExtensionInstallPrompt />);

    await settle();
    await advance(SHOW_DELAY_MS);

    expect(harness.sendMessage).toHaveBeenCalled();
    expect(renderer.toJSON()).not.toBeNull();
  });

  it("J — timeout do ping é tratado como não instalada", async () => {
    installBrowser({ handler: () => undefined, mobile: false });
    const renderer = await render(<ExtensionInstallPrompt />);

    await advance(PING_TIMEOUT_MS - 1);
    expect(renderer.toJSON()).toBeNull();

    await advance(1);
    expect(renderer.toJSON()).toBeNull();

    await advance(SHOW_DELAY_MS);
    expect(renderer.toJSON()).not.toBeNull();
  });
});

describe("convite na landing pública — matriz de gates sem login", () => {
  it("K1 — extensão detectada: o convite fica oculto", async () => {
    const harness = installBrowser({ handler: installedExtension(), mobile: false });
    const renderer = await render(<ExtensionInstallPrompt />);

    await settle();
    expect(harness.sendMessage).toHaveBeenCalled();

    await advance(SHOW_DELAY_MS + AUTO_DISMISS_MS);
    expect(renderer.toJSON()).toBeNull();
  });

  it("K2 — snooze ativo: o convite fica oculto", async () => {
    const harness = installBrowser({ handler: missingExtension(), mobile: false });
    harness.local.setItem(PROMPT_SNOOZE_KEY, String(Date.now() + 60 * 60 * 1_000));
    const renderer = await render(<ExtensionInstallPrompt />);

    await settle();
    expect(harness.sendMessage).toHaveBeenCalled();

    await advance(SHOW_DELAY_MS + AUTO_DISMISS_MS);
    expect(renderer.toJSON()).toBeNull();
  });

  it("K3 — já visto nesta sessão: o convite fica oculto", async () => {
    const harness = installBrowser({ handler: missingExtension(), mobile: false });
    harness.session.setItem(PROMPT_SESSION_KEY, "1");
    const renderer = await render(<ExtensionInstallPrompt />);

    await settle();
    expect(harness.sendMessage).toHaveBeenCalled();

    await advance(SHOW_DELAY_MS + AUTO_DISMISS_MS);
    expect(renderer.toJSON()).toBeNull();
  });

  it("K4 — mobile nunca vê o convite e não consulta a extensão", async () => {
    const harness = installBrowser({ handler: missingExtension(), mobile: true });
    const renderer = await render(<ExtensionInstallPrompt />);

    await advance(SHOW_DELAY_MS + AUTO_DISMISS_MS);

    expect(renderer.toJSON()).toBeNull();
    expect(harness.sendMessage).not.toHaveBeenCalled();
  });

  it("K5 — Firefox/Safari nunca veem o convite", async () => {
    const harness = installBrowser({ hasChannel: false, mobile: false, userAgent: DESKTOP_SAFARI_UA });
    const renderer = await render(<ExtensionInstallPrompt />);

    await advance(SHOW_DELAY_MS + AUTO_DISMISS_MS);

    expect(renderer.toJSON()).toBeNull();
    expect(harness.sendMessage).not.toHaveBeenCalled();
  });
});

describe("convite sem a extensão instalada — o caso real de produção", () => {
  it("L1 — Chromium desktop SEM chrome.runtime é compatível, fica 'missing' e é elegível", async () => {
    // apeeducation.org sem a extensão: nenhuma extensão declara externally_connectable
    // para o domínio, então window.chrome.runtime NÃO existe. Antes desta correção o
    // veredito era 'browser-incompatible' e o convite nunca aparecia.
    const harness = installBrowser({ hasChannel: false, mobile: false, brands: CHROME_BRANDS });
    const renderer = await render(<ExtensionInstallPrompt />);

    await settle();
    await advance(SHOW_DELAY_MS);

    const gates = readGateSnapshot();
    expect(gates.browserCompatible).toBe(true);
    expect(gates.extensionDetected).toBe(false);
    expect(gates.finalEligibility).toBe(true);
    expect(gates.reasonNotShown).toBeNull();
    expect(renderer.toJSON()).not.toBeNull();
    // Sem canal: nada foi chamado e nada lançou.
    expect(harness.sendMessage).not.toHaveBeenCalled();
  });

  it("L2 — canal presente com ping válido → 'installed' → convite oculto", async () => {
    const harness = installBrowser({
      handler: installedExtension(),
      mobile: false,
      brands: CHROME_BRANDS,
    });
    const renderer = await render(<ExtensionInstallPrompt />);

    await settle();
    await advance(SHOW_DELAY_MS + AUTO_DISMISS_MS);

    const gates = readGateSnapshot();
    expect(harness.sendMessage).toHaveBeenCalled();
    expect(gates.extensionDetected).toBe(true);
    expect(gates.browserCompatible).toBe(true);
    expect(gates.finalEligibility).toBe(false);
    expect(gates.reasonNotShown).toBe("extension-installed");
    expect(renderer.toJSON()).toBeNull();
  });

  it("L3 — canal presente com ping que estoura → 'missing' e elegível, sem erro visível", async () => {
    const harness = installBrowser({
      handler: () => {
        throw new Error("Could not establish connection. Receiving end does not exist.");
      },
      mobile: false,
      brands: CHROME_BRANDS,
    });
    const renderer = await render(<ExtensionInstallPrompt />);

    await settle();
    await advance(SHOW_DELAY_MS);

    const gates = readGateSnapshot();
    expect(harness.sendMessage).toHaveBeenCalled();
    expect(gates.extensionDetected).toBe(false);
    expect(gates.browserCompatible).toBe(true);
    expect(gates.finalEligibility).toBe(true);
    expect(renderer.toJSON()).not.toBeNull();
  });

  it("L4 — canal presente com timeout → 'missing' e elegível", async () => {
    installBrowser({ handler: () => undefined, mobile: false, brands: CHROME_BRANDS });
    const renderer = await render(<ExtensionInstallPrompt />);

    await advance(PING_TIMEOUT_MS);
    expect(readGateSnapshot().extensionDetected).toBe(false);

    await advance(SHOW_DELAY_MS);
    expect(readGateSnapshot().finalEligibility).toBe(true);
    expect(renderer.toJSON()).not.toBeNull();
  });

  it("L5 — Firefox, Safari e mobile não são elegíveis e não consultam a extensão", async () => {
    const cases = [
      { userAgent: DESKTOP_FIREFOX_UA, mobile: undefined },
      { userAgent: DESKTOP_SAFARI_UA, mobile: undefined },
      { userAgent: DESKTOP_CHROME_UA, mobile: true },
    ];

    for (const scenario of cases) {
      const harness = installBrowser({
        hasChannel: false,
        mobile: scenario.mobile,
        userAgent: scenario.userAgent,
      });
      const prompt = await render(<ExtensionInstallPrompt />);
      const settings = await render(<BrowserExtensionSettingsSection />);

      await advance(SHOW_DELAY_MS + AUTO_DISMISS_MS);

      expect(prompt.toJSON()).toBeNull();
      expect(statusLabel(settings)).toBe("Indisponível neste navegador");
      expect(harness.sendMessage).not.toHaveBeenCalled();

      await act(async () => {
        prompt.unmount();
        settings.unmount();
      });
    }
  });
});

describe("pingExtension", () => {
  it("trata lastError como não instalada, mesmo com resposta", async () => {
    installBrowser({
      handler: (_id, _message, callback) => {
        const runtime = (
          globalThis as unknown as { chrome: { runtime: { lastError?: unknown } } }
        ).chrome.runtime;
        runtime.lastError = { message: "Could not establish connection." };
        callback?.({ installed: true });
      },
      mobile: false,
    });

    await expect(pingExtension()).resolves.toBe("missing");
  });

  it("respeita o timeout quando a extensão não responde", async () => {
    installBrowser({ handler: () => undefined, mobile: false });
    const pending = pingExtension();

    await act(async () => {
      vi.advanceTimersByTime(PING_TIMEOUT_MS);
      await Promise.resolve();
    });

    await expect(pending).resolves.toBe("missing");
  });

  it("não lança quando não existe chrome.runtime", async () => {
    installBrowser({ hasChannel: false, mobile: false });
    await expect(pingExtension()).resolves.toBe("missing");
  });
});

describe("montagem única do convite (GlobalLayout)", () => {
  const countPrompts = (renderer: ReactTestRenderer): number =>
    renderer.root.findAllByType("aside").length;

  const mountAt = (entry: string) =>
    render(
      <MemoryRouter initialEntries={[entry]}>
        <BrowserExtensionPromptMount />
      </MemoryRouter>,
    );

  it("M1 — landing pública sem login: exatamente UMA instância, depois do delay", async () => {
    authState.status = "anonymous";
    const harness = installBrowser({ handler: missingExtension(), mobile: false });
    const renderer = await mountAt("/");

    await settle();
    await advance(SHOW_DELAY_MS);

    expect(harness.sendMessage).toHaveBeenCalled();
    expect(countPrompts(renderer)).toBe(1);
  });

  it("M2 — app autenticado em rota privada: exatamente UMA instância", async () => {
    authState.status = "authenticated";
    installBrowser({ handler: missingExtension(), mobile: false });
    const renderer = await mountAt("/dashboard");

    await settle();
    await advance(SHOW_DELAY_MS);

    expect(countPrompts(renderer)).toBe(1);
  });

  it("M3 — rota pública que não é a landing: nenhuma instância", async () => {
    authState.status = "anonymous";
    installBrowser({ handler: missingExtension(), mobile: false });
    const renderer = await mountAt("/auth");

    await settle();
    await advance(SHOW_DELAY_MS + AUTO_DISMISS_MS);

    expect(countPrompts(renderer)).toBe(0);
  });

  it("M4 — rota de estudo em tela cheia: nenhuma instância", async () => {
    authState.status = "authenticated";
    installBrowser({ handler: missingExtension(), mobile: false });
    const renderer = await mountAt("/list/abc/study");

    await settle();
    await advance(SHOW_DELAY_MS + AUTO_DISMISS_MS);

    expect(countPrompts(renderer)).toBe(0);
  });

  it("M5 — Safe Mode: nenhuma instância, mesmo na landing pública", async () => {
    authState.status = "anonymous";
    const harness = installBrowser({ handler: missingExtension(), mobile: false });
    harness.local.setItem("ape_safe_mode", "true");
    const renderer = await mountAt("/");

    await settle();
    await advance(SHOW_DELAY_MS + AUTO_DISMISS_MS);

    expect(countPrompts(renderer)).toBe(0);
  });
});
