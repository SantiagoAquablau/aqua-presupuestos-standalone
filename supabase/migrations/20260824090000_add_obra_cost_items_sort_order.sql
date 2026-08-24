-- obra_cost_items had no stable ordering column: the UI fetched with
-- `ORDER BY created_at` only, and bulk inserts (populateObraFromBudget)
-- give every item in a phase the same created_at timestamp. With tied
-- values, Postgres has no deterministic tie-break, so an UPDATE (which
-- rewrites the row's tuple) could make it come back in a different
-- position on the next fetch -- items appeared to "jump" to the end of
-- their phase after editing real_qty/real_unit_cost.
ALTER TABLE public.obra_cost_items
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Backfill existing rows with a stable order derived from their current
-- created_at/id ordering, grouped per phase, so old data also gets a
-- deterministic position instead of relying on NULLS LAST forever.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY phase_id ORDER BY created_at, id) - 1 AS rn
  FROM public.obra_cost_items
)
UPDATE public.obra_cost_items oci
SET sort_order = ranked.rn
FROM ranked
WHERE oci.id = ranked.id
  AND oci.sort_order IS NULL;
