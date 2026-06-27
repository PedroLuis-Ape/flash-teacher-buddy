import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const publicHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  "Content-Type": "application/javascript; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

Deno.serve((request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: publicHeaders });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...publicHeaders, Allow: "GET, HEAD, OPTIONS" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!url || !publishableKey) {
    return new Response("Runtime configuration unavailable", {
      status: 503,
      headers: { ...publicHeaders, "Cache-Control": "no-store" },
    });
  }

  const projectId = new URL(url).hostname.split(".")[0] ?? "";
  const payload = JSON.stringify({ projectId, url, publishableKey }).replaceAll("<", "\\u003c");
  const source = `window.__APE_SUPABASE_CONFIG__ = Object.freeze(${payload});\n`;

  return new Response(request.method === "HEAD" ? null : source, {
    status: 200,
    headers: publicHeaders,
  });
});
