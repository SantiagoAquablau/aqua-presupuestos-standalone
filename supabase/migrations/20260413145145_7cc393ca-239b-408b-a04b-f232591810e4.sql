
-- Add distancia depuradora fields for fontaneria and electrica
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_fontaneria_distancia numeric DEFAULT 10;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_electrica_distancia numeric DEFAULT 10;

-- Add local tecnico for fontaneria
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_fontaneria_local_tecnic text DEFAULT 'determinar';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_fontaneria_perforacions boolean DEFAULT true;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_fontaneria_perforacions_article_id uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS instal_fontaneria_rasas text DEFAULT 'determinar';
