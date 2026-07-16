
-- =============================================================
-- TABLE: pressupost_annexos
-- =============================================================
CREATE TABLE public.pressupost_annexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL,
  obra_id uuid,
  number text NOT NULL,
  annex_index integer NOT NULL DEFAULT 1,
  title text NOT NULL DEFAULT '',
  reason text DEFAULT '',
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'borrador',
  annex_date date DEFAULT CURRENT_DATE,
  comercial_id uuid,
  total_cost integer NOT NULL DEFAULT 0,
  total_sale integer NOT NULL DEFAULT 0,
  margin_pct numeric NOT NULL DEFAULT 0,
  payment_conditions text DEFAULT '',
  observations text DEFAULT '',
  sent_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_annexos_budget ON public.pressupost_annexos(budget_id);
CREATE INDEX idx_annexos_obra ON public.pressupost_annexos(obra_id);
CREATE INDEX idx_annexos_status ON public.pressupost_annexos(status);

ALTER TABLE public.pressupost_annexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View annexos via budget"
ON public.pressupost_annexos FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'administrativa'::app_role)
  OR EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = pressupost_annexos.budget_id AND b.comercial_id = auth.uid())
);

CREATE POLICY "Insert annexos via budget"
ON public.pressupost_annexos FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'administrativa'::app_role)
  OR EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = pressupost_annexos.budget_id AND b.comercial_id = auth.uid())
);

CREATE POLICY "Update annexos via budget"
ON public.pressupost_annexos FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'administrativa'::app_role)
  OR EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = pressupost_annexos.budget_id AND b.comercial_id = auth.uid())
);

CREATE POLICY "Delete annexos admin"
ON public.pressupost_annexos FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'administrativa'::app_role)
  OR EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = pressupost_annexos.budget_id AND b.comercial_id = auth.uid())
);

CREATE TRIGGER trg_annexos_updated_at
BEFORE UPDATE ON public.pressupost_annexos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- TABLE: pressupost_annex_items
-- =============================================================
CREATE TABLE public.pressupost_annex_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annex_id uuid NOT NULL REFERENCES public.pressupost_annexos(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'ud',
  quantity numeric NOT NULL DEFAULT 1,
  unit_cost integer NOT NULL DEFAULT 0,
  unit_sale integer NOT NULL DEFAULT 0,
  article_id uuid,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_annex_items_annex ON public.pressupost_annex_items(annex_id);

ALTER TABLE public.pressupost_annex_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage annex items via annex"
ON public.pressupost_annex_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pressupost_annexos a
    JOIN public.budgets b ON b.id = a.budget_id
    WHERE a.id = pressupost_annex_items.annex_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'administrativa'::app_role)
      OR b.comercial_id = auth.uid()
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pressupost_annexos a
    JOIN public.budgets b ON b.id = a.budget_id
    WHERE a.id = pressupost_annex_items.annex_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'administrativa'::app_role)
      OR b.comercial_id = auth.uid()
    )
  )
);

-- =============================================================
-- FUNCTION: generate annex number on insert
-- =============================================================
CREATE OR REPLACE FUNCTION public.generate_annex_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget_number text;
  v_next_index integer;
BEGIN
  IF NEW.number IS NOT NULL AND NEW.number <> '' THEN
    RETURN NEW;
  END IF;

  SELECT number INTO v_budget_number FROM public.budgets WHERE id = NEW.budget_id;
  IF v_budget_number IS NULL THEN
    v_budget_number := 'PRE';
  END IF;

  SELECT COALESCE(MAX(annex_index), 0) + 1
  INTO v_next_index
  FROM public.pressupost_annexos
  WHERE budget_id = NEW.budget_id;

  NEW.annex_index := v_next_index;
  NEW.number := v_budget_number || '-A' || v_next_index;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_annex_number
BEFORE INSERT ON public.pressupost_annexos
FOR EACH ROW EXECUTE FUNCTION public.generate_annex_number();

-- =============================================================
-- FUNCTION: recalc annex totals when items change
-- =============================================================
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

  IF v_cost > 0 THEN
    v_margin := ((v_sale - v_cost) / v_cost) * 100;
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

