ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS instal_prefiltre_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS instal_prefiltre_article_id uuid REFERENCES public.articles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instal_prefiltre_qty integer DEFAULT 1;