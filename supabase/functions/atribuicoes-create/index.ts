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

    const { turma_id, titulo, descricao, fonte_tipo, fonte_id, data_limite, pontos_vale } = await req.json();

    if (!turma_id || !titulo || !fonte_tipo || !fonte_id) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios faltando' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is turma owner
    const { data: turma, error: turmaError } = await supabaseClient
      .from('turmas')
      .select('owner_teacher_id')
      .eq('id', turma_id)
      .single();

    if (turmaError || !turma || turma.owner_teacher_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Turma não encontrada ou acesso negado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let finalFonteId = fonte_id;

    // DEEP COPY RULE: If fonte_tipo is 'lista', create a copy of the list and its flashcards
    if (fonte_tipo === 'lista') {
      console.log('Deep copy: Creating copy of list', fonte_id);
      
      // Fetch the original list
      const { data: originalList, error: listError } = await supabaseClient
        .from('lists')
        .select('*')
        .eq('id', fonte_id)
        .single();

      if (listError || !originalList) {
        console.error('Error fetching original list:', listError);
        return new Response(
          JSON.stringify({ error: 'Lista original não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create a NEW list linked to the class
      const { data: newList, error: newListError } = await supabaseClient
        .from('lists')
        .insert({
          folder_id: originalList.folder_id,
          owner_id: user.id,
          title: `[Atribuição] ${originalList.title}`,
          description: originalList.description,
          lang: originalList.lang,
          visibility: 'private',
          class_id: turma_id,
        })
        .select()
        .single();

      if (newListError || !newList) {
        console.error('Error creating new list:', newListError);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar cópia da lista' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Deep copy: Created new list', newList.id);

      // Fetch all flashcards from the original list
      const { data: originalCards, error: cardsError } = await supabaseClient
        .from('flashcards')
        .select('*')
        .eq('list_id', fonte_id);

      if (cardsError) {
        console.error('Error fetching original flashcards:', cardsError);
        // Continue anyway - list might be empty
      }

      // Copy flashcards to the new list
      if (originalCards && originalCards.length > 0) {
        const copiedCards = originalCards.map(card => ({
          list_id: newList.id,
          user_id: user.id,
          term: card.term,
          translation: card.translation,
          hint: card.hint,
          audio_url: card.audio_url,
          lang: card.lang,
          display_text: card.display_text,
          eval_text: card.eval_text,
          accepted_answers_en: card.accepted_answers_en,
          accepted_answers_pt: card.accepted_answers_pt,
          note_text: card.note_text,
        }));

        const { error: insertCardsError } = await supabaseClient
          .from('flashcards')
          .insert(copiedCards);

        if (insertCardsError) {
          console.error('Error copying flashcards:', insertCardsError);
          // Log but don't fail - the list was created successfully
        } else {
          console.log('Deep copy: Copied', copiedCards.length, 'flashcards');
        }
      }

      // Use the NEW list ID as fonte_id
      finalFonteId = newList.id;
    }

    // Create atribuição with the (potentially new) fonte_id
    const { data: atribuicao, error: insertError } = await supabaseClient
      .from('atribuicoes')
      .insert({
        turma_id,
        titulo: titulo.trim(),
        descricao: descricao?.trim() || null,
        fonte_tipo,
        fonte_id: finalFonteId,
        data_limite: data_limite || null,
        pontos_vale: pontos_vale || 50,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating atribuição:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar atribuição' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create status entries for all turma members
    const { data: members } = await supabaseClient
      .from('turma_membros')
      .select('user_id')
      .eq('turma_id', turma_id)
      .eq('ativo', true);

    if (members && members.length > 0) {
      const statusEntries = members.map(m => ({
        atribuicao_id: atribuicao.id,
        aluno_id: m.user_id,
        status: 'pendente',
        progresso: 0,
      }));

      await supabaseClient
        .from('atribuicoes_status')
        .insert(statusEntries);
    }

    return new Response(
      JSON.stringify({ atribuicao }),
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
