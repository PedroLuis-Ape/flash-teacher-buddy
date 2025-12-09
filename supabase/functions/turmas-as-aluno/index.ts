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
    // Client para autenticação (pega user.id do JWT)
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
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[turmas-as-aluno] User ID:', user.id);

    // Client ADMIN para bypassar RLS
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar turmas onde o usuário é membro
    const { data: memberships, error: membershipsError } = await adminClient
      .from('turma_membros')
      .select('turma_id')
      .eq('user_id', user.id)
      .eq('ativo', true);

    if (membershipsError) {
      console.error('Error fetching memberships:', membershipsError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar matrículas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[turmas-as-aluno] Memberships found:', memberships?.length || 0);

    if (!memberships || memberships.length === 0) {
      return new Response(
        JSON.stringify({ turmas: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Buscar detalhes das turmas
    const turmaIds = memberships.map(m => m.turma_id);
    
    const { data: turmas, error: turmasError } = await adminClient
      .from('turmas')
      .select('*')
      .in('id', turmaIds)
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (turmasError) {
      console.error('Error fetching turmas:', turmasError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar turmas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[turmas-as-aluno] Turmas returned:', turmas?.length || 0);

    return new Response(
      JSON.stringify({ turmas: turmas || [] }),
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
