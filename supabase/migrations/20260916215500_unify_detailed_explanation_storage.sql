-- Unify legacy rich explanation content into the canonical flashcard columns.
--
-- Historical study UI could persist a composed block inside `hint`, e.g.:
--   <real hint>
--   **Explicação detalhada**
--   ...
--   **Quando usar**
--   ...
--   **Erros comuns**
--   ...
--
-- The current contract has one source of truth for each rich field:
-- `detailed_explanation`, `usage_notes`, `common_mistakes`.
-- This migration preserves any real hint prefix, moves legacy rich sections to
-- their canonical columns, and merges conflicting non-empty values instead of
-- dropping either copy.

WITH legacy AS (
  SELECT
    id,
    hint,
    LEAST(
      NULLIF(strpos(hint, '**Explicação detalhada**'), 0),
      NULLIF(strpos(hint, '**Quando usar**'), 0),
      NULLIF(strpos(hint, '**Erros comuns**'), 0)
    ) AS rich_start,
    CASE
      WHEN strpos(hint, '**Explicação detalhada**') > 0
        THEN split_part(hint, '**Explicação detalhada**', 2)
      ELSE NULL
    END AS explanation_tail,
    CASE
      WHEN strpos(hint, '**Quando usar**') > 0
        THEN split_part(hint, '**Quando usar**', 2)
      ELSE NULL
    END AS usage_tail,
    CASE
      WHEN strpos(hint, '**Erros comuns**') > 0
        THEN split_part(hint, '**Erros comuns**', 2)
      ELSE NULL
    END AS mistakes_tail
  FROM public.flashcards
  WHERE hint IS NOT NULL
    AND (
      hint LIKE '%**Explicação detalhada**%'
      OR hint LIKE '%**Quando usar**%'
      OR hint LIKE '%**Erros comuns**%'
    )
),
parsed AS (
  SELECT
    id,
    NULLIF(btrim(left(hint, rich_start - 1)), '') AS clean_hint,
    NULLIF(btrim(
      CASE
        WHEN explanation_tail IS NULL THEN NULL
        WHEN strpos(explanation_tail, '**Quando usar**') > 0
          THEN split_part(explanation_tail, '**Quando usar**', 1)
        WHEN strpos(explanation_tail, '**Erros comuns**') > 0
          THEN split_part(explanation_tail, '**Erros comuns**', 1)
        ELSE explanation_tail
      END
    ), '') AS legacy_explanation,
    NULLIF(btrim(
      CASE
        WHEN usage_tail IS NULL THEN NULL
        WHEN strpos(usage_tail, '**Erros comuns**') > 0
          THEN split_part(usage_tail, '**Erros comuns**', 1)
        ELSE usage_tail
      END
    ), '') AS legacy_usage_notes,
    NULLIF(btrim(mistakes_tail), '') AS legacy_common_mistakes
  FROM legacy
),
merged AS (
  SELECT
    f.id,
    p.clean_hint,
    CASE
      WHEN NULLIF(btrim(f.detailed_explanation), '') IS NULL THEN p.legacy_explanation
      WHEN p.legacy_explanation IS NULL
        OR btrim(f.detailed_explanation) = p.legacy_explanation
        THEN f.detailed_explanation
      ELSE f.detailed_explanation || E'\n\n' || p.legacy_explanation
    END AS detailed_explanation,
    CASE
      WHEN NULLIF(btrim(f.usage_notes), '') IS NULL THEN p.legacy_usage_notes
      WHEN p.legacy_usage_notes IS NULL
        OR btrim(f.usage_notes) = p.legacy_usage_notes
        THEN f.usage_notes
      ELSE f.usage_notes || E'\n\n' || p.legacy_usage_notes
    END AS usage_notes,
    CASE
      WHEN NULLIF(btrim(f.common_mistakes), '') IS NULL THEN p.legacy_common_mistakes
      WHEN p.legacy_common_mistakes IS NULL
        OR btrim(f.common_mistakes) = p.legacy_common_mistakes
        THEN f.common_mistakes
      ELSE f.common_mistakes || E'\n\n' || p.legacy_common_mistakes
    END AS common_mistakes
  FROM public.flashcards f
  JOIN parsed p ON p.id = f.id
)
UPDATE public.flashcards AS f
SET
  hint = m.clean_hint,
  detailed_explanation = m.detailed_explanation,
  usage_notes = m.usage_notes,
  common_mistakes = m.common_mistakes,
  updated_at = now()
FROM merged AS m
WHERE f.id = m.id;
