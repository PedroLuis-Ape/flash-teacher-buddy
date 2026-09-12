/**
 * Integracao App Piteco <-> extensao oficial de navegador.
 *
 * FONTE UNICA DE VERDADE: `public/extensao/store-config.json`.
 * Nem o app nem a pagina publica podem decidir disponibilidade por conta propria
 * (existir uma URL NAO significa que a extensao esta publicada).
 *
 * Para ativar quando a Chrome Web Store aprovar:
 *   1. preencher `chrome` (e `edge`, se houver) com a URL oficial;
 *   2. trocar `status` para `published` e preencher `version`/`approvedAt`;
 *   3. rodar os gates e publicar pelo processo normal do APE.
 */

export const BROWSER_EXTENSION_CONFIG_URL = "/extensao/store-config.json";

export type BrowserExtensionStatus =
  | "development"
  | "pending_review"
  | "approved"
  | "published"
  | "temporarily_unavailable";

export type BrowserExtensionPlatform = "chrome" | "edge";

export interface BrowserExtensionConfig {
  platform: BrowserExtensionPlatform;
  status: BrowserExtensionStatus;
  /** URL oficial da Chrome Web Store. Vazia enquanto nao aprovada. */
  chrome: string | null;
  /** URL oficial do Microsoft Edge Add-ons (opcional). */
  edge: string | null;
  version: string | null;
  approvedAt: string | null;
}

/** Estado seguro: nada disponivel, nada prometido. */
export const PENDING_BROWSER_EXTENSION_CONFIG: BrowserExtensionConfig = {
  platform: "chrome",
  status: "pending_review",
  chrome: null,
  edge: null,
  version: null,
  approvedAt: null,
};

const STATUSES: BrowserExtensionStatus[] = [
  "development",
  "pending_review",
  "approved",
  "published",
  "temporarily_unavailable",
];

const STORE_HOSTS: Record<BrowserExtensionPlatform, string[]> = {
  chrome: ["chromewebstore.google.com", "chrome.google.com"],
  edge: ["microsoftedge.microsoft.com"],
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStatus(value: unknown): BrowserExtensionStatus {
  return STATUSES.includes(value as BrowserExtensionStatus)
    ? (value as BrowserExtensionStatus)
    : PENDING_BROWSER_EXTENSION_CONFIG.status;
}

function asPlatform(value: unknown): BrowserExtensionPlatform {
  return value === "edge" ? "edge" : "chrome";
}

export function normalizeBrowserExtensionConfig(raw: unknown): BrowserExtensionConfig {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    platform: asPlatform(source.platform),
    status: asStatus(source.status),
    chrome: asString(source.chrome),
    edge: asString(source.edge),
    version: asString(source.version),
    approvedAt: asString(source.approvedAt),
  };
}

/**
 * Aceita apenas HTTPS do dominio oficial da loja do navegador escolhido.
 * Bloqueia placeholder, http, dominio de terceiros e URL vazia.
 */
export function isOfficialStoreUrl(
  url: string | null | undefined,
  platform: BrowserExtensionPlatform = "chrome",
): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return STORE_HOSTS[platform].includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export interface BrowserExtensionCta {
  href: string;
  platform: BrowserExtensionPlatform;
  version: string | null;
}

/**
 * Unico caminho autorizado a liberar CTA publico de instalacao.
 * Retorna `null` para qualquer estado diferente de `published` — inclusive
 * `approved` — e quando a URL nao for a loja oficial.
 */
export function resolveBrowserExtensionCta(
  config: BrowserExtensionConfig,
  platform: BrowserExtensionPlatform = config.platform,
): BrowserExtensionCta | null {
  if (config.status !== "published") return null;
  const candidate = platform === "edge" ? config.edge ?? config.chrome : config.chrome;
  if (!isOfficialStoreUrl(candidate, platform)) return null;
  return { href: candidate as string, platform, version: config.version };
}

/**
 * Texto honesto para a UI futura. Nunca afirma disponibilidade antes de
 * `published`.
 */
export function describeBrowserExtensionAvailability(
  config: BrowserExtensionConfig,
): "available" | "pending" | "unavailable" {
  if (resolveBrowserExtensionCta(config)) return "available";
  return config.status === "temporarily_unavailable" ? "unavailable" : "pending";
}

/** Le a configuracao central. Em qualquer falha, degrada para o estado pendente. */
export async function loadBrowserExtensionConfig(
  fetcher: typeof fetch = fetch,
): Promise<BrowserExtensionConfig> {
  try {
    const response = await fetcher(BROWSER_EXTENSION_CONFIG_URL, { cache: "no-store" });
    if (!response.ok) return PENDING_BROWSER_EXTENSION_CONFIG;
    return normalizeBrowserExtensionConfig(await response.json());
  } catch {
    return PENDING_BROWSER_EXTENSION_CONFIG;
  }
}

