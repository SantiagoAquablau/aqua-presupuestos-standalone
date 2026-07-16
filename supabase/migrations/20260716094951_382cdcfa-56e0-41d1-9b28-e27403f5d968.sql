ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS revestiment_exterior_inclos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revestiment_exterior_format text,
  ADD COLUMN IF NOT EXISTS revestiment_exterior_model_id uuid,
  ADD COLUMN IF NOT EXISTS revestiment_exterior_model_a_determinar boolean,
  ADD COLUMN IF NOT EXISTS revestiment_exterior_beurada text,
  ADD COLUMN IF NOT EXISTS revestiment_exterior_beurada_color text;