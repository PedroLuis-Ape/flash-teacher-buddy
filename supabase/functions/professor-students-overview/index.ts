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
    // 1. Standard Client (User Context) - Used to verify who is making the request
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 2. Admin Client (Service Role) - Used to fetch data bypassing RLS policies
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify User
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

    // 3. Security Check: Verify Relationship using Admin Client
    // We check if the requester (teacher) has a subscription to this student
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('teacher_id', user.id)
      .eq('student_id', aluno_id)
      .maybeSingle();

    // Also check if they share a class where the user is the owner (Owner Access)
    let isOwner = false;
    if (!subscription) {
      const { data: commonClass } = await supabaseAdmin
        .from('turma_membros')
        .select('turma_id, turmas!inner(owner_teacher_id)')
        .eq('user_id', aluno_id)
        .eq('turmas.owner_teacher_id', user.id)
        .limit(1);

      if (commonClass && commonClass.length > 0) isOwner = true;
    }

    const isSelf = user.id === aluno_id;

    // If not Teacher, not Owner, and not Self -> Block access
    if (!subscription && !isOwner && !isSelf) {
      console.log(`[professor-students-overview] Access denied: user ${user.id} trying to access ${aluno_id}`);
      return new Response(
        JSON.stringify({ error: 'Permission denied: You are not authorized to view this student data' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Fetch Data using Admin Client (Guaranteed to return data if it exists)

    // Basic Profile
    const { data: studentProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, ape_id, avatar_skin_id, level, xp_total, current_streak')
      .eq('id', aluno_id)
      .single();

    // Activity Last 7 Days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: dailyActivity } = await supabaseAdmin
      .from('daily_activity')
      .select('activity_date, pts_earned, actions_count')
      .eq('user_id', aluno_id)
      .gte('activity_date', sevenDaysAgo.toISOString().split('T')[0])
      .order('activity_date', { ascending: true });

    // Recent Study Sessions
    const { data: recentSessions } = await supabaseAdmin
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
      sessionsCount: recentSessions?.length || 0,
      accessBy: subscription ? 'subscription' : isOwner ? 'class_owner' : 'self'
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
