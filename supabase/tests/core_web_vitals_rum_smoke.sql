\set ON_ERROR_STOP on

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.web_vital_samples', 'SELECT')
     OR has_table_privilege('anon', 'public.web_vital_samples', 'INSERT')
     OR has_table_privilege('authenticated', 'public.web_vital_samples', 'SELECT')
     OR has_table_privilege('authenticated', 'public.web_vital_samples', 'INSERT') THEN
    RAISE EXCEPTION 'Public roles received direct Web Vitals table access';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.record_web_vital_sample(uuid,text,double precision,text,text,text,text,double precision,text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.record_web_vital_sample(uuid,text,double precision,text,text,text,text,double precision,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Public roles can execute the RUM ingestion RPC';
  END IF;

  IF has_table_privilege('anon', 'public.web_vital_daily_summary', 'SELECT')
     OR has_table_privilege('authenticated', 'public.web_vital_daily_summary', 'SELECT') THEN
    RAISE EXCEPTION 'Public roles can read the aggregate RUM view';
  END IF;
END;
$$;

SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false);

SELECT public.record_web_vital_sample(
  '61616161-6161-4161-8161-616161616161',
  'LCP', 2400, 'good', '/rum-smoke', 'mobile', 'navigate', 0.1, 'smoke-build'
);
SELECT public.record_web_vital_sample(
  '62626262-6262-4262-8262-626262626262',
  'LCP', 1000, 'good', '/rum-p75', 'desktop', 'navigate', 0.1, NULL
);
SELECT public.record_web_vital_sample(
  '63636363-6363-4363-8363-636363636363',
  'LCP', 2000, 'good', '/rum-p75', 'desktop', 'navigate', 0.1, NULL
);
SELECT public.record_web_vital_sample(
  '64646464-6464-4464-8464-646464646464',
  'LCP', 3000, 'needs-improvement', '/rum-p75', 'desktop', 'navigate', 0.1, NULL
);
SELECT public.record_web_vital_sample(
  '65656565-6565-4565-8565-656565656565',
  'LCP', 4000, 'needs-improvement', '/rum-p75', 'desktop', 'navigate', 0.1, NULL
);
SELECT public.record_web_vital_sample(
  '66666666-6666-4666-8666-666666666666',
  'INP', 180, 'good', '/rum-smoke', 'mobile', 'reload', 0.1, NULL
);
SELECT public.record_web_vital_sample(
  '67676767-6767-4767-8767-676767676767',
  'CLS', 0.12, 'needs-improvement', '/rum-smoke', 'tablet', 'back_forward', 0.1, NULL
);

-- The same ephemeral page view and metric must update instead of duplicating.
SELECT public.record_web_vital_sample(
  '61616161-6161-4161-8161-616161616161',
  'LCP', 2600, 'needs-improvement', '/rum-smoke', 'mobile', 'navigate', 0.1, 'smoke-build-2'
);

DO $$
DECLARE
  summary_row record;
BEGIN
  IF (
    SELECT COUNT(*) FROM public.web_vital_samples
    WHERE page_view_id = '61616161-6161-4161-8161-616161616161'
      AND metric = 'LCP'
      AND value = 2600
      AND rating = 'needs-improvement'
      AND build_id = 'smoke-build-2'
  ) <> 1 THEN
    RAISE EXCEPTION 'RUM upsert did not preserve one row per page view and metric';
  END IF;

  SELECT * INTO summary_row
  FROM public.web_vital_daily_summary
  WHERE metric = 'LCP'
    AND device_class = 'desktop'
    AND route_group = '/rum-p75';

  IF summary_row.sample_count <> 4 THEN
    RAISE EXCEPTION 'Unexpected p75 sample count: %', summary_row.sample_count;
  END IF;
  IF abs(summary_row.p75_value - 3250) > 0.001 THEN
    RAISE EXCEPTION 'Unexpected continuous p75 value: %', summary_row.p75_value;
  END IF;
  IF abs(summary_row.good_rate - 0.5) > 0.001 THEN
    RAISE EXCEPTION 'Unexpected good-rate value: %', summary_row.good_rate;
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.record_web_vital_sample(
      '68686868-6868-4868-8868-686868686868',
      'LCP', 2600, 'good', '/rum-invalid', 'mobile', 'navigate', 0.1, NULL
    );
    RAISE EXCEPTION 'Mismatched rating was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  BEGIN
    PERFORM public.record_web_vital_sample(
      '69696969-6969-4969-8969-696969696969',
      'INP', 150, 'good', '/portal/list/secret?answer=1', 'mobile', 'navigate', 0.1, NULL
    );
    RAISE EXCEPTION 'Raw route with query parameters was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  BEGIN
    PERFORM public.record_web_vital_sample(
      '70707070-7070-4070-8070-707070707070',
      'CLS', 12, 'poor', '/rum-invalid', 'mobile', 'navigate', 0.1, NULL
    );
    RAISE EXCEPTION 'Out-of-range CLS was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  BEGIN
    PERFORM public.record_web_vital_sample(
      '71717171-7171-4171-8171-717171717171',
      'LCP', 'NaN'::double precision, 'poor', '/rum-invalid', 'desktop', 'navigate', 0.1, NULL
    );
    RAISE EXCEPTION 'NaN metric value was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  BEGIN
    PERFORM public.record_web_vital_sample(
      '72727272-7272-4272-8272-727272727272',
      'INP', 'Infinity'::double precision, 'poor', '/rum-invalid', 'desktop', 'navigate', 0.1, NULL
    );
    RAISE EXCEPTION 'Infinite metric value was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  BEGIN
    PERFORM public.record_web_vital_sample(
      '73737373-7373-4373-8373-737373737373',
      'CLS', 0.05, 'good', '/rum-invalid', 'desktop', 'navigate', 'Infinity'::double precision, NULL
    );
    RAISE EXCEPTION 'Infinite sample rate was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;
END;
$$;

UPDATE public.web_vital_samples
SET observed_at = now() - interval '100 days'
WHERE route_group = '/rum-p75';

DO $$
DECLARE
  deleted_count integer;
BEGIN
  deleted_count := public.purge_web_vital_samples(90);
  IF deleted_count <> 4 THEN
    RAISE EXCEPTION 'Unexpected purge count: %', deleted_count;
  END IF;
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.role', '', false);

SELECT 'Core Web Vitals RUM smoke passed' AS result;
