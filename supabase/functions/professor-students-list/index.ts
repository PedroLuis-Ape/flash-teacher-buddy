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
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is a teacher
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_teacher')
      .eq('id', user.id)
      .single();

    if (!profile?.is_teacher) {
      return new Response(
        JSON.stringify({ error: 'Apenas professores podem acessar esta função' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const cursor = url.searchParams.get('cursor');
    const q = url.searchParams.get('q') || '';
    const limit = 20;

    // Build query for subscriptions (students who follow this teacher)
    let query = supabaseClient
      .from('subscriptions')
      .select(`
        student_id,
        created_at,
        student:student_id (
          id,
          first_name,
          ape_id,
          avatar_skin_id
        )
      `)
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: subscriptions, error: subsError } = await query;

    if (subsError) {
      console.error('Error fetching students:', subsError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar alunos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let students = (subscriptions || []).map((sub: any) => ({
      aluno_id: sub.student_id,
      nome: sub.student?.first_name || 'Sem nome',
      ape_id: sub.student?.ape_id || '',
      avatar_skin_id: sub.student?.avatar_skin_id,
      desde_em: sub.created_at,
      status: 'ativo',
      origem: 'follow',
    }));

    // Filter by search query if provided
    if (q) {
      const searchLower = q.toLowerCase();
      students = students.filter((s: any) => 
        s.nome.toLowerCase().includes(searchLower) || 
        s.ape_id.toLowerCase().includes(searchLower)
      );
    }

    const hasMore = students.length > limit;
    if (hasMore) {
      students = students.slice(0, limit);
    }

    const nextCursor = hasMore && students.length > 0 
      ? students[students.length - 1].desde_em 
      : null;

    return new Response(
      JSON.stringify({ 
        students,
        nextCursor,
        hasMore,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
