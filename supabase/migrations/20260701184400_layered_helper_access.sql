BEGIN;
REVOKE ALL ON FUNCTION public.merge_cards_into_layers(uuid,uuid[],text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unmerge_layered_card(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_cards_into_layers(uuid,uuid[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unmerge_layered_card(uuid) TO authenticated;
COMMIT;
