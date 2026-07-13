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

const root = process.cwd();
const migrationPath = resolve(root, "supabase/migrations/20260713143000_public_entity_http_status.sql");
const edgePath = resolve(root, "netlify/edge-functions/public-entity-status.js");

const folderId = "17171717-1717-4717-8717-171717171717";
assert.deepEqual(
  classifyPublicEntityPath(`https://www.apeeducation.org/portal/folder/${folderId}`),
  {
    kind: "entity",
    entityType: "learning_resource",
    entityKey: folderId,
  },
);
assert.deepEqual(
  classifyPublicEntityPath("https://www.apeeducation.org/portal/professor/Professor-Pedro/"),
  {
    kind: "entity",
    entityType: "teacher",
    entityKey: "professor-pedro",
  },
);
assert.equal(classifyPublicEntityPath("https://www.apeeducation.org/portal"), null);
assert.equal(
  classifyPublicEntityPath("https://www.apeeducation.org/portal/folder/not-a-uuid")?.kind,
  "invalid",
);
assert.equal(
  classifyPublicEntityPath("https://www.apeeducation.org/portal/professor/%2Fprivate")?.kind,
  "invalid",
);

assert.equal(
  resolvePublicDataRuntime(),
  null,
  "Sem variáveis Functions, a Edge Function deve fazer bypass seguro.",
);
assert.deepEqual(
  resolvePublicDataRuntime({
    url: "https://ymahldldyxvwjeruaxpr.supabase.co",
    publicValue: "public-test-key",
  }),
  {
    url: "https://ymahldldyxvwjeruaxpr.supabase.co",
    publicValue: "public-test-key",
  },
);
assert.equal(
  resolvePublicDataRuntime({
    url: "https://wrong-project.supabase.co",
    publicValue: "public-test-key",
  }),
  null,
  "Uma configuração de outro projeto deve ser recusada.",
);

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
  async () => {
    throw new Error("fetch must not run without a validated runtime");
  },
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
        if (name === "VITE_SUPABASE_URL") {
          return "https://ymahldldyxvwjeruaxpr.supabase.co";
        }
        if (name === "VITE_SUPABASE_PUBLISHABLE_KEY") {
          return "public-test-key";
        }
        return undefined;
      },
    },
  };

  globalThis.fetch = async () => new Response(JSON.stringify([{
    status_code: 404,
    state: "not_found",
    canonical_path: null,
  }]), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  const missingResponse = await publicEntityStatusHandler(
    new Request("https://www.apeeducation.org/portal/professor/never-published"),
  );
  assert.equal(missingResponse.status, 404);

  globalThis.fetch = async () => new Response(JSON.stringify([{
    status_code: 200,
    state: "public",
    canonical_path: "/portal/professor/pedro",
  }]), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  const publicResponse = await publicEntityStatusHandler(
    new Request("https://www.apeeducation.org/portal/professor/pedro"),
  );
  assert.equal(publicResponse, undefined, "Entidades públicas devem continuar para o HTML existente.");

  globalThis.fetch = async () => {
    throw new Error("temporary network failure");
  };
  const bypassResponse = await publicEntityStatusHandler(
    new Request("https://www.apeeducation.org/portal/professor/pedro"),
  );
  assert.equal(bypassResponse, undefined, "Falhas temporárias não podem criar falsos 404.");

  globalThis.Netlify = { env: { get: () => undefined } };
  globalThis.fetch = async () => {
    throw new Error("fetch must not run without function-scoped variables");
  };
  const unconfiguredResponse = await publicEntityStatusHandler(
    new Request("https://www.apeeducation.org/portal/professor/pedro"),
  );
  assert.equal(unconfiguredResponse, undefined);
} finally {
  globalThis.fetch = originalFetch;
  if (originalNetlify === undefined) {
    delete globalThis.Netlify;
  } else {
    globalThis.Netlify = originalNetlify;
  }
}

const migration = readFileSync(migrationPath, "utf8");
const edge = readFileSync(edgePath, "utf8");
assert.ok(migration.includes("public_entity_publications"));
assert.ok(migration.includes("sync_folder_publication_registry_trigger"));
assert.ok(migration.includes("sync_profile_publication_registry_trigger"));
assert.ok(migration.includes("get_public_entity_http_status"));
assert.ok(migration.includes("CASE WHEN matched.current_public THEN 200 ELSE 410 END"));
assert.ok(migration.includes("404"));
assert.ok(migration.includes("REVOKE ALL ON TABLE"));
assert.ok(migration.includes("GRANT EXECUTE ON FUNCTION public.get_public_entity_http_status"));
assert.ok(edge.includes('path: ["/portal/folder/*", "/portal/professor/*"]'));
assert.ok(edge.includes('method: ["GET", "HEAD"]'));
assert.ok(edge.includes("if (!status || status.statusCode === 200) return"));
assert.ok(edge.includes("globalThis.Netlify?.env?.get"));
assert.ok(!edge.includes("eyJhbGci"), "Nenhuma chave JWT pode ficar embutida na Edge Function.");

console.log("Contrato HTTP público validado: 200 bypass, 404 nunca publicado e 410 retirado.");
