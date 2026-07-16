
-- Add AFM quantity field
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_afm_qty integer DEFAULT NULL;

-- Add canvi medi fields
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_canvi_medi_article_id uuid DEFAULT NULL;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_canvi_medi_filtre text DEFAULT NULL;
