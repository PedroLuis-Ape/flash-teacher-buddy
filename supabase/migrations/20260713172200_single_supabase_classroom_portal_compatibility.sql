-- The reduced official rebuild has no classroom tables. In the complete schema,
-- restore anonymous guest play only for explicitly public, active classrooms and
-- assigned lists. The check is inline to avoid depending on helper signatures.

DO $outer$
BEGIN
  IF to_regclass('public.turmas') IS NOT NULL
     AND to_regclass('public.atribuicoes') IS NOT NULL THEN
    EXECUTE $definition$
      CREATE OR REPLACE FUNCTION public.get_portal_flashcards(_list_id uuid)
      RETURNS SETOF public.flashcards
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $body$
        WITH requested_list AS (
          SELECT
            l.id,
            l.owner_id,
            l.folder_id,
            l.class_id,
            f.owner_id AS folder_owner_id,
            f.class_id AS folder_class_id,
            f.visibility AS folder_visibility,
            f.deleted_at AS folder_deleted_at
          FROM public.lists l
          JOIN public.folders f ON f.id = l.folder_id
          WHERE l.id = _list_id
            AND l.deleted_at IS NULL
        ),
        allowed_list AS (
          SELECT rl.id
          FROM requested_list rl
          WHERE (
            rl.owner_id = rl.folder_owner_id
            AND rl.class_id IS NULL
            AND rl.folder_class_id IS NULL
            AND rl.folder_visibility = 'class'
            AND rl.folder_deleted_at IS NULL
          )
          OR (
            rl.owner_id = rl.folder_owner_id
            AND rl.class_id IS NOT NULL
            AND rl.folder_class_id = rl.class_id
            AND rl.folder_deleted_at IS NULL
            AND EXISTS (
              SELECT 1
              FROM public.atribuicoes a
              JOIN public.turmas t ON t.id = a.turma_id
              WHERE a.list_id = rl.id
                AND a.turma_id = rl.class_id
                AND a.professor_id = rl.owner_id
                AND t.id = rl.class_id
                AND t.professor_id = rl.owner_id
                AND t.public_access_enabled = true
                AND t.is_active = true
            )
          )
        )
        SELECT fc.*
        FROM public.flashcards fc
        JOIN allowed_list al ON al.id = fc.list_id
        JOIN requested_list rl ON rl.id = fc.list_id
        WHERE fc.list_id = _list_id
          AND fc.user_id = rl.owner_id
          AND fc.deleted_at IS NULL
        ORDER BY fc.created_at ASC;
      $body$;
    $definition$;

    EXECUTE $definition$
      CREATE OR REPLACE FUNCTION public.get_portal_counts(_folder_id uuid)
      RETURNS TABLE(list_count integer, card_count integer)
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $body$
        WITH requested_folder AS (
          SELECT
            f.id,
            f.owner_id,
            f.class_id,
            f.visibility,
            f.deleted_at
          FROM public.folders f
          WHERE f.id = _folder_id
        ),
        allowed_lists AS (
          SELECT l.id, l.owner_id
          FROM public.lists l
          JOIN requested_folder rf ON rf.id = l.folder_id
          WHERE l.deleted_at IS NULL
            AND l.owner_id = rf.owner_id
            AND (
              (
                l.class_id IS NULL
                AND rf.class_id IS NULL
                AND rf.visibility = 'class'
                AND rf.deleted_at IS NULL
              )
              OR (
                l.class_id IS NOT NULL
                AND rf.class_id = l.class_id
                AND rf.deleted_at IS NULL
                AND EXISTS (
                  SELECT 1
                  FROM public.atribuicoes a
                  JOIN public.turmas t ON t.id = a.turma_id
                  WHERE a.list_id = l.id
                    AND a.turma_id = l.class_id
                    AND a.professor_id = rf.owner_id
                    AND t.id = l.class_id
                    AND t.professor_id = rf.owner_id
                    AND t.public_access_enabled = true
                    AND t.is_active = true
                )
              )
            )
        )
        SELECT
          COUNT(DISTINCT al.id)::integer,
          COUNT(DISTINCT fc.id) FILTER (WHERE fc.parent_card_id IS NULL)::integer
        FROM allowed_lists al
        LEFT JOIN public.flashcards fc
          ON fc.list_id = al.id
         AND fc.user_id = al.owner_id
         AND fc.deleted_at IS NULL;
      $body$;
    $definition$;

    REVOKE ALL ON FUNCTION public.get_portal_flashcards(uuid) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.get_portal_counts(uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.get_portal_flashcards(uuid) TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.get_portal_counts(uuid) TO anon, authenticated;
  END IF;
END;
$outer$;
