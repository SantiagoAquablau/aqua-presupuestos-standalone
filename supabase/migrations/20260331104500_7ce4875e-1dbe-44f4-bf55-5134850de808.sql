
-- Instal·lacions fields on budgets table
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS instal_filtre_polies_id uuid,
  ADD COLUMN IF NOT EXISTS instal_filtre_especial_id uuid,
  ADD COLUMN IF NOT EXISTS instal_afm_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS instal_afm_article_id uuid,
  ADD COLUMN IF NOT EXISTS instal_canvi_sorra_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS instal_canvi_sorra_article_id uuid,
  ADD COLUMN IF NOT EXISTS instal_bomba_onoff_id uuid,
  ADD COLUMN IF NOT EXISTS instal_bomba_variable_id uuid,
  ADD COLUMN IF NOT EXISTS instal_wifi_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS instal_wifi_article_id uuid,
  ADD COLUMN IF NOT EXISTS instal_dosificacio_std_id uuid,
  ADD COLUMN IF NOT EXISTS instal_hidrolisi_id uuid,
  ADD COLUMN IF NOT EXISTS instal_quadre_id uuid;
