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
    let finalFonteTipo = fonte_tipo;

    // DEEP COPY RULE: Handle both 'lista' and 'pasta' types
    if (fonte_tipo === 'lista') {
      console.log('Deep copy: Creating copy of list', fonte_id);
      const result = await deepCopyList(supabaseClient, fonte_id, turma_id, user.id);
      if (!result.success) {
        return new Response(
          JSON.stringify({ error: result.error }),
          { status: result.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      finalFonteId = result.newListId;
    } else if (fonte_tipo === 'pasta') {
      console.log('Deep copy: Creating copy of folder', fonte_id);
      const result = await deepCopyFolder(supabaseClient, fonte_id, turma_id, user.id);
      if (!result.success) {
        return new Response(
          JSON.stringify({ error: result.error }),
          { status: result.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      finalFonteId = result.newFolderId;
    }

    // Create atribuição with the (potentially new) fonte_id
    const { data: atribuicao, error: insertError } = await supabaseClient
      .from('atribuicoes')
      .insert({
        turma_id,
        titulo: titulo.trim(),
        descricao: descricao?.trim() || null,
        fonte_tipo: finalFonteTipo,
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

// Deep copy a single list and its flashcards
async function deepCopyList(
  supabaseClient: any, 
  sourceListId: string, 
  turmaId: string, 
  userId: string,
  newFolderId?: string
): Promise<{ success: boolean; newListId?: string; error?: string; status?: number }> {
  // Fetch the original list
  const { data: originalList, error: listError } = await supabaseClient
    .from('lists')
    .select('*')
    .eq('id', sourceListId)
    .single();

  if (listError || !originalList) {
    console.error('Error fetching original list:', listError);
    return { success: false, error: 'Lista original não encontrada', status: 404 };
  }

  // Create a NEW list linked to the class
  const { data: newList, error: newListError } = await supabaseClient
    .from('lists')
    .insert({
      folder_id: newFolderId || originalList.folder_id,
      owner_id: userId,
      title: newFolderId ? originalList.title : `[Atribuição] ${originalList.title}`,
      description: originalList.description,
      lang: originalList.lang,
      visibility: 'class',
      class_id: turmaId,
    })
    .select()
    .single();

  if (newListError || !newList) {
    console.error('Error creating new list:', newListError);
    return { success: false, error: 'Erro ao criar cópia da lista', status: 500 };
  }

  console.log('Deep copy: Created new list', newList.id);

  // Fetch all flashcards from the original list
  const { data: originalCards, error: cardsError } = await supabaseClient
    .from('flashcards')
    .select('*')
    .eq('list_id', sourceListId);

  if (cardsError) {
    console.error('Error fetching original flashcards:', cardsError);
    // Continue anyway - list might be empty
  }

  // Copy flashcards to the new list
  if (originalCards && originalCards.length > 0) {
    const copiedCards = originalCards.map((card: any) => ({
      list_id: newList.id,
      user_id: userId,
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

  return { success: true, newListId: newList.id };
}

// Deep copy a folder with all its lists and flashcards
async function deepCopyFolder(
  supabaseClient: any,
  sourceFolderId: string,
  turmaId: string,
  userId: string
): Promise<{ success: boolean; newFolderId?: string; error?: string; status?: number }> {
  // Fetch the original folder
  const { data: originalFolder, error: folderError } = await supabaseClient
    .from('folders')
    .select('*')
    .eq('id', sourceFolderId)
    .single();

  if (folderError || !originalFolder) {
    console.error('Error fetching original folder:', folderError);
    return { success: false, error: 'Pasta original não encontrada', status: 404 };
  }

  // Create a NEW folder linked to the class
  const { data: newFolder, error: newFolderError } = await supabaseClient
    .from('folders')
    .insert({
      owner_id: userId,
      title: `[Atribuição] ${originalFolder.title}`,
      description: originalFolder.description,
      visibility: 'class',
      class_id: turmaId,
    })
    .select()
    .single();

  if (newFolderError || !newFolder) {
    console.error('Error creating new folder:', newFolderError);
    return { success: false, error: 'Erro ao criar cópia da pasta', status: 500 };
  }

  console.log('Deep copy: Created new folder', newFolder.id);

  // Fetch all lists from the original folder
  const { data: originalLists, error: listsError } = await supabaseClient
    .from('lists')
    .select('id')
    .eq('folder_id', sourceFolderId);

  if (listsError) {
    console.error('Error fetching original lists:', listsError);
  }

  // Copy each list with its flashcards
  if (originalLists && originalLists.length > 0) {
    let copiedCount = 0;
    for (const list of originalLists) {
      const result = await deepCopyList(supabaseClient, list.id, turmaId, userId, newFolder.id);
      if (result.success) {
        copiedCount++;
      } else {
        console.error('Failed to copy list:', list.id, result.error);
      }
    }
    console.log('Deep copy: Copied', copiedCount, 'lists');
  }

  return { success: true, newFolderId: newFolder.id };
}