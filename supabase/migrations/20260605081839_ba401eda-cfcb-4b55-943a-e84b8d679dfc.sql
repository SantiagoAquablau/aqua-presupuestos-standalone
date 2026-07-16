
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_comercials() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recompute_obra_realtime(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalc_obra_totals(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalc_annex_totals(uuid) FROM PUBLIC, anon;
