-- 1. Cascade delete: when a budget is hard-deleted OR soft-deleted (deleted=true), remove the related obra.
CREATE OR REPLACE FUNCTION public.delete_obra_on_budget_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- soft delete
  IF TG_OP = 'UPDATE' AND COALESCE(NEW.deleted, false) = true AND COALESCE(OLD.deleted, false) = false THEN
    DELETE FROM public.obra_cost_items WHERE obra_id IN (SELECT id FROM public.obras WHERE budget_id = NEW.id);
    DELETE FROM public.obra_phases     WHERE obra_id IN (SELECT id FROM public.obras WHERE budget_id = NEW.id);
    DELETE FROM public.obra_activity   WHERE obra_id IN (SELECT id FROM public.obras WHERE budget_id = NEW.id);
    DELETE FROM public.obras WHERE budget_id = NEW.id;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.obra_cost_items WHERE obra_id IN (SELECT id FROM public.obras WHERE budget_id = OLD.id);
    DELETE FROM public.obra_phases     WHERE obra_id IN (SELECT id FROM public.obras WHERE budget_id = OLD.id);
    DELETE FROM public.obra_activity   WHERE obra_id IN (SELECT id FROM public.obras WHERE budget_id = OLD.id);
    DELETE FROM public.obras WHERE budget_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_obra_on_budget_soft_delete ON public.budgets;
CREATE TRIGGER trg_delete_obra_on_budget_soft_delete
AFTER UPDATE ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.delete_obra_on_budget_delete();

DROP TRIGGER IF EXISTS trg_delete_obra_on_budget_hard_delete ON public.budgets;
CREATE TRIGGER trg_delete_obra_on_budget_hard_delete
BEFORE DELETE ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.delete_obra_on_budget_delete();

-- 2. Use margin-over-cost (same formula as budget Resum Financer) and ensure obras totals match budgets.
CREATE OR REPLACE FUNCTION public.recalc_obra_totals(_obra_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_real numeric;
  v_sale numeric;
  v_margin_pct numeric;
BEGIN
  UPDATE public.obra_phases p
  SET cost_real = COALESCE((
    SELECT SUM(COALESCE(real_total_cost, 0))
    FROM public.obra_cost_items
    WHERE phase_id = p.id
  ), 0)
  WHERE p.obra_id = _obra_id;

  SELECT COALESCE(SUM(COALESCE(real_total_cost, 0)), 0)
  INTO v_total_real
  FROM public.obra_cost_items
  WHERE obra_id = _obra_id;

  SELECT total_sale_estimated INTO v_sale FROM public.obras WHERE id = _obra_id;

  -- Margin over cost: (sale - cost) / cost * 100  (consistent with budget Resum Financer)
  IF v_total_real > 0 THEN
    v_margin_pct := ((v_sale - v_total_real) / v_total_real) * 100;
  ELSE
    v_margin_pct := 0;
  END IF;

  UPDATE public.obras
  SET total_cost_real = v_total_real,
      margin_real_pct = v_margin_pct,
      updated_at = now()
  WHERE id = _obra_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_obra_from_budget()
RETURNS trigger
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

  -- Margin over cost
  IF COALESCE(NEW.total_cost, 0) > 0 THEN
    v_margin_est := ((COALESCE(NEW.total_sale, 0) - COALESCE(NEW.total_cost, 0))::numeric / NEW.total_cost) * 100;
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

-- 3. Recompute existing obras with the new margin formula
UPDATE public.obras o
SET margin_estimated_pct = CASE WHEN o.total_cost_estimated > 0
       THEN ((o.total_sale_estimated - o.total_cost_estimated) / o.total_cost_estimated) * 100 ELSE 0 END,
    margin_real_pct = CASE WHEN o.total_cost_real > 0
       THEN ((o.total_sale_estimated - o.total_cost_real) / o.total_cost_real) * 100 ELSE 0 END;