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
    if (!uuidPattern.test(turmaId)) return json({ error: 'ID da turma inválido' }, 400);

    const { data: turma, error: verifyError } = await supabaseClient
      .from('turmas')
      .select('owner_teacher_id')
      .eq('id', turmaId)
      .eq('ativo', true)
      .maybeSingle();

    if (verifyError) {
      console.error('Error checking turma before deletion:', verifyError);
      return json({ error: 'Não foi possível validar a turma' }, 500);
    }
    if (!turma || turma.owner_teacher_id !== user.id) {
      return json({ error: 'Você não tem permissão para excluir esta turma' }, 403);
    }

    const { data: deleted, error: deleteError } = await supabaseClient
      .from('turmas')
      .update({ ativo: false })
      .eq('id', turmaId)
      .eq('owner_teacher_id', user.id)
      .eq('ativo', true)
      .select('id')
      .maybeSingle();

    if (deleteError) {
      console.error('Error deleting turma:', deleteError);
      return json({ error: 'Erro ao excluir turma' }, 500);
    }
    if (!deleted) return json({ error: 'Turma não encontrada ou já inativa' }, 404);

    return json({ success: true }, 200);
  } catch (error) {
    console.error('Unexpected turma deletion error:', error);
    return json({ error: 'Requisição inválida' }, 400);
  }
});