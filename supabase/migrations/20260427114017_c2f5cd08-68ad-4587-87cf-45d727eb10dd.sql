
-- Add columns for the automatic electrical panel selection
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS instal_quadre_display_text text,
  ADD COLUMN IF NOT EXISTS instal_quadre_base_cost numeric,
  ADD COLUMN IF NOT EXISTS instal_quadre_base_sale numeric,
  ADD COLUMN IF NOT EXISTS instal_quadre_addon_nf_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instal_quadre_addon_nf_sale numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instal_quadre_addon_bc_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instal_quadre_addon_bc_sale numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instal_quadre_final_cost numeric,
  ADD COLUMN IF NOT EXISTS instal_quadre_final_sale numeric,
  ADD COLUMN IF NOT EXISTS instal_quadre_manual_override boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS instal_quadre_recommended_id uuid;

-- Seed cv_equivalent on the 4 TOMAHAWK variable speed pumps
UPDATE public.articles
SET technical_specs = COALESCE(technical_specs, '{}'::jsonb) || jsonb_build_object('cv_equivalent', 1.0)
WHERE name ILIKE '%TOMAHAWK IP 20%';

UPDATE public.articles
SET technical_specs = COALESCE(technical_specs, '{}'::jsonb) || jsonb_build_object('cv_equivalent', 1.5)
WHERE name ILIKE '%TOMAHAWK IP 25%';

UPDATE public.articles
SET technical_specs = COALESCE(technical_specs, '{}'::jsonb) || jsonb_build_object('cv_equivalent', 1.5)
WHERE name ILIKE '%TOMAHAWK IP 30%';

UPDATE public.articles
SET technical_specs = COALESCE(technical_specs, '{}'::jsonb) || jsonb_build_object('cv_equivalent', 3.0)
WHERE name ILIKE '%TOMAHAWK IP 40%';
