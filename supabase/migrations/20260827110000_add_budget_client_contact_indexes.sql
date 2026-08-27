-- Duplicate-client detection in the budget wizard (StepClient) filters
-- `budgets` by client_email / client_phone. These partial indexes keep that
-- lookup cheap: only non-deleted budgets with a non-empty contact field are
-- ever searched, and client_email is matched case-insensitively.
CREATE INDEX IF NOT EXISTS idx_budgets_client_email_lower
  ON public.budgets (lower(client_email))
  WHERE deleted = false AND client_email <> '';

CREATE INDEX IF NOT EXISTS idx_budgets_client_phone
  ON public.budgets (client_phone)
  WHERE deleted = false AND client_phone <> '';
