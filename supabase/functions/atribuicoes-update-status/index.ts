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

    const { atribuicao_id, status, progresso } = await req.json();

    if (!atribuicao_id || !status) {
      return new Response(
        JSON.stringify({ error: 'atribuicao_id e status são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status
    const { data: updatedStatus, error: updateError } = await supabaseClient
      .from('atribuicoes_status')
      .update({
        status,
        progresso: progresso ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq('atribuicao_id', atribuicao_id)
      .eq('aluno_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating status:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If status is concluida, award points
    if (status === 'concluida') {
      const { data: atribuicao } = await supabaseClient
        .from('atribuicoes')
        .select('pontos_vale')
        .eq('id', atribuicao_id)
        .single();

      if (atribuicao && atribuicao.pontos_vale > 0) {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('pts_weekly, xp_total')
          .eq('id', user.id)
          .single();

        if (profile) {
          await supabaseClient
            .from('profiles')
            .update({
              pts_weekly: (profile.pts_weekly || 0) + atribuicao.pontos_vale,
              xp_total: (profile.xp_total || 0) + atribuicao.pontos_vale,
            })
            .eq('id', user.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ status: updatedStatus }),
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