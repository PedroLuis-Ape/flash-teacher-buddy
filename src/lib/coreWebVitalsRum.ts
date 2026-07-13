export type CoreWebVitalName = "LCP" | "INP" | "CLS";
export type CoreWebVitalRating = "good" | "needs-improvement" | "poor";
export type RumDeviceClass = "mobile" | "tablet" | "desktop";
export type RumNavigationType = "navigate" | "reload" | "back_forward" | "prerender" | "unknown";

export interface CoreWebVitalValue {
  metric: CoreWebVitalName;
  value: number;
  rating: CoreWebVitalRating;
  updatedAt: number;
}

export interface CoreWebVitalsSnapshot {
  pageViewId: string;
  routeGroup: string;
  deviceClass: RumDeviceClass;
  navigationType: RumNavigationType;
  sampled: boolean;
  sampleRate: number;
  updatedAt: number;
  metrics: Partial<Record<CoreWebVitalName, CoreWebVitalValue>>;
}

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface InteractionEntry extends PerformanceEntry {
  interactionId?: number;
  duration: number;
}

interface RumPayload {
  pageViewId: string;
  metric: CoreWebVitalName;
  value: number;
  rating: CoreWebVitalRating;
  routeGroup: string;
  deviceClass: RumDeviceClass;
  navigationType: RumNavigationType;
  sampleRate: number;
  buildId: string | null;
}

type RumSessionStorage = Pick<Storage, "getItem" | "setItem">;

const CANONICAL_HOST = "www.apeeducation.org";
const SESSION_SAMPLE_KEY = "ape_rum_sample_v1";
const SESSION_SNAPSHOT_KEY = "ape_web_vitals_latest_v1";
const LOCAL_EVENT_NAME = "ape:web-vital";
const DEFAULT_SAMPLE_RATE = 0.1;
const FLUSH_INTERVAL_MS = 15_000;
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATIC_ROUTES = new Set([
  "/",
  "/landing",
  "/dashboard",
  "/ingles-para-iniciantes",
  "/atividades-de-ingles",
  "/flashcards-de-ingles",
  "/para-professores",
  "/pt-br",
  "/pt-br/recursos",
  "/pt-br/flashcards",
  "/pt-br/para-professores",
  "/pt-br/sobre",
  "/pt-br/fonte-oficial",
  "/pt-br/metodologia",
  "/pt-br/evidencias",
  "/en",
  "/en/features",
  "/en/flashcards",
  "/en/for-teachers",
  "/en/about",
  "/en/official-source",
  "/en/methodology",
  "/en/evidence",
  "/auth",
  "/auth/callback",
  "/profile",
  "/folders",
  "/glossary",
  "/term-check",
  "/search",
  "/portal",
  "/store",
  "/gifts",
  "/reinos",
  "/reino",
  "/store/inventory",
  "/store/exchange",
  "/reino/importar",
  "/admin/catalog",
  "/admin/logs",
  "/admin/gifts",
  "/turmas",
  "/turmas/professor",
  "/turmas/aluno",
  "/professor/alunos",
  "/my-teachers",
  "/painel-professor",
  "/settings/public-profile",
  "/about",
  "/notes",
  "/goals",
  "/goals/new",
  "/import",
  "/import/super",
  "/trash",
  "/settings/performance",
  "/settings/shortcuts",
  "/audit",
  "/special-cards",
  "/system-status",
  "/reportar-problema",
]);

const DYNAMIC_ROUTE_PATTERNS: Array<[RegExp, string]> = [
  [/^\/portal\/professor\/[^/]+$/i, "/portal/professor/:slug"],
  [/^\/portal\/folder\/[^/]+$/i, "/portal/folder/:id"],
  [/^\/portal\/list\/[^/]+$/i, "/portal/list/:id"],
  [/^\/portal\/list\/[^/]+\/(games|study|mixed-study)$/i, "/portal/list/:id/$1"],
  [/^\/portal\/collection\/[^/]+$/i, "/portal/collection/:id"],
  [/^\/portal\/collection\/[^/]+\/(study|mixed-study)$/i, "/portal/collection/:id/$1"],
  [/^\/folder\/[^/]+$/i, "/folder/:id"],
  [/^\/list\/[^/]+$/i, "/list/:id"],
  [/^\/list\/[^/]+\/(games|study|mixed-study)$/i, "/list/:id/$1"],
  [/^\/collection\/[^/]+$/i, "/collection/:id"],
  [/^\/collection\/[^/]+\/(games|study|mixed-study)$/i, "/collection/:id/$1"],
  [/^\/turmas\/[^/]+$/i, "/turmas/:id"],
  [/^\/turmas\/[^/]+\/import\/super$/i, "/turmas/:id/import/super"],
  [/^\/professor\/alunos\/[^/]+$/i, "/professor/alunos/:id"],
  [/^\/professores\/[^/]+$/i, "/professores/:id"],
  [/^\/notes\/[^/]+$/i, "/notes/:id"],
  [/^\/reino\/[^/]+$/i, "/reino/:code"],
];

