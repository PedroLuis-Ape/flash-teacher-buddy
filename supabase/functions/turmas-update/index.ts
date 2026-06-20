import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_VISIBILITY"
  | "MISSING_SCHEMA"
  | "UPDATE_FAILED";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function failure(code: ErrorCode, error: string, status: number) {
  return json({ code, error }, status);
}

function isMissingPublicColumn(error: { code?: string; message?: string; details?: string } | null) {
  if (!error) return false;
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return error.code === "42703" || (
    text.includes("public") && text.includes("turmas") && text.includes("column")
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return failure("UPDATE_FAILED", "Método não permitido", 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) {
      return failure("UNAUTHENTICATED", "Sua sessão expirou. Entre novamente para atualizar a turma.", 401);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authorization } } },
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("turmas-update UNAUTHENTICATED", authError);
      return failure("UNAUTHENTICATED", "Sua sessão expirou. Entre novamente para atualizar a turma.", 401);
    }

    const body = await req.json() as Record<string, unknown>;
    const turmaId = typeof body.turma_id === "string" ? body.turma_id.trim() : "";
    if (!uuidPattern.test(turmaId)) {
      return failure("UPDATE_FAILED", "ID da turma inválido", 400);
    }

    const updates: Record<string, unknown> = {};
    if (body.nome !== undefined) {
      if (typeof body.nome !== "string") return failure("UPDATE_FAILED", "Nome inválido", 400);
      const nome = body.nome.trim();
      if (!nome) return failure("UPDATE_FAILED", "Nome é obrigatório", 400);
      if (nome.length > 120) return failure("UPDATE_FAILED", "O nome deve ter no máximo 120 caracteres", 400);
      updates.nome = nome;
    }

    if (body.descricao !== undefined) {
      if (body.descricao !== null && typeof body.descricao !== "string") {
        return failure("UPDATE_FAILED", "Descrição inválida", 400);
      }
      const descricao = typeof body.descricao === "string" ? body.descricao.trim() : "";
      if (descricao.length > 1000) {
        return failure("UPDATE_FAILED", "A descrição deve ter no máximo 1000 caracteres", 400);
      }
      updates.descricao = descricao || null;
    }

    if (body.public !== undefined) {
      if (typeof body.public !== "boolean") {
        return failure("INVALID_VISIBILITY", "A visibilidade enviada é inválida.", 400);
      }
      updates.public = body.public;
    }

    if (Object.keys(updates).length === 0) {
      return failure("UPDATE_FAILED", "Nenhuma alteração válida foi enviada", 400);
    }

    const { data: turma, error: verifyError } = await supabaseClient
      .from("turmas")
      .select("owner_teacher_id")
      .eq("id", turmaId)
      .eq("ativo", true)
      .maybeSingle();

    if (verifyError) {
      console.error("turmas-update verification failure", verifyError);
      return failure("UPDATE_FAILED", "Não foi possível validar a turma.", 500);
    }
    if (!turma || turma.owner_teacher_id !== user.id) {
      return failure("FORBIDDEN", "Você não tem permissão para editar esta turma.", 403);
    }

    const { data: updated, error: updateError } = await supabaseClient
      .from("turmas")
      .update(updates)
      .eq("id", turmaId)
      .eq("owner_teacher_id", user.id)
      .eq("ativo", true)
      .select()
      .maybeSingle();

    if (updateError) {
      if (isMissingPublicColumn(updateError)) {
        console.error("turmas-update MISSING_SCHEMA", updateError);
        return failure("MISSING_SCHEMA", "A publicação de turmas ainda não foi instalada no servidor.", 503);
      }
      console.error("turmas-update UPDATE_FAILED", updateError);
      return failure("UPDATE_FAILED", "Não foi possível salvar as alterações da turma.", 500);
    }
    if (!updated) {
      return failure("UPDATE_FAILED", "A turma não foi encontrada ou já está inativa.", 404);
    }

    if (typeof body.public === "boolean" && updated.public !== body.public) {
      console.error("turmas-update visibility mismatch", {
        turmaId,
        requested: body.public,
        returned: updated.public,
      });
      return failure("UPDATE_FAILED", "A visibilidade da turma não foi confirmada pelo servidor.", 500);
    }

    return json({ turma: updated }, 200);
  } catch (error) {
    console.error("turmas-update unexpected error", error);
    return failure("UPDATE_FAILED", "Requisição inválida", 400);
  }
});
