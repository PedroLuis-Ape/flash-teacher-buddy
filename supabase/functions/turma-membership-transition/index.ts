import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicIdPattern = /^[a-zA-Z0-9_.-]{2,80}$/;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function rpcStatus(code?: string) {
  if (code === "28000") return 401;
  if (code === "42501") return 403;
  if (code === "P0002") return 404;
  if (code === "P0001") return 409;
  if (code === "22023") return 400;
  return 500;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Not authenticated" }, 401);

    const client = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authorization } } },
    );

    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ error: "Not authenticated" }, 401);

    const body = await req.json() as Record<string, unknown>;
    const turmaId = typeof body.turma_id === "string" ? body.turma_id.trim() : "";
    const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";
    const targetUserId = typeof body.target_user_id === "string" ? body.target_user_id.trim() : "";
    const targetPublicId = typeof body.target_public_id === "string" ? body.target_public_id.trim() : "";

    if (!uuidPattern.test(turmaId)) return json({ error: "Invalid classroom id" }, 400);
    if (!action) return json({ error: "Membership action is required" }, 400);
    if (targetUserId && !uuidPattern.test(targetUserId)) return json({ error: "Invalid user id" }, 400);
    if (targetUserId && targetPublicId) return json({ error: "Use one target identifier" }, 400);

    if (targetPublicId) {
      if (!publicIdPattern.test(targetPublicId)) return json({ error: "Invalid public identifier" }, 400);
      const { data, error } = await client.rpc("transition_turma_membership_public_v1", {
        p_turma_id: turmaId,
        p_action: action,
        p_target_public_id: targetPublicId,
      });
      if (error) {
        console.error("public membership transition failed", error);
        return json({ code: error.code, error: error.message || "Could not update membership" }, rpcStatus(error.code));
      }
      return json({ membership: data }, 200);
    }

    const { data, error } = await client.rpc("transition_turma_membership_v1", {
      p_turma_id: turmaId,
      p_action: action,
      p_target_user_id: targetUserId || null,
    });

    if (error) {
      console.error("membership transition failed", error);
      return json({ code: error.code, error: error.message || "Could not update membership" }, rpcStatus(error.code));
    }

    return json({ membership: data }, 200);
  } catch (error) {
    console.error("membership transition unexpected error", error);
    return json({ error: "Invalid request" }, 400);
  }
});
