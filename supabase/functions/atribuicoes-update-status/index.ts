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
    // Client para autenticação
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    
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

    console.log('[atribuicoes-update-status] User:', user.id, 'Atribuição:', atribuicao_id, 'Status:', status);

    // Client ADMIN para bypassar RLS
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // SEGURANÇA: FORÇAR aluno_id = user.id (do token JWT)
    // Nunca confiar em aluno_id vindo do body!
    const aluno_id = user.id;

    // Verificar se o registro de status já existe
    const { data: existingStatus } = await adminClient
      .from('atribuicoes_status')
      .select('id')
      .eq('atribuicao_id', atribuicao_id)
      .eq('aluno_id', aluno_id)
      .single();

    let updatedStatus;

    if (existingStatus) {
      // Update existing
      const { data, error } = await adminClient
        .from('atribuicoes_status')
        .update({
          status,
          progresso: progresso ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingStatus.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating status:', error);
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar status' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      updatedStatus = data;
    } else {
      // Insert new
      const { data, error } = await adminClient
        .from('atribuicoes_status')
        .insert({
          atribuicao_id,
          aluno_id,
          status,
          progresso: progresso ?? 0,
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting status:', error);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar status' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      updatedStatus = data;
    }

    // Se status é 'concluida', dar pontos ao aluno
    if (status === 'concluida') {
      const { data: atribuicao } = await adminClient
        .from('atribuicoes')
        .select('pontos_vale')
        .eq('id', atribuicao_id)
        .single();

      if (atribuicao && atribuicao.pontos_vale > 0) {
        const { data: profile } = await adminClient
          .from('profiles')
          .select('pts_weekly, xp_total')
          .eq('id', aluno_id)
          .single();

        if (profile) {
          await adminClient
            .from('profiles')
            .update({
              pts_weekly: (profile.pts_weekly || 0) + atribuicao.pontos_vale,
              xp_total: (profile.xp_total || 0) + atribuicao.pontos_vale,
            })
            .eq('id', aluno_id);

          console.log('[atribuicoes-update-status] Awarded', atribuicao.pontos_vale, 'points');
        }
      }
    }

    console.log('[atribuicoes-update-status] Success');

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