CREATE OR REPLACE FUNCTION public.trg_recalc_annex_on_item_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_annex_totals(OLD.annex_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_annex_totals(NEW.annex_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_annex_items_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.pressupost_annex_items
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_annex_on_item_change();

-- =============================================================
-- FUNCTION: inject annex items into obra when accepted
-- =============================================================
CREATE OR REPLACE FUNCTION public.sync_annex_to_obra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_obra_id uuid;
  v_phase_id uuid;
  it record;
BEGIN
  -- Find or set obra_id
  IF NEW.obra_id IS NULL THEN
    SELECT id INTO v_obra_id FROM public.obras WHERE budget_id = NEW.budget_id LIMIT 1;
    IF v_obra_id IS NOT NULL THEN
      NEW.obra_id := v_obra_id;
    END IF;
  ELSE
    v_obra_id := NEW.obra_id;
  END IF;

  -- Transition to acceptat: inject items as extras into a dedicated phase
  IF NEW.status = 'acceptat' AND (OLD.status IS DISTINCT FROM 'acceptat') AND v_obra_id IS NOT NULL THEN
    -- Find or create a phase for this annex
    SELECT id INTO v_phase_id
    FROM public.obra_phases
    WHERE obra_id = v_obra_id AND phase_name = ('Annex ' || NEW.number)
    LIMIT 1;

    IF v_phase_id IS NULL THEN
      INSERT INTO public.obra_phases (obra_id, phase_name, order_index, cost_estimated, sale_estimated, status)
      VALUES (v_obra_id, 'Annex ' || NEW.number, 999, NEW.total_cost, NEW.total_sale, 'pendent')
      RETURNING id INTO v_phase_id;
    ELSE
      UPDATE public.obra_phases
      SET cost_estimated = NEW.total_cost, sale_estimated = NEW.total_sale
      WHERE id = v_phase_id;
    END IF;

    -- Clean previous injection then re-insert items
    DELETE FROM public.obra_cost_items
    WHERE obra_id = v_obra_id AND phase_id = v_phase_id AND description LIKE ('[ANNEX ' || NEW.number || ']%');

    FOR it IN
      SELECT description, quantity, unit_cost
      FROM public.pressupost_annex_items
      WHERE annex_id = NEW.id
    LOOP
      INSERT INTO public.obra_cost_items (
        obra_id, phase_id, description,
        estimated_qty, estimated_unit_cost, estimated_total_cost,
        is_extra
      ) VALUES (
        v_obra_id, v_phase_id,
        '[ANNEX ' || NEW.number || '] ' || it.description,
        it.quantity, it.unit_cost, ROUND(it.quantity * it.unit_cost),
        true
      );
    END LOOP;

    -- Bump obra estimated totals (sale + cost) so KPIs include annex
    UPDATE public.obras
    SET total_sale_estimated = total_sale_estimated + NEW.total_sale,
        total_cost_estimated = total_cost_estimated + NEW.total_cost
    WHERE id = v_obra_id;

    NEW.accepted_at := now();
    PERFORM public.recalc_obra_totals(v_obra_id);
  END IF;

  -- Transition out of acceptat: remove injected items + phase
  IF (OLD.status = 'acceptat') AND (NEW.status IS DISTINCT FROM 'acceptat') AND v_obra_id IS NOT NULL THEN
    SELECT id INTO v_phase_id
    FROM public.obra_phases
    WHERE obra_id = v_obra_id AND phase_name = ('Annex ' || OLD.number)
    LIMIT 1;
    IF v_phase_id IS NOT NULL THEN
      DELETE FROM public.obra_cost_items WHERE phase_id = v_phase_id;
      DELETE FROM public.obra_phases WHERE id = v_phase_id;
    END IF;

    UPDATE public.obras
    SET total_sale_estimated = GREATEST(0, total_sale_estimated - OLD.total_sale),
        total_cost_estimated = GREATEST(0, total_cost_estimated - OLD.total_cost)
    WHERE id = v_obra_id;

    PERFORM public.recalc_obra_totals(v_obra_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_annex_status_sync
BEFORE UPDATE ON public.pressupost_annexos
FOR EACH ROW EXECUTE FUNCTION public.sync_annex_to_obra();

CREATE TRIGGER trg_annex_obra_link
BEFORE INSERT ON public.pressupost_annexos
FOR EACH ROW EXECUTE FUNCTION public.sync_annex_to_obra();

-- Cleanup on delete
CREATE OR REPLACE FUNCTION public.cleanup_annex_from_obra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phase_id uuid;
BEGIN
  IF OLD.obra_id IS NOT NULL AND OLD.status = 'acceptat' THEN
    SELECT id INTO v_phase_id FROM public.obra_phases
    WHERE obra_id = OLD.obra_id AND phase_name = ('Annex ' || OLD.number) LIMIT 1;
    IF v_phase_id IS NOT NULL THEN
      DELETE FROM public.obra_cost_items WHERE phase_id = v_phase_id;
      DELETE FROM public.obra_phases WHERE id = v_phase_id;
    END IF;
    UPDATE public.obras
    SET total_sale_estimated = GREATEST(0, total_sale_estimated - OLD.total_sale),
        total_cost_estimated = GREATEST(0, total_cost_estimated - OLD.total_cost)
    WHERE id = OLD.obra_id;
    PERFORM public.recalc_obra_totals(OLD.obra_id);
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_annex_cleanup
BEFORE DELETE ON public.pressupost_annexos
FOR EACH ROW EXECUTE FUNCTION public.cleanup_annex_from_obra();
