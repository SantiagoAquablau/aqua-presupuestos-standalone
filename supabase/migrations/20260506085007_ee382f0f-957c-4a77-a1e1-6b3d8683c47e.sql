
-- =============================================================
-- 1. Margin formula change: (sale - cost) / sale * 100
-- =============================================================

CREATE OR REPLACE FUNCTION public.recompute_obra_realtime(_obra_id uuid)
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

  -- Margin over sale: (sale - cost) / sale * 100
  IF v_sale > 0 THEN
    v_margin_pct := ((v_sale - v_total_real) / v_sale) * 100;
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

  -- Margin over sale
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

CREATE OR REPLACE FUNCTION public.recalc_annex_totals(_annex_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost numeric;
  v_sale numeric;
  v_margin numeric;
BEGIN
  SELECT
    COALESCE(SUM(quantity * unit_cost), 0),
    COALESCE(SUM(quantity * unit_sale), 0)
  INTO v_cost, v_sale
  FROM public.pressupost_annex_items
  WHERE annex_id = _annex_id;

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
$$;

-- Recompute existing rows
UPDATE public.obras
SET margin_estimated_pct = CASE WHEN total_sale_estimated > 0
       THEN ((total_sale_estimated - total_cost_estimated) / total_sale_estimated) * 100 ELSE 0 END,
    margin_real_pct = CASE WHEN total_sale_estimated > 0
       THEN ((total_sale_estimated - total_cost_real) / total_sale_estimated) * 100 ELSE 0 END;

UPDATE public.budgets
SET margin_pct = CASE WHEN total_sale > 0
       THEN ROUND((((total_sale - total_cost)::numeric / total_sale) * 100)::numeric, 1) ELSE 0 END;

UPDATE public.pressupost_annexos
SET margin_pct = CASE WHEN total_sale > 0
       THEN ROUND((((total_sale - total_cost)::numeric / total_sale) * 100)::numeric, 2) ELSE 0 END;

-- =============================================================
-- 2 & 3. Widen SELECT policies: comercial sees ALL budgets + obras
-- =============================================================

-- Budgets: all authenticated can view
DROP POLICY IF EXISTS "Admins see all budgets" ON public.budgets;
CREATE POLICY "All authenticated view budgets" ON public.budgets FOR SELECT TO authenticated
USING (true);

-- Budget phases / items: all authenticated can view
DROP POLICY IF EXISTS "View phases via budget" ON public.budget_phases;
CREATE POLICY "All authenticated view phases" ON public.budget_phases FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "View items via phase" ON public.budget_items;
CREATE POLICY "All authenticated view items" ON public.budget_items FOR SELECT TO authenticated
USING (true);

-- Obras: all authenticated can view
DROP POLICY IF EXISTS "View obras" ON public.obras;
CREATE POLICY "All authenticated view obras" ON public.obras FOR SELECT TO authenticated
USING (true);

-- Obra phases / cost_items / activity: all authenticated can view
DROP POLICY IF EXISTS "View phases" ON public.obra_phases;
CREATE POLICY "All authenticated view obra_phases" ON public.obra_phases FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "View cost items" ON public.obra_cost_items;
CREATE POLICY "All authenticated view cost_items" ON public.obra_cost_items FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "View activity" ON public.obra_activity;
CREATE POLICY "All authenticated view activity" ON public.obra_activity FOR SELECT TO authenticated
USING (true);
