-- Remove duplicate budget_phases (same budget_id + same name).
-- Keep the row with the lowest "order" then lowest id. Reassign items to the kept phase.

WITH ranked AS (
  SELECT
    id,
    budget_id,
    name,
    ROW_NUMBER() OVER (
      PARTITION BY budget_id, name
      ORDER BY "order" NULLS LAST, id
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY budget_id, name
      ORDER BY "order" NULLS LAST, id
      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS keep_id
  FROM public.budget_phases
),
to_delete AS (
  SELECT id, keep_id FROM ranked WHERE rn > 1
)
UPDATE public.budget_items bi
SET phase_id = td.keep_id
FROM to_delete td
WHERE bi.phase_id = td.id;

DELETE FROM public.budget_phases bp
USING (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY budget_id, name
        ORDER BY "order" NULLS LAST, id
      ) AS rn
    FROM public.budget_phases
  ) r
  WHERE rn > 1
) d
WHERE bp.id = d.id;