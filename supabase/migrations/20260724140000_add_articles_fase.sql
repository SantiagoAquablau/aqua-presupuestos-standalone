-- "Fase" elèctrica (Monofàsic / Trifàsic) — aplicable únicament a articles de
-- categoria "Bomba". Text lliure, sense constraint, seguint el mateix patró
-- que beurada_color (columna dedicada, condicionada per categoria a la UI).
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS fase text;
