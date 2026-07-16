DROP POLICY IF EXISTS "Manage phases via budget" ON public.budget_phases;
CREATE POLICY "Manage phases via budget"
ON public.budget_phases
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.budgets b
    WHERE b.id = budget_phases.budget_id
      AND (b.comercial_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.budgets b
    WHERE b.id = budget_phases.budget_id
      AND (b.comercial_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

DROP POLICY IF EXISTS "Manage items via phase" ON public.budget_items;
CREATE POLICY "Manage items via phase"
ON public.budget_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.budget_phases bp
    JOIN public.budgets b ON b.id = bp.budget_id
    WHERE bp.id = budget_items.phase_id
      AND (b.comercial_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.budget_phases bp
    JOIN public.budgets b ON b.id = bp.budget_id
    WHERE bp.id = budget_items.phase_id
      AND (b.comercial_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);