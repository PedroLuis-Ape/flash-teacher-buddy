-- App Piteco — hotfix do Super Importador
-- Corrige a colisão entre variáveis PL/pgSQL e colunas folder_id/list_id.
-- Seguro para executar novamente: a função é substituída de forma idempotente.

BEGIN;

DO $hotfix$
DECLARE
  function_sql text;
BEGIN
  SELECT pg_get_functiondef(
    'public.import_app_piteco_super_package_v1(uuid,jsonb,jsonb,text,uuid)'::regprocedure
  )
  INTO function_sql;

  IF function_sql IS NULL THEN
    RAISE EXCEPTION 'A função import_app_piteco_super_package_v1 não foi encontrada.';
  END IF;

  function_sql := replace(function_sql, '  folder_id uuid;', '  v_folder_id uuid;');
  function_sql := replace(function_sql, '  list_id uuid;', '  v_list_id uuid;');

  function_sql := replace(function_sql, 'folder_id := (fp #>> ''{folder,folderId}'')::uuid;', 'v_folder_id := (fp #>> ''{folder,folderId}'')::uuid;');
  function_sql := replace(function_sql, 'WHERE id = folder_id AND owner_id = uid', 'WHERE id = v_folder_id AND owner_id = uid');
  function_sql := replace(function_sql, 'VALUES(batch_id, uid, ''folder'', folder_id,', 'VALUES(batch_id, uid, ''folder'', v_folder_id,');
  function_sql := replace(function_sql, 'RETURNING id INTO folder_id;', 'RETURNING id INTO v_folder_id;');
  function_sql := replace(function_sql, 'WHERE folder_id = folder_id AND deleted_at IS NULL;', 'WHERE folder_id = v_folder_id AND deleted_at IS NULL;');
  function_sql := replace(function_sql, 'WHERE id = list_id AND folder_id = folder_id AND owner_id = uid', 'WHERE id = v_list_id AND folder_id = v_folder_id AND owner_id = uid');
  function_sql := replace(function_sql, E'\n          folder_id, uid, list_name,', E'\n          v_folder_id, uid, list_name,');

  function_sql := replace(function_sql, 'list_id := (lp->>''listId'')::uuid;', 'v_list_id := (lp->>''listId'')::uuid;');
  function_sql := replace(function_sql, 'WHERE id = list_id AND folder_id = v_folder_id AND owner_id = uid', 'WHERE id = v_list_id AND folder_id = v_folder_id AND owner_id = uid');
  function_sql := replace(function_sql, 'WHERE id = list_id;', 'WHERE id = v_list_id;');
  function_sql := replace(function_sql, 'flashcard.list_id = list_id AND flashcard.user_id = uid', 'flashcard.list_id = v_list_id AND flashcard.user_id = uid');
  function_sql := replace(function_sql, 'DELETE FROM public.flashcards WHERE list_id = list_id AND user_id = uid;', 'DELETE FROM public.flashcards WHERE list_id = v_list_id AND user_id = uid;');
  function_sql := replace(function_sql, E'\n          list_id,\n', E'\n          v_list_id,\n');
  function_sql := replace(function_sql, 'RETURNING id INTO list_id;', 'RETURNING id INTO v_list_id;');
  function_sql := replace(function_sql, 'VALUES(batch_id, uid, ''list'', list_id,', 'VALUES(batch_id, uid, ''list'', v_list_id,');
  function_sql := replace(function_sql, E'WHERE list_id = list_id\n', E'WHERE list_id = v_list_id\n');
  function_sql := replace(function_sql, 'VALUES(list_id, uid, front_text, back_text)', 'VALUES(v_list_id, uid, front_text, back_text)');

  IF function_sql ~ 'WHERE[[:space:]]+folder_id[[:space:]]*=[[:space:]]*folder_id'
     OR function_sql ~ 'WHERE[[:space:]]+list_id[[:space:]]*=[[:space:]]*list_id'
     OR function_sql !~ 'v_folder_id'
     OR function_sql !~ 'v_list_id' THEN
    RAISE EXCEPTION 'O hotfix não conseguiu desambiguar todas as referências.';
  END IF;

  EXECUTE function_sql;
END;
$hotfix$;

REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_v1(uuid, jsonb, jsonb, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_v1(uuid, jsonb, jsonb, text, uuid) TO authenticated;

COMMIT;

SELECT
  to_regprocedure(
    'public.import_app_piteco_super_package_v1(uuid,jsonb,jsonb,text,uuid)'
  ) AS function_after_hotfix;
