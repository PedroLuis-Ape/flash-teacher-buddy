import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('[HUD] Auth error:', authError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'AUTH_REQUIRED',
          message: 'Usuário não autenticado.',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        }
      );
    }

    console.log('[HUD] Fetching summary for user:', user.id);

    // Get user balances from profiles
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('pts_weekly, balance_pitecoin')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[HUD] Profile error:', profileError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'INTERNAL_ERROR',
          message: 'Erro ao carregar perfil.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        }
      );
    }

    // Count inventory items
    const { count: inventoryCount, error: inventoryError } = await supabaseClient
      .from('user_inventory')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (inventoryError) {
      console.error('[HUD] Inventory count error:', inventoryError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'INTERNAL_ERROR',
          message: 'Erro ao contar inventário.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        }
      );
    }

    const summary = {
      ok: true,
      points: profile.pts_weekly || 0,
      ptc: profile.balance_pitecoin || 0,
      inventory_count: inventoryCount || 0,
      ts: new Date().toISOString(),
    };

    console.log('[HUD] Summary:', summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('[HUD] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'INTERNAL_ERROR',
        message: 'Erro inesperado ao carregar resumo.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      }
    );
  }
});
