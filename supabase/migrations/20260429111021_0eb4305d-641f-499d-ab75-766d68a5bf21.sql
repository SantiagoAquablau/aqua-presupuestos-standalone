
-- Rename the existing entry to "Transparent" (keep id so existing budgets keep linkage)
UPDATE public.cover_colors
SET code = 'poli-transparent', name = 'Transparent'
WHERE id = '9c5a2fbb-6c2f-4b2c-b0c5-47ae8f98deba';

-- Insert new color "Negre translúcid" right after, shifting the rest
UPDATE public.cover_colors
SET order_index = order_index + 1
WHERE material = 'policarbonat' AND order_index >= 2;

WITH new_color AS (
  INSERT INTO public.cover_colors (code, name, material, order_index, image_url)
  VALUES ('poli-negre-trans', 'Negre translúcid', 'policarbonat', 2, NULL)
  RETURNING id
)
INSERT INTO public.cover_model_colors (model_id, color_id)
SELECT cmc.model_id, nc.id
FROM public.cover_model_colors cmc
CROSS JOIN new_color nc
WHERE cmc.color_id = '9c5a2fbb-6c2f-4b2c-b0c5-47ae8f98deba'
ON CONFLICT DO NOTHING;
