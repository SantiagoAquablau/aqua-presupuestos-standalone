-- Lock down EXECUTE on all SECURITY DEFINER helpers.
-- These are invoked by triggers or RLS internally and must not be
-- callable from the PostgREST API by anon/authenticated roles.

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_obra_realtime(uuid)              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recalc_obra_on_item_change()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_obra_on_budget_delete()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recalc_annex_on_item_change()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_annex_totals(uuid)                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_obra_totals(uuid)                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_annex_number()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_annex_to_obra()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_annex_from_obra()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_obra_from_budget()                  FROM PUBLIC, anon, authenticated;

-- Role-check helpers ARE called from the app for the signed-in user only.
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;