#!/usr/bin/env node
/**
 * Smoke test read-only do MCP do App Piteco em producao.
 *
 * Sequencia: initialize -> tools/list -> echo -> get_my_profile ->
 * list_folders -> list_lists (global e por pasta) -> get_flashcards.
 *
 * Uso:
 *   PITECO_MCP_TOKEN=<access token OAuth delegado> node docs/mcp/smoke-mcp.mjs
 *
 * Variaveis de ambiente:
 *   PITECO_MCP_TOKEN     obrigatorio. Access token OAuth DELEGADO (authorization_code
 *                        + PKCE). NUNCA coloque o token no codigo ou em arquivo versionado.
 *   PITECO_MCP_ENDPOINT  opcional. Default: MCP de producao do projeto de dados.
 *
 * Garantias:
 *   - somente leitura: nenhuma tool de escrita e chamada, mesmo agora que o catalogo
 *     publicado tambem oferece tools de escrita e de exclusao (FASE 3);
 *   - o token nunca e impresso, nem em caso de erro;
 *   - a saida nao despeja conteudo da biblioteca: so contagens, ids curtos e titulos truncados.
 *
 * Codigos de saida: 0 = tudo passou, 1 = alguma etapa falhou, 2 = uso incorreto.
 */

const DEFAULT_ENDPOINT = "https://ymahldldyxvwjeruaxpr.supabase.co/functions/v1/mcp";

/**
 * Subconjunto read-only OBRIGATORIO do catalogo. O total pode crescer (a FASE 3 adiciona tools de
 * escrita); por isso o smoke exige a presenca destas e nao um numero fixo de tools.
 */
const EXPECTED_TOOLS = [
  "echo",
  "get_my_profile",
  "list_folders",
  "list_lists",
  "get_list",
  "get_flashcards",
  "search_my_content",
];

/**
 * Bundle antigo (v0.1.0): se tools/list responder exatamente isto, o que esta publicado nao e o
 * catalogo atual — assinatura de deploy desatualizado.
 */
const STALE_TOOLSET = ["echo"];

const endpoint = (process.env.PITECO_MCP_ENDPOINT || DEFAULT_ENDPOINT).trim();
const token = (process.env.PITECO_MCP_TOKEN || "").trim();

const results = [];
let requestId = 0;

function record(step, status, detail) {
  results.push({ step, status, detail });
  const tag = status === "PASS" ? "PASS" : status === "SKIP" ? "SKIP" : "FAIL";
  console.log(`[${tag}] ${step}${detail ? ` - ${detail}` : ""}`);
}

function truncate(value, max = 240) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text === undefined) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

/**
 * Diagnostico local do token, sem revelar o segredo.
 * O MCP usa auth.oauth.issuer(...) com requireOAuthClientClaim no default (true),
 * entao um JWT de sessao do app (sem client_id/azp) e rejeitado por design.
 */
function describeToken(raw) {
  const parts = raw.split(".");
  if (parts.length !== 3) return { isJwt: false };
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const delegatedClaim = payload.client_id ?? payload.azp ?? null;
    return {
      isJwt: true,
      issuer: payload.iss ?? "(sem iss)",
      audience: payload.aud ?? "(sem aud)",
      subject: payload.sub ? `${String(payload.sub).slice(0, 8)}...` : "(sem sub)",
      delegatedClaim: delegatedClaim ?? "(nenhum)",
      hasDelegatedClaim: Boolean(delegatedClaim),
      expiresAt: typeof payload.exp === "number" ? new Date(payload.exp * 1000).toISOString() : "(sem exp)",
      expired: typeof payload.exp === "number" ? Date.now() >= payload.exp * 1000 : null,
    };
  } catch {
    return { isJwt: true, decodable: false };
  }
}

class HttpError extends Error {
  constructor(status, wwwAuthenticate, body, denoServed) {
    super(`HTTP ${status}`);
    this.status = status;
    this.wwwAuthenticate = wwwAuthenticate;
    this.body = body;
    this.denoServed = denoServed;
  }
}

/**
 * O transporte do SDK e stateless (sessionIdGenerator undefined) e responde em
 * text/event-stream por default. Exige Accept com application/json E
 * text/event-stream, senao devolve 406. Cada POST e autocontido: nao existe
 * Mcp-Session-Id a preservar entre chamadas.
 */
