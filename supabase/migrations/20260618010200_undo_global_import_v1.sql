CREATE OR REPLACE FUNCTION public.undo_global_import_v1(_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  batch_row public.global_import_batches%ROWTYPE;
  item_row record;
  cards_deleted integer := 0;
  lists_deleted integer := 0;
  lists_preserved integer := 0;
  folders_deleted integer := 0;
  folders_preserved integer := 0;
  affected integer;
  result jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE='42501'; END IF;
  SELECT * INTO batch_row FROM public.global_import_batches WHERE id=_batch_id AND user_id=uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Importação não encontrada.'; END IF;
  IF batch_row.status='undone' THEN
    RETURN COALESCE(batch_row.summary->'undo','{}'::jsonb) || jsonb_build_object('batch_id',batch_row.id,'status','undone');
  END IF;
  IF batch_row.status<>'completed' THEN RAISE EXCEPTION 'A importação ainda não pode ser desfeita.'; END IF;

  DELETE FROM public.flashcards f
  USING public.global_import_items i
  WHERE i.batch_id=batch_row.id AND i.user_id=uid AND i.entity_type='card' AND i.action='created' AND i.entity_id=f.id AND f.user_id=uid;
  GET DIAGNOSTICS cards_deleted=ROW_COUNT;

  FOR item_row IN SELECT entity_id FROM public.global_import_items
    WHERE batch_id=batch_row.id AND user_id=uid AND entity_type='list' AND action='created' AND entity_id IS NOT NULL ORDER BY id DESC
  LOOP
    IF EXISTS(SELECT 1 FROM public.flashcards WHERE list_id=item_row.entity_id) THEN
      lists_preserved := lists_preserved + 1;
    ELSE
      DELETE FROM public.lists WHERE id=item_row.entity_id AND owner_id=uid;
      GET DIAGNOSTICS affected=ROW_COUNT;
      lists_deleted := lists_deleted + affected;
    END IF;
  END LOOP;

  FOR item_row IN SELECT entity_id FROM public.global_import_items
    WHERE batch_id=batch_row.id AND user_id=uid AND entity_type='folder' AND action='created' AND entity_id IS NOT NULL ORDER BY id DESC
  LOOP
    IF EXISTS(SELECT 1 FROM public.lists WHERE folder_id=item_row.entity_id) THEN
      folders_preserved := folders_preserved + 1;
    ELSE
      DELETE FROM public.folders WHERE id=item_row.entity_id AND owner_id=uid;
      GET DIAGNOSTICS affected=ROW_COUNT;
      folders_deleted := folders_deleted + affected;
    END IF;
  END LOOP;

  result := jsonb_build_object('batch_id',batch_row.id,'status','undone','cards_deleted',cards_deleted,'lists_deleted',lists_deleted,'lists_preserved',lists_preserved,'folders_deleted',folders_deleted,'folders_preserved',folders_preserved);
  UPDATE public.global_import_batches SET status='undone',undone_at=now(),summary=summary||jsonb_build_object('undo',result) WHERE id=batch_row.id;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.undo_global_import_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.undo_global_import_v1(uuid) TO authenticated;
