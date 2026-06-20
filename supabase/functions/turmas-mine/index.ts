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

    const { data: turmas, error: turmasError } = await supabaseClient
      .from("turmas")
      .select("*, turma_membros(count)")
      .eq("owner_teacher_id", user.id)
      .eq("ativo", true)
      .order("created_at", { ascending: false });

    if (turmasError) {
      console.error("Error fetching owned turmas:", turmasError);
      return json({ error: "Erro ao buscar turmas" }, 500);
    }

    return json({ turmas: turmas ?? [] }, 200);
  } catch (error) {
    console.error("Unexpected turmas-mine error:", error);
    return json({ error: "Erro interno" }, 500);
  }
});
