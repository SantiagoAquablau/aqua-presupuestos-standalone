
-- Revoke from PUBLIC/anon on all SECURITY DEFINER functions in public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_obra_totals(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_recalc_obra_on_item_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_annex_totals(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_recalc_annex_on_item_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_obra_realtime(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_recalc_annex_on_pct_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_comercials() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_annex_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_annex_from_obra() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_obra_from_budget() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_annex_to_obra() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_obra_on_budget_delete() FROM PUBLIC, anon, authenticated;

-- Ensure authenticated and service_role keep needed access
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalc_obra_totals(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalc_annex_totals(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recompute_obra_realtime(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_comercials() TO authenticated, service_role;
