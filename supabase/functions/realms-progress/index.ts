import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    // Create Supabase client with auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Token de autenticação não fornecido',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('[realms-progress] Auth error:', userError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[realms-progress] User authenticated:', user.id);

    // Handle GET - return progress
    if (req.method === 'GET') {
      // Stub data - only realm 1 unlocked
      const progress = {
        userId: user.id,
        currentRealmIndex: 1,
        unlockedRealmIndexes: [1],
      };

      console.log('[realms-progress] Returning stub progress:', progress);

      return new Response(
        JSON.stringify({
          success: true,
          progress,
        }),
        {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // Handle POST - not implemented yet
    if (req.method === 'POST') {
      console.log('[realms-progress] POST not implemented yet');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'NOT_IMPLEMENTED',
          message: 'Esta funcionalidade ainda não está disponível',
        }),
        {
          status: 501,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Method not allowed
    return new Response(
      JSON.stringify({
        success: false,
        error: 'METHOD_NOT_ALLOWED',
        message: 'Método não permitido',
      }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[realms-progress] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Erro ao processar requisição',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
