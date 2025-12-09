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

    // Read body
    let bodyData: any = {};
    if (req.method === 'POST') {
      try {
        bodyData = await req.json();
      } catch (_) {}
    }

    const url = new URL(req.url);
    const turma_id = bodyData?.turma_id || url.searchParams.get('turma_id');

    if (!turma_id) {
      return new Response(
        JSON.stringify({ error: 'turma_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[atribuicoes-by-turma] User:', user.id, 'Turma:', turma_id);

    // Client ADMIN para bypassar RLS
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Verificar se o usuário é membro ou dono da turma
    const { data: turma } = await adminClient
      .from('turmas')
      .select('owner_teacher_id')
      .eq('id', turma_id)
      .single();

    const isOwner = turma?.owner_teacher_id === user.id;

    if (!isOwner) {
      const { data: membership } = await adminClient
        .from('turma_membros')
        .select('id')
        .eq('turma_id', turma_id)
        .eq('user_id', user.id)
        .eq('ativo', true)
        .single();

      if (!membership) {
        console.log('[atribuicoes-by-turma] Acesso negado - não é membro');
        return new Response(
          JSON.stringify({ error: 'Você não tem acesso a esta turma' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2. Buscar atribuições
    const { data: atribuicoes, error: atribuicoesError } = await adminClient
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

    // 3. Buscar total de alunos na turma
    const { count: totalAlunos } = await adminClient
      .from('turma_membros')
      .select('*', { count: 'exact', head: true })
      .eq('turma_id', turma_id)
      .eq('ativo', true);

    // 4. Buscar status do usuário atual para cada atribuição (se for aluno)
    const atribuicaoIds = (atribuicoes || []).map(a => a.id);
    
    let meuStatusMap: Record<string, { status: string; progresso: number }> = {};
    
    if (!isOwner && atribuicaoIds.length > 0) {
      const { data: meusStatus } = await adminClient
        .from('atribuicoes_status')
        .select('atribuicao_id, status, progresso')
        .eq('aluno_id', user.id)
        .in('atribuicao_id', atribuicaoIds);
      
      for (const s of (meusStatus || [])) {
        meuStatusMap[s.atribuicao_id] = {
          status: s.status,
          progresso: s.progresso || 0
        };
      }
    }

    // 5. Para cada atribuição, buscar estatísticas e contagem de cards
    const atribuicoesComProgresso = await Promise.all(
      (atribuicoes || []).map(async (atrib) => {
        // Stats para professor
        const { data: statusData } = await adminClient
          .from('atribuicoes_status')
          .select('status, aluno_id')
          .eq('atribuicao_id', atrib.id);

        const stats = {
          total_alunos: totalAlunos || 0,
          concluidas: (statusData || []).filter(s => s.status === 'concluida').length,
          em_andamento: (statusData || []).filter(s => s.status === 'em_andamento').length,
          pendentes: (totalAlunos || 0) - (statusData || []).length,
        };

        // Card count
        let cardCount = 0;
        if (atrib.fonte_tipo === 'lista') {
          const { count } = await adminClient
            .from('flashcards')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', atrib.fonte_id);
          cardCount = count || 0;
        } else if (atrib.fonte_tipo === 'pasta') {
          const { data: lists } = await adminClient
            .from('lists')
            .select('id')
            .eq('folder_id', atrib.fonte_id);
          
          if (lists && lists.length > 0) {
            const listIds = lists.map(l => l.id);
            const { count } = await adminClient
              .from('flashcards')
              .select('*', { count: 'exact', head: true })
              .in('list_id', listIds);
            cardCount = count || 0;
          }
        }

        // Meu status (para alunos)
        const meuStatus = meuStatusMap[atrib.id] || { status: 'pendente', progresso: 0 };

        return {
          ...atrib,
          progresso: stats,
          card_count: cardCount,
          meu_status: meuStatus.status,
          meu_progresso: meuStatus.progresso,
        };
      })
    );

    console.log('[atribuicoes-by-turma] Returning', atribuicoesComProgresso.length, 'atribuições');

    return new Response(
      JSON.stringify({ atribuicoes: atribuicoesComProgresso }),
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
