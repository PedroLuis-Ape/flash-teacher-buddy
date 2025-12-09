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
    const folder_id = bodyData?.folder_id || url.searchParams.get('folder_id');

    if (!folder_id) {
      return new Response(
        JSON.stringify({ error: 'folder_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[get-folder-full] User:', user.id, 'Folder:', folder_id);

    // Client ADMIN para bypassar RLS
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar a pasta
    const { data: folder, error: folderError } = await adminClient
      .from('folders')
      .select('*')
      .eq('id', folder_id)
      .single();

    if (folderError || !folder) {
      console.log('[get-folder-full] Pasta não encontrada');
      return new Response(
        JSON.stringify({ error: 'Pasta não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verificar permissão de acesso
    // O usuário pode acessar se:
    // a) É o dono da pasta
    // b) Está inscrito em uma turma do professor dono da pasta
    // c) Tem subscription para o professor
    // d) A pasta é de uma classe que ele faz parte

    const isOwner = folder.owner_id === user.id;
    let hasAccess = isOwner;

    if (!hasAccess) {
      // Verificar se o usuário é aluno de alguma turma do professor dono da pasta
      const { data: teacherTurmas } = await adminClient
        .from('turmas')
        .select('id')
        .eq('owner_teacher_id', folder.owner_id);

      if (teacherTurmas && teacherTurmas.length > 0) {
        const turmaIds = teacherTurmas.map(t => t.id);
        
        const { data: membership } = await adminClient
          .from('turma_membros')
          .select('id')
          .eq('user_id', user.id)
          .eq('ativo', true)
          .in('turma_id', turmaIds)
          .limit(1)
          .single();

        if (membership) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      // Verificar subscription direta professor-aluno
      const { data: subscription } = await adminClient
        .from('subscriptions')
        .select('id')
        .eq('student_id', user.id)
        .eq('teacher_id', folder.owner_id)
        .single();

      if (subscription) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      // Verificar se a pasta é de uma classe que o usuário faz parte
      if (folder.class_id) {
        const { data: classMembership } = await adminClient
          .from('class_members')
          .select('user_id')
          .eq('class_id', folder.class_id)
          .eq('user_id', user.id)
          .single();

        if (classMembership) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      // Última verificação: pasta com visibilidade 'class' e usuário tem public_access
      if (folder.visibility === 'class') {
        const { data: ownerProfile } = await adminClient
          .from('profiles')
          .select('public_access_enabled')
          .eq('id', folder.owner_id)
          .single();

        if (ownerProfile?.public_access_enabled) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      console.log('[get-folder-full] Acesso negado');
      return new Response(
        JSON.stringify({ error: 'Você não tem acesso a esta pasta' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Buscar listas da pasta
    const { data: lists, error: listsError } = await adminClient
      .from('lists')
      .select('id, title, description, lang, order_index, created_at')
      .eq('folder_id', folder_id)
      .order('order_index', { ascending: true });

    if (listsError) {
      console.error('Error fetching lists:', listsError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar listas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Contar cards por lista
    const listsWithCounts = await Promise.all(
      (lists || []).map(async (list) => {
        const { count } = await adminClient
          .from('flashcards')
          .select('*', { count: 'exact', head: true })
          .eq('list_id', list.id);

        return {
          ...list,
          cards_count: count || 0,
        };
      })
    );

    console.log('[get-folder-full] Returning folder with', listsWithCounts.length, 'lists');

    return new Response(
      JSON.stringify({
        folder,
        lists: listsWithCounts,
      }),
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
