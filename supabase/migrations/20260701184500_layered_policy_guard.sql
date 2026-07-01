BEGIN;

CREATE OR REPLACE FUNCTION public.import_app_piteco_super_package_current(
  _request_id uuid,
  _payload jsonb,
  _destination_plan jsonb,
  _card_conflict text DEFAULT 'skip',
  _institution_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF _card_conflict = 'replace' AND jsonb_path_exists(
    _payload,
    '$.package.folders[*].lists[*].cards[*] ? (@.type == "layered")'
  ) THEN
    RAISE EXCEPTION 'E_LAYERED_REPLACE_UNSUPPORTED|Use skip, copy ou error para pacotes com camadas.';
  END IF;

  RETURN public.import_app_piteco_super_package_v3(
    _request_id, _payload, _destination_plan, _card_conflict, _institution_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.import_app_piteco_super_package_to_class_current(
  _request_id uuid,
  _payload jsonb,
  _destination_plan jsonb,
  _turma_id uuid,
  _card_conflict text DEFAULT 'skip'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF _card_conflict = 'replace' AND jsonb_path_exists(
    _payload,
    '$.package.folders[*].lists[*].cards[*] ? (@.type == "layered")'
  ) THEN
    RAISE EXCEPTION 'E_LAYERED_REPLACE_UNSUPPORTED|Use skip, copy ou error para pacotes com camadas.';
  END IF;

  RETURN public.import_app_piteco_super_package_to_class_v2(
    _request_id, _payload, _destination_plan, _turma_id, _card_conflict
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_current(uuid,jsonb,jsonb,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_app_piteco_super_package_to_class_current(uuid,jsonb,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_current(uuid,jsonb,jsonb,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_to_class_current(uuid,jsonb,jsonb,uuid,text) TO authenticated;

COMMIT;
