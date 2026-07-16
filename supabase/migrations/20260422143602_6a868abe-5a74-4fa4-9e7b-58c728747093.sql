-- Add column to store the chosen new technical room type (caseta) and a formula variable for it
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS instal_fontaneria_caseta_tipus text;

INSERT INTO public.formula_variables (variable_name, label, description, category, source_field, example_value)
VALUES
  ('instal_fontaneria_local_tecnic', 'Tipus de local tècnic', 'Valor: existent | nou | determinar', 'installations', 'instal_fontaneria_local_tecnic', 0),
  ('instal_fontaneria_caseta_tipus', 'Tipus de caseta (local nou)', 'Valor: caseta_elevada | caseta_soterrada | caseta_obra (només si local tècnic = nou)', 'installations', 'instal_fontaneria_caseta_tipus', 0)
ON CONFLICT DO NOTHING;