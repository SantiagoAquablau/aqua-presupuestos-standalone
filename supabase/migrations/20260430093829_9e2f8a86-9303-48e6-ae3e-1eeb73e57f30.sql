INSERT INTO public.formula_variables (variable_name, label, description, category, source_field, example_value)
VALUES
  ('annex_cobertor_mur_nou', 'Cobertor — Mur nou (s-Lux)', 'Indica si cal construir un mur nou per al cobertor submergit s-Lux (true/false). Útil amb operadors AND/OR.', 'annex_cobertor', 'annex_cobertor_mur_nou', 0),
  ('annex_cobertor_mur_m2', 'Cobertor — m² del mur nou', 'Metres quadrats del mur calculats automàticament: ample piscina × profunditat mitjana.', 'annex_cobertor', 'annex_cobertor_mur_m2', 12),
  ('annex_cobertor_model_code', 'Cobertor — codi del model', 'Codi del model de cobertor seleccionat (ex: s-lux, s-premium, e-basic...). Útil per condicions específiques per model.', 'annex_cobertor', 'annex_cobertor_model_code', 0),
  ('annex_cobertor_tipus', 'Cobertor — tipus', 'Tipus de cobertor: fora_aigua o submergit.', 'annex_cobertor', 'annex_cobertor_tipus', 0),
  ('annex_cobertor_lames', 'Cobertor — lames', 'Material de les lames: pvc o policarbonat.', 'annex_cobertor', 'annex_cobertor_lames', 0)
ON CONFLICT (variable_name) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    source_field = EXCLUDED.source_field;