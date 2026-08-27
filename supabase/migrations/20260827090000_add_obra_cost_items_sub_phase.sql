-- obra_cost_items had no way to preserve the wizard/budget's sub-phase
-- grouping (BudgetItem.subPhase from wizardLines.ts, e.g. "Vas d'obra" vs
-- "Elements estructurals", "Coronament" vs "Revestiment"). That info was
-- computed by the formula engine + wizard lines but dropped when
-- populateObraFromBudget.ts inserted the rows, so Control d'Obres could only
-- group partides by phase, never by the finer sub-phase used in the wizard.
ALTER TABLE public.obra_cost_items
  ADD COLUMN IF NOT EXISTS sub_phase TEXT;
