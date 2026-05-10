create or replace function public.merge_cards_into_layers(
  _list_id uuid,
  _card_ids uuid[],
  _title text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list record;
  v_user_id uuid := auth.uid();
  v_title text := nullif(btrim(_title), '');
  v_card_count integer := coalesce(array_length(_card_ids, 1), 0);
  v_unique_count integer;
  v_principal_id uuid;
  v_first_translation text;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED', 'message', 'Você precisa estar logado.');
  end if;

  if v_card_count < 2 then
    return jsonb_build_object('success', false, 'error', 'INVALID_INPUT', 'message', 'Selecione pelo menos 2 cards para mesclar.');
  end if;

  if v_title is null then
    return jsonb_build_object('success', false, 'error', 'INVALID_INPUT', 'message', 'Defina um título para o card principal.');
  end if;

  select l.id, l.owner_id, l.class_id, t.owner_teacher_id
    into v_list
  from public.lists l
  left join public.turmas t on t.id = l.class_id
  where l.id = _list_id
    and l.deleted_at is null;

  if not found then
    return jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Lista não encontrada.');
  end if;

  if v_list.owner_id <> v_user_id then
    if v_list.class_id is null or v_list.owner_teacher_id is null or v_list.owner_teacher_id <> v_user_id then
      return jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Você não tem permissão para mesclar cards desta lista.');
    end if;
  end if;

  select count(distinct x.card_id)::integer
    into v_unique_count
  from unnest(_card_ids) as x(card_id);

  if v_unique_count <> v_card_count then
    return jsonb_build_object('success', false, 'error', 'INVALID_INPUT', 'message', 'Há cards repetidos na seleção.');
  end if;

  select count(*)::integer
    into v_unique_count
  from public.flashcards f
  where f.id = any(_card_ids)
    and f.list_id = _list_id
    and f.deleted_at is null
    and f.parent_card_id is null;

  if v_unique_count <> v_card_count then
    return jsonb_build_object('success', false, 'error', 'INVALID_INPUT', 'message', 'Alguns cards não podem ser mesclados ou já são camadas.');
  end if;

  select f.translation
    into v_first_translation
  from unnest(_card_ids) with ordinality as input(card_id, ord)
  join public.flashcards f on f.id = input.card_id
  order by input.ord
  limit 1;

  insert into public.flashcards (list_id, user_id, term, translation)
  values (_list_id, v_user_id, v_title, coalesce(v_first_translation, ''))
  returning id into v_principal_id;

  update public.flashcards f
     set parent_card_id = v_principal_id,
         layer_index = input.ord - 1,
         updated_at = now()
    from unnest(_card_ids) with ordinality as input(card_id, ord)
   where f.id = input.card_id;

  return jsonb_build_object(
    'success', true,
    'principal_id', v_principal_id,
    'layer_count', v_card_count,
    'message', format('%s cards mesclados em camadas.', v_card_count)
  );

exception when others then
  return jsonb_build_object('success', false, 'error', 'INTERNAL_ERROR', 'message', 'Erro ao mesclar cards. Tente novamente.');
end;
$$;

create or replace function public.unmerge_layered_card(_principal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card record;
  v_user_id uuid := auth.uid();
  v_layer_count integer := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED', 'message', 'Você precisa estar logado.');
  end if;

  select f.id, f.list_id, l.owner_id, l.class_id, t.owner_teacher_id
    into v_card
  from public.flashcards f
  join public.lists l on l.id = f.list_id
  left join public.turmas t on t.id = l.class_id
  where f.id = _principal_id
    and f.deleted_at is null;

  if not found then
    return jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Card principal não encontrado.');
  end if;

  if v_card.owner_id <> v_user_id then
    if v_card.class_id is null or v_card.owner_teacher_id is null or v_card.owner_teacher_id <> v_user_id then
      return jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Você não tem permissão para separar estas camadas.');
    end if;
  end if;

  update public.flashcards
     set parent_card_id = null,
         layer_index = null,
         updated_at = now()
   where parent_card_id = _principal_id
     and deleted_at is null;

  get diagnostics v_layer_count = row_count;

  update public.flashcards
     set deleted_at = now(),
         updated_at = now()
   where id = _principal_id
     and deleted_at is null;

  return jsonb_build_object(
    'success', true,
    'layer_count', v_layer_count,
    'message', 'Camadas separadas com sucesso.'
  );

exception when others then
  return jsonb_build_object('success', false, 'error', 'INTERNAL_ERROR', 'message', 'Erro ao separar camadas. Tente novamente.');
end;
$$;