ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS annex_excavacio_pill1_title TEXT,
  ADD COLUMN IF NOT EXISTS annex_excavacio_pill2_title TEXT,
  ADD COLUMN IF NOT EXISTS annex_excavacio_text1 TEXT,
  ADD COLUMN IF NOT EXISTS annex_excavacio_text2 TEXT,
  ADD COLUMN IF NOT EXISTS annex_excavacio_mano_obra_override NUMERIC,
  ADD COLUMN IF NOT EXISTS annex_excavacio_reompliment_override NUMERIC;