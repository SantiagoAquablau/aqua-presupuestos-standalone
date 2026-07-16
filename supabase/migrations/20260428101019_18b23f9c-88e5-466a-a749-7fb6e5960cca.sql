ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS annex_paviment_model_a_determinar boolean DEFAULT true;