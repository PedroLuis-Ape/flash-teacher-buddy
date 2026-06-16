import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido' }, 405);
  }

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Não autorizado' }, 401);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authorization } } },
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) return json({ error: 'Não autorizado' }, 401);

    const body = await req.json() as Record<string, unknown>;
    const turmaId = typeof body.turma_id === 'string' ? body.turma_id.trim() : '';
    if (!turmaId) return json({ error: 'ID da turma é obrigatório' }, 400);

    const updates: Record<string, unknown> = {};

    if (body.nome !== undefined) {
      if (typeof body.nome !== 'string') return json({ error: 'Nome inválido' }, 400);
      const nome = body.nome.trim();
      if (!nome) return json({ error: 'Nome é obrigatório' }, 400);
      if (nome.length > 120) return json({ error: 'O nome deve ter no máximo 120 caracteres' }, 400);
      updates.nome = nome;
    }

    if (body.descricao !== undefined) {
      if (body.descricao !== null && typeof body.descricao !== 'string') {
        return json({ error: 'Descrição inválida' }, 400);
      }
      const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : '';
      if (descricao.length > 1000) {
        return json({ error: 'A descrição deve ter no máximo 1000 caracteres' }, 400);
      }
      updates.descricao = descricao || null;
    }

    if (body.public !== undefined) {
      if (typeof body.public !== 'boolean') return json({ error: 'Visibilidade inválida' }, 400);
      updates.public = body.public;
    }

    if (Object.keys(updates).length === 0) {
      return json({ error: 'Nenhuma alteração válida foi enviada' }, 400);
    }

    const { data: turma, error: verifyError } = await supabaseClient
      .from('turmas')
      .select('owner_teacher_id')
      .eq('id', turmaId)
      .single();

    if (verifyError || !turma || turma.owner_teacher_id !== user.id) {
      return json({ error: 'Você não tem permissão para editar esta turma' }, 403);
    }

    const { data: updated, error: updateError } = await supabaseClient
      .from('turmas')
      .update(updates)
      .eq('id', turmaId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating turma:', updateError);
      return json({ error: 'Erro ao atualizar turma' }, 500);
    }

    return json({ turma: updated }, 200);
  } catch (error) {
    console.error('Unexpected error:', error);
    return json({ error: 'Requisição inválida' }, 400);
  }
});
