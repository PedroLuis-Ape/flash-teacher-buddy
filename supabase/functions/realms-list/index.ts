import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[realms-list] Fetching realms list');

    // Fixed stub data with 3 realms
    const realms = [
      {
        id: "r1",
        index: 1,
        title: "Reino 1",
        iconUrl: null,
        locked: false,
      },
      {
        id: "r2",
        index: 2,
        title: "Reino 2",
        iconUrl: null,
        locked: true,
      },
      {
        id: "r3",
        index: 3,
        title: "Reino 3",
        iconUrl: null,
        locked: true,
      },
    ];

    console.log('[realms-list] Returning realms:', realms.length);

    return new Response(
      JSON.stringify({
        success: true,
        realms,
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('[realms-list] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Erro ao carregar reinos',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
