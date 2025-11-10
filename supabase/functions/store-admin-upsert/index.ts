import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ingest-secret',
};

interface UpsertRequest {
  operationId: string;
  sku: string;
  title: string;
  rarity: 'normal' | 'rare' | 'epic' | 'legendary';
  type: 'avatar' | 'card' | 'bundle';
  price_ptc?: number;
  assets: {
    avatarUrl?: string;
    cardUrl?: string;
  };
  is_active?: boolean;
  version?: number;
}

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

    const body: UpsertRequest = await req.json();

    // Validate required fields
    if (!body.operationId || !body.sku || !body.title || !body.rarity || !body.type) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'INVALID_INPUT',
          message: 'Campos obrigatórios ausentes' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check idempotency
    const { data: existingLog } = await supabaseClient
      .from('ingest_logs')
      .select('*')
      .eq('operation_id', body.operationId)
      .eq('sku', body.sku)
      .eq('action', 'upsert')
      .maybeSingle();

    if (existingLog) {
      // Already processed, return existing item
      const { data: item } = await supabaseClient
        .from('public_catalog')
        .select('*')
        .eq('sku', body.sku)
        .single();

      return new Response(
        JSON.stringify({ 
          success: true, 
          alreadyProcessed: true,
          item 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate type vs assets
    if (body.type === 'avatar' && !body.assets.avatarUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'INVALID_INPUT',
          message: 'Tipo avatar requer avatarUrl' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.type === 'card' && !body.assets.cardUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'INVALID_INPUT',
          message: 'Tipo card requer cardUrl' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.type === 'bundle' && (!body.assets.avatarUrl || !body.assets.cardUrl)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'INVALID_INPUT',
          message: 'Tipo bundle requer avatarUrl e cardUrl' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get fallback price if not provided
    let price = body.price_ptc;
    if (!price) {
      const { data: fallbackPrice } = await supabaseClient
        .rpc('get_rarity_fallback_price', { p_rarity: body.rarity });
      price = fallbackPrice || 200;
    }

    // Upsert item
    const { data: item, error: upsertError } = await supabaseClient
      .from('public_catalog')
      .upsert({
        id: body.sku, // Use SKU as ID for uniqueness
        sku: body.sku,
        slug: body.sku.toLowerCase().replace(/_/g, '-'),
        name: body.title,
        rarity: body.rarity,
        type: body.type,
        price_pitecoin: price,
        avatar_final: body.assets.avatarUrl || '',
        card_final: body.assets.cardUrl || '',
        description: `${body.title} - ${body.rarity}`,
        is_active: body.is_active ?? false,
        approved: true,
        approved_by: 'system',
        version: body.version || 1,
        created_by: 'dev',
      }, { onConflict: 'sku' })
      .select()
      .single();

    if (upsertError) {
      throw upsertError;
    }

    // Log operation
    await supabaseClient
      .from('ingest_logs')
      .insert({
        operation_id: body.operationId,
        sku: body.sku,
        action: 'upsert',
        payload: body,
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        item 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in store-admin-upsert:', error);
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
