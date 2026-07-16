
-- Table: cover_model_prices (model x ancho -> precio estructura + max largo)
CREATE TABLE public.cover_model_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES public.cover_models(id) ON DELETE CASCADE,
  width_m NUMERIC NOT NULL,
  price_eur NUMERIC NOT NULL DEFAULT 0,
  max_length_m NUMERIC NOT NULL DEFAULT 10,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id, width_m)
);

ALTER TABLE public.cover_model_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cover_model_prices"
ON public.cover_model_prices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage cover_model_prices"
ON public.cover_model_prices FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_cover_model_prices_updated_at
BEFORE UPDATE ON public.cover_model_prices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: cover_lama_prices (material x ancho -> precio/m)
CREATE TABLE public.cover_lama_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material TEXT NOT NULL CHECK (material IN ('pvc','policarbonat')),
  width_m NUMERIC NOT NULL,
  price_per_m NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (material, width_m)
);

ALTER TABLE public.cover_lama_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cover_lama_prices"
ON public.cover_lama_prices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage cover_lama_prices"
ON public.cover_lama_prices FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_cover_lama_prices_updated_at
BEFORE UPDATE ON public.cover_lama_prices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: cover_settings (constants singleton)
CREATE TABLE public.cover_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  embalatge_eur NUMERIC NOT NULL DEFAULT 110,
  transport_eur NUMERIC NOT NULL DEFAULT 420,
  installation_fora_aigua_eur NUMERIC NOT NULL DEFAULT 870,
  installation_submergit_eur NUMERIC NOT NULL DEFAULT 1740,
  cost_factor NUMERIC NOT NULL DEFAULT 0.55, -- coste = venta * 0.55 (descuento del 45%)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cover_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cover_settings"
ON public.cover_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage cover_settings"
ON public.cover_settings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.cover_settings (embalatge_eur, transport_eur, installation_fora_aigua_eur, installation_submergit_eur, cost_factor)
VALUES (110, 420, 870, 1740, 0.55);

-- Add override columns to budgets
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS annex_cobertor_manual_override BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS annex_cobertor_manual_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS annex_cobertor_calc_cost NUMERIC,
  ADD COLUMN IF NOT EXISTS annex_cobertor_calc_sale NUMERIC,
  ADD COLUMN IF NOT EXISTS annex_cobertor_calc_breakdown JSONB;
