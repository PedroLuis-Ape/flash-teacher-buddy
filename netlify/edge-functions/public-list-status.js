import {
  createPublicEntityErrorResponse,
  fetchPublicEntityHttpStatus,
} from "./public-entity-status.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function classifyListPath(input) {
  const url = input instanceof URL ? input : new URL(input, "https://www.apeeducation.org");
  const match = url.pathname.match(/^\/portal\/list\/([^/]+)\/?$/i);
  if (!match) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(match[1]);
  } catch {
    return { kind: "invalid" };
  }
  if (!UUID_PATTERN.test(decoded)) return { kind: "invalid" };
  return { kind: "entity", entityType: "learning_list", entityKey: decoded.toLowerCase() };
}

export default async function publicListStatusHandler(request) {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return;
  const route = classifyListPath(request.url);
  if (!route) return;
  if (route.kind === "invalid") return createPublicEntityErrorResponse(404, method);

  try {
    const status = await fetchPublicEntityHttpStatus(route);
    if (!status || status.statusCode === 200) return;
    return createPublicEntityErrorResponse(status.statusCode, method);
  } catch (error) {
    console.warn("[public-list-status] status lookup bypassed", error);
    return;
  }
}

export { classifyListPath };
