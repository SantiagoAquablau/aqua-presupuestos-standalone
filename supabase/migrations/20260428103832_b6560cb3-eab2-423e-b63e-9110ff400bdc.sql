
-- 1) Replace the single "PAVIMENT APLACAT (A DETERMINAR)" with three format-specific TBD articles.
-- Update the existing one to be the 31x62 variant (preserves any data referencing it).
UPDATE public.articles
SET name = 'PAVIMENT APLACAT 31x62 (A DETERMINAR)',
    reference = 'PAVIMENT_APLACAT_31_TBD',
    format = '31 x 62',
    cost_price = 3000,
    sale_price = 4500
WHERE reference = 'PAVIMENT_APLACAT_TBD';

-- Insert the 48x98 variant (slightly higher price)
INSERT INTO public.articles (name, reference, category, subtipus, format, cost_price, sale_price, unit)
VALUES ('PAVIMENT APLACAT 48x98 (A DETERMINAR)', 'PAVIMENT_APLACAT_48_TBD', 'Varis', 'Paviment perimetral', '48 x 98', 3500, 5200, 'm²')
ON CONFLICT DO NOTHING;

-- Insert the 98x98 variant (highest price)
INSERT INTO public.articles (name, reference, category, subtipus, format, cost_price, sale_price, unit)
VALUES ('PAVIMENT APLACAT 98x98 (A DETERMINAR)', 'PAVIMENT_APLACAT_98_TBD', 'Varis', 'Paviment perimetral', '98 x 98', 4200, 6300, 'm²')
ON CONFLICT DO NOTHING;

-- 2) Replace the single "PAVIMENT APLACAT MODEL" rule with three format-conditional rules.
DELETE FROM public.formula_rules
WHERE name = 'PAVIMENT APLACAT MODEL'
  AND phase = 'annex'
  AND sub_phase = 'paviment';

INSERT INTO public.formula_rules
  (budget_type, phase, sub_phase, order_index, name, description,
   formula_quantity, formula_sale, formula_cost, unit, article_ref,
   is_active, is_conditional, condition_field, condition_value, notes)
VALUES
  ('obra_nova', 'annex', 'paviment', 10,
   'PAVIMENT APLACAT MODEL 31x62',
   'Model de paviment aplacat format 31x62 (placeholder o seleccionat per l''usuari).',
   'annex_paviment_m2',
   'modelPrice(''annex_paviment'').sale',
   'modelPrice(''annex_paviment'').cost',
   'm²', 'PAVIMENT APLACAT 31x62 (A DETERMINAR)',
   true, true,
   '{"version":2,"groups":[{"fields":["annex_paviment_nou_enabled"],"ops":["eq"]},{"fields":["annex_paviment_material"],"ops":["eq"]},{"fields":["annex_paviment_format"],"ops":["eq"]}]}',
   '{"version":2,"groups":[{"values":["true"]},{"values":["aplacat"]},{"values":["31 × 62 cm"]}]}',
   NULL),
  ('obra_nova', 'annex', 'paviment', 11,
   'PAVIMENT APLACAT MODEL 48x98',
   'Model de paviment aplacat format 48x98 (placeholder o seleccionat per l''usuari).',
   'annex_paviment_m2',
   'modelPrice(''annex_paviment'').sale',
   'modelPrice(''annex_paviment'').cost',
   'm²', 'PAVIMENT APLACAT 48x98 (A DETERMINAR)',
   true, true,
   '{"version":2,"groups":[{"fields":["annex_paviment_nou_enabled"],"ops":["eq"]},{"fields":["annex_paviment_material"],"ops":["eq"]},{"fields":["annex_paviment_format"],"ops":["eq"]}]}',
   '{"version":2,"groups":[{"values":["true"]},{"values":["aplacat"]},{"values":["48 × 98 cm"]}]}',
   NULL),
  ('obra_nova', 'annex', 'paviment', 12,
   'PAVIMENT APLACAT MODEL 98x98',
   'Model de paviment aplacat format 98x98 (placeholder o seleccionat per l''usuari).',
   'annex_paviment_m2',
   'modelPrice(''annex_paviment'').sale',
   'modelPrice(''annex_paviment'').cost',
   'm²', 'PAVIMENT APLACAT 98x98 (A DETERMINAR)',
   true, true,
   '{"version":2,"groups":[{"fields":["annex_paviment_nou_enabled"],"ops":["eq"]},{"fields":["annex_paviment_material"],"ops":["eq"]},{"fields":["annex_paviment_format"],"ops":["eq"]}]}',
   '{"version":2,"groups":[{"values":["true"]},{"values":["aplacat"]},{"values":["98 × 98 cm"]}]}',
   NULL);
