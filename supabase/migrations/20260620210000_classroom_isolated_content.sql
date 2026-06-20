-- Classroom content is contextual to the classroom, not to the public/private
-- visibility of the teacher's personal library.
--
-- Guarantees introduced here:
--   1. Lists created inside a classroom folder always inherit its class context.
--   2. Existing inconsistent lists are repaired.
--   3. Teachers can create a classroom-only folder and assignment atomically.
--   4. Public classroom reads use the assignment as the source of truth instead
--      of requiring duplicate visibility/class metadata on every child row.

-- Repair lists already stored inside classroom folders.
UPDATE public.lists AS l
SET
  class_id = f.class_id,
  visibility = 'class',
  owner_id = f.owner_id
FROM public.folders AS f
WHERE f.id = l.folder_id
  AND f.class_id IS NOT NULL
  AND (
    l.class_id IS DISTINCT FROM f.class_id
    OR l.visibility IS DISTINCT FROM 'class'
    OR l.owner_id IS DISTINCT FROM f.owner_id
  );

CREATE OR REPLACE FUNCTION public.inherit_list_class_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_class_id uuid;
  parent_owner_id uuid;
BEGIN
  SELECT f.class_id, f.owner_id
  INTO parent_class_id, parent_owner_id
  FROM public.folders AS f
  WHERE f.id = NEW.folder_id;

  IF parent_class_id IS NOT NULL THEN
    NEW.class_id := parent_class_id;
    NEW.visibility := 'class';
    NEW.owner_id := parent_owner_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inherit_list_class_context_trigger ON public.lists;
CREATE TRIGGER inherit_list_class_context_trigger
BEFORE INSERT OR UPDATE ON public.lists
FOR EACH ROW
EXECUTE FUNCTION public.inherit_list_class_context();

CREATE OR REPLACE FUNCTION public.propagate_folder_class_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.class_id IS NOT NULL THEN
    UPDATE public.lists
    SET
      class_id = NEW.class_id,
      visibility = 'class',
      owner_id = NEW.owner_id
    WHERE folder_id = NEW.id
      AND (
        class_id IS DISTINCT FROM NEW.class_id
        OR visibility IS DISTINCT FROM 'class'
        OR owner_id IS DISTINCT FROM NEW.owner_id
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS propagate_folder_class_context_trigger ON public.folders;
CREATE TRIGGER propagate_folder_class_context_trigger
AFTER INSERT OR UPDATE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.propagate_folder_class_context();

CREATE OR REPLACE FUNCTION public.create_class_folder_with_assignment(
  _turma_id uuid,
  _title text,
  _description text DEFAULT NULL
)
RETURNS TABLE (
  folder_id uuid,
  assignment_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  teacher_id uuid;
  created_folder_id uuid;
  created_assignment_id uuid;
  next_order integer;
  clean_title text := NULLIF(BTRIM(_title), '');
  clean_description text := NULLIF(BTRIM(COALESCE(_description, '')), '');
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF clean_title IS NULL THEN
    RAISE EXCEPTION 'Folder title is required' USING ERRCODE = '22023';
  END IF;

  SELECT t.owner_teacher_id
  INTO teacher_id
  FROM public.turmas AS t
  WHERE t.id = _turma_id
    AND t.ativo = true
  FOR UPDATE;

  IF teacher_id IS NULL THEN
    RAISE EXCEPTION 'Classroom not found or inactive' USING ERRCODE = 'P0002';
  END IF;

  IF teacher_id <> caller_id THEN
    RAISE EXCEPTION 'Only the classroom owner can create folders' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.folders (
    owner_id,
    title,
    description,
    visibility,
    class_id
  )
  VALUES (
    teacher_id,
    clean_title,
    clean_description,
    'class',
    _turma_id
  )
  RETURNING id INTO created_folder_id;

  SELECT COALESCE(MAX(a.order_index), 0) + 1
  INTO next_order
  FROM public.atribuicoes AS a
  WHERE a.turma_id = _turma_id;

  INSERT INTO public.atribuicoes (
    turma_id,
    titulo,
    descricao,
    fonte_tipo,
    fonte_id,
    order_index
  )
  VALUES (
    _turma_id,
    clean_title,
    clean_description,
    'pasta'::public.atribuicao_fonte_tipo,
    created_folder_id,
    next_order
  )
  RETURNING id INTO created_assignment_id;

  RETURN QUERY SELECT created_folder_id, created_assignment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_class_folder_with_assignment(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_class_folder_with_assignment(uuid, text, text) TO authenticated;

-- Public classroom counts and list discovery are controlled by the assignment
-- and classroom state. Personal-library visibility is intentionally irrelevant.
CREATE OR REPLACE FUNCTION public.public_turma_atribuicoes_rows()
RETURNS TABLE (
  id uuid,
  turma_id uuid,
  titulo text,
  descricao text,
  fonte_tipo text,
  order_index integer,
  created_at timestamptz,
  card_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.turma_id,
    a.titulo,
    a.descricao,
    a.fonte_tipo::text,
    a.order_index,
    a.created_at,
    CASE
      WHEN a.fonte_tipo::text = 'lista' THEN (
        SELECT COUNT(*)::integer
        FROM public.lists AS li
        JOIN public.flashcards AS fc ON fc.list_id = li.id
        WHERE li.id = a.fonte_id
          AND li.owner_id = t.owner_teacher_id
          AND li.deleted_at IS NULL
          AND fc.user_id = t.owner_teacher_id
          AND fc.deleted_at IS NULL
      )
      WHEN a.fonte_tipo::text = 'pasta' THEN (
        SELECT COUNT(*)::integer
        FROM public.folders AS fo
        JOIN public.lists AS li ON li.folder_id = fo.id
        JOIN public.flashcards AS fc ON fc.list_id = li.id
        WHERE fo.id = a.fonte_id
          AND fo.owner_id = t.owner_teacher_id
          AND fo.deleted_at IS NULL
          AND li.owner_id = t.owner_teacher_id
          AND li.deleted_at IS NULL
          AND fc.user_id = t.owner_teacher_id
          AND fc.deleted_at IS NULL
      )
      ELSE 0
    END
  FROM public.atribuicoes AS a
  JOIN public.turmas AS t ON t.id = a.turma_id
  WHERE t.public = true
    AND t.ativo = true;
$$;

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

COMMENT ON FUNCTION public.create_class_folder_with_assignment(uuid, text, text) IS
  'Creates an isolated classroom folder and its assignment atomically for the classroom owner.';
COMMENT ON FUNCTION public.inherit_list_class_context() IS
  'Forces every list inside a classroom folder to inherit owner, class_id and class visibility.';
COMMENT ON FUNCTION public.public_turma_lists_rows() IS
  'Returns lists contextually exposed by active public classroom assignments, independently of personal-library visibility.';
