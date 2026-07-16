ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS gunite_manguera_metres numeric DEFAULT 30,
  ADD COLUMN IF NOT EXISTS gunite_distancia_km numeric DEFAULT 0;