async function callRpc(method, params = undefined, options = {}) {
  const isNotification = method.indexOf("notifications/") === 0;
  const id = isNotification ? undefined : ++requestId;
  const payload = { jsonrpc: "2.0", method };
  if (id !== undefined) payload.id = id;
  if (params !== undefined) payload.params = params;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get("content-type") || "";
  const denoServed = Boolean(response.headers.get("x-deno-execution-id"));
  const raw = await response.text();

  if (response.status === 202 && options.allowNotification) return { status: 202, message: null };

  if (!response.ok) {
    throw new HttpError(response.status, response.headers.get("www-authenticate"), raw.slice(0, 300), denoServed);
  }

  const messages = [];
  if (contentType.indexOf("text/event-stream") !== -1) {
    for (const line of raw.split(/\r?\n/)) {
      if (line.indexOf("data:") !== 0) continue;
      const chunk = line.slice(5).trim();
      if (!chunk || chunk === "[DONE]") continue;
      try {
        messages.push(JSON.parse(chunk));
      } catch {
        // Frame SSE nao-JSON e ignorado: o smoke so depende de JSON-RPC.
      }
    }
  } else if (raw.trim()) {
    messages.push(JSON.parse(raw));
  }

  const message = id === undefined
    ? (messages.length ? messages[messages.length - 1] : null)
    : (messages.find((candidate) => candidate && candidate.id === id) ?? (messages.length ? messages[messages.length - 1] : null));

  if (message && message.error) {
    throw new Error(`JSON-RPC error ${message.error.code}: ${message.error.message}`);
  }
  return { status: response.status, message };
}

/** Toda tool devolve um envelope em content[0].text: {"ok":true,...} ou {"ok":false,error}. */
function readEnvelope(result) {
  const blocks = (result && result.content) || [];
  const textBlock = blocks.find((block) => block && block.type === "text");
  if (!textBlock || typeof textBlock.text !== "string") return null;
  try {
    return JSON.parse(textBlock.text);
  } catch {
    return null;
  }
}

async function callTool(name, args = {}) {
  const { message } = await callRpc("tools/call", { name, arguments: args });
  const envelope = readEnvelope(message && message.result);
  const isError = Boolean(message && message.result && message.result.isError) || (envelope && envelope.ok === false);
  if (isError) {
    const detail = (envelope && envelope.error) || {};
    const hint = detail.hint ? ` (hint: ${detail.hint})` : "";
    throw new Error(`tool ${name} falhou com ${detail.code || "unknown"}: ${detail.message || "sem envelope"}.${hint}`);
  }
  return envelope;
}

function explainAuthFailure(error) {
  console.error("");
  console.error("--- diagnostico da falha de autenticacao ---");
  console.error(`HTTP ${error.status} na chamada ao MCP.`);
  if (error.wwwAuthenticate) {
    console.error(`WWW-Authenticate: ${truncate(error.wwwAuthenticate, 300)}`);
  } else {
    console.error("Sem header WWW-Authenticate: indicio de 401 do gateway do Supabase (verify_jwt), nao do SDK do MCP.");
  }
  if (error.denoServed) {
    console.error("A Edge Function executou (x-deno-execution-id presente): o 401 veio do verificador OAuth do SDK.");
  } else {
    console.error("Sem x-deno-execution-id: a requisicao nao chegou a Edge Function. Verifique deploy/verify_jwt.");
  }
  console.error(`Corpo: ${truncate(error.body, 200)}`);

  const info = describeToken(token);
  if (!info.isJwt) {
    console.error("O valor em PITECO_MCP_TOKEN nao parece um JWT.");
    console.error("");
    return;
  }
  console.error("Token (sem revelar o segredo):");
  console.error(`  iss=${info.issuer} sub=${info.subject} exp=${info.expiresAt} expirado=${info.expired}`);
  console.error(`  aud=${truncate(String(info.audience), 60)} client_id/azp=${info.delegatedClaim}`);
  if (!info.hasDelegatedClaim) {
    console.error("  ATENCAO: token sem client_id nem azp. O MCP rejeita JWT de sessao do app por design");
    console.error("  (requireOAuthClientClaim=true). Use um access token OAuth delegado.");
  }
  console.error("");
}

