ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS planol_inclos boolean NOT NULL DEFAULT true;
