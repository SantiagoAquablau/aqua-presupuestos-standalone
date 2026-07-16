-- Simplify obra creation trigger: only create obra header. Phases and cost items
-- will be inserted from the application code, where formula-derived items are
-- recomputed (otherwise phases like Estructura/Acabats/Annex stay empty since
-- their lines are calculated on the fly and not persisted in budget_items).

CREATE OR REPLACE FUNCTION public.create_obra_from_budget()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_obra_id uuid;
  v_margin_est numeric;
BEGIN
  IF NEW.status <> 'acceptat' OR (OLD.status = 'acceptat') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.obras WHERE budget_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.total_sale, 0) > 0 THEN
    v_margin_est := ((COALESCE(NEW.total_sale, 0) - COALESCE(NEW.total_cost, 0))::numeric / NEW.total_sale) * 100;
  ELSE
    v_margin_est := 0;
  END IF;

  INSERT INTO public.obras (
    budget_id, budget_number, client_name, client_town, comercial_id,
    status, total_sale_estimated, total_cost_estimated, margin_estimated_pct
  ) VALUES (
    NEW.id, NEW.number, COALESCE(NEW.client_name, ''), COALESCE(NEW.client_town, ''), NEW.comercial_id,
    'activa',
    COALESCE(NEW.total_sale, 0), COALESCE(NEW.total_cost, 0), v_margin_est
  ) RETURNING id INTO v_obra_id;

  INSERT INTO public.obra_activity (obra_id, user_id, kind, message)
  VALUES (v_obra_id, NEW.comercial_id, 'system', 'Obra creada automàticament des del pressupost ' || NEW.number);

  RETURN NEW;
END;
$$;