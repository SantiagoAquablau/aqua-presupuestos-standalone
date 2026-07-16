
-- Semi-enterrada: mortero de rebosado + mano de obra del rebosado.
-- Aparecen només quan la disposició de la piscina és 'semi_enterrada'.

INSERT INTO public.formula_rules
  (budget_type, phase, sub_phase, order_index, name, description,
   formula_sale, formula_cost, formula_quantity, unit, article_ref,
   is_active, is_conditional, condition_field, condition_value, notes)
VALUES
  ('obra_nova', 'estructura', 'vas', 60,
   'MORTERO REBOSAT (SEMI-ENTERRADA)',
   'Mortero per revestir la part exterior visible del vas quan la piscina és semi-enterrada.',
   'articlePrice(''MORTERO '').sale',
   'articlePrice(''MORTERO '').cost',
   'roundUp((((pool_length + pool_width) * 2) * altura_vista) * 1.5 * 0.8, 0)',
   'sacs', 'MORTERO ',
   true, true, 'pool_disposition', 'semi_enterrada',
   'Cantitat = superfície vista (perímetre * altura vista) * 1.5 * 0.8. Modifica aquesta fórmula si canvien els coeficients.'),
  ('obra_nova', 'estructura', 'vas', 61,
   'MANO DE OBRA REBOSAT (SEMI-ENTERRADA)',
   'Mà d''obra del rebosat exterior en piscines semi-enterrades.',
   '7',
   '4.5',
   '(((pool_length + pool_width) * 2) * altura_vista)',
   'm²', NULL,
   true, true, 'pool_disposition', 'semi_enterrada',
   'Import de venda = superfície vista * 7 €/m². Modifica formula_sale per canviar el preu unitari.');
