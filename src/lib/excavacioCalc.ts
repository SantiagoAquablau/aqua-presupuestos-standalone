/**
 * Mà d'obra d'excavació — shared calculation used by both StepAnnex (input
 * default / note) and StepRevisio (summary), so the two views never drift.
 *
 * Mirrors the formula engine rule "MANO DE OBRA EXCAVACION":
 *   qty = roundUp(((L+1)*(W+1)*(depth_avg+0.3))/8.5), unit price 455€.
 * Mínim de venda 3.300 € (igual que el mínim de 930 € del re-ompliment).
 */
export interface ManoObraExcavacioResult {
  qty: number;
  total: number;
}

const MANO_OBRA_EXCAVACIO_UNIT_PRICE = 455;
export const MANO_OBRA_EXCAVACIO_MIN_SALE = 3300;

export function computeManoObraExcavacio(
  poolLength: number,
  poolWidth: number,
  poolDepthAvg: number,
): ManoObraExcavacioResult | null {
  if (!poolLength || !poolWidth || !poolDepthAvg) return null;
  const qty = Math.ceil(((poolLength + 1) * (poolWidth + 1) * (poolDepthAvg + 0.3)) / 8.5);
  const total = Math.max(MANO_OBRA_EXCAVACIO_MIN_SALE, qty * MANO_OBRA_EXCAVACIO_UNIT_PRICE);
  return { qty, total: Math.round(total * 100) / 100 };
}
