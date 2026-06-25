-- Public classroom ordering v1
-- Lets each teacher define which public classroom appears first on the public profile.

ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS public_order_index integer;

COMMENT ON COLUMN public.turmas.public_order_index IS
  'Teacher-defined 1-based position used only when listing active public classrooms.';

-- Preserve the current public profile order (newest first) on first install, while
-- keeping any already-valid order if the migration is reapplied.
WITH ranked AS (
  SELECT
    t.id,
    ROW_NUMBER() OVER (
      PARTITION BY t.owner_teacher_id
      ORDER BY
        CASE WHEN COALESCE(t.public_order_index, 0) > 0 THEN 0 ELSE 1 END,
        t.public_order_index NULLS LAST,
        t.created_at DESC,
        t.id
    )::integer AS position
  FROM public.turmas t
  WHERE t.public = true
    AND t.ativo = true
)
UPDATE public.turmas t
SET public_order_index = ranked.position
FROM ranked
WHERE t.id = ranked.id
  AND t.public_order_index IS DISTINCT FROM ranked.position;

UPDATE public.turmas
SET public_order_index = NULL
WHERE (public = false OR ativo = false)
  AND public_order_index IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'turmas_public_order_index_positive'
      AND conrelid = 'public.turmas'::regclass
  ) THEN
    ALTER TABLE public.turmas
      ADD CONSTRAINT turmas_public_order_index_positive
      CHECK (public_order_index IS NULL OR public_order_index > 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_turmas_owner_public_order
  ON public.turmas (owner_teacher_id, public_order_index, created_at DESC)
  WHERE public = true AND ativo = true;

CREATE OR REPLACE FUNCTION public.assign_public_turma_order_index()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.public, false) = false OR COALESCE(NEW.ativo, true) = false THEN
    NEW.public_order_index := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     OR COALESCE(OLD.public, false) = false
     OR COALESCE(OLD.ativo, true) = false
     OR COALESCE(NEW.public_order_index, 0) <= 0 THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.owner_teacher_id::text, 0));

    SELECT COALESCE(MAX(t.public_order_index), 0) + 1
    INTO NEW.public_order_index
    FROM public.turmas t
    WHERE t.owner_teacher_id = NEW.owner_teacher_id
      AND t.public = true
      AND t.ativo = true
      AND t.id IS DISTINCT FROM NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_public_turma_order_index_trigger ON public.turmas;
CREATE TRIGGER assign_public_turma_order_index_trigger
BEFORE INSERT OR UPDATE OF public, ativo, owner_teacher_id
ON public.turmas
FOR EACH ROW
EXECUTE FUNCTION public.assign_public_turma_order_index();

CREATE OR REPLACE FUNCTION public.reorder_public_turmas(_ordered_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested_count integer := COALESCE(cardinality(_ordered_ids), 0);
  v_distinct_count integer := 0;
  v_owned_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));

  SELECT COUNT(*)::integer
  INTO v_owned_count
  FROM public.turmas t
  WHERE t.owner_teacher_id = auth.uid()
    AND t.public = true
    AND t.ativo = true;

  IF v_requested_count <> v_owned_count THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CLASS_SET_MISMATCH',
      'expected_count', v_owned_count,
      'received_count', v_requested_count
    );
  END IF;

  SELECT COUNT(DISTINCT item.id)::integer
  INTO v_distinct_count
  FROM UNNEST(COALESCE(_ordered_ids, ARRAY[]::uuid[])) AS item(id);

  IF v_distinct_count <> v_requested_count THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_CLASS');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM UNNEST(COALESCE(_ordered_ids, ARRAY[]::uuid[])) AS requested(id)
    LEFT JOIN public.turmas t
      ON t.id = requested.id
     AND t.owner_teacher_id = auth.uid()
     AND t.public = true
     AND t.ativo = true
    WHERE t.id IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN_CLASS');
  END IF;

  UPDATE public.turmas t
  SET
    public_order_index = requested.position::integer,
    updated_at = now()
  FROM UNNEST(COALESCE(_ordered_ids, ARRAY[]::uuid[])) WITH ORDINALITY AS requested(id, position)
  WHERE t.id = requested.id
    AND t.owner_teacher_id = auth.uid()
    AND t.public = true
    AND t.ativo = true;

  RETURN jsonb_build_object(
    'success', true,
    'count', v_requested_count,
    'ordered_ids', TO_JSONB(COALESCE(_ordered_ids, ARRAY[]::uuid[]))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_public_turmas(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_public_turmas(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.reorder_public_turmas(uuid[]) IS
  'Atomically saves the authenticated teacher public classroom order after validating ownership and the complete public classroom set.';

CREATE OR REPLACE FUNCTION public.get_public_teacher_turmas(_slug text)
RETURNS TABLE (
  id uuid,
  nome text,
  descricao text,
  assignment_count bigint,
  card_count bigint,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.nome,
    t.descricao,
    (SELECT COUNT(*) FROM public.public_turma_atribuicoes pa WHERE pa.turma_id = t.id) AS assignment_count,
    (SELECT COUNT(*) FROM public.public_turma_flashcards pf WHERE pf.turma_id = t.id) AS card_count,
    t.created_at
  FROM public.profiles p
  JOIN public.turmas t ON t.owner_teacher_id = p.id
  WHERE COALESCE(p.is_teacher, false) = true
    AND COALESCE(p.public_access_enabled, false) = true
    AND COALESCE(p.public_profile_searchable, false) = true
    AND p.public_slug IS NOT NULL
    AND LOWER(BTRIM(p.public_slug)) = LOWER(BTRIM(COALESCE(_slug, '')))
    AND t.public = true
    AND t.ativo = true
  ORDER BY
    CASE WHEN COALESCE(t.public_order_index, 0) > 0 THEN 0 ELSE 1 END,
    t.public_order_index ASC NULLS LAST,
    t.created_at DESC,
    t.id;
$$;

REVOKE ALL ON FUNCTION public.get_public_teacher_turmas(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_teacher_turmas(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_public_teacher_turmas(text) IS
  'Returns active public classrooms in the teacher-defined public order without exposing ownership, membership, email, progress, or administrative data.';
