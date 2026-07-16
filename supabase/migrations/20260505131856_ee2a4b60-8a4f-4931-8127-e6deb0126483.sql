
CREATE TABLE public.obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL UNIQUE,
  budget_number text NOT NULL,
  client_name text NOT NULL DEFAULT '',
  client_town text NOT NULL DEFAULT '',
  comercial_id uuid,
  status text NOT NULL DEFAULT 'activa',
  start_date date,
  end_date_estimated date,
  end_date_real date,
  total_sale_estimated numeric NOT NULL DEFAULT 0,
  total_cost_estimated numeric NOT NULL DEFAULT 0,
  total_cost_real numeric NOT NULL DEFAULT 0,
  margin_estimated_pct numeric NOT NULL DEFAULT 0,
  margin_real_pct numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.obra_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  phase_name text NOT NULL,
  sale_estimated numeric NOT NULL DEFAULT 0,
  cost_estimated numeric NOT NULL DEFAULT 0,
  cost_real numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendent',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.obra_cost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  phase_id uuid NOT NULL REFERENCES public.obra_phases(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  article_id uuid,
  estimated_qty numeric,
  estimated_unit_cost numeric,
  estimated_total_cost numeric,
  real_qty numeric,
  real_unit_cost numeric,
  real_total_cost numeric,
  invoice_ref text,
  invoice_date date,
  supplier_name text,
  notes text,
  is_extra boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.obra_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  user_id uuid,
  user_name text,
  kind text NOT NULL DEFAULT 'note',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_obras_budget_id ON public.obras(budget_id);
CREATE INDEX idx_obras_status ON public.obras(status);
CREATE INDEX idx_obras_comercial_id ON public.obras(comercial_id);
CREATE INDEX idx_obra_phases_obra_id ON public.obra_phases(obra_id);
CREATE INDEX idx_obra_cost_items_obra_id ON public.obra_cost_items(obra_id);
CREATE INDEX idx_obra_cost_items_phase_id ON public.obra_cost_items(phase_id);
CREATE INDEX idx_obra_activity_obra_id ON public.obra_activity(obra_id);

CREATE TRIGGER trg_obras_updated_at BEFORE UPDATE ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_obra_phases_updated_at BEFORE UPDATE ON public.obra_phases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_obra_cost_items_updated_at BEFORE UPDATE ON public.obra_cost_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_cost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View obras" ON public.obras FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'administrativa'::app_role)
    OR comercial_id = auth.uid()
  );
CREATE POLICY "Insert obras" ON public.obras FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'administrativa'::app_role)
  );
CREATE POLICY "Update obras" ON public.obras FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'administrativa'::app_role)
  );
CREATE POLICY "Delete obras" ON public.obras FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Manage phases via obra" ON public.obra_phases FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.obras o WHERE o.id = obra_phases.obra_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'administrativa'::app_role)
      OR o.comercial_id = auth.uid()
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.obras o WHERE o.id = obra_phases.obra_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'administrativa'::app_role)
    )
  ));

CREATE POLICY "Manage cost items via obra" ON public.obra_cost_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.obras o WHERE o.id = obra_cost_items.obra_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'administrativa'::app_role)
      OR o.comercial_id = auth.uid()
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.obras o WHERE o.id = obra_cost_items.obra_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'administrativa'::app_role)
    )
  ));

CREATE POLICY "View activity via obra" ON public.obra_activity FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.obras o WHERE o.id = obra_activity.obra_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'administrativa'::app_role)
      OR o.comercial_id = auth.uid()
    )
  ));
CREATE POLICY "Insert activity via obra" ON public.obra_activity FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.obras o WHERE o.id = obra_activity.obra_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'administrativa'::app_role)
      OR o.comercial_id = auth.uid()
    )
  ));

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

CREATE OR REPLACE FUNCTION public.trg_recalc_obra_on_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_obra_totals(OLD.obra_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_obra_totals(NEW.obra_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_obra_cost_items_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.obra_cost_items
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_obra_on_item_change();

CREATE OR REPLACE FUNCTION public.create_obra_from_budget()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_obra_id uuid;
  v_phase RECORD;
  v_phase_id uuid;
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

  FOR v_phase IN
    SELECT id, name, "order", total_sale, total_cost
    FROM public.budget_phases
    WHERE budget_id = NEW.id
    ORDER BY "order"
  LOOP
    INSERT INTO public.obra_phases (
      obra_id, phase_name, sale_estimated, cost_estimated, order_index
    ) VALUES (
      v_obra_id, v_phase.name,
      COALESCE(v_phase.total_sale, 0),
      COALESCE(v_phase.total_cost, 0),
      v_phase."order"
    ) RETURNING id INTO v_phase_id;

    INSERT INTO public.obra_cost_items (
      obra_id, phase_id, description, article_id,
      estimated_qty, estimated_unit_cost, estimated_total_cost, is_extra
    )
    SELECT
      v_obra_id, v_phase_id, bi.description, bi.article_id,
      bi.quantity, bi.unit_cost, COALESCE(bi.unit_cost, 0) * COALESCE(bi.quantity, 0), false
    FROM public.budget_items bi
    WHERE bi.phase_id = v_phase.id
    ORDER BY bi."order";
  END LOOP;

  INSERT INTO public.obra_activity (obra_id, user_id, kind, message)
  VALUES (v_obra_id, NEW.comercial_id, 'system', 'Obra creada automàticament des del pressupost ' || NEW.number);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_budget_acceptat_create_obra
AFTER UPDATE OF status ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.create_obra_from_budget();
