import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Not authenticated" }, 401);

  try {
    const client = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: "Not authenticated" }, 401);

    return json({
      code: "LEGACY_DIRECT_ASSIGNMENT_RETIRED",
      error: "Selecione uma turma e use o fluxo transacional de atribuições da turma.",
    }, 410);
  } catch (error) {
    console.error("Legacy direct assignment gateway error", error);
    return json({ error: "Invalid request" }, 400);
  }
});
