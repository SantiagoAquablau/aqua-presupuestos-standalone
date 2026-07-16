-- Allow comercial (owner of the obra) to insert/update cost items and phases
DROP POLICY IF EXISTS "Manage cost items via obra" ON public.obra_cost_items;
CREATE POLICY "Manage cost items via obra"
ON public.obra_cost_items
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obras o
  WHERE o.id = obra_cost_items.obra_id
    AND (has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'administrativa'::app_role)
      OR o.comercial_id = auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.obras o
  WHERE o.id = obra_cost_items.obra_id
    AND (has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'administrativa'::app_role)
      OR o.comercial_id = auth.uid())
));

DROP POLICY IF EXISTS "Manage phases via obra" ON public.obra_phases;
CREATE POLICY "Manage phases via obra"
ON public.obra_phases
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obras o
  WHERE o.id = obra_phases.obra_id
    AND (has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'administrativa'::app_role)
      OR o.comercial_id = auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.obras o
  WHERE o.id = obra_phases.obra_id
    AND (has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'administrativa'::app_role)
      OR o.comercial_id = auth.uid())
));