-- Persist which formula-engine rule generated a budget_items row, so a
-- manually edited formula item (user_edited = true) can be matched back to
-- its originating rule (formulaRuleId === result.ruleId) after a reload and
-- have its override preserved instead of being silently regenerated with
-- the catalog default.
ALTER TABLE public.budget_items
  ADD COLUMN IF NOT EXISTS formula_rule_id TEXT;
