-- Register new formula variables for the cobertor wall affecting interior revestiment surface
INSERT INTO public.formula_variables (variable_name, label, description, category, source_field, example_value)
VALUES
  ('revestiment_surface_m2',
   'Superfície revestiment (amb mur cobertor)',
   'Superfície interior total per revestir. Equival a total_surface + (mur_m2 × 2) quan el cobertor submergit requereix construir un mur nou; en cas contrari és igual a total_surface.',
   'pool_dimensions', 'revestiment_surface_m2', 80),
  ('annex_cobertor_mur_extra_m2',
   'Cobertor — m² extra a revestir pel mur',
   'Metres quadrats addicionals a sumar a la superfície de revestiment quan es construeix un mur nou per al cobertor: mur_m2 × 2 (cara interior + exterior). Val 0 si no es construeix mur.',
   'annex_cobertor', 'annex_cobertor_mur_extra_m2', 0)
ON CONFLICT DO NOTHING;

-- Replace total_surface with revestiment_surface_m2 in the specific revestiment-related rules
-- listed by the user. Only affects formula_quantity (where total_surface is used).
UPDATE public.formula_rules
SET formula_quantity = REPLACE(formula_quantity, 'total_surface', 'revestiment_surface_m2'),
    updated_at = now()
WHERE name IN (
  'MANO DE OBRA (GRESSITE)',
  'MANO DE OBRA (GRESSITE + EPOXI)',
  'MANO DE OBRA (PORCELANICO)',
  'MANO DE OBRA (PORCELANICO + EPOXI)',
  'BORADA EUROCOLOR 25KG AMB GRESSITE',
  'BORADA EUROCOLOR 25KG AMB (PORCELANICO)',
  'CEMENTO COLA FIXAFLEX GEL 25KG',
  'CEMENTO COLA FIX-PORCELANICO 25KG',
  'EPOXI AMB GRESSITE',
  'EPOXI AMB PORCELANICO',
  'EPOXINET',
  'FIX ESPATULA GOMA AZUL',
  'FIX ESTROPAJO BLANCO',
  'RECAMBIOS ESTROPAJO',
  'ESPONJA CON RECAMBIO',
  'RECAMBIOS ESPONJAS PACK',
  'CUÑAS',
  'CRUCETAS PORCELANICO'
)
AND formula_quantity LIKE '%total_surface%';

-- Also update the "Revestiment (model seleccionat)" rule (any name variant)
UPDATE public.formula_rules
SET formula_quantity = REPLACE(formula_quantity, 'total_surface', 'revestiment_surface_m2'),
    updated_at = now()
WHERE (name ILIKE 'Revestiment%model seleccionat%' OR name ILIKE 'Revestiment (model%')
AND formula_quantity LIKE '%total_surface%';