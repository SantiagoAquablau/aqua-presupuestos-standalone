-- Manual total vessel surface (floor + walls combined) for poolShape ===
-- 'irregular', where pool_length/pool_width aren't collected and can't be
-- used to derive surface (see formulaEngine.ts / StepEstructura.tsx).
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS pool_surface_irregular numeric;
