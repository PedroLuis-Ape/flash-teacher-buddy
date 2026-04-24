-- Atomic, server-side swap of flashcard CONTENT (term <-> translation)
-- for an entire list. Replaces the previous client-side chunked loop that
-- could freeze mobile UIs on large lists. Permission model mirrors
-- swap_list_sides (list owner OR turma owner if the list belongs to a turma).
create or replace function public.swap_flashcards_sides(_list_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list record;
  v_swapped integer;
begin
  -- Load list + turma owner (if any) for permission check
  select l.id, l.owner_id, l.class_id, t.owner_teacher_id
    into v_list
  from public.lists l
  left join public.turmas t on t.id = l.class_id
  where l.id = _list_id
    and l.deleted_at is null;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'NOT_FOUND',
      'message', 'Lista não encontrada.'
    );
  end if;

  -- Allow list owner; OR if list belongs to a turma, allow turma owner.
  if v_list.owner_id <> auth.uid() then
    if v_list.class_id is null or v_list.owner_teacher_id is null
       or v_list.owner_teacher_id <> auth.uid() then
      return jsonb_build_object(
        'success', false,
        'error', 'PERMISSION_DENIED',
        'message', 'Você não tem permissão para inverter esta lista.'
      );
    end if;
  end if;

  -- Atomic swap. Postgres evaluates RHS from the OLD row, so this is safe.
  update public.flashcards
     set term = translation,
         translation = term,
         updated_at = now()
   where list_id = _list_id
     and deleted_at is null;

  get diagnostics v_swapped = row_count;

  return jsonb_build_object(
    'success', true,
    'cards_swapped', v_swapped,
    'message', format('Conteúdo de %s cards invertido!', v_swapped)
  );

exception when others then
  return jsonb_build_object(
    'success', false,
    'error', 'INTERNAL_ERROR',
    'message', 'Erro ao inverter conteúdo. Tente novamente.'
  );
end;
$$;