let activeStop: (() => void) | null = null;

function clampSampleRate(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_SAMPLE_RATE;
  return Math.min(1, Math.max(0, value));
}

export function classifyCoreWebVital(metric: CoreWebVitalName, value: number): CoreWebVitalRating {
  if (metric === "LCP") {
    if (value <= 2500) return "good";
    if (value <= 4000) return "needs-improvement";
    return "poor";
  }
  if (metric === "INP") {
    if (value <= 200) return "good";
    if (value <= 500) return "needs-improvement";
    return "poor";
  }
  if (value <= 0.1) return "good";
  if (value <= 0.25) return "needs-improvement";
  return "poor";
}

export function normalizeRumRoute(pathname: string): string {
  let normalized = pathname.split(/[?#]/, 1)[0] || "/";
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    return "/other";
  }
  normalized = `/${normalized.split("/").filter(Boolean).join("/")}`;
  if (normalized !== "/") normalized = normalized.replace(/\/+$/, "");
  if (STATIC_ROUTES.has(normalized)) return normalized;

  for (const [pattern, replacement] of DYNAMIC_ROUTE_PATTERNS) {
    if (pattern.test(normalized)) return normalized.replace(pattern, replacement);
  }

  const withIdsRedacted = normalized
    .split("/")
    .map((segment) => UUID_SEGMENT.test(segment) ? ":id" : segment)
    .join("/");
  if (withIdsRedacted !== normalized && withIdsRedacted.length <= 160 && !withIdsRedacted.includes("@")) {
    return withIdsRedacted;
  }
  return "/other";
}

export function resolveRumSampleRate(rawValue: string | undefined, hostname: string, production: boolean) {
  if (!production || hostname !== CANONICAL_HOST) return 0;
  if (!rawValue?.trim()) return DEFAULT_SAMPLE_RATE;
  return clampSampleRate(Number(rawValue));
}

export function getRumDeviceClass(width: number): RumDeviceClass {
  if (width <= 767) return "mobile";
  if (width <= 1024) return "tablet";
  return "desktop";
}

export function getRumNavigationType(entryType?: string): RumNavigationType {
  return entryType === "navigate" || entryType === "reload" || entryType === "back_forward" || entryType === "prerender"
    ? entryType
    : "unknown";
}

function randomUnit() {
  try {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] / 0x1_0000_0000;
  } catch {
    return Math.random();
  }
}

function createPageViewId() {
  try {
    return crypto.randomUUID();
  } catch {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}

export function resolveSessionSample(sampleRate: number, storage: RumSessionStorage | null = null) {
  if (sampleRate <= 0) return false;
  if (sampleRate >= 1) return true;
  const key = `${SESSION_SAMPLE_KEY}:${sampleRate}`;
  try {
    const existing = storage?.getItem(key);
    if (existing === "1") return true;
    if (existing === "0") return false;
    const sampled = randomUnit() < sampleRate;
    storage?.setItem(key, sampled ? "1" : "0");
    return sampled;
  } catch {
    return randomUnit() < sampleRate;
  }
}

export function readOptionalSessionStorage(
  getter: () => RumSessionStorage = () => window.sessionStorage,
): RumSessionStorage | null {
  try {
    return getter();
  } catch {
    return null;
  }
}

export function getLatestCoreWebVitals(): CoreWebVitalsSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SESSION_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CoreWebVitalsSnapshot;
    return parsed && typeof parsed === "object" && typeof parsed.routeGroup === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function storeSnapshot(snapshot: CoreWebVitalsSnapshot) {
  try {
    sessionStorage.setItem(SESSION_SNAPSHOT_KEY, JSON.stringify(snapshot));
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT_NAME, { detail: snapshot }));
  } catch {
    // Session diagnostics are best-effort only.
  }
}

function sendPayload(payload: RumPayload) {
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon) {
      const accepted = navigator.sendBeacon(
        "/api/rum",
        new Blob([body], { type: "application/json" }),
      );
      if (accepted) return;
    }
  } catch {
    // Fall through to fetch keepalive.
  }
  void fetch("/api/rum", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
    credentials: "omit",
  }).catch(() => undefined);
}

function selectInpValue(interactions: Map<number, number>) {
  const values = Array.from(interactions.values()).sort((a, b) => b - a);
  if (!values.length) return null;
  const index = Math.min(Math.floor(values.length / 50), values.length - 1);
  return values[index];
}

