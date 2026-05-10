revoke execute on function public.merge_cards_into_layers(uuid, uuid[], text) from public;
revoke execute on function public.merge_cards_into_layers(uuid, uuid[], text) from anon;
grant execute on function public.merge_cards_into_layers(uuid, uuid[], text) to authenticated;

revoke execute on function public.unmerge_layered_card(uuid) from public;
revoke execute on function public.unmerge_layered_card(uuid) from anon;
grant execute on function public.unmerge_layered_card(uuid) to authenticated;