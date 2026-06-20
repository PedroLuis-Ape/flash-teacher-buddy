-- Deep classroom integrity sweep.
--
-- This migration is intentionally conservative:
--   * it repairs only sources that are assigned to exactly one classroom;
--   * it never deletes folders, lists, flashcards, assignments or classrooms;
--   * it makes classroom-folder descendants inherit the classroom owner/context;
--   * it adds a guard so newly assigned classroom folders cannot drift again.

-- 1) Repair folder sources when the assignment points unambiguously to one class.
WITH folder_assignment_map AS (
  SELECT
    a.fonte_id AS folder_id,
    (array_agg(DISTINCT a.turma_id))[1] AS turma_id,
    (array_agg(DISTINCT t.owner_teacher_id))[1] AS teacher_id,
    COUNT(DISTINCT a.turma_id) AS turma_count,
    COUNT(DISTINCT t.owner_teacher_id) AS teacher_count
  FROM public.atribuicoes AS a
  JOIN public.turmas AS t ON t.id = a.turma_id
  WHERE a.fonte_tipo::text = 'pasta'
  GROUP BY a.fonte_id
), safe_folder_assignment_map AS (
  SELECT folder_id, turma_id, teacher_id
  FROM folder_assignment_map
  WHERE turma_count = 1
    AND teacher_count = 1
)
UPDATE public.folders AS f
SET
  class_id = m.turma_id,
  owner_id = m.teacher_id,
  visibility = 'class'
FROM safe_folder_assignment_map AS m
WHERE f.id = m.folder_id
  AND f.deleted_at IS NULL
  AND (
    f.class_id IS DISTINCT FROM m.turma_id
    OR f.owner_id IS DISTINCT FROM m.teacher_id
    OR f.visibility IS DISTINCT FROM 'class'
  );

-- 2) Every active list inside a classroom folder inherits its folder context.
UPDATE public.lists AS l
SET
  class_id = f.class_id,
  owner_id = f.owner_id,
  visibility = 'class'
FROM public.folders AS f
WHERE f.id = l.folder_id
  AND f.class_id IS NOT NULL
  AND f.deleted_at IS NULL
  AND l.deleted_at IS NULL
  AND (
    l.class_id IS DISTINCT FROM f.class_id
    OR l.owner_id IS DISTINCT FROM f.owner_id
    OR l.visibility IS DISTINCT FROM 'class'
  );

-- 3) Copied flashcards inside classroom lists inherit the list owner.
UPDATE public.flashcards AS fc
SET user_id = l.owner_id
FROM public.lists AS l
JOIN public.folders AS f ON f.id = l.folder_id
WHERE fc.list_id = l.id
  AND f.class_id IS NOT NULL
  AND f.deleted_at IS NULL
  AND l.deleted_at IS NULL
  AND fc.deleted_at IS NULL
  AND fc.user_id IS DISTINCT FROM l.owner_id;

-- 4) Assignment guard: assigning an owned folder to a class synchronizes the
-- folder immediately. Existing list/folder triggers then propagate the context.
CREATE OR REPLACE FUNCTION public.sync_assigned_folder_class_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  teacher_id uuid;
BEGIN
  IF NEW.fonte_tipo::text <> 'pasta' THEN
    RETURN NEW;
  END IF;

  SELECT t.owner_teacher_id
  INTO teacher_id
  FROM public.turmas AS t
  WHERE t.id = NEW.turma_id;

  IF teacher_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.folders AS f
  SET
    class_id = NEW.turma_id,
    owner_id = teacher_id,
    visibility = 'class'
  WHERE f.id = NEW.fonte_id
    AND f.deleted_at IS NULL
    AND f.owner_id = teacher_id
    AND (
      f.class_id IS DISTINCT FROM NEW.turma_id
      OR f.visibility IS DISTINCT FROM 'class'
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_assigned_folder_class_context_trigger
  ON public.atribuicoes;
CREATE TRIGGER sync_assigned_folder_class_context_trigger
AFTER INSERT OR UPDATE OF turma_id, fonte_tipo, fonte_id
ON public.atribuicoes
FOR EACH ROW
EXECUTE FUNCTION public.sync_assigned_folder_class_context();

-- 5) Keep public classroom discovery assignment-driven. Re-declaring this
-- function makes the migration a complete safety net even if an older function
-- body was left behind in production.
CREATE OR REPLACE FUNCTION public.public_turma_lists_rows()
RETURNS TABLE (
  turma_id uuid,
  atribuicao_id uuid,
  list_id uuid,
  title text,
  description text,
  order_index integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.turma_id,
    a.id,
    l.id,
    l.title,
    l.description,
    l.order_index
  FROM public.atribuicoes AS a
  JOIN public.turmas AS t
    ON t.id = a.turma_id
   AND t.public = true
   AND t.ativo = true
  JOIN public.lists AS l
    ON a.fonte_tipo::text = 'lista'
   AND l.id = a.fonte_id
   AND l.owner_id = t.owner_teacher_id
  WHERE l.deleted_at IS NULL

  UNION ALL

  SELECT
    a.turma_id,
    a.id,
    l.id,
    l.title,
    l.description,
    l.order_index
  FROM public.atribuicoes AS a
  JOIN public.turmas AS t
    ON t.id = a.turma_id
   AND t.public = true
   AND t.ativo = true
  JOIN public.folders AS f
    ON a.fonte_tipo::text = 'pasta'
   AND f.id = a.fonte_id
   AND f.owner_id = t.owner_teacher_id
  JOIN public.lists AS l
    ON l.folder_id = f.id
   AND l.owner_id = t.owner_teacher_id
  WHERE f.deleted_at IS NULL
    AND l.deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_flashcards(_list_id uuid)
RETURNS SETOF public.flashcards
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fc.*
  FROM public.flashcards AS fc
  JOIN public.lists AS l ON l.id = fc.list_id
  JOIN public.folders AS f ON f.id = l.folder_id
  JOIN public.profiles AS p ON p.id = l.owner_id
  WHERE fc.list_id = _list_id
    AND fc.deleted_at IS NULL
    AND l.deleted_at IS NULL
    AND f.deleted_at IS NULL
    AND fc.user_id = l.owner_id
    AND f.owner_id = l.owner_id
    AND (
      (
        l.class_id IS NULL
        AND f.class_id IS NULL
        AND f.visibility = 'class'
        AND COALESCE(p.public_access_enabled, false) = true
      )
      OR
      EXISTS (
        SELECT 1
        FROM public.turmas AS t
        JOIN public.atribuicoes AS a ON a.turma_id = t.id
        WHERE t.owner_teacher_id = l.owner_id
          AND t.public = true
          AND t.ativo = true
          AND (
            (a.fonte_tipo::text = 'lista' AND a.fonte_id = l.id)
            OR
            (
              a.fonte_tipo::text = 'pasta'
              AND a.fonte_id = f.id
              AND f.owner_id = t.owner_teacher_id
              AND l.owner_id = t.owner_teacher_id
            )
          )
      )
    )
  ORDER BY fc.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_portal_flashcards(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_flashcards(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.sync_assigned_folder_class_context() IS
  'Synchronizes an owned folder with the classroom when a folder assignment is created or moved.';
