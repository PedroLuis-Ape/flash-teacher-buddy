import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // Verify user is developer_admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has developer_admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!roleData || roleData.role !== 'developer_admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ingestSecret = Deno.env.get('INGEST_SECRET');
    if (!ingestSecret) {
      console.error('INGEST_SECRET not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newPackages = [
      {
        operationId: `import-astronaut-${Date.now()}`,
        sku: "piteco_astronaut",
        title: "Piteco Astronauta",
        rarity: "epic",
        type: "bundle",
        price_ptc: 900,
        assets: {
          avatarUrl: "/assets/published/piteco_astronaut_avatar.png",
          cardUrl: "/assets/published/piteco_astronaut_card.png",
        },
        is_active: true,
        version: 1,
      },
      {
        operationId: `import-gold-${Date.now()}`,
        sku: "piteco_gold",
        title: "Piteco Chad (Gold)",
        rarity: "legendary",
        type: "bundle",
        price_ptc: 1500,
        assets: {
          avatarUrl: "/assets/published/piteco_gold_avatar.png",
          cardUrl: "/assets/published/piteco_gold_card.png",
        },
        is_active: true,
        version: 1,
      },
    ];

    const results = [];
    
    for (const pkg of newPackages) {
      try {
        const response = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/store-admin-upsert`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Ingest-Secret': ingestSecret,
            },
            body: JSON.stringify(pkg),
          }
        );

        const result = await response.json();
        results.push({
          sku: pkg.sku,
          title: pkg.title,
          success: result.success,
          alreadyProcessed: result.alreadyProcessed || false,
          error: result.error || null,
        });
      } catch (error) {
        results.push({
          sku: pkg.sku,
          title: pkg.title,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        successCount,
        errorCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in store-admin-batch-import:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
