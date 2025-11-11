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

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'UNAUTHORIZED', message: 'Você precisa estar logado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { class_id, other_user_id } = body;

    // Validar input
    if (!class_id || !other_user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'INVALID_INPUT', message: 'class_id e other_user_id são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (user.id === other_user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'INVALID_INPUT', message: 'Não é possível criar DM consigo mesmo.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se ambos são membros ativos da turma
    const { data: members } = await supabaseClient
      .from('class_members')
      .select('user_id, role')
      .eq('class_id', class_id)
      .eq('status', 'active')
      .in('user_id', [user.id, other_user_id]);

    if (!members || members.length !== 2) {
      return new Response(
        JSON.stringify({ success: false, error: 'FORBIDDEN', message: 'Você não tem permissão nesta turma.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se um é professor e outro aluno
    const roles = members.map(m => m.role);
    const hasTeacher = roles.includes('teacher');
    const hasStudent = roles.includes('student');

    if (!hasTeacher || !hasStudent) {
      return new Response(
        JSON.stringify({ success: false, error: 'FORBIDDEN', message: 'DM só é permitido entre professor e aluno.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ordenar IDs para garantir unicidade (user_a < user_b)
    const [userA, userB] = [user.id, other_user_id].sort();

    // Buscar thread existente
    const { data: existingThread } = await supabaseClient
      .from('threads')
      .select('*')
      .eq('class_id', class_id)
      .eq('user_a_id', userA)
      .eq('user_b_id', userB)
      .single();

    if (existingThread) {
      console.log('Thread found:', existingThread.id);
      return new Response(
        JSON.stringify({
          success: true,
          thread_id: existingThread.id,
          created: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar nova thread
    const { data: newThread, error: insertError } = await supabaseClient
      .from('threads')
      .insert({
        class_id,
        user_a_id: userA,
        user_b_id: userB,
        type: 'dm',
      })
      .select()
      .single();

    if (insertError || !newThread) {
      console.error('Error creating thread:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Erro ao criar thread.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Thread created:', newThread.id);

    return new Response(
      JSON.stringify({
        success: true,
        thread_id: newThread.id,
        created: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in threads-find-or-create:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
