
-- Update label of annex_netejafons_total: it is the boquilles COUNT, not a sale amount.
UPDATE public.formula_variables
SET label = 'Netejafons · Boquilles (total)',
    description = 'Nombre total de boquilles (fons + escala + plataforma) calculat al pas Annex.',
    source_field = 'annex_netejafons_total'
WHERE variable_name = 'annex_netejafons_total';

-- Add new netejafons-related variables
INSERT INTO public.formula_variables (variable_name, label, source_field, category, description, example_value) VALUES
  ('annex_netejafons_boquilles_total', 'Netejafons · Boquilles (total)', 'annex_netejafons_total', 'annex', 'Alies de annex_netejafons_total. Nombre total de boquilles del sistema netejafons.', 11),
  ('annex_netejafons_fons', 'Netejafons · Boquilles fons', 'annex_netejafons_fons', 'annex', 'Quantitat de boquilles al fons de la piscina.', 4),
  ('annex_netejafons_escala', 'Netejafons · Boquilles escala', 'annex_netejafons_escala', 'annex', 'Quantitat de boquilles a l''escala interior.', 2),
  ('annex_netejafons_plataforma', 'Netejafons · Boquilles plataforma', 'annex_netejafons_plataforma', 'annex', 'Quantitat de boquilles a la plataforma interior.', 1),
  ('annex_netejafons_extra_cost', 'Netejafons · Cost extra (€)', 'annex_netejafons_extra_cost', 'annex', 'Cost addicional per boquilles que superen les 11 incloses.', 0),
  ('annex_netejafons_sale', 'Netejafons · Preu venda article (€)', 'annex_netejafons_article_id', 'annex', 'Preu de venda unitari de l''article netejafons seleccionat.', 0),
  ('annex_netejafons_cost', 'Netejafons · Cost article (€)', 'annex_netejafons_article_id', 'annex', 'Preu de cost unitari de l''article netejafons seleccionat.', 0)
ON CONFLICT (variable_name) DO UPDATE
  SET label = EXCLUDED.label,
      source_field = EXCLUDED.source_field,
      category = EXCLUDED.category,
      description = EXCLUDED.description,
      example_value = EXCLUDED.example_value;
