import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const publicHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

Deno.serve((request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: publicHeaders });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...publicHeaders, Allow: "GET, HEAD, OPTIONS" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!url || !publishableKey) {
    return new Response(JSON.stringify({ error: "runtime_config_unavailable" }), {
      status: 503,
      headers: { ...publicHeaders, "Cache-Control": "no-store" },
    });
  }

  const projectId = new URL(url).hostname.split(".")[0] ?? "";
  const body = JSON.stringify({ projectId, url, publishableKey });

  return new Response(request.method === "HEAD" ? null : body, {
    status: 200,
    headers: publicHeaders,
  });
});
