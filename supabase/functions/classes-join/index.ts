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
    const { code } = body;

    // Validar input
    if (!code || typeof code !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'INVALID_INPUT', message: 'Código da turma é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar turma pelo código
    const { data: classData, error: classError } = await supabaseClient
      .from('classes')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .is('archived_at', null)
      .single();

    if (classError || !classData) {
      console.error('Class not found:', classError);
      return new Response(
        JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'Código inválido ou turma indisponível.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se já é membro
    const { data: existingMember } = await supabaseClient
      .from('class_members')
      .select('*')
      .eq('class_id', classData.id)
      .eq('user_id', user.id)
      .single();

    if (existingMember) {
      return new Response(
        JSON.stringify({
          success: true,
          already_member: true,
          class: {
            id: classData.id,
            name: classData.name,
            code: classData.code,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Adicionar como aluno
    const { error: insertError } = await supabaseClient.from('class_members').insert({
      class_id: classData.id,
      user_id: user.id,
      role: 'student',
      status: 'active',
    });

    if (insertError) {
      console.error('Error adding member:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Erro ao entrar na turma.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User joined class:', classData.id);

    return new Response(
      JSON.stringify({
        success: true,
        class: {
          id: classData.id,
          name: classData.name,
          code: classData.code,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in classes-join:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
