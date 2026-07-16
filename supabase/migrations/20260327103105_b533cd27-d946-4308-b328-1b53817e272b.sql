
-- Add acabat fields to articles
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS format text DEFAULT '';
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS quality text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS acabat_type text;

-- Add coronament fields to budgets
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS coronament_actuacio text DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS coronament_tipus text DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS coronament_format text DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS coronament_ml numeric DEFAULT 0;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS coronament_encofrat_ml numeric DEFAULT 0;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS coronament_model_id uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS coronament_model_a_determinar boolean DEFAULT true;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS coronament_beurada text DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS coronament_beurada_color text DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS coronament_observacions text DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS coronament_peces integer DEFAULT 0;

-- Add revestiment fields to budgets
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS revestiment_actuacio text DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS revestiment_tipus text DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS revestiment_format text DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS revestiment_qualitat text DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS revestiment_model_id uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS revestiment_model_a_determinar boolean DEFAULT true;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS revestiment_beurada text DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS revestiment_beurada_color text DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS revestiment_peces_especials boolean DEFAULT false;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS revestiment_mig_canya boolean DEFAULT false;

-- Add optional revestiment fields to budgets
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS opcional_revestiment_tipus text;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS opcional_revestiment_format text;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS opcional_revestiment_model_id uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS opcional_revestiment_beurada text;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS opcional_revestiment_beurada_color text;
