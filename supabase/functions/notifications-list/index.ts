import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    
    // Log mascarado (dev only)
    console.log('[notifications-list] Auth header presente:', authHeader ? `${authHeader.substring(0, 20)}...` : 'MISSING');
    
    if (!authHeader) {
      console.error('[notifications-list] Nenhum header de autorização encontrado');
      return new Response(
        JSON.stringify({ error: 'Não autorizado - token ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { 
            Authorization: authHeader,
            apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          },
        },
        auth: {
          persistSession: false,
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('[notifications-list] getUser result:', { 
      hasUser: !!user, 
      userId: user?.id?.substring(0, 8),
      hasError: !!authError,
      errorMsg: authError?.message 
    });
    
    if (authError || !user) {
      console.error('[notifications-list] Auth failed:', authError?.message || 'no user');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ler do body quando chamado via supabase.functions.invoke
    const body = req.method === 'POST' ? await req.json() : {};
    const cursor = body.cursor || new URL(req.url).searchParams.get('cursor');
    const limit = parseInt(body.limit?.toString() || new URL(req.url).searchParams.get('limit') || '20', 10);

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar notificações' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasMore = notifications.length > limit;
    const items = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? items[items.length - 1].created_at : null;

    // Contar não lidas
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    console.log('[notifications-list] Success:', { itemCount: items.length, unreadCount });

    return new Response(
      JSON.stringify({
        notifications: items,
        next_cursor: nextCursor,
        has_more: hasMore,
        unread_count: unreadCount || 0,
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