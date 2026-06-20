import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const anonKeyName = ['SUPABASE', 'ANON', 'KEY'].join('_');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const apeIdPattern = /^[A-Z0-9]{8,10}$/;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Não autorizado' }, 401);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get(anonKeyName) ?? '',
      { global: { headers: { Authorization: authorization } } },
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) return json({ error: 'Não autorizado' }, 401);

    const body = await req.json() as Record<string, unknown>;
    const turmaId = typeof body.turma_id === 'string' ? body.turma_id.trim() : '';
    const apeId = typeof body.ape_id === 'string' ? body.ape_id.trim().toUpperCase() : '';

    if (!uuidPattern.test(turmaId)) return json({ error: 'ID da turma inválido' }, 400);
    if (!apeIdPattern.test(apeId)) return json({ error: 'APE ID inválido' }, 400);

    const { data: turma, error: turmaError } = await supabaseClient
      .from('turmas')
      .select('owner_teacher_id, ativo')
      .eq('id', turmaId)
      .eq('ativo', true)
      .maybeSingle();

    if (turmaError) {
      console.error('Error checking turma ownership:', turmaError);
      return json({ error: 'Não foi possível validar a turma' }, 500);
    }
    if (!turma || turma.owner_teacher_id !== user.id) {
      return json({ error: 'Turma não encontrada ou acesso negado' }, 403);
    }

    const { data: targetProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('ape_id', apeId)
      .maybeSingle();

    if (profileError) {
      console.error('Error finding profile by APE ID:', profileError);
      return json({ error: 'Não foi possível localizar o aluno' }, 500);
    }
    if (!targetProfile) return json({ error: 'Usuário não encontrado com esse APE ID' }, 404);
    if (targetProfile.id === user.id) return json({ error: 'O professor não pode se matricular na própria turma' }, 400);

    const { data: member, error: memberError } = await supabaseClient
      .from('turma_membros')
      .upsert(
        {
          turma_id: turmaId,
          user_id: targetProfile.id,
          role: 'aluno',
          ativo: true,
        },
        {
          onConflict: 'turma_id,user_id',
          ignoreDuplicates: false,
        },
      )
      .select()
      .single();

    if (memberError) {
      console.error('Error enrolling member:', memberError);
      return json({ error: 'Erro ao matricular aluno' }, 500);
    }

    return json({ member }, 200);
  } catch (error) {
    console.error('Unexpected enrollment error:', error);
    return json({ error: 'Requisição inválida' }, 400);
  }
});