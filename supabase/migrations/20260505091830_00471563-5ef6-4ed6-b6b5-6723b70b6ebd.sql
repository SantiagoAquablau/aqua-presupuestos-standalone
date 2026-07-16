ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS acc_barana_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS acc_barana_qty integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS acc_barana_model_id uuid;