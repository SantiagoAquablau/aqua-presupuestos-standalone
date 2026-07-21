
-- El rebossat de la paret vista (mortero + mà d'obra) aplica tant a
-- semi-enterrada com a elevada. Generalitzem la condició amb la sintaxi OR
-- ja suportada per formulaConditions.ts (format 3: mode-aware flat).
-- La quantitat (formula_quantity) segueix llegint la variable "altura_vista",
-- que el motor de fórmules (formulaEngine.ts::getEffectiveHeight) ja resol a
-- l'altura vista manual (semi-enterrada) o a pool_depth_max - rebaix (elevada).

UPDATE public.formula_rules
SET
  name = 'MORTERO REBOSSAT (PARET VISTA)',
  description = 'Mortero per revestir la part exterior visible del vas (semi-enterrada o elevada).',
  condition_field = '{"mode":"or","fields":["pool_disposition","pool_disposition"]}',
  condition_value = '{"values":["semi_enterrada","elevada"]}',
  notes = 'Cantitat = superfície vista (perímetre * altura efectiva) * 1.5 * 0.8. Altura efectiva = altura vista (semi-enterrada) o profunditat màxima - rebaix (elevada), resolta pel motor de fórmules.'
WHERE budget_type = 'obra_nova' AND phase = 'estructura' AND sub_phase = 'vas'
  AND name = 'MORTERO REBOSAT (SEMI-ENTERRADA)';

UPDATE public.formula_rules
SET
  name = 'MANO DE OBRA REBOSSAT (PARET VISTA)',
  description = 'Mà d''obra del rebossat exterior en piscines semi-enterrades o elevades.',
  condition_field = '{"mode":"or","fields":["pool_disposition","pool_disposition"]}',
  condition_value = '{"values":["semi_enterrada","elevada"]}',
  notes = 'Import de venda = superfície vista * 7 €/m². Superfície = perímetre * altura efectiva (veure MORTERO REBOSSAT).'
WHERE budget_type = 'obra_nova' AND phase = 'estructura' AND sub_phase = 'vas'
  AND name = 'MANO DE OBRA REBOSAT (SEMI-ENTERRADA)';
