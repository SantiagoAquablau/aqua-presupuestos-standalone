-- Annex — "Entrada de material a mà": a manual cost/sale line (no article
-- reference) inside Annex, displayed as its own line in the Resum PDF page.
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS has_manual_material_entry BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_material_entry_cost NUMERIC,
  ADD COLUMN IF NOT EXISTS manual_material_entry_sale NUMERIC;
