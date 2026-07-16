ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS coronament_inclos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS revestiment_inclos boolean NOT NULL DEFAULT true;