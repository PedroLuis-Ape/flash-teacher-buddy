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
    const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
    const descricao = body.descricao;
    const isPublic = body.public ?? false;

    if (!nome) return json({ error: 'Nome é obrigatório' }, 400);
    if (nome.length > 120) return json({ error: 'O nome deve ter no máximo 120 caracteres' }, 400);
    if (descricao !== undefined && descricao !== null && typeof descricao !== 'string') {
      return json({ error: 'Descrição inválida' }, 400);
    }
    if (typeof descricao === 'string' && descricao.trim().length > 1000) {
      return json({ error: 'A descrição deve ter no máximo 1000 caracteres' }, 400);
    }
    if (typeof isPublic !== 'boolean') return json({ error: 'Visibilidade inválida' }, 400);

    const { data: turma, error: insertError } = await supabaseClient
      .from('turmas')
      .insert({
        owner_teacher_id: user.id,
        nome,
        descricao: typeof descricao === 'string' ? descricao.trim() || null : null,
        ativo: true,
        public: isPublic,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating turma:', insertError);
      return json({ error: 'Erro ao criar turma' }, 500);
    }

    return json({ turma }, 201);
  } catch (error) {
    console.error('Unexpected error:', error);
    return json({ error: 'Requisição inválida' }, 400);
  }
});
