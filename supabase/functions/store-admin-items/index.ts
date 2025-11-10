import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ingest-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify ingest secret
    const ingestSecret = req.headers.get('X-Ingest-Secret');
    const envSecret = Deno.env.get('INGEST_SECRET');

    if (!envSecret) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'FORBIDDEN',
          message: 'Ingest não configurado no servidor' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (ingestSecret !== envSecret) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'FORBIDDEN',
          message: 'Credenciais inválidas' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse query params
    const url = new URL(req.url);
    const activeParam = url.searchParams.get('active');

    let query = supabaseClient
      .from('public_catalog')
      .select('*')
      .order('rarity', { ascending: false })
      .order('name', { ascending: true });

    // Filter by active status if provided
    if (activeParam === 'true') {
      query = query.eq('is_active', true);
    } else if (activeParam === 'false') {
      query = query.eq('is_active', false);
    }

    const { data: items, error } = await query;

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        items: items || [],
        count: items?.length || 0
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in store-admin-items:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
