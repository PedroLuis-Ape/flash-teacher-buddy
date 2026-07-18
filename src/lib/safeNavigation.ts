import type { NavigateFunction } from "react-router-dom";

const NAVIGATION_STACK_KEY = "ape:navigation-stack:v2";
const MAX_TRACKED_ROUTES = 50;
const ROUTE_TTL_MS = 12 * 60 * 60 * 1000;

type NavigationAction = "POP" | "PUSH" | "REPLACE";

type TrackedRoute = {
  path: string;
  visitedAt: number;
};

export interface SafeBackOptions {
  fallbackRoute?: string;
  state?: unknown;
  replace?: boolean;
}

function browserOrigin(): string {
  return typeof window === "undefined" ? "https://app.local" : window.location.origin;
}

function normalizeInternalPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value, browserOrigin());
    if (url.origin !== browserOrigin()) return null;
    return `${url.pathname}${url.search}${url.hash}` || "/";
  } catch {
    return null;
  }
}

function currentBrowserPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function pathnameOf(path: string): string {
  try {
    return new URL(path, browserOrigin()).pathname;
  } catch {
    return path.split(/[?#]/, 1)[0] || "/";
  }
}

function isTransientRoute(path: string): boolean {
  const pathname = pathnameOf(path);
  return pathname === "/auth/callback" || pathname === "/.lovable/oauth/consent";
}

function readStack(): TrackedRoute[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(NAVIGATION_STACK_KEY);
    if (!raw) return [];

    const now = Date.now();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry): entry is TrackedRoute => {
        if (!entry || typeof entry !== "object") return false;
        const candidate = entry as Partial<TrackedRoute>;
        return Boolean(
          normalizeInternalPath(candidate.path)
          && typeof candidate.visitedAt === "number"
          && now - candidate.visitedAt <= ROUTE_TTL_MS,
        );
      })
      .map((entry) => ({
        path: normalizeInternalPath(entry.path)!,
        visitedAt: entry.visitedAt,
      }))
      .slice(-MAX_TRACKED_ROUTES);
  } catch {
    return [];
  }
}

function writeStack(stack: TrackedRoute[]): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      NAVIGATION_STACK_KEY,
      JSON.stringify(stack.slice(-MAX_TRACKED_ROUTES)),
    );
  } catch {
    // Session storage may be unavailable in private or restricted browser modes.
  }
}

/**
 * Records meaningful in-app routes independently from the browser's global
 * history. This prevents a Back button from landing on an unrelated route
 * left by redirects, an old PWA session, or an external entry point.
 */
export function trackAppNavigation(path: string, action: NavigationAction): void {
  const normalized = normalizeInternalPath(path);
  if (!normalized || isTransientRoute(normalized)) return;

  const now = Date.now();
  let stack = readStack();
  const last = stack.at(-1);

  if (action === "POP") {
    let matchingIndex = -1;
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      if (stack[index].path === normalized) {
        matchingIndex = index;
        break;
      }
    }

    // A POP route that is not in the tracked stack is a fresh/direct entry.
    // Reset instead of treating a route from an older tab session as its parent.
    stack = matchingIndex >= 0
      ? stack.slice(0, matchingIndex + 1)
      : [{ path: normalized, visitedAt: now }];
  } else if (action === "REPLACE" && stack.length > 0) {
    stack = [...stack.slice(0, -1), { path: normalized, visitedAt: now }];
  } else if (last?.path === normalized) {
    stack = [...stack.slice(0, -1), { path: normalized, visitedAt: now }];
  } else {
    stack = [...stack, { path: normalized, visitedAt: now }];
  }

  writeStack(stack);
}

function previousTrackedPath(currentPath: string): string | null {
  const normalizedCurrent = normalizeInternalPath(currentPath);
  if (!normalizedCurrent) return null;

  const stack = readStack();
  let currentIndex = -1;
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index].path === normalizedCurrent) {
      currentIndex = index;
      break;
    }
  }

  const startIndex = currentIndex >= 0 ? currentIndex - 1 : stack.length - 1;
  for (let index = startIndex; index >= 0; index -= 1) {
    const candidate = stack[index].path;
    if (candidate !== normalizedCurrent && !isTransientRoute(candidate)) return candidate;
  }

  return null;
}

