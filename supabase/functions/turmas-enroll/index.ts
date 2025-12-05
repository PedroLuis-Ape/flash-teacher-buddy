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

    const { turma_id, ape_id } = await req.json();

    if (!turma_id || !ape_id) {
      return new Response(
        JSON.stringify({ error: 'turma_id e ape_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is the turma owner
    const { data: turma, error: turmaError } = await supabaseClient
      .from('turmas')
      .select('owner_teacher_id')
      .eq('id', turma_id)
      .single();

    if (turmaError || !turma || turma.owner_teacher_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Turma não encontrada ou acesso negado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find user by ape_id
    const { data: targetProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('ape_id', ape_id.trim().toUpperCase())
      .single();

    if (profileError || !targetProfile) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado com esse APE ID' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert member (Create or Reactivate)
    const { data: member, error: memberError } = await supabaseClient
      .from('turma_membros')
      .upsert(
        {
          turma_id,
          user_id: targetProfile.id,
          role: 'aluno',
          ativo: true,
        },
        { 
          onConflict: 'turma_id,user_id',
          ignoreDuplicates: false 
        } 
      )
      .select()
      .single();

    if (memberError) {
      console.error('Error enrolling member:', memberError);
      return new Response(
        JSON.stringify({ error: 'Erro ao matricular aluno: ' + memberError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ member }),
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