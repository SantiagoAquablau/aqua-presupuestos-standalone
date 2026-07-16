ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS contractant_name text,
  ADD COLUMN IF NOT EXISTS contractant_nif text,
  ADD COLUMN IF NOT EXISTS contractant_address text,
  ADD COLUMN IF NOT EXISTS contractant_town text,
  ADD COLUMN IF NOT EXISTS obra_location text;