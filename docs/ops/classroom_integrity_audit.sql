-- App Piteco — Classroom integrity audit
-- Run in the production SQL Editor after applying all migrations.
-- This script is read-only and does not change data.

WITH assignment_sources AS (
  SELECT
    a.id AS assignment_id,
    a.turma_id,
    a.fonte_tipo::text AS source_type,
    a.fonte_id AS source_id,
    t.owner_teacher_id,
    t.public AS class_public,
    t.ativo AS class_active
  FROM public.atribuicoes AS a
  JOIN public.turmas AS t ON t.id = a.turma_id
), expected_public_lists AS (
  SELECT
    a.assignment_id,
    a.turma_id,
    l.id AS list_id
  FROM assignment_sources AS a
  JOIN public.lists AS l
    ON a.source_type = 'lista'
   AND l.id = a.source_id
   AND l.deleted_at IS NULL
   AND l.owner_id = a.owner_teacher_id
  WHERE a.class_public = true
    AND a.class_active = true

  UNION ALL

  SELECT
    a.assignment_id,
    a.turma_id,
    l.id AS list_id
  FROM assignment_sources AS a
  JOIN public.folders AS f
    ON a.source_type = 'pasta'
   AND f.id = a.source_id
   AND f.deleted_at IS NULL
   AND f.owner_id = a.owner_teacher_id
  JOIN public.lists AS l
    ON l.folder_id = f.id
   AND l.deleted_at IS NULL
   AND l.owner_id = a.owner_teacher_id
  WHERE a.class_public = true
    AND a.class_active = true
), issues AS (
  SELECT
    'assignment_missing_folder'::text AS issue_type,
    a.turma_id,
    a.assignment_id,
    a.source_id AS folder_id,
    NULL::uuid AS list_id,
    NULL::uuid AS flashcard_id,
    'A folder assignment points to a missing or deleted folder.'::text AS details
  FROM assignment_sources AS a
  LEFT JOIN public.folders AS f
    ON a.source_type = 'pasta'
   AND f.id = a.source_id
   AND f.deleted_at IS NULL
  WHERE a.source_type = 'pasta'
    AND f.id IS NULL

  UNION ALL

  SELECT
    'assignment_missing_list',
    a.turma_id,
    a.assignment_id,
    NULL::uuid,
    a.source_id,
    NULL::uuid,
    'A list assignment points to a missing or deleted list.'
  FROM assignment_sources AS a
  LEFT JOIN public.lists AS l
    ON a.source_type = 'lista'
   AND l.id = a.source_id
   AND l.deleted_at IS NULL
  WHERE a.source_type = 'lista'
    AND l.id IS NULL

  UNION ALL

  SELECT
    'folder_class_mismatch',
    a.turma_id,
    a.assignment_id,
    f.id,
    NULL::uuid,
    NULL::uuid,
    FORMAT('folder.class_id=%s, expected=%s', f.class_id, a.turma_id)
  FROM assignment_sources AS a
  JOIN public.folders AS f
    ON a.source_type = 'pasta'
   AND f.id = a.source_id
   AND f.deleted_at IS NULL
  WHERE f.class_id IS DISTINCT FROM a.turma_id

  UNION ALL

  SELECT
    'folder_owner_mismatch',
    a.turma_id,
    a.assignment_id,
    f.id,
    NULL::uuid,
    NULL::uuid,
    FORMAT('folder.owner_id=%s, expected=%s', f.owner_id, a.owner_teacher_id)
  FROM assignment_sources AS a
  JOIN public.folders AS f
    ON a.source_type = 'pasta'
   AND f.id = a.source_id
   AND f.deleted_at IS NULL
  WHERE f.owner_id IS DISTINCT FROM a.owner_teacher_id

  UNION ALL

  SELECT
    'list_class_mismatch',
    f.class_id,
    NULL::uuid,
    f.id,
    l.id,
    NULL::uuid,
    FORMAT('list.class_id=%s, expected=%s', l.class_id, f.class_id)
  FROM public.folders AS f
  JOIN public.lists AS l ON l.folder_id = f.id
  WHERE f.class_id IS NOT NULL
    AND f.deleted_at IS NULL
    AND l.deleted_at IS NULL
    AND l.class_id IS DISTINCT FROM f.class_id

  UNION ALL

  SELECT
    'list_owner_mismatch',
    f.class_id,
    NULL::uuid,
    f.id,
    l.id,
    NULL::uuid,
    FORMAT('list.owner_id=%s, expected=%s', l.owner_id, f.owner_id)
  FROM public.folders AS f
  JOIN public.lists AS l ON l.folder_id = f.id
  WHERE f.class_id IS NOT NULL
    AND f.deleted_at IS NULL
    AND l.deleted_at IS NULL
    AND l.owner_id IS DISTINCT FROM f.owner_id

  UNION ALL

  SELECT
    'list_visibility_mismatch',
    f.class_id,
    NULL::uuid,
    f.id,
    l.id,
    NULL::uuid,
    FORMAT('list.visibility=%s, expected=class', l.visibility)
  FROM public.folders AS f
  JOIN public.lists AS l ON l.folder_id = f.id
  WHERE f.class_id IS NOT NULL
    AND f.deleted_at IS NULL
    AND l.deleted_at IS NULL
    AND l.visibility IS DISTINCT FROM 'class'

  UNION ALL

  SELECT
    'flashcard_owner_mismatch',
    f.class_id,
    NULL::uuid,
    f.id,
    l.id,
    fc.id,
    FORMAT('flashcard.user_id=%s, expected=%s', fc.user_id, l.owner_id)
  FROM public.folders AS f
  JOIN public.lists AS l ON l.folder_id = f.id
  JOIN public.flashcards AS fc ON fc.list_id = l.id
  WHERE f.class_id IS NOT NULL
    AND f.deleted_at IS NULL
    AND l.deleted_at IS NULL
    AND fc.deleted_at IS NULL
    AND fc.user_id IS DISTINCT FROM l.owner_id

  UNION ALL

  SELECT
    'public_list_missing_from_view',
    e.turma_id,
    e.assignment_id,
    l.folder_id,
    e.list_id,
    NULL::uuid,
    'The list is expected from an active public assignment but is absent from public_turma_lists.'
  FROM expected_public_lists AS e
  JOIN public.lists AS l ON l.id = e.list_id
  LEFT JOIN public.public_turma_lists AS p
    ON p.turma_id = e.turma_id
   AND p.atribuicao_id = e.assignment_id
   AND p.list_id = e.list_id
  WHERE p.list_id IS NULL

  UNION ALL

  SELECT
    'source_assigned_to_multiple_classes',
    NULL::uuid,
    NULL::uuid,
    CASE WHEN a.fonte_tipo::text = 'pasta' THEN a.fonte_id ELSE NULL::uuid END,
    CASE WHEN a.fonte_tipo::text = 'lista' THEN a.fonte_id ELSE NULL::uuid END,
    NULL::uuid,
    FORMAT('source is assigned to %s different classrooms', COUNT(DISTINCT a.turma_id))
  FROM public.atribuicoes AS a
  GROUP BY a.fonte_tipo, a.fonte_id
  HAVING COUNT(DISTINCT a.turma_id) > 1
)
SELECT
  issue_type,
  turma_id,
  assignment_id,
  folder_id,
  list_id,
  flashcard_id,
  details
FROM issues
ORDER BY issue_type, turma_id NULLS LAST, folder_id NULLS LAST, list_id NULLS LAST;
