import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import publicEntityStatusHandler, {
  classifyPublicEntityPath,
  createPublicEntityErrorResponse,
  fetchPublicEntityHttpStatus,
  renderPublicEntityErrorPage,
  resolvePublicDataRuntime,
} from "../netlify/edge-functions/public-entity-status.js";
import publicListStatusHandler, {
  classifyListPath,
} from "../netlify/edge-functions/public-list-status.js";

const root = process.cwd();
const publicationMigration = readFileSync(resolve(root, "supabase/migrations/20260713143000_public_entity_http_status.sql"), "utf8");
const listMigration = readFileSync(resolve(root, "supabase/migrations/20260713152000_public_learning_list_pages.sql"), "utf8");
const entityEdge = readFileSync(resolve(root, "netlify/edge-functions/public-entity-status.js"), "utf8");
const listEdge = readFileSync(resolve(root, "netlify/edge-functions/public-list-status.js"), "utf8");
const netlifyConfig = readFileSync(resolve(root, "netlify.toml"), "utf8");
const folderId = "17171717-1717-4717-8717-171717171717";
const listId = "41414141-4141-4141-8141-414141414141";

assert.deepEqual(classifyPublicEntityPath(`https://www.apeeducation.org/portal/folder/${folderId}`), {
  kind: "entity", entityType: "learning_resource", entityKey: folderId,
});
assert.deepEqual(classifyPublicEntityPath("https://www.apeeducation.org/portal/professor/Professor-Pedro/"), {
  kind: "entity", entityType: "teacher", entityKey: "professor-pedro",
});
assert.deepEqual(classifyListPath(`https://www.apeeducation.org/portal/list/${listId}`), {
  kind: "entity", entityType: "learning_list", entityKey: listId,
});
assert.equal(classifyListPath(`https://www.apeeducation.org/portal/list/${listId}/games`), null);
assert.equal(classifyListPath("https://www.apeeducation.org/portal/list/not-a-uuid")?.kind, "invalid");
assert.equal(classifyPublicEntityPath("https://www.apeeducation.org/portal"), null);

assert.equal(resolvePublicDataRuntime(), null, "Sem variáveis Functions, a borda deve fazer bypass seguro.");
assert.deepEqual(resolvePublicDataRuntime({
  url: "https://ymahldldyxvwjeruaxpr.supabase.co",
  publicValue: "public-test-key",
}), {
  url: "https://ymahldldyxvwjeruaxpr.supabase.co",
  publicValue: "public-test-key",
});
assert.equal(resolvePublicDataRuntime({
  url: "https://wrong-project.supabase.co",
  publicValue: "public-test-key",
}), null);

let capturedRequest = null;
const lookup = await fetchPublicEntityHttpStatus(
  { kind: "entity", entityType: "learning_list", entityKey: listId },
  async (url, init) => {
    capturedRequest = { url, init };
    return new Response(JSON.stringify([{
      status_code: 410,
      state: "gone",
      canonical_path: `/portal/list/${listId}`,
    }]), { status: 200, headers: { "content-type": "application/json" } });
  },
  { url: "https://example.supabase.co", publicValue: "public-test-key" },
);
assert.deepEqual(lookup, {
  statusCode: 410,
  state: "gone",
  canonicalPath: `/portal/list/${listId}`,
});
assert.deepEqual(JSON.parse(capturedRequest.init.body), {
  _entity_type: "learning_list",
  _entity_key: listId,
});

for (const statusCode of [404, 410]) {
  const html = renderPublicEntityErrorPage(statusCode);
  assert.ok(html.includes(`data-public-entity-status="${statusCode}"`));
  assert.ok(html.includes("noindex,nofollow,noarchive"));
  assert.ok(!html.includes('rel="canonical"'));
  const response = createPublicEntityErrorResponse(statusCode);
  assert.equal(response.status, statusCode);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  const head = createPublicEntityErrorResponse(statusCode, "HEAD");
  assert.equal(await head.text(), "");
}

const originalFetch = globalThis.fetch;
const originalNetlify = globalThis.Netlify;
try {
  globalThis.Netlify = {
    env: {
      get(name) {
        if (name === "VITE_SUPABASE_URL") return "https://ymahldldyxvwjeruaxpr.supabase.co";
        if (name === "VITE_SUPABASE_PUBLISHABLE_KEY") return "public-test-key";
        return undefined;
      },
    },
  };
  globalThis.fetch = async () => new Response(JSON.stringify([{
    status_code: 404,
    state: "not_found",
    canonical_path: null,
  }]), { status: 200, headers: { "content-type": "application/json" } });
  assert.equal((await publicEntityStatusHandler(new Request("https://www.apeeducation.org/portal/professor/never-published"))).status, 404);
  assert.equal((await publicListStatusHandler(new Request(`https://www.apeeducation.org/portal/list/${listId}`))).status, 404);

  globalThis.fetch = async () => new Response(JSON.stringify([{
    status_code: 200,
    state: "public",
    canonical_path: `/portal/list/${listId}`,
  }]), { status: 200, headers: { "content-type": "application/json" } });
  assert.equal(await publicListStatusHandler(new Request(`https://www.apeeducation.org/portal/list/${listId}`)), undefined);
  assert.equal(await publicListStatusHandler(new Request(`https://www.apeeducation.org/portal/list/${listId}/games`)), undefined);
} finally {
  globalThis.fetch = originalFetch;
  if (originalNetlify === undefined) delete globalThis.Netlify;
  else globalThis.Netlify = originalNetlify;
}

assert.ok(publicationMigration.includes("public_entity_publications"));
assert.ok(listMigration.includes("learning_list"));
assert.ok(listMigration.includes("get_public_entity_http_status"));
assert.ok(entityEdge.includes("Netlify.env.get"));
assert.ok(listEdge.includes('entityType: "learning_list"'));
assert.ok(!entityEdge.includes("eyJhbGci"));
assert.ok(!listEdge.includes("eyJhbGci"));
assert.equal((netlifyConfig.match(/\[\[edge_functions\]\]/g) ?? []).length, 3);
assert.ok(netlifyConfig.includes('path = "/portal/folder/*"'));
assert.ok(netlifyConfig.includes('path = "/portal/professor/*"'));
assert.ok(netlifyConfig.includes('path = "/portal/list/*"'));
assert.equal((netlifyConfig.match(/function = "public-entity-status"/g) ?? []).length, 2);
assert.equal((netlifyConfig.match(/function = "public-list-status"/g) ?? []).length, 1);
assert.ok(!netlifyConfig.includes("[build]"));

console.log("Contrato HTTP público validado: professor, pasta e lista com 200/404/410 seguros.");
