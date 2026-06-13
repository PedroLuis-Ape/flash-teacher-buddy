-- Canonicalize favorites & red list to parent_card_id for layered cards.
-- Idempotent: safe to re-run; uses ON CONFLICT DO NOTHING and only deletes
-- legacy per-layer rows after the canonical row exists.
-- Specials are NOT migrated — they remain per-layer by design.

-- 1) FAVORITES (resource_type='flashcard')
WITH legacy AS (
  SELECT uf.user_id, uf.resource_id AS layer_id, f.parent_card_id
  FROM public.user_favorites uf
  JOIN public.flashcards f ON f.id = uf.resource_id
  WHERE uf.resource_type = 'flashcard'
    AND f.parent_card_id IS NOT NULL
), inserted AS (
  INSERT INTO public.user_favorites (user_id, resource_type, resource_id)
  SELECT DISTINCT user_id, 'flashcard', parent_card_id
  FROM legacy
  ON CONFLICT DO NOTHING
  RETURNING user_id, resource_id
)
DELETE FROM public.user_favorites uf
USING legacy l
WHERE uf.user_id = l.user_id
  AND uf.resource_type = 'flashcard'
  AND uf.resource_id = l.layer_id
  AND EXISTS (
    SELECT 1 FROM public.user_favorites cuf
    WHERE cuf.user_id = l.user_id
      AND cuf.resource_type = 'flashcard'
      AND cuf.resource_id = l.parent_card_id
  );

-- 2) RED LIST
WITH legacy AS (
  SELECT ur.user_id, ur.flashcard_id AS layer_id, f.parent_card_id
  FROM public.user_red_list ur
  JOIN public.flashcards f ON f.id = ur.flashcard_id
  WHERE f.parent_card_id IS NOT NULL
), inserted AS (
  INSERT INTO public.user_red_list (user_id, flashcard_id)
  SELECT DISTINCT user_id, parent_card_id
  FROM legacy
  ON CONFLICT DO NOTHING
  RETURNING user_id, flashcard_id
)
DELETE FROM public.user_red_list ur
USING legacy l
WHERE ur.user_id = l.user_id
  AND ur.flashcard_id = l.layer_id
  AND EXISTS (
    SELECT 1 FROM public.user_red_list cur
    WHERE cur.user_id = l.user_id
      AND cur.flashcard_id = l.parent_card_id
  );