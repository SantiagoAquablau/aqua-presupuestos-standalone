/**
 * Single source of truth for how "Ajust de preu (%)" (draft.marginPctAdjustment)
 * affects displayed sale totals — used by both StepPartides.tsx (Partides) and
 * StepRevisio.tsx (Resum Financer), which previously kept two independent,
 * partially-diverged copies of this logic.
 *
 * Business rule (unchanged, just centralized):
 * - Positive % (increment): propagated line by line — each line is rounded
 *   UP individually (Math.ceil) BEFORE summing, matching what the PDF shows.
 *   Summing already-rounded lines is NOT the same as rounding the sum once,
 *   so this order matters for cent-level agreement with the PDF.
 * - Negative % (descompte) or 0: individual lines/phases are left at their
 *   base amount — the discount only surfaces in the grand total (as a single
 *   adjustment), never distributed into per-line/per-phase figures.
 * - "Opcionals informatius (no sumen al total)" lines never count toward
 *   any total (cost, sale, or the adjustment).
 */

export interface FinancialLineItem {
  quantity: number;
  unitCost: number;
  unitSale: number;
  subPhase?: string | null;
}

export interface FinancialPhase<T extends FinancialLineItem = FinancialLineItem> {
  name: string;
  items: T[];
}

export function isOptionalSubPhase(subPhase?: string | null): boolean {
  return (subPhase || '').toLowerCase().includes('opcionals informatius');
}

export function countableItems<T extends FinancialLineItem>(items: T[]): T[] {
  return items.filter((it) => !isOptionalSubPhase(it.subPhase));
}

/** Base (unadjusted) sale of a single line, rounded up. */
export function lineSaleBase(item: FinancialLineItem): number {
  return Math.ceil(item.quantity * item.unitSale);
}

/** Multiplier applied to sale prices for display: only positive adjustments propagate. */
export function getDisplayFactor(adjustmentPct: number): number {
  return adjustmentPct > 0 ? 1 + adjustmentPct / 100 : 1;
}

/** Display sale of a single line: adjusted (and re-rounded) when there's an increment, base otherwise. */
export function lineSaleDisplay(item: FinancialLineItem, adjustmentPct: number, optional = false): number {
  const factor = getDisplayFactor(adjustmentPct);
  return adjustmentPct > 0 && !optional ? Math.ceil(item.quantity * item.unitSale * factor) : lineSaleBase(item);
}

export function itemsSaleDisplay<T extends FinancialLineItem>(
  items: T[],
  adjustmentPct: number,
  optional = false,
): number {
  return items.reduce((sum, item) => sum + lineSaleDisplay(item, adjustmentPct, optional), 0);
}

export interface PhaseTotals {
  name: string;
  cost: number;
  saleBase: number;
  /** Adjusted (increment) or base (descompte/0) — what should be displayed per phase. */
  sale: number;
  marginPct: number;
}

/**
 * Per-phase cost/sale, applying the same asymmetric increment/descompte rule
 * and "Opcionals informatius" exclusion used everywhere else. Note: summing
 * every phase's `sale` does NOT reproduce computeGrandTotal's `sale` when
 * adjustmentPct < 0 — a descompte intentionally never touches per-phase
 * figures, only the grand total (see module doc).
 */
export function computePhaseTotals<T extends FinancialLineItem>(
  phases: FinancialPhase<T>[],
  adjustmentPct: number,
): PhaseTotals[] {
  const showIncrement = adjustmentPct > 0;
  return phases.map((phase) => {
    const items = countableItems(phase.items);
    const cost = items.reduce((s, it) => s + it.quantity * it.unitCost, 0);
    const saleBase = items.reduce((s, it) => s + lineSaleBase(it), 0);
    const sale = showIncrement ? itemsSaleDisplay(items, adjustmentPct) : saleBase;
    const marginPct = sale > 0 ? ((sale - cost) / sale) * 100 : 0;
    return { name: phase.name, cost, saleBase, sale, marginPct };
  });
}

export interface GrandTotals {
  cost: number;
  saleBase: number;
  /** Adjusted sale total — includes both increments (propagated) and descomptes (aggregate-only). */
  sale: number;
  marginPct: number;
}

export function computeGrandTotal<T extends FinancialLineItem>(
  phases: FinancialPhase<T>[],
  adjustmentPct: number,
): GrandTotals {
  const showIncrement = adjustmentPct > 0;
  const cost = phases.reduce(
    (sum, phase) => sum + countableItems(phase.items).reduce((s, it) => s + it.quantity * it.unitCost, 0),
    0,
  );
  const saleBase = phases.reduce(
    (sum, phase) => sum + countableItems(phase.items).reduce((s, it) => s + lineSaleBase(it), 0),
    0,
  );
  const saleRaw = saleBase * (1 + adjustmentPct / 100);
  const sale = showIncrement
    ? phases.reduce((sum, phase) => sum + itemsSaleDisplay(countableItems(phase.items), adjustmentPct), 0)
    : adjustmentPct !== 0
      ? Math.round(saleRaw)
      : saleRaw;
  const marginPct = sale > 0 ? ((sale - cost) / sale) * 100 : 0;
  return { cost, saleBase, sale, marginPct };
}
