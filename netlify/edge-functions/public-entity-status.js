const OFFICIAL_SUPABASE_PROJECT_ID = "xrnfhhoxmmstagmelvyi";
const OFFICIAL_SUPABASE_URL = `https://${OFFICIAL_SUPABASE_PROJECT_ID}.supabase.co`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

function readEdgeEnvironment(name) {
  try {
    return Netlify.env.get(name)?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function resolvePublicDataRuntime(overrides = {}) {
  const candidateUrl = overrides.url
    ?? readEdgeEnvironment("VITE_SUPABASE_URL")
    ?? readEdgeEnvironment("SUPABASE_URL")
    ?? OFFICIAL_SUPABASE_URL;
  const candidateKey = overrides.publicValue
    ?? readEdgeEnvironment("VITE_SUPABASE_PUBLISHABLE_KEY")
    ?? readEdgeEnvironment("SUPABASE_PUBLISHABLE_KEY")
    ?? readEdgeEnvironment("SUPABASE_ANON_KEY");

  try {
    const parsed = new URL(candidateUrl);
    if (
      parsed.protocol === "https:"
      && parsed.hostname === `${OFFICIAL_SUPABASE_PROJECT_ID}.supabase.co`
      && candidateKey
    ) {
      return { url: parsed.origin, publicValue: candidateKey };
    }
  } catch {
    // Invalid or foreign runtime configuration is ignored.
  }
  return null;
}

function decodeSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function isSafeTeacherSlug(value) {
  return value.length > 0
    && value.length <= 160
    && !value.includes("/")
    && !value.includes("\\")
    && !CONTROL_CHARACTER_PATTERN.test(value);
}

export function classifyPublicEntityPath(input) {
  const url = input instanceof URL ? input : new URL(input, "https://www.apeeducation.org");
  const folderMatch = url.pathname.match(/^\/portal\/folder\/([^/]+)\/?$/i);
  if (folderMatch) {
    const decoded = decodeSegment(folderMatch[1]);
    if (!decoded || !UUID_PATTERN.test(decoded)) return { kind: "invalid", entityType: "learning_resource" };
    return { kind: "entity", entityType: "learning_resource", entityKey: decoded.toLowerCase() };
  }

  const teacherMatch = url.pathname.match(/^\/portal\/professor\/([^/]+)\/?$/i);
  if (teacherMatch) {
    const decoded = decodeSegment(teacherMatch[1]);
    if (!decoded || !isSafeTeacherSlug(decoded)) return { kind: "invalid", entityType: "teacher" };
    return { kind: "entity", entityType: "teacher", entityKey: decoded.toLowerCase() };
  }
  return null;
}

export async function fetchPublicEntityHttpStatus(
  entity,
  fetchImpl = fetch,
  runtime = resolvePublicDataRuntime(),
) {
  if (!runtime) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);
  try {
    const response = await fetchImpl(`${runtime.url}/rest/v1/rpc/get_public_entity_http_status`, {
      method: "POST",
      headers: {
        apikey: runtime.publicValue,
        authorization: `Bearer ${runtime.publicValue}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        _entity_type: entity.entityType,
        _entity_key: entity.entityKey,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const row = Array.isArray(payload) ? payload[0] : payload;
    const statusCode = Number(row?.status_code);
    if (![200, 404, 410].includes(statusCode)) return null;
    return {
      statusCode,
      state: String(row?.state ?? ""),
      canonicalPath: typeof row?.canonical_path === "string" ? row.canonical_path : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function renderPublicEntityErrorPage(statusCode) {
  const gone = statusCode === 410;
  const title = gone ? "Conteúdo removido" : "Conteúdo não encontrado";
  const heading = gone ? "Este conteúdo não está mais público" : "Página pública não encontrada";
  const message = gone
    ? "Este material ou perfil já foi publicado no APE, mas foi retirado pelo responsável e não está mais disponível publicamente."
    : "Não encontramos um material ou perfil público neste endereço. A URL pode estar incorreta ou nunca ter sido publicada.";

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | APE</title>
  <meta name="description" content="${message}" />
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <meta property="og:title" content="${title} | APE" />
  <meta property="og:description" content="${message}" />
  <meta property="og:type" content="website" />
  <style>
    :root{color-scheme:dark;font-family:Nunito,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at top,#29104a 0,#10051f 45%,#090012 100%);color:#f8f5ff;padding:24px}
    main{width:min(680px,100%);border:1px solid #4a2a68;background:rgba(24,8,45,.94);border-radius:22px;padding:clamp(28px,6vw,54px);box-shadow:0 24px 80px rgba(0,0,0,.42)}
    .status{display:inline-flex;align-items:center;border:1px solid #8055a8;border-radius:999px;padding:6px 12px;color:#dcc2f5;font-weight:800;letter-spacing:.04em}h1{font-size:clamp(2rem,7vw,3.7rem);line-height:1.03;margin:22px 0 16px}
    p{font-size:1.08rem;line-height:1.7;color:#d8cee5;margin:0}nav{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;border-radius:12px;padding:10px 16px;text-decoration:none;font-weight:800}a:first-child{background:#9b5de5;color:#fff}a:last-child{border:1px solid #664285;color:#e8d8f8}
  </style>
</head>
<body data-public-entity-status="${statusCode}">
  <main>
    <span class="status">HTTP ${statusCode}</span>
    <h1>${heading}</h1>
    <p>${message}</p>
    <nav aria-label="Próximos caminhos">
      <a href="/portal">Explorar materiais públicos</a>
      <a href="/pt-br/fonte-oficial">Conhecer o APE</a>
    </nav>
  </main>
</body>
</html>`;
}

export function createPublicEntityErrorResponse(statusCode, method = "GET") {
  const body = method.toUpperCase() === "HEAD" ? null : renderPublicEntityErrorPage(statusCode);
  return new Response(body, {
    status: statusCode,
    statusText: statusCode === 410 ? "Gone" : "Not Found",
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-language": "pt-BR",
      "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      "x-robots-tag": "noindex, nofollow, noarchive",
      "x-ape-public-entity-state": statusCode === 410 ? "gone" : "not-found",
    },
  });
}

export default async function publicEntityStatusHandler(request) {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return;
  const route = classifyPublicEntityPath(request.url);
  if (!route) return;
  if (route.kind === "invalid") return createPublicEntityErrorResponse(404, method);
  try {
    const status = await fetchPublicEntityHttpStatus(route);
    if (!status || status.statusCode === 200) return;
    return createPublicEntityErrorResponse(status.statusCode, method);
  } catch (error) {
    console.warn("[public-entity-status] status lookup bypassed", error);
    return;
  }
}
