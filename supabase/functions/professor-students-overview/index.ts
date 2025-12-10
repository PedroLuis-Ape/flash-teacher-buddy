import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { aluno_id } = await req.json();

    if (!aluno_id) {
      return new Response(
        JSON.stringify({ error: 'aluno_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Basic Profile
    const { data: studentProfile } = await supabaseClient
      .from('profiles')
      .select('id, first_name, ape_id, avatar_skin_id, level, xp_total, current_streak')
      .eq('id', aluno_id)
      .single();

    // 2. Activity Last 7 Days (For Chart)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: dailyActivity } = await supabaseClient
      .from('daily_activity')
      .select('activity_date, pts_earned, actions_count')
      .eq('user_id', aluno_id)
      .gte('activity_date', sevenDaysAgo.toISOString().split('T')[0])
      .order('activity_date', { ascending: true });

    // 3. Recent Study Sessions
    const { data: recentSessions } = await supabaseClient
      .from('study_sessions')
      .select(`
        id, mode, completed, updated_at, created_at,
        list:list_id ( title, folder_id )
      `)
      .eq('user_id', aluno_id)
      .order('updated_at', { ascending: false })
      .limit(10);

    console.log(`[professor-students-overview] Fetched data for student ${aluno_id}:`, {
      hasProfile: !!studentProfile,
      dailyActivityCount: dailyActivity?.length || 0,
      sessionsCount: recentSessions?.length || 0
    });

    return new Response(
      JSON.stringify({ 
        student: studentProfile,
        dailyActivity: dailyActivity || [],
        recentSessions: recentSessions || []
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[professor-students-overview] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
