import { APP_BUILD_COMMIT, APP_BUILD_ID, APP_VERSION } from "./versionManager";

export type TechnicalIncident = {
  id: string;
  route: string;
  version: string;
  buildId: string;
  commit: string;
  errorName: string;
  domain: string;
  at: string;
};

function createIncidentId(): string {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `APE-${Date.now().toString(36).toUpperCase()}-${randomPart.toUpperCase()}`;
}

function safeRoute(): string {
  if (typeof window === "undefined") return "server";
  return window.location.pathname || "/";
}

function safeDomain(componentStack: string): string {
  const component = componentStack.match(/\bin ([A-Za-z0-9_.-]+)/)?.[1];
  return component?.slice(0, 80) || "app";
}

export function createTechnicalIncident(error: unknown, componentStack = ""): TechnicalIncident {
  return {
    id: createIncidentId(),
    route: safeRoute(),
    version: APP_VERSION,
    buildId: APP_BUILD_ID,
    commit: APP_BUILD_COMMIT,
    errorName: error instanceof Error && error.name ? error.name : "UnknownError",
    domain: safeDomain(componentStack),
    at: new Date().toISOString(),
  };
}

export function formatBuildTimestamp(): string {
  const timestamp = Number(APP_BUILD_ID);
  if (!Number.isFinite(timestamp)) return "indisponível";
  return new Date(timestamp).toISOString();
}

export function logTechnicalIncident(scope: string, incident: TechnicalIncident): void {
  console.error(`[${scope}]`, {
    incidentId: incident.id,
    route: incident.route,
    version: incident.version,
    buildId: incident.buildId,
    commit: incident.commit,
    errorName: incident.errorName,
    domain: incident.domain,
    at: incident.at,
  });
}
