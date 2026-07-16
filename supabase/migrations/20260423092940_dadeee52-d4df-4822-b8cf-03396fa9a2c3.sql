ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS instal_caseta_obra_llarg numeric,
  ADD COLUMN IF NOT EXISTS instal_caseta_obra_ample numeric,
  ADD COLUMN IF NOT EXISTS instal_caseta_obra_alt numeric,
  ADD COLUMN IF NOT EXISTS instal_caseta_obra_portes text;