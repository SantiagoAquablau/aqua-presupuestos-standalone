-- "Plat de dutxa" sale price: separate manual-override flag for the price
-- field itself (distinct from acc_plat_dutxa_manual_override, which guards
-- the enabled toggle). Once the user edits the auto-calculated price by
-- hand, this locks it so Llarg/Ample changes never overwrite it again.
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS acc_plat_dutxa_sale_manual_override BOOLEAN DEFAULT false;
