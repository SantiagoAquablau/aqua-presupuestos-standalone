
-- Add subtipus column to articles
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS subtipus text DEFAULT NULL;

-- Add quantity fields for installations
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_filtre_polies_qty integer DEFAULT 1;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_filtre_especial_qty integer DEFAULT 1;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_bomba_onoff_qty integer DEFAULT 1;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_bomba_variable_qty integer DEFAULT 1;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_dosificacio_std_qty integer DEFAULT 1;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_hidrolisi_qty integer DEFAULT 1;

-- Add opcional fields for installations
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_filtre_especial_opcional boolean DEFAULT true;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_bomba_onoff_opcional boolean DEFAULT false;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_bomba_variable_opcional boolean DEFAULT false;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_dosificacio_std_opcional boolean DEFAULT false;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_hidrolisi_opcional boolean DEFAULT false;
