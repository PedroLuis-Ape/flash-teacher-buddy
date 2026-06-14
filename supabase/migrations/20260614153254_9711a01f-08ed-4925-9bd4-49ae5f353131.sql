
-- =========================================================================
-- Clara Master — Fase 4: backfill legado -> user_flashcard_group_status
-- Não-destrutivo. Re-executável (ON CONFLICT DO NOTHING).
-- =========================================================================

-- 1) Tabela de relatório (auditoria persistente da execução)
CREATE TABLE IF NOT EXISTS public.clara_backfill_phase4_report (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at        timestamptz NOT NULL DEFAULT now(),
  metric        text NOT NULL,
  value_bigint  bigint,
  detail        jsonb
);
GRANT ALL ON public.clara_backfill_phase4_report TO service_role;
ALTER TABLE public.clara_backfill_phase4_report ENABLE ROW LEVEL SECURITY;
-- Sem policies => nenhum role além de service_role acessa.

-- 2) Snapshot pré-execução
INSERT INTO public.clara_backfill_phase4_report(metric, value_bigint) VALUES
  ('pre.user_favorites_flashcards',
    (SELECT count(*) FROM public.user_favorites WHERE resource_type='flashcard')),
  ('pre.user_favorites_orphans',
    (SELECT count(*) FROM public.user_favorites uf
     WHERE uf.resource_type='flashcard'
       AND NOT EXISTS (SELECT 1 FROM public.flashcards f WHERE f.id = uf.resource_id))),
  ('pre.user_red_list', (SELECT count(*) FROM public.user_red_list)),
  ('pre.user_flashcard_group_status', (SELECT count(*) FROM public.user_flashcard_group_status));

-- 3) Backfill FAVORITOS — agrupa por (user_id, status_group_uid)
WITH src AS (
  SELECT DISTINCT uf.user_id, f.status_group_uid, min(uf.created_at) AS first_at
  FROM public.user_favorites uf
  JOIN public.flashcards f ON f.id = uf.resource_id
  WHERE uf.resource_type = 'flashcard'
    AND f.status_group_uid IS NOT NULL
  GROUP BY uf.user_id, f.status_group_uid
), ins AS (
  INSERT INTO public.user_flashcard_group_status
    (user_id, status_group_uid, is_favorite, is_red_list, last_operation_id, created_at, updated_at)
  SELECT s.user_id, s.status_group_uid, true, false, gen_random_uuid(), s.first_at, now()
  FROM src s
  ON CONFLICT (user_id, status_group_uid) DO UPDATE
    SET is_favorite = true,
        updated_at  = now()
    WHERE public.user_flashcard_group_status.is_favorite = false
  RETURNING 1
)
INSERT INTO public.clara_backfill_phase4_report(metric, value_bigint)
SELECT 'backfill.favorites_groups_written', count(*) FROM ins;

-- 4) Backfill RED LIST — só onde já existe favorito (CHECK garante)
WITH src AS (
  SELECT DISTINCT ur.user_id, f.status_group_uid, min(ur.created_at) AS first_at
  FROM public.user_red_list ur
  JOIN public.flashcards f ON f.id = ur.flashcard_id
  WHERE f.status_group_uid IS NOT NULL
  GROUP BY ur.user_id, f.status_group_uid
), ins AS (
  INSERT INTO public.user_flashcard_group_status
    (user_id, status_group_uid, is_favorite, is_red_list, last_operation_id, created_at, updated_at)
  SELECT s.user_id, s.status_group_uid, true, true, gen_random_uuid(), s.first_at, now()
  FROM src s
  ON CONFLICT (user_id, status_group_uid) DO UPDATE
    SET is_red_list  = true,
        is_favorite  = true,   -- invariante CHECK
        updated_at   = now()
    WHERE public.user_flashcard_group_status.is_red_list = false
  RETURNING 1
)
INSERT INTO public.clara_backfill_phase4_report(metric, value_bigint)
SELECT 'backfill.red_list_groups_written', count(*) FROM ins;

-- 5) Snapshot pós-execução + reconciliação
INSERT INTO public.clara_backfill_phase4_report(metric, value_bigint) VALUES
  ('post.user_flashcard_group_status_total',
    (SELECT count(*) FROM public.user_flashcard_group_status)),
  ('post.ufgs_favorites',
    (SELECT count(*) FROM public.user_flashcard_group_status WHERE is_favorite)),
  ('post.ufgs_red_list',
    (SELECT count(*) FROM public.user_flashcard_group_status WHERE is_red_list));

-- 6) Reconciliação: para todo (user_id, status_group_uid) que existe no legado,
--    deve existir na nova tabela. Conta divergências.
INSERT INTO public.clara_backfill_phase4_report(metric, value_bigint, detail)
SELECT 'recon.legacy_fav_groups_missing_in_new',
       count(*),
       jsonb_agg(jsonb_build_object('user_id', t.user_id, 'sgu', t.status_group_uid)) FILTER (WHERE t.user_id IS NOT NULL)
FROM (
  SELECT DISTINCT uf.user_id, f.status_group_uid
  FROM public.user_favorites uf
  JOIN public.flashcards f ON f.id = uf.resource_id
  WHERE uf.resource_type='flashcard' AND f.status_group_uid IS NOT NULL
) t
LEFT JOIN public.user_flashcard_group_status u
  ON u.user_id = t.user_id AND u.status_group_uid = t.status_group_uid AND u.is_favorite = true
WHERE u.user_id IS NULL;

INSERT INTO public.clara_backfill_phase4_report(metric, value_bigint, detail)
SELECT 'recon.legacy_red_groups_missing_in_new',
       count(*),
       jsonb_agg(jsonb_build_object('user_id', t.user_id, 'sgu', t.status_group_uid)) FILTER (WHERE t.user_id IS NOT NULL)
FROM (
  SELECT DISTINCT ur.user_id, f.status_group_uid
  FROM public.user_red_list ur
  JOIN public.flashcards f ON f.id = ur.flashcard_id
  WHERE f.status_group_uid IS NOT NULL
) t
LEFT JOIN public.user_flashcard_group_status u
  ON u.user_id = t.user_id AND u.status_group_uid = t.status_group_uid AND u.is_red_list = true
WHERE u.user_id IS NULL;

-- 7) Lista de órfãos para auditoria
INSERT INTO public.clara_backfill_phase4_report(metric, value_bigint, detail)
SELECT 'audit.orphan_favorites_skipped',
       count(*),
       jsonb_agg(jsonb_build_object('user_id', uf.user_id, 'resource_id', uf.resource_id))
FROM public.user_favorites uf
WHERE uf.resource_type='flashcard'
  AND NOT EXISTS (SELECT 1 FROM public.flashcards f WHERE f.id = uf.resource_id);
