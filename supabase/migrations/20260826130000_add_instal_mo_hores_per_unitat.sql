-- Hores d'instal·lador editables per secció (Depuració/Dosificació/Quadre/
-- Bomba), en substitució de les 11h/18h/4h/8h fixes que hi havia
-- hardcodejades a budgetSave.ts. NULL = usar el valor per defecte de cada
-- secció (veure MO_HORES_DEFAULTS a src/lib/instalMoHores.ts). Són hores
-- PER UNITAT d'equip: el total es multiplica per la quantitat real inclosa.
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS instal_mo_hores_depuracio NUMERIC,
  ADD COLUMN IF NOT EXISTS instal_mo_hores_dosificacio NUMERIC,
  ADD COLUMN IF NOT EXISTS instal_mo_hores_quadre NUMERIC,
  ADD COLUMN IF NOT EXISTS instal_mo_hores_bomba NUMERIC;
