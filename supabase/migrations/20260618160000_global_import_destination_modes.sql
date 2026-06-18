-- Destination modes and explicit list-conflict handling for the Super Importador Global.
ALTER TABLE public.global_import_items
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.global_import_items
  DROP CONSTRAINT IF EXISTS global_import_items_action_check;
ALTER TABLE public.global_import_items
  ADD CONSTRAINT global_import_items_action_check
  CHECK (action IN ('created', 'reused', 'skipped', 'replaced'));

CREATE OR REPLACE FUNCTION public.import_global_package_v1(
  _request_id uuid,
  _payload jsonb,
  _destination_plan jsonb,
  _card_conflict text DEFAULT 'skip',
  _institution_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  batch_id uuid;
  existing public.global_import_batches%ROWTYPE;
  payload_hash text;
  package_name text;
  fr record;
  lr record;
  cr record;
  fp jsonb;
  lp jsonb;
  folder_id uuid;
  list_id uuid;
  card_id uuid;
  folder_name text;
  list_name text;
  front_text text;
  back_text text;
  next_order integer;
  folder_cards integer;
  total_folders integer := 0;
  total_lists integer := 0;
  total_cards integer := 0;
  folders_created integer := 0;
  folders_reused integer := 0;
  lists_created integer := 0;
  lists_reused integer := 0;
  lists_replaced integer := 0;
  lists_skipped integer := 0;
  cards_created integer := 0;
  cards_skipped integer := 0;
  duplicate_found boolean;
  folder_path text;
  list_path text;
  card_path text;
  result jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Você precisa estar autenticado.' USING ERRCODE = '42501'; END IF;
  IF _request_id IS NULL THEN RAISE EXCEPTION 'request_id é obrigatório.'; END IF;
  IF _card_conflict NOT IN ('skip','copy','error') THEN RAISE EXCEPTION 'Política de duplicata inválida.'; END IF;
  IF _payload->>'schema' IS DISTINCT FROM 'appteco-global-import' OR COALESCE((_payload->>'version')::int,0) <> 1 THEN
    RAISE EXCEPTION 'Schema ou versão incompatível.';
  END IF;
  IF jsonb_typeof(_payload #> '{package,folders}') IS DISTINCT FROM 'array' OR jsonb_array_length(_payload #> '{package,folders}') = 0 THEN
    RAISE EXCEPTION 'package.folders deve ser um array não vazio.';
  END IF;
  IF jsonb_array_length(_payload #> '{package,folders}') > 100 THEN RAISE EXCEPTION 'Limite de 100 pastas excedido.'; END IF;
  IF jsonb_typeof(_destination_plan->'folders') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Plano de destinos inválido.'; END IF;

  package_name := NULLIF(BTRIM(_payload #>> '{package,name}'),'');
  IF package_name IS NULL OR char_length(package_name) > 160 THEN RAISE EXCEPTION 'Nome do pacote inválido.'; END IF;
  IF _institution_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutions WHERE id = _institution_id AND owner_id = uid) THEN
    RAISE EXCEPTION 'Instituição inválida ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  payload_hash := md5(_payload::text || '|' || _destination_plan::text || '|' || _card_conflict || '|' || COALESCE(_institution_id::text,''));
  SELECT * INTO existing FROM public.global_import_batches WHERE user_id = uid AND request_id = _request_id;
  IF FOUND THEN
    IF existing.payload_hash <> payload_hash THEN RAISE EXCEPTION 'request_id já usado com outro pacote.'; END IF;
    IF existing.status = 'undone' THEN RAISE EXCEPTION 'Esta importação já foi desfeita. Inicie outra tentativa.'; END IF;
    RETURN existing.summary || jsonb_build_object('batch_id',existing.id,'request_id',existing.request_id,'status',existing.status);
  END IF;

  INSERT INTO public.global_import_batches(user_id,request_id,payload_hash,package_name,schema_version,status,options)
  VALUES(uid,_request_id,payload_hash,package_name,1,'processing',jsonb_build_object('card_conflict',_card_conflict,'destination_plan',_destination_plan,'institution_id',_institution_id))
  ON CONFLICT (user_id,request_id) DO NOTHING RETURNING id INTO batch_id;

  IF batch_id IS NULL THEN
    SELECT * INTO existing FROM public.global_import_batches WHERE user_id = uid AND request_id = _request_id;
    IF existing.payload_hash <> payload_hash THEN RAISE EXCEPTION 'request_id já usado com outro pacote.'; END IF;
    RETURN existing.summary || jsonb_build_object('batch_id',existing.id,'request_id',existing.request_id,'status',existing.status);
  END IF;

  FOR fr IN SELECT value,ordinality FROM jsonb_array_elements(_payload #> '{package,folders}') WITH ORDINALITY LOOP
    total_folders := total_folders + 1;
    folder_path := format('package.folders[%s]',fr.ordinality-1);
    fp := _destination_plan #> ARRAY['folders',(fr.ordinality-1)::text];
    IF jsonb_typeof(fp) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION '%: destino ausente.',folder_path; END IF;

    IF fp #>> '{folder,mode}' = 'existing' THEN
      folder_id := (fp #>> '{folder,folderId}')::uuid;
      IF NOT EXISTS (SELECT 1 FROM public.folders WHERE id=folder_id AND owner_id=uid AND deleted_at IS NULL AND class_id IS NULL) THEN
        RAISE EXCEPTION '%: pasta inválida ou sem permissão.',folder_path USING ERRCODE='42501';
      END IF;
      folders_reused := folders_reused + 1;
      INSERT INTO public.global_import_items(batch_id,user_id,entity_type,entity_id,action,item_path)
      VALUES(batch_id,uid,'folder',folder_id,'reused',folder_path);
    ELSIF fp #>> '{folder,mode}' = 'create' THEN
      folder_name := COALESCE(NULLIF(BTRIM(fp #>> '{folder,name}'),''),NULLIF(BTRIM(fr.value->>'name'),''));
      IF folder_name IS NULL OR char_length(folder_name)>160 THEN RAISE EXCEPTION '%: nome inválido.',folder_path; END IF;
      INSERT INTO public.folders(owner_id,title,description,visibility,institution_id,lang_a,lang_b)
      VALUES(uid,folder_name,NULLIF(BTRIM(fr.value->>'description'),''),'private',_institution_id,NULLIF(BTRIM(_payload #>> '{package,source_language}'),''),NULLIF(BTRIM(_payload #>> '{package,target_language}'),''))
      RETURNING id INTO folder_id;
      folders_created := folders_created + 1;
      INSERT INTO public.global_import_items(batch_id,user_id,entity_type,entity_id,action,item_path)
      VALUES(batch_id,uid,'folder',folder_id,'created',folder_path);
    ELSE RAISE EXCEPTION '%: modo de pasta inválido.',folder_path; END IF;

    IF jsonb_typeof(fr.value->'lists') IS DISTINCT FROM 'array' OR jsonb_array_length(fr.value->'lists')=0 THEN RAISE EXCEPTION '%: listas ausentes.',folder_path; END IF;
    SELECT COALESCE(MAX(order_index),-1)+1 INTO next_order FROM public.lists WHERE folder_id=folder_id AND deleted_at IS NULL;
    folder_cards := 0;

    FOR lr IN SELECT value,ordinality FROM jsonb_array_elements(fr.value->'lists') WITH ORDINALITY LOOP
      total_lists := total_lists + 1;
      IF total_lists>500 THEN RAISE EXCEPTION 'Limite de 500 listas excedido.'; END IF;
      list_path := format('%s.lists[%s]',folder_path,lr.ordinality-1);
      lp := fp #> ARRAY['lists',(lr.ordinality-1)::text];
      IF jsonb_typeof(lp) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION '%: destino ausente.',list_path; END IF;
      IF jsonb_typeof(lr.value->'cards') IS DISTINCT FROM 'array' OR jsonb_array_length(lr.value->'cards')=0 THEN RAISE EXCEPTION '%: cards ausentes.',list_path; END IF;
      IF lr.value ? 'expected_cards' AND (lr.value->>'expected_cards')::int <> jsonb_array_length(lr.value->'cards') THEN RAISE EXCEPTION '%: contagem incorreta.',list_path; END IF;
      folder_cards := folder_cards + jsonb_array_length(lr.value->'cards');

      IF lp->>'mode'='skip' THEN
        lists_skipped := lists_skipped + 1;
        INSERT INTO public.global_import_items(batch_id,user_id,entity_type,entity_id,action,item_path)
        VALUES(batch_id,uid,'list',NULL,'skipped',list_path);
        CONTINUE;
      ELSIF lp->>'mode'='existing' THEN
        list_id := (lp->>'listId')::uuid;
        IF NOT EXISTS (SELECT 1 FROM public.lists WHERE id=list_id AND folder_id=folder_id AND owner_id=uid AND deleted_at IS NULL) THEN
          RAISE EXCEPTION '%: lista inválida ou sem permissão.',list_path USING ERRCODE='42501';
        END IF;
        IF COALESCE(lp->>'strategy','append') NOT IN ('append','replace') THEN
          RAISE EXCEPTION '%: estratégia de conflito inválida.',list_path;
        END IF;

        IF COALESCE(lp->>'strategy','append')='replace' THEN
          INSERT INTO public.global_import_items(batch_id,user_id,entity_type,entity_id,action,item_path,metadata)
          SELECT batch_id,uid,'card',f.id,'replaced',list_path,to_jsonb(f)
          FROM public.flashcards f
          WHERE f.list_id=list_id AND f.user_id=uid;
          DELETE FROM public.flashcards WHERE list_id=list_id AND user_id=uid;
          lists_replaced := lists_replaced + 1;
        ELSE
          lists_reused := lists_reused + 1;
        END IF;
        INSERT INTO public.global_import_items(batch_id,user_id,entity_type,entity_id,action,item_path)
        VALUES(batch_id,uid,'list',list_id,CASE WHEN COALESCE(lp->>'strategy','append')='replace' THEN 'replaced' ELSE 'reused' END,list_path);
      ELSIF lp->>'mode'='create' THEN
        list_name := COALESCE(NULLIF(BTRIM(lp->>'name'),''),NULLIF(BTRIM(lr.value->>'name'),''));
        IF list_name IS NULL OR char_length(list_name)>160 THEN RAISE EXCEPTION '%: nome inválido.',list_path; END IF;
        INSERT INTO public.lists(folder_id,owner_id,title,description,order_index,visibility,institution_id,lang_a,lang_b)
        VALUES(folder_id,uid,list_name,NULLIF(BTRIM(lr.value->>'description'),''),next_order,'private',_institution_id,NULLIF(BTRIM(_payload #>> '{package,source_language}'),''),NULLIF(BTRIM(_payload #>> '{package,target_language}'),''))
        RETURNING id INTO list_id;
        next_order := next_order + 1;
        lists_created := lists_created + 1;
        INSERT INTO public.global_import_items(batch_id,user_id,entity_type,entity_id,action,item_path)
        VALUES(batch_id,uid,'list',list_id,'created',list_path);
      ELSE RAISE EXCEPTION '%: modo de lista inválido.',list_path; END IF;

      FOR cr IN SELECT value,ordinality FROM jsonb_array_elements(lr.value->'cards') WITH ORDINALITY LOOP
        total_cards := total_cards + 1;
        IF total_cards>10000 THEN RAISE EXCEPTION 'Limite de 10.000 cards excedido.'; END IF;
        card_path := format('%s.cards[%s]',list_path,cr.ordinality-1);
        front_text := NULLIF(BTRIM(cr.value->>'front'),'');
        back_text := NULLIF(BTRIM(cr.value->>'back'),'');
        IF front_text IS NULL OR back_text IS NULL OR char_length(front_text)>8000 OR char_length(back_text)>8000 THEN RAISE EXCEPTION '%: conteúdo inválido.',card_path; END IF;
        SELECT EXISTS(SELECT 1 FROM public.flashcards WHERE list_id=list_id AND deleted_at IS NULL AND LOWER(BTRIM(term))=LOWER(front_text) AND LOWER(BTRIM(translation))=LOWER(back_text)) INTO duplicate_found;
        IF duplicate_found AND _card_conflict='error' THEN RAISE EXCEPTION '%: card duplicado.',card_path; END IF;
        IF duplicate_found AND _card_conflict='skip' THEN
          cards_skipped := cards_skipped + 1;
          INSERT INTO public.global_import_items(batch_id,user_id,entity_type,entity_id,action,item_path)
          VALUES(batch_id,uid,'card',NULL,'skipped',card_path);
        ELSE
          INSERT INTO public.flashcards(list_id,user_id,term,translation,hint,context_tag,example_text,example_translation)
          VALUES(list_id,uid,front_text,back_text,NULLIF(BTRIM(cr.value->>'hint'),''),NULLIF(BTRIM(cr.value->>'context_tag'),''),NULLIF(BTRIM(cr.value->>'example'),''),NULLIF(BTRIM(cr.value->>'example_translation'),''))
          RETURNING id INTO card_id;
          cards_created := cards_created + 1;
          INSERT INTO public.global_import_items(batch_id,user_id,entity_type,entity_id,action,item_path)
          VALUES(batch_id,uid,'card',card_id,'created',card_path);
        END IF;
      END LOOP;
    END LOOP;
    IF fr.value ? 'expected_cards' AND (fr.value->>'expected_cards')::int <> folder_cards THEN RAISE EXCEPTION '%: contagem incorreta.',folder_path; END IF;
  END LOOP;

  result := jsonb_build_object(
    'batch_id',batch_id,
    'request_id',_request_id,
    'status','completed',
    'package_name',package_name,
    'folders_created',folders_created,
    'folders_reused',folders_reused,
    'lists_created',lists_created,
    'lists_reused',lists_reused,
    'lists_replaced',lists_replaced,
    'lists_skipped',lists_skipped,
    'cards_created',cards_created,
    'cards_skipped',cards_skipped,
    'folders_total',total_folders,
    'lists_total',total_lists,
    'cards_total',total_cards
  );
  UPDATE public.global_import_batches SET status='completed',summary=result,completed_at=now() WHERE id=batch_id;
  RETURN result;
END;
$$;

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
  cards_restored integer := 0;
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

  INSERT INTO public.flashcards
  SELECT (jsonb_populate_record(NULL::public.flashcards, i.metadata)).*
  FROM public.global_import_items i
  WHERE i.batch_id=batch_row.id AND i.user_id=uid AND i.entity_type='card' AND i.action='replaced'
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS cards_restored=ROW_COUNT;

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

  result := jsonb_build_object(
    'batch_id',batch_row.id,
    'status','undone',
    'cards_deleted',cards_deleted,
    'cards_restored',cards_restored,
    'lists_deleted',lists_deleted,
    'lists_preserved',lists_preserved,
    'folders_deleted',folders_deleted,
    'folders_preserved',folders_preserved
  );
  UPDATE public.global_import_batches SET status='undone',undone_at=now(),summary=summary||jsonb_build_object('undo',result) WHERE id=batch_row.id;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.import_global_package_v1(uuid,jsonb,jsonb,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_global_import_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_global_package_v1(uuid,jsonb,jsonb,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_global_import_v1(uuid) TO authenticated;
