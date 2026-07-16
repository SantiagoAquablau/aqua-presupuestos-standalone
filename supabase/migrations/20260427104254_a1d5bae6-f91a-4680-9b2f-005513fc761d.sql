-- Pool Vallet conditional rules for sistema netejafons
-- Logic:
--   B = annex_netejafons_boquilles_total
--   D = instal_fontaneria_distancia (m, default 10)
--   useDoubleD50 = (B/6 > 4)                                  -> CABEZAL D50 x2
--   useD63       = !useDoubleD50 && ((B/6 == 4) || (D > 20))  -> CABEZA  D63 x1
--   default      = CABEZAL D50 x1
-- Bomba:
--   1.5 CV cuando useDoubleD50 || useD63 || B/6==4 || D>20
--   1   CV en el resto

-- 1) Update existing CABEZAL D50 rule to be conditional on quantity
UPDATE public.formula_rules
SET
  formula_quantity = '((annex_netejafons_boquilles_total/6) > 4) ? 2 : ((((annex_netejafons_boquilles_total/6) === 4) || (instal_fontaneria_distancia > 20)) ? 0 : 1)',
  notes = 'Cabezal D50: 2 uds si boquilles/6>4, 1 ud por defecto, 0 si aplica D63 (boquilles/6==4 o distancia>20m).'
WHERE id = '6de4ba2d-a862-4cbc-ad6a-fc55b265e9b1';

-- 2) Insert CABEZA D63 rule (conditional)
INSERT INTO public.formula_rules (
  budget_type, phase, sub_phase, order_index, name, description,
  formula_sale, formula_cost, formula_quantity, unit, article_ref,
  is_active, is_conditional, condition_field, condition_value, notes
) VALUES (
  'obra_nova', 'annex', 'netejafons', 105,
  'CABEZA DE POOL VALLET D63',
  'Cabezal D63 cuando boquilles/6==4 o distancia depuradora > 20m (y no aplica D50 doble).',
  'articlePrice(''CABEZA DE POOL VALLET D63'').sale',
  'articlePrice(''CABEZA DE POOL VALLET D63'').cost',
  '((annex_netejafons_boquilles_total/6) > 4) ? 0 : ((((annex_netejafons_boquilles_total/6) === 4) || (instal_fontaneria_distancia > 20)) ? 1 : 0)',
  'ud', 'CABEZA DE POOL VALLET D63',
  true, true, 'annex_netejafons_estat', 'inclos',
  'Activo si B/6==4 o distancia>20m. Excluido si B/6>4 (en ese caso se usan 2x D50).'
);

-- 3) Update existing BOMBA 1CV rule to be conditional
UPDATE public.formula_rules
SET
  formula_quantity = '(((annex_netejafons_boquilles_total/6) > 4) || ((annex_netejafons_boquilles_total/6) === 4) || (instal_fontaneria_distancia > 20)) ? 0 : 1',
  notes = 'Bomba 1CV: solo cuando NO aplica bomba 1.5CV (cabezal D50 simple).'
WHERE id = '8e942bd1-3103-47a5-9a60-c9fbd99e5de4';

-- 4) Insert BOMBA 1.5CV rule (conditional)
INSERT INTO public.formula_rules (
  budget_type, phase, sub_phase, order_index, name, description,
  formula_sale, formula_cost, formula_quantity, unit, article_ref,
  is_active, is_conditional, condition_field, condition_value, notes
) VALUES (
  'obra_nova', 'annex', 'netejafons', 115,
  'BOMBA POOL VALLET DOLFI 150M (1,5CV)',
  'Bomba 1.5CV cuando hay cabezal D63 o doble D50.',
  'articlePrice(''BOMBA POOL VALLET DOLFI 150M (1,5CV)'').sale',
  'articlePrice(''BOMBA POOL VALLET DOLFI 150M (1,5CV)'').cost',
  '(((annex_netejafons_boquilles_total/6) > 4) || ((annex_netejafons_boquilles_total/6) === 4) || (instal_fontaneria_distancia > 20)) ? 1 : 0',
  'ud', 'BOMBA POOL VALLET DOLFI 150M (1,5CV)',
  true, true, 'annex_netejafons_estat', 'inclos',
  'Se activa cuando aplica el cabezal D63 (B/6==4 o distancia>20m) o doble D50 (B/6>4).'
);