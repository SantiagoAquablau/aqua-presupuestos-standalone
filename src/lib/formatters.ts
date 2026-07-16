/**
 * Format a number as EUR with the Catalan locale.
 * Always shows two decimals and the € symbol after the amount.
 * Example: 8855 → "8.855,00 €"
 */
export function formatEUR(value: number, options?: { round?: 'ceil' | 'floor' | 'round' | 'none' }): string {
  const mode = options?.round ?? 'ceil';
  const rounded =
    mode === 'ceil' ? Math.ceil(value) :
    mode === 'floor' ? Math.floor(value) :
    mode === 'round' ? Math.round(value) :
    value;
  return `${rounded.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/**
 * Round up a partida/line-item sale subtotal to whole euros.
 * Centralised so the wizard, persistence layer and PDF all agree on the
 * same value (avoids decimal drift between resum financer and PDF).
 * Example: 15189.33 → 15190 ; 2330.50 → 2331.
 */
export function lineSaleTotal(quantity: number, unitSale: number): number {
  return Math.ceil((Number(quantity) || 0) * (Number(unitSale) || 0));
}
