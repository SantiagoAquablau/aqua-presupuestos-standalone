-- Register jacuzzi measures/quantities as available variables for use inside
-- formula_rules quantity/sale/cost expressions (configurador de fórmules).
-- jacuzzi_surface / jacuzzi_volume are derived variables computed by
-- buildVariablesContext (formulaEngine.ts), mirroring StepJacuzzi.tsx.
INSERT INTO public.formula_variables (variable_name, label, description, category, source_field, example_value)
VALUES
  ('jacuzzi_length', 'Jacuzzi — llargada (m)', 'Llargada del jacuzzi en metres.', 'jacuzzi', 'jacuzzi_length', 2),
  ('jacuzzi_width', 'Jacuzzi — amplada (m)', 'Amplada del jacuzzi en metres.', 'jacuzzi', 'jacuzzi_width', 1.5),
  ('jacuzzi_depth', 'Jacuzzi — profunditat (m)', 'Profunditat del jacuzzi en metres (única, sense min/max).', 'jacuzzi', 'jacuzzi_depth', 0.9),
  ('jacuzzi_surface', 'Jacuzzi — superfície (m²)', 'Superfície calculada del jacuzzi: (llarg × ample) + 2×(llarg × profunditat) + 2×(ample × profunditat).', 'jacuzzi', 'calculated', 9.3),
  ('jacuzzi_volume', 'Jacuzzi — volum (L)', 'Volum calculat del jacuzzi en litres: llarg × ample × profunditat × 1000.', 'jacuzzi', 'calculated', 2700),
  ('jacuzzi_bench_count', 'Jacuzzi — nombre de bancs interiors', 'Jacuzzi independent: nombre de bancs interiors.', 'jacuzzi', 'jacuzzi_bench_count', 4),
  ('jacuzzi_bench_depth', 'Jacuzzi — fondària dels bancs (m)', 'Jacuzzi independent: fondària dels bancs interiors.', 'jacuzzi', 'jacuzzi_bench_depth', 0.4),
  ('jacuzzi_bench_height', 'Jacuzzi — alçada dels bancs (m)', 'Jacuzzi independent: alçada dels bancs interiors.', 'jacuzzi', 'jacuzzi_bench_height', 0.45),
  ('jacuzzi_stairs_count', 'Jacuzzi — nombre d''escalons', 'Jacuzzi independent: nombre d''escalons (fix a 2).', 'jacuzzi', 'jacuzzi_stairs_count', 2),
  ('jacuzzi_stairs_tread', 'Jacuzzi — petjada escaló (m)', 'Jacuzzi independent: petjada de cada escaló.', 'jacuzzi', 'jacuzzi_stairs_tread', 0.3),
  ('jacuzzi_air_jets_count', 'Jacuzzi — jets d''aire', 'Nombre de jets d''aire de la instal·lació del jacuzzi.', 'jacuzzi', 'jacuzzi_air_jets_count', 6),
  ('jacuzzi_air_jets_intake_count', 'Jacuzzi — preses d''aire', 'Nombre de preses d''aire de la instal·lació del jacuzzi.', 'jacuzzi', 'jacuzzi_air_jets_intake_count', 1),
  ('jacuzzi_air_pump_qty', 'Jacuzzi — quantitat bomba d''aire', 'Quantitat de bombes d''aire seleccionades pel jacuzzi.', 'jacuzzi', 'jacuzzi_air_pump_qty', 1),
  ('jacuzzi_water_jets_count', 'Jacuzzi — jets d''aigua', 'Nombre de jets d''aigua de la instal·lació del jacuzzi.', 'jacuzzi', 'jacuzzi_water_jets_count', 4),
  ('jacuzzi_water_jets_intake_count', 'Jacuzzi — preses d''aigua', 'Nombre de preses d''aigua de la instal·lació del jacuzzi.', 'jacuzzi', 'jacuzzi_water_jets_intake_count', 1),
  ('jacuzzi_water_pump_qty', 'Jacuzzi — quantitat bomba d''aigua', 'Quantitat de bombes d''aigua seleccionades pel jacuzzi.', 'jacuzzi', 'jacuzzi_water_pump_qty', 1),
  ('jacuzzi_piezo_buttons_count', 'Jacuzzi — polsadors piezoelèctrics', 'Nombre de polsadors piezoelèctrics de la instal·lació del jacuzzi.', 'jacuzzi', 'jacuzzi_piezo_buttons_count', 2)
ON CONFLICT DO NOTHING;