function consumeBackTarget(currentPath: string, targetPath: string): void {
  const current = normalizeInternalPath(currentPath);
  const target = normalizeInternalPath(targetPath);
  if (!current || !target) return;

  const stack = readStack();
  let targetIndex = -1;
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index].path === target) {
      targetIndex = index;
      break;
    }
  }

  writeStack(targetIndex >= 0
    ? stack.slice(0, targetIndex + 1)
    : [{ path: target, visitedAt: Date.now() }]);
}

function pathFromState(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const record = state as Record<string, unknown>;

  for (const key of ["returnTo", "backTo", "from"] as const) {
    const value = record[key];
    const direct = normalizeInternalPath(value);
    if (direct) return direct;

    if (value && typeof value === "object") {
      const location = value as Record<string, unknown>;
      if (typeof location.pathname === "string") {
        const combined = `${location.pathname}${typeof location.search === "string" ? location.search : ""}${typeof location.hash === "string" ? location.hash : ""}`;
        const nested = normalizeInternalPath(combined);
        if (nested) return nested;
      }
    }
  }

  return null;
}

/**
 * Deterministic parent route used when the page was opened directly and no
 * meaningful previous screen exists in the current app session.
 */
export function getFallbackRoute(pathname: string): string {
  const path = pathnameOf(pathname);
  let match: RegExpMatchArray | null;

  match = path.match(/^\/portal\/list\/([^/]+)\/(?:games|study|mixed-study)$/);
  if (match) return `/portal/list/${match[1]}`;

  match = path.match(/^\/portal\/collection\/([^/]+)\/(?:games|study|mixed-study)$/);
  if (match) return `/portal/collection/${match[1]}`;

  match = path.match(/^\/list\/([^/]+)\/(?:games|study|mixed-study)$/);
  if (match) return `/list/${match[1]}`;

  match = path.match(/^\/collection\/([^/]+)\/(?:games|study|mixed-study)$/);
  if (match) return `/collection/${match[1]}`;

  match = path.match(/^\/turmas\/([^/]+)\/import\/super$/);
  if (match) return `/turmas/${match[1]}`;

  if (path === "/goals/new") return "/goals";
  if (path === "/reino/importar") return "/reinos";
  if (/^\/reino\/[^/]+$/.test(path)) return "/reinos";
  if (/^\/notes\/[^/]+$/.test(path)) return "/notes";
  if (/^\/professor\/alunos\/[^/]+$/.test(path)) return "/professor/alunos";
  if (/^\/turmas\/[^/]+$/.test(path)) return "/turmas";

  if (/^\/portal\/(?:folder|list|collection)\/[^/]+$/.test(path)) return "/portal";
  if (/^\/folder\/[^/]+$/.test(path)) return "/folders";
  if (/^\/(?:list|collection)\/[^/]+$/.test(path)) return "/folders";

  if (path.startsWith("/settings/")) return "/profile";
  if (path.startsWith("/admin/")) return "/dashboard";
  if (path.startsWith("/portal")) return "/portal";
  if (path === "/en" || path.startsWith("/en/") || path.startsWith("/pt-br")) return "/landing";
  if (path === "/auth") return "/";

  return "/folders";
}

/**
 * Returns to the actual previous in-app screen when it is known. Otherwise it
 * uses a deterministic parent route instead of trusting browser history.
 */
export function safeGoBack(
  navigate: NavigateFunction,
  optionsOrFallback: SafeBackOptions | string = {},
): void {
  const options: SafeBackOptions = typeof optionsOrFallback === "string"
    ? { fallbackRoute: optionsOrFallback }
    : optionsOrFallback;

  const current = currentBrowserPath();
  const historyState = typeof window === "undefined" ? undefined : window.history.state?.usr;
  const explicit = pathFromState(options.state ?? historyState);
  const tracked = previousTrackedPath(current);
  const fallback = normalizeInternalPath(options.fallbackRoute ?? getFallbackRoute(current)) ?? "/folders";

  const target = [explicit, tracked, fallback]
    .find((candidate): candidate is string => Boolean(candidate && candidate !== current))
    ?? "/folders";

  consumeBackTarget(current, target);
  navigate(target, { replace: options.replace ?? true });
}

/**
 * Constrói o caminho correto baseado no contexto (portal ou privado).
 */
export function buildPath(
  pathname: string,
  type: "list" | "collection" | "folder",
  id: string,
): string {
  const isPortal = pathname.startsWith("/portal");
  return isPortal ? `/portal/${type}/${id}` : `/${type}/${id}`;
}

export function isPublicRoute(pathname: string): boolean {
  return pathname.startsWith("/portal") || pathname.startsWith("/auth");
}
