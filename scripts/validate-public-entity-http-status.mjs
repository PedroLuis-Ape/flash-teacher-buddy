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
  classifyPublicListPath,
} from "../netlify/edge-functions/public-list-status.js";

const root = process.cwd();
const publicationMigrationPath = resolve(root, "supabase/migrations/20260713143000_public_entity_http_status.sql");
const listMigrationPath = resolve(root, "supabase/migrations/20260713152000_public_learning_list_pages.sql");
const entityEdgePath = resolve(root, "netlify/edge-functions/public-entity-status.js");
const listEdgePath = resolve(root, "netlify/edge-functions/public-list-status.js");
const netlifyConfigPath = resolve(root, "netlify.toml");

const folderId = "17171717-1717-4717-8717-171717171717";
const listId = "18181818-1818-4818-8818-181818181818";
assert.deepEqual(
  classifyPublicEntityPath(`https://www.apeeducation.org/portal/folder/${folderId}`),
  { kind: "entity", entityType: "learning_resource", entityKey: folderId },
);
assert.deepEqual(
  classifyPublicEntityPath("https://www.apeeducation.org/portal/professor/Professor-Pedro/"),
  { kind: "entity", entityType: "teacher", entityKey: "professor-pedro" },
);
assert.deepEqual(
  classifyPublicListPath(`https://www.apeeducation.org/portal/list/${listId}`),
  { kind: "entity", entityType: "learning_list", entityKey: listId },
);
assert.equal(classifyPublicEntityPath("https://www.apeeducation.org/portal"), null);
assert.equal(classifyPublicEntityPath("https://www.apeeducation.org/portal/folder/not-a-uuid")?.kind, "invalid");
assert.equal(classifyPublicEntityPath("https://www.apeeducation.org/portal/professor/%2Fprivate")?.kind, "invalid");
assert.equal(classifyPublicListPath(`https://www.apeeducation.org/portal/list/${listId}/games`), null);
assert.equal(classifyPublicListPath("https://www.apeeducation.org/portal/list/not-a-uuid")?.kind, "invalid");

assert.equal(resolvePublicDataRuntime(), null, "Sem variáveis Functions, a Edge Function deve fazer bypass seguro.");
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
}), null, "Uma configuração de outro projeto deve ser recusada.");

