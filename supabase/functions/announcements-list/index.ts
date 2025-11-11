import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ler do body quando chamado via supabase.functions.invoke
    const body = req.method === 'POST' ? await req.json() : {};
    const class_id = body.class_id || new URL(req.url).searchParams.get('class_id');
    const cursor = body.cursor || new URL(req.url).searchParams.get('cursor');
    const limit = parseInt(body.limit?.toString() || new URL(req.url).searchParams.get('limit') || '20', 10);

    if (!class_id) {
      return new Response(
        JSON.stringify({ error: 'class_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é membro da turma
    const { data: membership } = await supabase
      .from('class_members')
      .select('user_id')
      .eq('class_id', class_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    // Ou se é owner
    const { data: classData } = await supabase
      .from('classes')
      .select('owner_id')
      .eq('id', class_id)
      .single();

    if (!membership && classData?.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Você não tem permissão nesta turma.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar anúncios (pinned primeiro, depois por data)
    let query = supabase
      .from('announcements')
      .select(`
        id,
        class_id,
        author_id,
        title,
        body,
        pinned,
        created_at,
        updated_at,
        profiles!announcements_author_id_fkey(first_name, avatar_skin_id)
      `)
      .eq('class_id', class_id)
      .is('archived_at', null)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: announcements, error } = await query;

    if (error) {
      console.error('Error fetching announcements:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar anúncios' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasMore = announcements.length > limit;
    const items = hasMore ? announcements.slice(0, limit) : announcements;
    const nextCursor = hasMore ? items[items.length - 1].created_at : null;

    // Buscar contagem de comentários para cada anúncio
    const announcementIds = items.map((a) => a.id);
    const { data: threads } = await supabase
      .from('threads')
      .select('announcement_id, id')
      .in('announcement_id', announcementIds)
      .eq('type', 'announcement');

    const threadIds = threads?.map((t) => t.id) || [];
    let commentsCount: Record<string, number> = {};

    if (threadIds.length > 0) {
      const { data: messages } = await supabase
        .from('messages')
        .select('thread_id')
        .in('thread_id', threadIds);

      // Criar mapa de announcement_id -> thread_id
      const threadMap = new Map(threads?.map((t) => [t.id, t.announcement_id]) || []);
      
      messages?.forEach((m) => {
        const announcementId = threadMap.get(m.thread_id);
        if (announcementId) {
          commentsCount[announcementId] = (commentsCount[announcementId] || 0) + 1;
        }
      });
    }

    const enriched = items.map((a) => ({
      ...a,
      comment_count: commentsCount[a.id] || 0,
    }));

    return new Response(
      JSON.stringify({
        announcements: enriched,
        next_cursor: nextCursor,
        has_more: hasMore,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
