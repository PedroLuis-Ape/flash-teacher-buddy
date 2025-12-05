import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { turma_id, user_id } = body;

    if (!turma_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'turma_id e user_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o usuário é dono da turma
    const { data: turma, error: turmaError } = await supabaseClient
      .from('turmas')
      .select('owner_teacher_id')
      .eq('id', turma_id)
      .single();

    if (turmaError || !turma || turma.owner_teacher_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão para remover membros desta turma' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Não permitir remover o próprio dono
    if (user_id === turma.owner_teacher_id) {
      return new Response(
        JSON.stringify({ error: 'Não é possível remover o professor da turma' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Remover o membro (Hard Delete)
    const { error: removeError } = await supabaseClient
      .from('turma_membros')
      .delete()
      .eq('turma_id', turma_id)
      .eq('user_id', user_id);

    if (removeError) {
      console.error('Error removing member:', removeError);
      return new Response(
        JSON.stringify({ error: 'Erro ao remover membro' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Membro removido:', user_id, 'da turma:', turma_id);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
