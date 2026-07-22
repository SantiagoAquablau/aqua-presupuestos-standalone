-- "Filtre de fibra" (Polies) opcional flag was never persisted — draftToRow
-- never wrote instal_filtre_polies_opcional because the column didn't exist,
-- so it was silently lost on every save and reloaded as undefined on every
-- edit. Combined with the wizard's "?? false" default, this could make BOTH
-- Filtre de fibra AND Filtre especial show as "Inclòs al pressupost" at once
-- after editing a saved budget where Filtre especial had been chosen as
-- included. DEFAULT true backfills existing rows as "opcional" — the safe
-- choice, since we don't know their original intent and Filtre de fibra is
-- usually the one already marked included via its own explicit save.
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS instal_filtre_polies_opcional BOOLEAN DEFAULT true;
