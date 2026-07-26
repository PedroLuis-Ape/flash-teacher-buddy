import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicIdPattern = /^[a-zA-Z0-9_.-]{2,80}$/;

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

    const client = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ error: "Not authenticated" }, 401);

    const body = await req.json() as Record<string, unknown>;
    const turmaId = typeof body.turma_id === "string" ? body.turma_id.trim() : "";
    const studentIds = Array.isArray(body.student_ids)
      ? Array.from(new Set(body.student_ids.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean)))
      : [];

    if (!uuidPattern.test(turmaId)) return json({ error: "Invalid classroom id" }, 400);
    if (studentIds.length < 1 || studentIds.length > 100) return json({ error: "Provide between 1 and 100 students" }, 400);
    if (studentIds.some((id) => !publicIdPattern.test(id))) return json({ error: "Invalid student identifier" }, 400);

    const { data: result, error } = await client.rpc("add_students_to_turma_by_public_id_v1", {
      p_turma_id: turmaId,
      p_public_ids: studentIds,
    });

    if (error) {
      console.error("Bulk membership RPC failed", error);
      const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : error.code === "22023" ? 400 : 500;
      return json({ error: error.message || "Could not add students" }, status);
    }

    return json({
      success: true,
      added_count: result?.added_count || 0,
      message: "Students added to classroom.",
    }, 200);
  } catch (error) {
    console.error("Unexpected bulk membership error", error);
    return json({ error: "Invalid request" }, 400);
  }
});
