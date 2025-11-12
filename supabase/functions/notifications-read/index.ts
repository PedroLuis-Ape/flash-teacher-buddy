import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface MarkReadRequest {
  ids?: string[];
  mark_all?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    
    // Log mascarado (dev only)
    console.log('[notifications-read] Auth header presente:', authHeader ? `${authHeader.substring(0, 20)}...` : 'MISSING');
    
    if (!authHeader) {
      console.error('[notifications-read] Nenhum header de autorização encontrado');
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
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('[notifications-read] getUser result:', { 
      hasUser: !!user, 
      userId: user?.id?.substring(0, 8),
      hasError: !!authError,
      errorMsg: authError?.message 
    });
    
    if (authError || !user) {
      console.error('[notifications-read] Auth failed:', authError?.message || 'no user');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: MarkReadRequest = await req.json();
    const { ids, mark_all } = payload;

    if (!ids && !mark_all) {
      return new Response(
        JSON.stringify({ error: 'Forneça ids ou mark_all' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let query = supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (ids && ids.length > 0) {
      query = query.in('id', ids);
    }

    const { error: updateError } = await query;

    if (updateError) {
      console.error('Error marking notifications as read:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao marcar como lidas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[notifications-read] Success for user:', user.id.substring(0, 8));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notificações marcadas como lidas',
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