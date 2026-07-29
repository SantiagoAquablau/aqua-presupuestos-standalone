-- "Dues piscines" (Manteniment): a second pool sharing the same maintenance
-- contract/visit. Persist the toggle plus the 4 duplicated measure fields.
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS has_second_pool BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pool_length_2 NUMERIC,
  ADD COLUMN IF NOT EXISTS pool_width_2 NUMERIC,
  ADD COLUMN IF NOT EXISTS pool_depth_avg_2 NUMERIC,
  ADD COLUMN IF NOT EXISTS has_electrolisi_2 BOOLEAN;
