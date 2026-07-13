import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classifyWebVital,
  ingestWebVital,
  resolveRumRuntime,
  validateRumPayload,
} from "../netlify/edge-functions/rum-web-vital.js";

const root = process.cwd();
const clientPath = resolve(root, "src/lib/coreWebVitalsRum.ts");
const edgePath = resolve(root, "netlify/edge-functions/rum-web-vital.js");
const migrationPath = resolve(root, "supabase/migrations/20260713160000_core_web_vitals_rum.sql");
const netlifyPath = resolve(root, "netlify.toml");
const client = readFileSync(clientPath, "utf8");
const edge = readFileSync(edgePath, "utf8");
const migration = readFileSync(migrationPath, "utf8");
const netlify = readFileSync(netlifyPath, "utf8");

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const serviceKey = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ ref: "ymahldldyxvwjeruaxpr", role: "service_role" })}.test-signature`;
const runtime = resolveRumRuntime({
  url: "https://ymahldldyxvwjeruaxpr.supabase.co",
  serviceKey,
});
assert.deepEqual(runtime, {
  url: "https://ymahldldyxvwjeruaxpr.supabase.co",
  serviceKey,
});
assert.equal(resolveRumRuntime({
  url: "https://wrong-project.supabase.co",
  serviceKey,
}), null);
assert.equal(resolveRumRuntime({
  url: "https://ymahldldyxvwjeruaxpr.supabase.co",
  serviceKey: `${encode({ alg: "HS256" })}.${encode({ ref: "ymahldldyxvwjeruaxpr", role: "anon" })}.signature`,
}), null);

assert.equal(classifyWebVital("LCP", 2500), "good");
assert.equal(classifyWebVital("LCP", 2500.1), "needs-improvement");
assert.equal(classifyWebVital("INP", 500.1), "poor");
assert.equal(classifyWebVital("CLS", 0.1), "good");

const payload = {
  pageViewId: "71717171-7171-4171-8171-717171717171",
  metric: "LCP",
  value: 2450.16,
  rating: "good",
  routeGroup: "/portal/list/:id",
  deviceClass: "mobile",
  navigationType: "navigate",
  sampleRate: 0.1,
  buildId: "commit-abc",
};
assert.deepEqual(validateRumPayload(payload), {
  ...payload,
  value: 2450.2,
});
assert.equal(validateRumPayload({ ...payload, userId: "private-user" }), null);
assert.equal(validateRumPayload({ ...payload, email: "person@example.com" }), null);
assert.equal(validateRumPayload({ ...payload, routeGroup: "/portal/list/real-id?answer=secret" }), null);
assert.equal(validateRumPayload({ ...payload, rating: "poor" }), null);
assert.equal(validateRumPayload({ ...payload, value: Number.POSITIVE_INFINITY }), null);

let captured = null;
const response = await ingestWebVital(
  new Request("https://www.apeeducation.org/api/rum", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://www.apeeducation.org" },
    body: JSON.stringify(payload),
  }),
  async (url, init) => {
    captured = { url, init };
    return new Response("", { status: 204 });
  },
  runtime,
);
assert.equal(response.status, 204);
assert.equal(response.headers.get("x-ape-rum-state"), "recorded");
assert.equal(captured.url, "https://ymahldldyxvwjeruaxpr.supabase.co/rest/v1/rpc/record_web_vital_sample");
const rpcBody = JSON.parse(captured.init.body);
assert.deepEqual(Object.keys(rpcBody).sort(), [
  "_build_id",
  "_device_class",
  "_metric",
  "_navigation_type",
  "_page_view_id",
  "_rating",
  "_route_group",
  "_sample_rate",
  "_value",
]);
assert.equal(rpcBody._route_group, "/portal/list/:id");
assert.equal(captured.init.headers.apikey, serviceKey);

let nonProductionFetchCalled = false;
const previewResponse = await ingestWebVital(
  new Request("https://deploy-preview-299--example.netlify.app/api/rum", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  async () => {
    nonProductionFetchCalled = true;
    return new Response(null, { status: 204 });
  },
  runtime,
);
assert.equal(previewResponse.status, 204);
assert.equal(previewResponse.headers.get("x-ape-rum-state"), "non-production-host");
assert.equal(nonProductionFetchCalled, false);

const disabledResponse = await ingestWebVital(
  new Request("https://www.apeeducation.org/api/rum", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  async () => {
    throw new Error("fetch must not run without service configuration");
  },
  null,
);
assert.equal(disabledResponse.status, 204);
assert.equal(disabledResponse.headers.get("x-ape-rum-state"), "collector-disabled");

const extraFieldResponse = await ingestWebVital(
  new Request("https://www.apeeducation.org/api/rum", {
    method: "POST",
    body: JSON.stringify({ ...payload, rawUrl: "https://example.com/private?token=1" }),
  }),
  async () => new Response(null, { status: 204 }),
  runtime,
);
assert.equal(extraFieldResponse.status, 400);
assert.equal(extraFieldResponse.headers.get("x-ape-rum-state"), "invalid-payload");

assert.ok(client.includes('navigator.sendBeacon'));
assert.ok(client.includes('new PerformanceObserver'));
assert.ok(client.includes('"largest-contentful-paint"'));
assert.ok(client.includes('"layout-shift"'));
assert.ok(client.includes('"event"'));
assert.ok(client.includes('durationThreshold: 16'));
assert.ok(client.includes('normalizeRumRoute'));
assert.ok(client.includes('window.location.hostname'));
assert.ok(!client.includes('location.search'));
assert.ok(!client.match(/userId|user_id|email|ipAddress|ip_address|userAgent|user_agent/));
assert.ok(edge.includes('ALLOWED_KEYS'));
assert.ok(edge.includes('SUPABASE_SERVICE_ROLE_KEY'));
assert.ok(!edge.includes('eyJhbGci'));
assert.ok(!edge.match(/userId|user_id|email|rawUrl|raw_url|ip_address|user_agent/));
assert.ok(migration.includes('percentile_cont(0.75)'));
assert.ok(migration.includes("metric IN ('LCP', 'INP', 'CLS')"));
assert.ok(migration.includes('REVOKE ALL ON TABLE public.web_vital_samples'));
assert.ok(migration.includes('TO service_role'));
assert.ok(!migration.match(/user_id|email|ip_address|user_agent/));
assert.ok(netlify.includes('path = "/api/rum"'));
assert.ok(netlify.includes('function = "rum-web-vital"'));

console.log("Core Web Vitals RUM validado: coleta first-party, rota normalizada e acesso service-only.");
