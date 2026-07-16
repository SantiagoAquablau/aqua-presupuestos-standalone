
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_depuracio_enabled boolean DEFAULT true;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_bomba_enabled boolean DEFAULT true;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_dosificacio_enabled boolean DEFAULT true;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_quadre_enabled boolean DEFAULT true;
