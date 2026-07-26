import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const apeIdPattern = /^[A-Z0-9]{8,10}$/;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Not authenticated" }, 401);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authorization } } },
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) return json({ error: "Not authenticated" }, 401);

    const body = await req.json() as Record<string, unknown>;
    const turmaId = typeof body.turma_id === "string" ? body.turma_id.trim() : "";
    const apeId = typeof body.ape_id === "string" ? body.ape_id.trim().toUpperCase() : "";
    if (!turmaId) return json({ error: "Classroom id is required" }, 400);
    if (!apeIdPattern.test(apeId)) return json({ error: "Invalid APE id" }, 400);

    const { data: membership, error: memberError } = await supabaseClient.rpc(
      "transition_turma_membership_public_v1",
      {
        p_turma_id: turmaId,
        p_action: "add_direct",
        p_target_public_id: apeId,
      },
    );

    if (memberError) {
      console.error("Enrollment RPC failed", memberError);
      const status = memberError.code === "42501" ? 403 : memberError.code === "P0002" ? 404 : 500;
      return json({ error: memberError.message || "Could not enroll student" }, status);
    }

    return json({ membership }, 200);
  } catch (error) {
    console.error("Unexpected enrollment error", error);
    return json({ error: "Invalid request" }, 400);
  }
});
