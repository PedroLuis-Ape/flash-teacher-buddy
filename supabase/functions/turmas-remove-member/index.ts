import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    const client = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authorization } } },
    );

    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json() as Record<string, unknown>;
    const turmaId = typeof body.turma_id === "string" ? body.turma_id.trim() : "";
    const targetUserId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    if (!uuidPattern.test(turmaId)) return json({ error: "ID da turma inválido" }, 400);
    if (!uuidPattern.test(targetUserId)) return json({ error: "ID do usuário inválido" }, 400);

    const { data: turma, error: turmaError } = await client
      .from("turmas")
      .select("owner_teacher_id")
      .eq("id", turmaId)
      .eq("ativo", true)
      .maybeSingle();

    if (turmaError) {
      console.error("Error checking turma before member removal:", turmaError);
      return json({ error: "Não foi possível validar a turma" }, 500);
    }
    if (!turma || turma.owner_teacher_id !== user.id) {
      return json({ error: "Sem permissão para remover membros desta turma" }, 403);
    }
    if (targetUserId === turma.owner_teacher_id) {
      return json({ error: "Não é possível remover o professor da turma" }, 400);
    }

    const { data: removed, error: removeError } = await client
      .from("turma_membros")
      .update({ ativo: false })
      .eq("turma_id", turmaId)
      .eq("user_id", targetUserId)
      .eq("ativo", true)
      .select("id")
      .maybeSingle();

    if (removeError) {
      console.error("Error removing member:", removeError);
      return json({ error: "Erro ao remover membro" }, 500);
    }
    if (!removed) return json({ error: "Membro ativo não encontrado nesta turma" }, 404);

    return json({ success: true }, 200);
  } catch (error) {
    console.error("Unexpected member removal error:", error);
    return json({ error: "Requisição inválida" }, 400);
  }
});
