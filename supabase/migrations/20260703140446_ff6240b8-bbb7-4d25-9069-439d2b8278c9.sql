
-- Placeholder article for PAVIMENT APLACAT 31x31 (mirrors the existing 31x62/48x98/98x98 TBD rows)
INSERT INTO public.articles (name, reference, category, format, unit, cost_price, sale_price, sale_price_supply_only, subtipus, image_url)
VALUES (
  'PAVIMENT APLACAT 31x31 (A DETERMINAR)',
  'PAVIMENT_APLACAT_31x31_TBD',
  'Varis',
  '31 x 31',
  'm²',
  1860, -- cost in cents (18,60 €) — same baseline as GRES DE BREDA 31x31
  3000, -- sale in cents (30,00 €)
  0,
  'Paviment perimetral',
  ''
)
ON CONFLICT DO NOTHING;

-- Formula rule for the 31 × 31 cm aplacat paviment (clone of 31x62 rule with matching conditions)
INSERT INTO public.formula_rules (
  budget_type, phase, sub_phase, order_index, name, description,
  formula_quantity, formula_cost, formula_sale, unit, article_ref,
  is_active, is_conditional, condition_field, condition_value
)
VALUES (
  'obra_nova',
  'annex',
  'paviment',
  (SELECT COALESCE(MAX(order_index), 0) + 1 FROM public.formula_rules WHERE phase = 'annex' AND sub_phase = 'paviment'),
  'PAVIMENT APLACAT MODEL 31x31',
  NULL,
  'annex_paviment_m2',
  'modelPrice(''annex_paviment'').cost',
  'modelPrice(''annex_paviment'').sale',
  'm²',
  'PAVIMENT APLACAT 31x31 (A DETERMINAR)',
  true,
  true,
  '{"version":2,"groups":[{"fields":["annex_paviment_nou_enabled"],"ops":["eq"]},{"fields":["annex_paviment_material"],"ops":["eq"]},{"fields":["annex_paviment_format"],"ops":["eq"]}]}'::text,
  '{"version":2,"groups":[{"values":["true"]},{"values":["aplacat"]},{"values":["31 × 31 cm"]}]}'::text
);
