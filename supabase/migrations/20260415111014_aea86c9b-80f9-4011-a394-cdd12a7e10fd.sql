
-- Formula rules table
CREATE TABLE public.formula_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_type text NOT NULL DEFAULT 'obra_nova',
  phase text NOT NULL,
  sub_phase text,
  order_index integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  description text,
  formula_sale text NOT NULL DEFAULT '0',
  formula_cost text,
  unit text,
  article_ref text,
  is_active boolean NOT NULL DEFAULT true,
  is_conditional boolean NOT NULL DEFAULT false,
  condition_field text,
  condition_value text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.formula_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view formula_rules"
  ON public.formula_rules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage formula_rules"
  ON public.formula_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Formula variables table
CREATE TABLE public.formula_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variable_name text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  source_field text,
  category text NOT NULL DEFAULT 'pool_dimensions',
  example_value numeric DEFAULT 0
);

ALTER TABLE public.formula_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view formula_variables"
  ON public.formula_variables FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage formula_variables"
  ON public.formula_variables FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Formula execution log table
CREATE TABLE public.formula_execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.formula_rules(id) ON DELETE CASCADE,
  formula_used text NOT NULL,
  variables_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_sale numeric NOT NULL DEFAULT 0,
  result_cost numeric NOT NULL DEFAULT 0,
  executed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.formula_execution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budget logs"
  ON public.formula_execution_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = formula_execution_log.budget_id
        AND (b.comercial_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Users can insert logs for own budgets"
  ON public.formula_execution_log FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = formula_execution_log.budget_id
        AND (b.comercial_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Admins can manage all logs"
  ON public.formula_execution_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Index for fast log lookups
CREATE INDEX idx_formula_execution_log_budget ON public.formula_execution_log(budget_id);
CREATE INDEX idx_formula_rules_type_phase ON public.formula_rules(budget_type, phase, order_index);
