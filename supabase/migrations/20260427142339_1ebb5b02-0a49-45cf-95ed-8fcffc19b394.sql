-- 1) New columns on budgets to allow BOTH "reforma existent" AND "paviment nou" simultaneously
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS annex_paviment_reforma_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS annex_paviment_nou_enabled boolean DEFAULT false;

-- Backfill: if existing budgets had annex_paviment_tipus set, infer the new flags
UPDATE public.budgets
   SET annex_paviment_reforma_enabled = true
 WHERE annex_paviment_tipus = 'reforma'
   AND COALESCE(annex_paviment_reforma_enabled, false) = false;

UPDATE public.budgets
   SET annex_paviment_nou_enabled = true
 WHERE annex_paviment_tipus = 'nou'
   AND COALESCE(annex_paviment_nou_enabled, false) = false;

-- 2) Add formula_variables for the Paviment Perimetral subsection so users can build
--    formulas and conditions in the calculation engine.
INSERT INTO public.formula_variables (variable_name, label, description, source_field, category, example_value)
VALUES
  ('annex_paviment_estat',                  'Estat paviment perimetral',          'Valor: no | si | opcional',                                  'annex_paviment_estat',                  'annex', 0),
  ('annex_paviment_reforma_enabled',        'Reforma de paviment existent',       'true si l''usuari activa el toggle de reforma',              'annex_paviment_reforma_enabled',        'annex', 0),
  ('annex_paviment_retirada_enabled',       'Retirada ceràmica existent',         'true si s''ha d''eliminar paviment existent',                'annex_paviment_retirada_enabled',       'annex', 0),
  ('annex_paviment_retirada_m2',            'M² retirada ceràmica',               'Metres quadrats a retirar',                                  'annex_paviment_retirada_m2',            'annex', 0),
  ('annex_paviment_regularitzacio_enabled', 'Regularització llosa existent',      'true si cal regularitzar la llosa existent',                 'annex_paviment_regularitzacio_enabled', 'annex', 0),
  ('annex_paviment_regularitzacio_m2',      'M² regularització llosa',            'Metres quadrats a regularitzar',                             'annex_paviment_regularitzacio_m2',      'annex', 0),
  ('annex_paviment_nou_enabled',            'Paviment nou',                       'true si l''usuari activa el toggle de paviment nou',         'annex_paviment_nou_enabled',            'annex', 0),
  ('annex_paviment_actuacio',               'Actuació paviment nou',              'Valor: suministre_col | col | suministre',                   'annex_paviment_actuacio',               'annex', 0),
  ('annex_paviment_formigo_enabled',        'Inclou formigó de base',             'true si s''inclou la base de formigó',                       'annex_paviment_formigo_enabled',        'annex', 0),
  ('annex_paviment_formigo_m2',             'M² formigó de base',                 'Metres quadrats de formigó de base',                         'annex_paviment_formigo_m2',             'annex', 0),
  ('annex_paviment_material',               'Material paviment nou',              'Valor: aplacat | fusta',                                     'annex_paviment_material',               'annex', 0),
  ('annex_paviment_format',                 'Format paviment',                    'Format de la peça (per ex. 31 × 62 cm)',                     'annex_paviment_format',                 'annex', 0),
  ('annex_paviment_m2',                     'M² paviment nou',                    'Metres quadrats totals del paviment nou',                    'annex_paviment_m2',                     'annex', 0),
  ('annex_paviment_model_sale',             'Preu venda model paviment',          'Preu de venda unitari de l''article model seleccionat',      'annex_paviment_model_id',               'annex', 0),
  ('annex_paviment_model_cost',             'Cost model paviment',                'Cost unitari de l''article model seleccionat',               'annex_paviment_model_id',               'annex', 0)
ON CONFLICT DO NOTHING;