
-- Config table for autoportant transport pricing (single-row expected)
CREATE TABLE public.autoportant_transport_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_address text NOT NULL DEFAULT 'N-332, 03190 Pilar de la Horadada, Alicante',
  base_fee_cents integer NOT NULL DEFAULT 45000,
  rate_narrow_cents_per_km integer NOT NULL DEFAULT 150,
  rate_wide_cents_per_km integer NOT NULL DEFAULT 300,
  narrow_width_threshold_m numeric NOT NULL DEFAULT 2.5,
  wide_width_threshold_m numeric NOT NULL DEFAULT 3.0,
  margin_multiplier numeric NOT NULL DEFAULT 1.40,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.autoportant_transport_config TO authenticated;
GRANT ALL ON public.autoportant_transport_config TO service_role;

ALTER TABLE public.autoportant_transport_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view transport config"
  ON public.autoportant_transport_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage transport config"
  ON public.autoportant_transport_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_autoportant_transport_config_updated_at
  BEFORE UPDATE ON public.autoportant_transport_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default single row
INSERT INTO public.autoportant_transport_config DEFAULT VALUES;

-- Per-budget transport data on budgets table
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS autoportant_transport_km numeric,
  ADD COLUMN IF NOT EXISTS autoportant_transport_km_override boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS autoportant_transport_cost numeric,
  ADD COLUMN IF NOT EXISTS autoportant_transport_sale numeric,
  ADD COLUMN IF NOT EXISTS autoportant_transport_user_edited boolean DEFAULT false;
