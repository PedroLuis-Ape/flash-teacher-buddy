import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ingest-secret',
};

interface ActivateRequest {
  operationId: string;
  sku: string;
  active: boolean;
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

    const body: ActivateRequest = await req.json();

    // Validate required fields
    if (!body.operationId || !body.sku || typeof body.active !== 'boolean') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'INVALID_INPUT',
          message: 'Campos obrigatórios ausentes ou inválidos' 
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
      .eq('action', 'activate')
      .maybeSingle();

    if (existingLog) {
      // Already processed, return current state
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

    // Check if item exists
    const { data: existingItem, error: checkError } = await supabaseClient
      .from('public_catalog')
      .select('*')
      .eq('sku', body.sku)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (!existingItem) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'NOT_FOUND',
          message: 'Item não encontrado' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update is_active
    const { data: item, error: updateError } = await supabaseClient
      .from('public_catalog')
      .update({ is_active: body.active })
      .eq('sku', body.sku)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log operation
    await supabaseClient
      .from('ingest_logs')
      .insert({
        operation_id: body.operationId,
        sku: body.sku,
        action: 'activate',
        payload: { active: body.active },
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        item 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in store-admin-activate:', error);
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