function startCoreWebVitalsRumInternal() {
  if (activeStop || typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
    return activeStop ?? (() => undefined);
  }

  const routeGroup = normalizeRumRoute(window.location.pathname);
  const sampleRate = resolveRumSampleRate(
    import.meta.env.VITE_RUM_SAMPLE_RATE,
    window.location.hostname,
    import.meta.env.PROD,
  );
  const sampled = resolveSessionSample(sampleRate, readOptionalSessionStorage());
  const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const navigationType = getRumNavigationType(navigationEntry?.type);
  const deviceClass = getRumDeviceClass(window.innerWidth);
  const pageViewId = createPageViewId();
  const buildId = (import.meta.env.VITE_BUILD_ID || import.meta.env.VITE_COMMIT_REF || "").trim().slice(0, 80) || null;
  const snapshot: CoreWebVitalsSnapshot = {
    pageViewId,
    routeGroup,
    deviceClass,
    navigationType,
    sampled,
    sampleRate,
    updatedAt: Date.now(),
    metrics: {},
  };
  const sentValues = new Map<CoreWebVitalName, number>();
  const observers: PerformanceObserver[] = [];
  const interactions = new Map<number, number>();
  let clsSessionValue = 0;
  let clsSessionStart = 0;
  let clsPreviousTime = 0;
  let clsMax = 0;

  const update = (metric: CoreWebVitalName, rawValue: number) => {
    if (!Number.isFinite(rawValue) || rawValue < 0) return;
    const value = metric === "CLS"
      ? Math.round(rawValue * 10000) / 10000
      : Math.round(rawValue * 10) / 10;
    snapshot.metrics[metric] = {
      metric,
      value,
      rating: classifyCoreWebVital(metric, value),
      updatedAt: Date.now(),
    };
    snapshot.updatedAt = Date.now();
    storeSnapshot(snapshot);
  };

  // A page with no layout shifts has a real CLS of zero. Recording the zero
  // avoids biasing aggregates toward only the pages where a shift occurred.
  update("CLS", 0);

  const observe = (type: string, callback: PerformanceObserverCallback, extra: Record<string, unknown> = {}) => {
    if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return;
    try {
      const observer = new PerformanceObserver(callback);
      observer.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
      observers.push(observer);
    } catch {
      // Unsupported entry options are ignored per browser.
    }
  };

  observe("largest-contentful-paint", (list) => {
    const entries = list.getEntries();
    const last = entries.at(-1);
    if (last) update("LCP", last.startTime);
  });

  observe("layout-shift", (list) => {
    for (const entry of list.getEntries() as LayoutShiftEntry[]) {
      if (entry.hadRecentInput) continue;
      const withinWindow = clsSessionStart > 0
        && entry.startTime - clsPreviousTime < 1000
        && entry.startTime - clsSessionStart < 5000;
      if (withinWindow) {
        clsSessionValue += entry.value;
      } else {
        clsSessionValue = entry.value;
        clsSessionStart = entry.startTime;
      }
      clsPreviousTime = entry.startTime;
      if (clsSessionValue > clsMax) {
        clsMax = clsSessionValue;
        update("CLS", clsMax);
      }
    }
  });

  observe("event", (list) => {
    for (const entry of list.getEntries() as InteractionEntry[]) {
      const interactionId = Number(entry.interactionId ?? 0);
      if (!interactionId || !Number.isFinite(entry.duration)) continue;
      interactions.set(interactionId, Math.max(interactions.get(interactionId) ?? 0, entry.duration));
    }
    const inp = selectInpValue(interactions);
    if (inp != null) update("INP", inp);
  }, { durationThreshold: 16 });

  const flush = () => {
    if (!sampled || sampleRate <= 0) return;
    for (const metric of ["LCP", "INP", "CLS"] as CoreWebVitalName[]) {
      const current = snapshot.metrics[metric];
      if (!current || sentValues.get(metric) === current.value) continue;
      sendPayload({
        pageViewId,
        metric,
        value: current.value,
        rating: current.rating,
        routeGroup,
        deviceClass,
        navigationType,
        sampleRate,
        buildId,
      });
      sentValues.set(metric, current.value);
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") flush();
  };
  const onPageHide = () => flush();
  document.addEventListener("visibilitychange", onVisibilityChange, true);
  window.addEventListener("pagehide", onPageHide, true);
  const interval = window.setInterval(flush, FLUSH_INTERVAL_MS);
  storeSnapshot(snapshot);

  const stop = () => {
    flush();
    observers.forEach((observer) => observer.disconnect());
    document.removeEventListener("visibilitychange", onVisibilityChange, true);
    window.removeEventListener("pagehide", onPageHide, true);
    window.clearInterval(interval);
    activeStop = null;
  };
  activeStop = stop;
  return stop;
}

export function startCoreWebVitalsRum() {
  try {
    return startCoreWebVitalsRumInternal();
  } catch (error) {
    activeStop = null;
    console.warn("[CoreWebVitalsRum] Collector disabled after startup failure:", error);
    return () => undefined;
  }
}

export const CORE_WEB_VITAL_EVENT = LOCAL_EVENT_NAME;