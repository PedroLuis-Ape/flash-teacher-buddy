import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateAnnouncementRequest {
  id: string;
  title?: string;
  body?: string;
  pinned?: boolean;
  archived?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: UpdateAnnouncementRequest = await req.json();
    const { id, title, body, pinned, archived } = payload;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'ID do anúncio é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar anúncio
    const { data: announcement, error: fetchError } = await supabase
      .from('announcements')
      .select('id, class_id, author_id')
      .eq('id', id)
      .single();

    if (fetchError || !announcement) {
      return new Response(
        JSON.stringify({ error: 'Anúncio não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é owner da turma
    const { data: classData } = await supabase
      .from('classes')
      .select('owner_id')
      .eq('id', announcement.class_id)
      .single();

    if (classData?.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Você não tem permissão nesta turma.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar update
    const updates: any = {};
    if (title !== undefined) {
      if (title.trim().length === 0 || title.trim().length > 200) {
        return new Response(
          JSON.stringify({ error: 'Título inválido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      updates.title = title.trim();
    }

    if (body !== undefined) {
      if (body.trim().length === 0 || body.trim().length > 5000) {
        return new Response(
          JSON.stringify({ error: 'Corpo inválido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      updates.body = body.trim();
    }

    if (pinned !== undefined) {
      updates.pinned = pinned;
    }

    if (archived !== undefined) {
      updates.archived_at = archived ? new Date().toISOString() : null;
    }

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma alteração fornecida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar
    const { data: updated, error: updateError } = await supabase
      .from('announcements')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating announcement:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar anúncio' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Announcement updated:', id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Anúncio atualizado.',
        announcement: updated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
