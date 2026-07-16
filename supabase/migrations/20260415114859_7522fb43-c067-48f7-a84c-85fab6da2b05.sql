
INSERT INTO public.formula_variables (variable_name, label, description, source_field, category, example_value)
VALUES
  ('pool_floor_surface', 'Superficie del suelo (m²)', 'Largo × Ancho del vaso', 'calculated', 'pool_dimensions', 32),
  ('pool_wall_surface', 'Superficie de las paredes (m²)', 'Perímetro × Profundidad media', 'calculated', 'pool_dimensions', 33.6)
ON CONFLICT (variable_name) DO NOTHING;

UPDATE public.formula_variables
SET label = 'Superficie total del vaso (m²)',
    description = 'Suelo + Paredes (Largo×Ancho + Perímetro×Prof.media)',
    example_value = 65.6
WHERE variable_name = 'pool_surface';
