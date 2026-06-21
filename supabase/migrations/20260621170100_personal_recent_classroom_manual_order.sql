BEGIN;

DROP FUNCTION IF EXISTS public.get_lists_with_card_counts(uuid);

CREATE FUNCTION public.get_lists_with_card_counts(_folder_id uuid)
RETURNS TABLE (
  id uuid,
  folder_id uuid,
  owner_id uuid,
  title text,
  description text,
  order_index integer,
  visibility text,
  lang text,
  class_id uuid,
  institution_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  card_count bigint,
  last_activity timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    list_row.id,
    list_row.folder_id,
    list_row.owner_id,
    list_row.title,
    list_row.description,
    list_row.order_index,
    list_row.visibility,
    list_row.lang,
    list_row.class_id,
    list_row.institution_id,
    list_row.created_at,
    list_row.updated_at,
    COUNT(card.id)::bigint AS card_count,
    CASE
      WHEN list_row.class_id IS NULL
        THEN GREATEST(activity.last_studied_at, activity.last_opened_at)
      ELSE NULL
    END AS last_activity
  FROM public.lists list_row
  LEFT JOIN public.flashcards card
    ON card.list_id = list_row.id
   AND card.deleted_at IS NULL
   AND card.parent_card_id IS NULL
  LEFT JOIN public.user_list_activity activity
    ON activity.list_id = list_row.id
   AND activity.user_id = auth.uid()
  WHERE list_row.folder_id = _folder_id
    AND list_row.deleted_at IS NULL
  GROUP BY
    list_row.id,
    activity.last_studied_at,
    activity.last_opened_at
  ORDER BY
    CASE
      WHEN list_row.class_id IS NULL
        THEN GREATEST(activity.last_studied_at, activity.last_opened_at)
      ELSE NULL
    END DESC NULLS LAST,
    list_row.order_index ASC NULLS LAST,
    list_row.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_lists_with_card_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lists_with_card_counts(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
