-- "Plat de dutxa" accessory: editable sale price (replaces the hardcoded
-- 550€), optional Llarg/Ample dimensions for future PDF use, and a manual
-- override flag so auto-activation from "Dutxa exterior" never fights a
-- deliberate user choice (same pattern as instal_quadre_manual_override).
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS acc_plat_dutxa_sale NUMERIC,
  ADD COLUMN IF NOT EXISTS acc_plat_dutxa_llarg NUMERIC,
  ADD COLUMN IF NOT EXISTS acc_plat_dutxa_ample NUMERIC,
  ADD COLUMN IF NOT EXISTS acc_plat_dutxa_manual_override BOOLEAN DEFAULT false;
