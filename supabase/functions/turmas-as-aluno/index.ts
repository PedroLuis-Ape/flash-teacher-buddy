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
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Não autorizado" }, 401);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authorization } } },
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) return json({ error: "Não autorizado" }, 401);

    const { data: memberships, error: membershipsError } = await supabaseClient
      .from("turma_membros")
      .select("turma_id")
      .eq("user_id", user.id)
      .eq("ativo", true);

    if (membershipsError) {
      console.error("Error fetching memberships:", membershipsError);
      return json({ error: "Erro ao buscar matrículas" }, 500);
    }

    const turmaIds = Array.from(new Set((memberships ?? []).map((membership) => membership.turma_id)));
    if (turmaIds.length === 0) return json({ turmas: [] }, 200);

    const { data: turmas, error: turmasError } = await supabaseClient
      .from("turmas")
      .select("*")
      .in("id", turmaIds)
      .eq("ativo", true)
      .order("created_at", { ascending: false });

    if (turmasError) {
      console.error("Error fetching enrolled turmas:", turmasError);
      return json({ error: "Erro ao buscar turmas" }, 500);
    }

    return json({ turmas: turmas ?? [] }, 200);
  } catch (error) {
    console.error("Unexpected turmas-as-aluno error:", error);
    return json({ error: "Erro interno" }, 500);
  }
});
