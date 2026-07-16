-- Update cobertor cost factor: sale prices already include a 45% margin on cost,
-- so cost = sale / 1.45 (≈ 0.6896551724).
UPDATE public.cover_settings
SET cost_factor = 0.6896551724
WHERE cost_factor = 0.55 OR cost_factor IS NULL;

ALTER TABLE public.cover_settings
  ALTER COLUMN cost_factor SET DEFAULT 0.6896551724;