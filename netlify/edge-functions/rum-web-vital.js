const PRODUCTION_DATA_PROJECT_ID = "ymahldldyxvwjeruaxpr";
const PRODUCTION_DATA_URL = `https://${PRODUCTION_DATA_PROJECT_ID}.supabase.co`;
const CANONICAL_HOST = "www.apeeducation.org";
const MAX_BODY_BYTES = 4096;
const ALLOWED_KEYS = new Set([
  "pageViewId",
  "metric",
  "value",
  "rating",
  "routeGroup",
  "deviceClass",
  "navigationType",
  "sampleRate",
  "buildId",
]);
const METRICS = new Set(["LCP", "INP", "CLS"]);
const RATINGS = new Set(["good", "needs-improvement", "poor"]);
const DEVICE_CLASSES = new Set(["mobile", "tablet", "desktop"]);
const NAVIGATION_TYPES = new Set(["navigate", "reload", "back_forward", "prerender", "unknown"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readEdgeEnvironment(name) {
  try {
    return Netlify.env.get(name)?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function decodeBase64Url(value) {
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function validateServiceCredential(value) {
  if (!value) return false;
  if (value.startsWith("sb_secret_")) return value.length >= 32;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const payload = decodeBase64Url(parts[1]);
  return payload?.ref === PRODUCTION_DATA_PROJECT_ID && payload?.role === "service_role";
}

export function resolveRumRuntime(overrides = {}) {
  const candidateUrl = overrides.url
    ?? readEdgeEnvironment("VITE_SUPABASE_URL")
    ?? readEdgeEnvironment("SUPABASE_URL")
    ?? PRODUCTION_DATA_URL;
  const serviceKey = overrides.serviceKey
    ?? readEdgeEnvironment("SUPABASE_SERVICE_ROLE_KEY")
    ?? readEdgeEnvironment("SUPABASE_SECRET_KEY");

  try {
    const parsed = new URL(candidateUrl);
    if (
      parsed.protocol === "https:"
      && parsed.hostname === `${PRODUCTION_DATA_PROJECT_ID}.supabase.co`
      && validateServiceCredential(serviceKey)
    ) {
      return { url: parsed.origin, serviceKey };
    }
  } catch {
    // Invalid runtime configuration is handled as a disabled collector.
  }
  return null;
}

export function classifyWebVital(metric, value) {
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
  if (metric === "CLS") {
    if (value <= 0.1) return "good";
    if (value <= 0.25) return "needs-improvement";
    return "poor";
  }
  return null;
}

function isSafeRouteGroup(value) {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 160
    && value.startsWith("/")
    && !value.includes("?")
    && !value.includes("#")
    && !value.includes("@")
    && !/[\u0000-\u001f\u007f]/.test(value);
}

export function validateRumPayload(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const keys = Object.keys(input);
  if (keys.some((key) => !ALLOWED_KEYS.has(key))) return null;

  const metric = typeof input.metric === "string" ? input.metric.toUpperCase() : "";
  const value = Number(input.value);
  const rating = typeof input.rating === "string" ? input.rating.toLowerCase() : "";
  const deviceClass = typeof input.deviceClass === "string" ? input.deviceClass.toLowerCase() : "";
  const navigationType = typeof input.navigationType === "string" ? input.navigationType.toLowerCase() : "";
  const sampleRate = Number(input.sampleRate);
  const buildId = typeof input.buildId === "string" && input.buildId.trim()
    ? input.buildId.trim()
    : null;

  if (!UUID_PATTERN.test(String(input.pageViewId ?? ""))) return null;
  if (!METRICS.has(metric) || !Number.isFinite(value)) return null;
  if ((metric === "CLS" && (value < 0 || value > 10)) || (metric !== "CLS" && (value < 0 || value > 60000))) return null;
  if (!RATINGS.has(rating) || rating !== classifyWebVital(metric, value)) return null;
  if (!isSafeRouteGroup(input.routeGroup)) return null;
  if (!DEVICE_CLASSES.has(deviceClass) || !NAVIGATION_TYPES.has(navigationType)) return null;
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || sampleRate > 1) return null;
  if (buildId && (buildId.length > 80 || /[\u0000-\u001f\u007f]/.test(buildId))) return null;

  return {
    pageViewId: String(input.pageViewId).toLowerCase(),
    metric,
    value: metric === "CLS" ? Math.round(value * 10000) / 10000 : Math.round(value * 10) / 10,
    rating,
    routeGroup: input.routeGroup,
    deviceClass,
    navigationType,
    sampleRate: Math.round(sampleRate * 10000) / 10000,
    buildId,
  };
}

function emptyResponse(status = 204, state = "accepted") {
  return new Response(null, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-ape-rum-state": state,
    },
  });
}

export async function ingestWebVital(request, fetchImpl = fetch, runtime = resolveRumRuntime()) {
  if (request.method.toUpperCase() !== "POST") return emptyResponse(405, "method-not-allowed");

  const requestUrl = new URL(request.url);
  if (requestUrl.hostname !== CANONICAL_HOST) return emptyResponse(204, "non-production-host");

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).hostname !== CANONICAL_HOST) return emptyResponse(204, "origin-rejected");
    } catch {
      return emptyResponse(204, "origin-rejected");
    }
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return emptyResponse(413, "payload-too-large");

  let text;
  try {
    text = await request.text();
  } catch {
    return emptyResponse(400, "invalid-body");
  }
  if (!text || new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return emptyResponse(400, "invalid-body");

  let payload;
  try {
    payload = validateRumPayload(JSON.parse(text));
  } catch {
    payload = null;
  }
  if (!payload) return emptyResponse(400, "invalid-payload");
  if (!runtime) return emptyResponse(204, "collector-disabled");

  try {
    const response = await fetchImpl(`${runtime.url}/rest/v1/rpc/record_web_vital_sample`, {
      method: "POST",
      headers: {
        apikey: runtime.serviceKey,
        authorization: `Bearer ${runtime.serviceKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        _page_view_id: payload.pageViewId,
        _metric: payload.metric,
        _value: payload.value,
        _rating: payload.rating,
        _route_group: payload.routeGroup,
        _device_class: payload.deviceClass,
        _navigation_type: payload.navigationType,
        _sample_rate: payload.sampleRate,
        _build_id: payload.buildId,
      }),
    });

    if (!response.ok) {
      console.warn("[rum-web-vital] database write unavailable", response.status);
      return emptyResponse(204, "database-unavailable");
    }
    return emptyResponse(204, "recorded");
  } catch (error) {
    console.warn("[rum-web-vital] ingestion bypassed", error);
    return emptyResponse(204, "network-unavailable");
  }
}

export default function rumWebVitalHandler(request) {
  return ingestWebVital(request);
}