async function main() {
  console.log(`Endpoint: ${endpoint}`);
  console.log("Modo: read-only (initialize -> tools/list -> tools read-only)");
  console.log("");

  // 1. initialize
  const init = await callRpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "ape-piteco-mcp-smoke", version: "1.0.0" },
  });
  const initResult = (init.message && init.message.result) || {};
  const serverInfo = initResult.serverInfo || {};
  record("initialize", serverInfo.name ? "PASS" : "FAIL", `server=${serverInfo.name || "?"} version=${serverInfo.version || "?"} protocol=${initResult.protocolVersion || "?"}`);
  if (!serverInfo.name) throw new Error("initialize nao retornou serverInfo");

  // 2. notifications/initialized (best effort)
  try {
    await callRpc("notifications/initialized", undefined, { allowNotification: true });
    record("notifications/initialized", "PASS", "202 aceito");
  } catch (error) {
    record("notifications/initialized", "SKIP", `ignorado: ${error.message}`);
  }

  // 3. tools/list
  const list = await callRpc("tools/list");
  const listResult = (list.message && list.message.result) || {};
  const tools = listResult.tools || [];
  const names = tools.map((tool) => tool.name);
  const missing = EXPECTED_TOOLS.filter((name) => names.indexOf(name) === -1);
  const isStale = names.length === STALE_TOOLSET.length && STALE_TOOLSET.every((name) => names.indexOf(name) !== -1);
  if (isStale) {
    record("tools/list", "FAIL", `apenas [${names.join(", ")}] - bundle publicado e o v0.1.0 (stale)`);
    throw new Error("o bundle em producao nao contem as tools da FASE 2");
  }
  record("tools/list", missing.length === 0 ? "PASS" : "FAIL", `${names.length} tools; ausentes: ${missing.length ? missing.join(", ") : "nenhuma"}`);

  // 4. echo (nao toca o banco: prova transporte + token)
  const echo = await callTool("echo", { text: "ape-piteco-smoke" });
  record("echo", echo && echo.ok === true ? "PASS" : "FAIL", "conectividade autenticada confirmada");

  // 5. get_my_profile
  const profile = await callTool("get_my_profile");
  const scopes = (profile && profile.scopes) || [];
  const userId = profile && profile.user_id ? `${String(profile.user_id).slice(0, 8)}...` : "?";
  record("get_my_profile", profile && profile.ok === true && profile.user_id ? "PASS" : "FAIL", `user_id=${userId} scopes=${scopes.length}`);

  // 6. list_folders
  const folders = await callTool("list_folders", { limit: 5 });
  const folderItems = (folders && folders.items) || [];
  record("list_folders", folders && folders.ok === true ? "PASS" : "FAIL", `returned=${folders && folders.returned} total=${folders && folders.total_count} has_more=${folders && folders.has_more}`);

  // 7. list_lists (global)
  const lists = await callTool("list_lists", { limit: 5 });
  const listItems = (lists && lists.items) || [];
  record("list_lists", lists && lists.ok === true ? "PASS" : "FAIL", `returned=${lists && lists.returned} total=${lists && lists.total_count}`);

  // 8. list_lists filtrado por pasta (exercita o filtro aninhado lists -> folders)
  const firstFolder = folderItems[0];
  if (firstFolder && firstFolder.id) {
    const scoped = await callTool("list_lists", { folder_id: firstFolder.id, limit: 5 });
    record("list_lists (folder_id)", scoped && scoped.ok === true ? "PASS" : "FAIL", `pasta "${truncate(firstFolder.title, 40)}": returned=${scoped && scoped.returned}/${scoped && scoped.total_count}`);
  } else {
    record("list_lists (folder_id)", "SKIP", "conta sem pastas pessoais");
  }

  // 9. get_flashcards (exercita flashcards -> lists -> folders)
  const firstList = listItems[0];
  if (firstList && firstList.id) {
    const cards = await callTool("get_flashcards", { list_id: firstList.id, limit: 5 });
    record("get_flashcards", cards && cards.ok === true ? "PASS" : "FAIL", `lista "${truncate(firstList.title, 40)}": returned=${cards && cards.returned} total=${cards && cards.total_count}`);
  } else {
    record("get_flashcards", "SKIP", "conta sem listas pessoais para paginar");
  }
}

if (!token) {
  console.error("PITECO_MCP_TOKEN nao definido.");
  console.error("Defina o access token OAuth delegado (nunca no codigo) e rode de novo:");
  console.error("  PowerShell:  $env:PITECO_MCP_TOKEN=\"<token>\"; node docs/mcp/smoke-mcp.mjs");
  console.error("  bash:        PITECO_MCP_TOKEN=<token> node docs/mcp/smoke-mcp.mjs");
  console.error("Como obter esse token: docs/mcp/PITECO-MCP-CONNECTION.md");
  process.exit(2);
}

try {
  await main();
} catch (error) {
  if (error instanceof HttpError) {
    record("request", "FAIL", `HTTP ${error.status}`);
    explainAuthFailure(error);
  } else {
    record("execucao", "FAIL", error.message);
  }
}

const passed = results.filter((item) => item.status === "PASS").length;
const skipped = results.filter((item) => item.status === "SKIP").length;
const failed = results.filter((item) => item.status === "FAIL").length;
console.log("");
console.log(`Resumo: ${passed} PASS, ${skipped} SKIP, ${failed} FAIL`);
if (failed > 0) {
  console.log("STATUS: FAILED");
  // Sem process.exit(): encerrar depois de um fetch faz o Node abortar no Windows
  // (libuv: Assertion failed — async.c). exitCode deixa o runtime fechar sozinho.
  process.exitCode = 1;
} else {
  console.log("STATUS: PASSED");
}
