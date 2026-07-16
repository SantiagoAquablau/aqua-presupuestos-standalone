
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS instal_fontaneria_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS instal_fontaneria_metres numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS instal_fontaneria_text text,
  ADD COLUMN IF NOT EXISTS instal_fontaneria_base_article_id uuid,
  ADD COLUMN IF NOT EXISTS instal_fontaneria_extra_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instal_fontaneria_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instal_electrica_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS instal_electrica_metres numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS instal_electrica_text text,
  ADD COLUMN IF NOT EXISTS instal_electrica_base_article_id uuid,
  ADD COLUMN IF NOT EXISTS instal_electrica_extra_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instal_electrica_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instal_caseta_ubicacio text,
  ADD COLUMN IF NOT EXISTS instal_caseta_observacions text,
  ADD COLUMN IF NOT EXISTS instal_caseta_enabled boolean DEFAULT true;
