-- Elecció entre "Option Redox" i "Kit Clor Lliure — Sonda Potenciostàtica"
-- quan el model de dosificació estàndard escollit és de la línia "HC".
-- Text lliure (no enum) seguint el mateix patró que pool_type; els valors
-- vàlids gestionats des del codi són 'redox' / 'kit_clor'.
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS instal_dosificacio_hc_option TEXT;
