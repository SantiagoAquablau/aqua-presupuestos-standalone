ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS annex_cobertor_mur_nou boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS annex_cobertor_mur_m2 numeric;