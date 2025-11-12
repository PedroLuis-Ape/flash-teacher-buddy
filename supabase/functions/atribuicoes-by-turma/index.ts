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

    const url = new URL(req.url);
    const turma_id_qs = url.searchParams.get('turma_id');

    let turma_id = turma_id_qs;
    if (req.method !== 'GET' && !turma_id) {
      try {
        const body = await req.json();
        turma_id = body?.turma_id || undefined;
      } catch (_) {
        // ignore body parse errors
      }
    }

    if (!turma_id) {
      return new Response(
        JSON.stringify({ error: 'turma_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: atribuicoes, error: atribuicoesError } = await supabaseClient
      .from('atribuicoes')
      .select('*')
      .eq('turma_id', turma_id)
      .order('created_at', { ascending: false });

    if (atribuicoesError) {
      console.error('Error fetching atribuições:', atribuicoesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar atribuições' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ atribuicoes: atribuicoes || [] }),
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