let capturedRequest = null;
const okFetch = async (url, init) => {
  capturedRequest = { url, init };
  return new Response(JSON.stringify([{
    status_code: 410,
    state: "gone",
    canonical_path: `/portal/folder/${folderId}`,
  }]), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const lookup = await fetchPublicEntityHttpStatus(
  { kind: "entity", entityType: "learning_resource", entityKey: folderId },
  okFetch,
  { url: "https://example.supabase.co", publicValue: "public-test-key" },
);
assert.deepEqual(lookup, {
  statusCode: 410,
  state: "gone",
  canonicalPath: `/portal/folder/${folderId}`,
});
assert.equal(capturedRequest.url, "https://example.supabase.co/rest/v1/rpc/get_public_entity_http_status");
assert.equal(capturedRequest.init.method, "POST");
assert.deepEqual(JSON.parse(capturedRequest.init.body), {
  _entity_type: "learning_resource",
  _entity_key: folderId,
});
assert.equal(capturedRequest.init.headers.apikey, "public-test-key");

const noRuntime = await fetchPublicEntityHttpStatus(
  { kind: "entity", entityType: "teacher", entityKey: "pedro" },
  async () => { throw new Error("fetch must not run without a validated runtime"); },
  null,
);
assert.equal(noRuntime, null);

const missingMigration = await fetchPublicEntityHttpStatus(
  { kind: "entity", entityType: "teacher", entityKey: "pedro" },
  async () => new Response("missing function", { status: 404 }),
  { url: "https://example.supabase.co", publicValue: "public-test-key" },
);
assert.equal(missingMigration, null, "A migration ausente deve manter o bypass seguro.");

for (const statusCode of [404, 410]) {
  const html = renderPublicEntityErrorPage(statusCode);
  assert.ok(html.includes(`data-public-entity-status="${statusCode}"`));
  assert.ok(html.includes("noindex,nofollow,noarchive"));
  assert.ok(!html.includes('rel="canonical"'));
  assert.ok(html.includes("/portal"));
  assert.ok(html.includes("/pt-br/fonte-oficial"));

  const response = createPublicEntityErrorResponse(statusCode);
  assert.equal(response.status, statusCode);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  assert.ok((await response.text()).includes(`HTTP ${statusCode}`));

  const headResponse = createPublicEntityErrorResponse(statusCode, "HEAD");
  assert.equal(headResponse.status, statusCode);
  assert.equal(await headResponse.text(), "");
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
  const missingResponse = await publicEntityStatusHandler(
    new Request("https://www.apeeducation.org/portal/professor/never-published"),
  );
  assert.equal(missingResponse.status, 404);

  globalThis.fetch = async () => new Response(JSON.stringify([{
    status_code: 200,
    state: "public",
    canonical_path: "/portal/professor/pedro",
  }]), { status: 200, headers: { "content-type": "application/json" } });
  assert.equal(await publicEntityStatusHandler(new Request("https://www.apeeducation.org/portal/professor/pedro")), undefined);
  assert.equal(await publicEntityStatusHandler(new Request("https://www.apeeducation.org/portal/professor/pedro", { method: "POST" })), undefined);

  globalThis.fetch = async () => { throw new Error("temporary network failure"); };
  assert.equal(await publicEntityStatusHandler(new Request("https://www.apeeducation.org/portal/professor/pedro")), undefined);

  globalThis.Netlify = { env: { get: () => undefined } };
  globalThis.fetch = async () => { throw new Error("fetch must not run without function-scoped variables"); };
  assert.equal(await publicEntityStatusHandler(new Request("https://www.apeeducation.org/portal/professor/pedro")), undefined);

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

const publicationMigration = readFileSync(publicationMigrationPath, "utf8");
const listMigration = readFileSync(listMigrationPath, "utf8");
const entityEdge = readFileSync(entityEdgePath, "utf8");
const listEdge = readFileSync(listEdgePath, "utf8");
const netlifyConfig = readFileSync(netlifyConfigPath, "utf8");
const edgeDeclarations = netlifyConfig.match(/\[\[edge_functions\]\]/g) ?? [];
const publicStatusFunctionCount =
  (netlifyConfig.match(/function = "public-entity-status"/g) ?? []).length
  + (netlifyConfig.match(/function = "public-list-status"/g) ?? []).length;

assert.ok(publicationMigration.includes("public_entity_publications"));
assert.ok(listMigration.includes("learning_list"));
assert.ok(listMigration.includes("get_public_entity_http_status"));
assert.ok(entityEdge.includes("Netlify.env.get"));
assert.ok(listEdge.includes('entityType: "learning_list"'));
assert.ok(!entityEdge.includes("eyJhbGci"));
assert.ok(!listEdge.includes("eyJhbGci"));
assert.ok(edgeDeclarations.length >= 3, "As três rotas públicas de status devem permanecer declaradas.");
assert.equal(publicStatusFunctionCount, 3, "Somente as duas rotas de entidade e a rota raiz de lista compõem o contrato 404/410.");
assert.ok(netlifyConfig.includes('path = "/portal/folder/*"'));
assert.ok(netlifyConfig.includes('path = "/portal/professor/*"'));
assert.ok(netlifyConfig.includes('path = "/portal/list/*"'));
assert.equal((netlifyConfig.match(/function = "public-entity-status"/g) ?? []).length, 2);
assert.equal((netlifyConfig.match(/function = "public-list-status"/g) ?? []).length, 1);
assert.ok(!netlifyConfig.includes("[build]"));

console.log("Contrato HTTP público validado: professor, pasta e lista com 200/404/410 seguros.");
