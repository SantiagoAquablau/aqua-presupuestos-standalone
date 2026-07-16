-- Resync existing obras' estimated totals to match the sum of their phases
UPDATE public.obras o
SET total_cost_estimated = sub.sum_cost,
    total_sale_estimated = sub.sum_sale,
    margin_estimated_pct = CASE WHEN sub.sum_sale > 0
      THEN ROUND((((sub.sum_sale - sub.sum_cost)::numeric / sub.sum_sale) * 100)::numeric, 2)
      ELSE 0 END,
    updated_at = now()
FROM (
  SELECT obra_id,
         COALESCE(SUM(cost_estimated), 0) AS sum_cost,
         COALESCE(SUM(sale_estimated), 0) AS sum_sale
  FROM public.obra_phases
  GROUP BY obra_id
) sub
WHERE o.id = sub.obra_id
  AND (o.total_cost_estimated <> sub.sum_cost OR o.total_sale_estimated <> sub.sum_sale);

-- Recalc real margins
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.obras LOOP
    PERFORM public.recalc_obra_totals(r.id);
  END LOOP;
END $$;