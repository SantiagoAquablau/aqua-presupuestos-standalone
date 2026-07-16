
-- Accessoris bàsics
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_impulsors_qty integer DEFAULT 0;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_impulsors_model_id uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_skimmers_qty integer DEFAULT 0;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_skimmers_model_id uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_embornal_qty integer DEFAULT 0;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_embornal_model_id uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_focus_led_qty integer DEFAULT 0;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_focus_led_model_id uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_focus_led_variant text DEFAULT 'blanc';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_focus_led_text text;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_regulador_qty integer DEFAULT 0;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_regulador_model_id uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_netejafons_qty integer DEFAULT 0;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_netejafons_model_id uuid;

-- Accessoris opcionals
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_escala_enabled boolean DEFAULT false;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_escala_qty integer DEFAULT 1;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_escala_model_id uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_dutxa_enabled boolean DEFAULT false;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_dutxa_qty integer DEFAULT 1;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_dutxa_model_id uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_plat_dutxa_enabled boolean DEFAULT false;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_plat_dutxa_qty integer DEFAULT 1;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_plat_dutxa_model_id uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_cascada_enabled boolean DEFAULT false;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_cascada_qty integer DEFAULT 1;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_cascada_model_id uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_salvavides_enabled boolean DEFAULT false;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_salvavides_qty integer DEFAULT 1;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS acc_salvavides_model_id uuid;

-- Annex
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_notes text;

-- Add Accessoris category if missing
INSERT INTO public.categories (name) VALUES ('Accessoris') ON CONFLICT DO NOTHING;
