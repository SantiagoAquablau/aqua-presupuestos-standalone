/** One 0.20m riser per step, minus 1 because the pool floor itself counts as
 *  the last "step". Used for the interior stairs only (poolDepthMin) — the
 *  exterior access stair (alturaVista/alturaElevada) has its own separate
 *  formulas in StepEstructura.tsx/budgetSave.ts and is out of scope here.
 *
 *  Round-half-down on depth/0.2, not plain Math.round: for depths that land
 *  exactly on a .5 (odd multiples of 0.10m — 1.10, 1.30, 1.50...), plain
 *  Math.round rounds up (JS rounds .5 towards +Infinity), but the business
 *  rule here wants the extra riser only once depth clears the midpoint, e.g.
 *  1.30m must give 5 steps, not 6. Math.ceil(x - 0.5) is the standard
 *  round-half-down identity. */
export function computeInteriorStepsCount(depth?: number): number {
  return typeof depth === "number" && depth > 0 ? Math.max(0, Math.ceil(depth / 0.2 - 0.5) - 1) : 0;
}
