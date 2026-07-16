
ALTER TABLE public.pressupost_annexos
  ADD COLUMN IF NOT EXISTS global_pct numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recalc_annex_totals(_annex_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cost numeric;
  v_sale numeric;
  v_margin numeric;
  v_pct numeric;
BEGIN
  SELECT COALESCE(global_pct, 0) INTO v_pct
  FROM public.pressupost_annexos WHERE id = _annex_id;

  SELECT
    COALESCE(SUM(quantity * unit_cost), 0),
    COALESCE(SUM(quantity * unit_sale), 0)
  INTO v_cost, v_sale
  FROM public.pressupost_annex_items
  WHERE annex_id = _annex_id;

  v_sale := v_sale * (1 + COALESCE(v_pct, 0) / 100.0);

  IF v_sale > 0 THEN
    v_margin := ((v_sale - v_cost) / v_sale) * 100;
  ELSE
    v_margin := 0;
  END IF;

  UPDATE public.pressupost_annexos
  SET total_cost = ROUND(v_cost),
      total_sale = ROUND(v_sale),
      margin_pct = ROUND(v_margin::numeric, 2),
      updated_at = now()
  WHERE id = _annex_id;
END;
$function$;

-- Recalculate when global_pct changes on the annex itself
CREATE OR REPLACE FUNCTION public.trg_recalc_annex_on_pct_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.global_pct IS DISTINCT FROM OLD.global_pct THEN
    PERFORM public.recalc_annex_totals(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_annex_pct_change ON public.pressupost_annexos;
CREATE TRIGGER trg_annex_pct_change
AFTER UPDATE OF global_pct ON public.pressupost_annexos
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_annex_on_pct_change();
