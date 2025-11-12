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

    const { turma_id, aluno_id } = await req.json();

    if (!turma_id || !aluno_id) {
      return new Response(
        JSON.stringify({ error: 'turma_id e aluno_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is teacher of this turma
    const { data: turma } = await supabaseClient
      .from('turmas')
      .select('owner_teacher_id')
      .eq('id', turma_id)
      .single();

    if (!turma || turma.owner_teacher_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Apenas o professor pode abrir DMs' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find or create DM
    let { data: dm, error: dmError } = await supabaseClient
      .from('dms')
      .select('*')
      .eq('turma_id', turma_id)
      .eq('teacher_id', user.id)
      .eq('aluno_id', aluno_id)
      .single();

    if (dmError && dmError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error finding DM:', dmError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar DM' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!dm) {
      // Create new DM
      const { data: newDm, error: createError } = await supabaseClient
        .from('dms')
        .insert({
          turma_id,
          teacher_id: user.id,
          aluno_id,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating DM:', createError);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar DM' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      dm = newDm;
    }

    return new Response(
      JSON.stringify({ dm_pair_id: dm.id }),
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