-- "Línia preferent" — marca manualment (admin) els articles de categoria
-- "Bomba" que han d'aparèixer a les recomanacions automàtiques d'equipament
-- (EquipmentRecommendations.tsx). No s'acobla a cap marca/nom concret: és el
-- propi admin qui marca les bombes que vol recomanar (p.ex. la línia DOLFI).
-- Cap article la té marcada per defecte després d'aquesta migració.
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS linia_preferent boolean NOT NULL DEFAULT false;
