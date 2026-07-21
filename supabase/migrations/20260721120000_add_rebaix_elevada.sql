
-- Elevada: "rebaix" opcional que redueix l'altura de paret vista respecte a
-- profunditat màxima (alçada efectiva = pool_depth_max - rebaix_amount).
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS has_rebaix BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rebaix_amount NUMERIC NOT NULL DEFAULT 0;
