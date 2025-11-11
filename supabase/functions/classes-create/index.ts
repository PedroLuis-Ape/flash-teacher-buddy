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

    // Verificar se é professor
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (profile?.user_type !== 'professor') {
      return new Response(
        JSON.stringify({ success: false, error: 'FORBIDDEN', message: 'Apenas professores podem criar turmas.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { name, visibility = 'code' } = body;

    // Validar input
    if (!name || typeof name !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'INVALID_INPUT', message: 'Nome da turma é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (name.length < 3 || name.length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: 'INVALID_INPUT', message: 'Nome deve ter entre 3 e 100 caracteres.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gerar código único
    const { data: codeData, error: codeError } = await supabaseClient.rpc('generate_class_code');

    if (codeError || !codeData) {
      console.error('Error generating code:', codeError);
      return new Response(
        JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Erro ao gerar código.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar turma
    const { data: classData, error: insertError } = await supabaseClient
      .from('classes')
      .insert({
        owner_id: user.id,
        name: name.trim(),
        code: codeData,
        visibility,
      })
      .select()
      .single();

    if (insertError || !classData) {
      console.error('Error creating class:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Erro ao criar turma.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Adicionar professor como membro
    await supabaseClient.from('class_members').insert({
      class_id: classData.id,
      user_id: user.id,
      role: 'teacher',
      status: 'active',
    });

    console.log('Class created:', classData.id);

    return new Response(
      JSON.stringify({
        success: true,
        class: {
          id: classData.id,
          name: classData.name,
          code: classData.code,
          visibility: classData.visibility,
          created_at: classData.created_at,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in classes-create:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
