-- Read-only authority used only after get_portal_flashcards returned no rows.
-- It mirrors the existing public-list visibility contract and distinguishes an
-- accessible empty list from an inaccessible/missing resource.

CREATE OR REPLACE FUNCTION public.get_portal_playable_card_count(_list_id uuid)
RETURNS TABLE (
  resource_exists boolean,
  raw_count bigint,
  playable_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH accessible_list AS (
    SELECT l.id
    FROM public.lists AS l
    JOIN public.folders AS f ON f.id = l.folder_id
    JOIN public.profiles AS p ON p.id = l.owner_id
    WHERE l.id = _list_id
      AND l.deleted_at IS NULL
      AND f.deleted_at IS NULL
      AND f.owner_id = l.owner_id
      AND (
        (
          l.class_id IS NULL
          AND f.class_id IS NULL
          AND l.visibility = 'class'
          AND f.visibility = 'class'
          AND COALESCE(p.public_access_enabled, false) = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.turmas AS t
          JOIN public.atribuicoes AS a ON a.turma_id = t.id
          WHERE t.owner_teacher_id = l.owner_id
            AND t.public = true
            AND t.ativo = true
            AND (
              (a.fonte_tipo::text = 'lista' AND a.fonte_id = l.id)
              OR (
                a.fonte_tipo::text = 'pasta'
                AND a.fonte_id = f.id
                AND f.owner_id = t.owner_teacher_id
                AND l.owner_id = t.owner_teacher_id
              )
            )
        )
      )
  ),
  visible_cards AS (
    SELECT fc.id, fc.parent_card_id, fc.status_group_uid
    FROM public.flashcards AS fc
    JOIN accessible_list AS visible_list ON visible_list.id = fc.list_id
    JOIN public.lists AS owner_list ON owner_list.id = fc.list_id
    WHERE fc.deleted_at IS NULL
      AND fc.user_id = owner_list.owner_id
  ),
  standalone_cards AS (
    SELECT card.id
    FROM visible_cards AS card
    WHERE card.parent_card_id IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM visible_cards AS layer
        WHERE layer.parent_card_id = card.id
      )
  ),
  layered_groups AS (
    SELECT DISTINCT COALESCE(card.status_group_uid::text, card.parent_card_id::text) AS group_id
    FROM visible_cards AS card
    WHERE card.parent_card_id IS NOT NULL
  )
  SELECT
    EXISTS (SELECT 1 FROM accessible_list) AS resource_exists,
    (SELECT COUNT(*) FROM visible_cards)::bigint AS raw_count,
    (
      (SELECT COUNT(*) FROM standalone_cards)
      + (SELECT COUNT(*) FROM layered_groups)
    )::bigint AS playable_count;
$$;

REVOKE ALL ON FUNCTION public.get_portal_playable_card_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_playable_card_count(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.get_portal_playable_card_count(uuid) IS
  'Read-only authoritative public-list card counts for safe study empty-state confirmation.';
