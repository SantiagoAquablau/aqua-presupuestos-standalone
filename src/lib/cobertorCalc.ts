/**
 * Cobertor (pool cover) price calculation engine.
 *
 * FORMULA:
 *   TOTAL = Estructura(model, ample) + (Preu_lama(material, ample) × llarg) + embalatge + transport + instal·lació
 *
 * RULES:
 * - The pool width is rounded UP to the nearest standard step: 3 / 3.5 / 4 / 4.5 / 5 / 5.5 / 6 m.
 * - The pool length is rounded UP to the nearest whole metre (8.5 → 9).
 * - Each model has a max length: if the pool exceeds it, the calculation is invalid.
 * - Each model has a max width (derived from the available price rows for that model).
 * - Installation cost depends on the cover type (fora_aigua vs submergit).
 * - Sale prices already include a 45% margin on cost, so:
 *     cost = sale × 0.55  (i.e. sale − 45 %)
 *
 * SPECIAL CASE — model "s-lux":
 *   Adds a "Tapa horizontal PVC per revestir" line below the lames.
 *     tapa = ample_efectiu × 0.72 × 462 €
 */

export const STANDARD_WIDTHS = [3, 3.5, 4, 4.5, 5, 5.5, 6] as const;

export interface CoverModelPriceRow {
  model_id: string;
  width_m: number;
  price_eur: number;
  max_length_m: number;
}

export interface CoverLamaPriceRow {
  material: 'pvc' | 'policarbonat';
  width_m: number;
  price_per_m: number;
}

export interface CoverSettings {
  embalatge_eur: number;
  transport_eur: number;
  installation_fora_aigua_eur: number;
  installation_submergit_eur: number;
  cost_factor: number;
}

export interface CobertorCalcInput {
  modelId?: string;
  modelName?: string;
  modelCode?: string;
  coverType?: 'fora_aigua' | 'submergit';
  material?: 'pvc' | 'policarbonat';
  poolWidth?: number;
  poolLength?: number;
  modelPrices: CoverModelPriceRow[];
  lamaPrices: CoverLamaPriceRow[];
  settings: CoverSettings;
}

export interface CobertorCalcBreakdown {
  estructura: number;
  lames: number;
  tapaHoritzontal?: number;
  embalatge: number;
  transport: number;
  installation: number;
  totalSale: number;
  totalCost: number;
  effectiveWidth: number;
  effectiveLength: number;
  lamaPricePerM: number;
}

export interface CobertorCalcResult {
  ok: boolean;
  reason?:
    | 'missing_input'
    | 'no_prices'
    | 'width_too_large'
    | 'length_too_large'
    | 'no_lama_price';
  message?: string;
  maxWidth?: number;
  maxLength?: number;
  breakdown?: CobertorCalcBreakdown;
}

/** Round the pool width UP to the nearest standard step (3/3.5/.../6). */
export function roundUpWidth(width: number): number | null {
  if (!width || width <= 0) return null;
  for (const w of STANDARD_WIDTHS) if (width <= w) return w;
  return null; // over 6m
}

/** Round the pool length UP to the nearest whole metre. */
export function roundUpLength(length: number): number {
  return Math.ceil(length);
}

/**
 * Find which models in the catalogue could fit the given pool width and length.
 * Used to suggest alternatives when the chosen model doesn't fit.
 */
export function findCompatibleModels(
  width: number,
  length: number,
  modelPrices: CoverModelPriceRow[],
  allModels: { id: string; name: string; cover_type: string }[],
): { id: string; name: string; cover_type: string }[] {
  const w = roundUpWidth(width);
  const l = roundUpLength(length);
  if (!w) return [];
  const okModelIds = new Set(
    modelPrices.filter((p) => p.width_m === w && p.max_length_m >= l).map((p) => p.model_id),
  );
  return allModels.filter((m) => okModelIds.has(m.id));
}

export function calcCobertor(input: CobertorCalcInput): CobertorCalcResult {
  const {
    modelId,
    modelName,
    modelCode,
    coverType,
    material,
    poolWidth,
    poolLength,
    modelPrices,
    lamaPrices,
    settings,
  } = input;

  if (!modelId || !coverType || !material || !poolWidth || !poolLength) {
    return { ok: false, reason: 'missing_input', message: 'Falten dades per calcular' };
  }

  const modelRows = modelPrices.filter((p) => p.model_id === modelId);
  if (modelRows.length === 0) {
    return {
      ok: false,
      reason: 'no_prices',
      message: 'Aquest model no té preus configurats',
    };
  }

  const maxWidth = Math.max(...modelRows.map((r) => r.width_m));
  const w = roundUpWidth(poolWidth);
  if (w === null || w > maxWidth) {
    return {
      ok: false,
      reason: 'width_too_large',
      maxWidth,
      message: `El model ${modelName ?? ''} només admet fins a ${maxWidth} m d'ample. La teva piscina té ${poolWidth} m.`,
    };
  }

  const row = modelRows.find((r) => r.width_m === w);
  if (!row) {
    return {
      ok: false,
      reason: 'no_prices',
      message: `No hi ha preu definit per a ${w} m d'ample en aquest model`,
    };
  }

  const l = roundUpLength(poolLength);
  if (l > row.max_length_m) {
    return {
      ok: false,
      reason: 'length_too_large',
      maxLength: row.max_length_m,
      maxWidth,
      message: `El model ${modelName ?? ''} només admet fins a ${row.max_length_m} m de llarg. La teva piscina té ${poolLength} m.`,
    };
  }

  const lamaRow = lamaPrices.find((p) => p.material === material && p.width_m === w);
  if (!lamaRow) {
    return {
      ok: false,
      reason: 'no_lama_price',
      message: `No hi ha preu de lama ${material} per a ${w} m d'ample`,
    };
  }

  const estructura = Number(row.price_eur);
  const lamaPricePerM = Number(lamaRow.price_per_m);
  const lames = lamaPricePerM * l;
  const embalatge = Number(settings.embalatge_eur);
  const transport = Number(settings.transport_eur);
  const installation =
    coverType === 'submergit'
      ? Number(settings.installation_submergit_eur)
      : Number(settings.installation_fora_aigua_eur);

  // s-Lux: add "Tapa horitzontal PVC per revestir" — width × 0.72 × 462 €
  const isSLux = (modelCode ?? '').toLowerCase() === 's-lux';
  const tapaHoritzontal = isSLux ? round2(w * 0.72 * 462) : 0;

  const totalSale = estructura + lames + tapaHoritzontal + embalatge + transport + installation;
  // Cost = total sale − 45 % (i.e. sale × 0.55)
  const totalCost = totalSale * 0.55;

  return {
    ok: true,
    breakdown: {
      estructura,
      lames,
      tapaHoritzontal: isSLux ? tapaHoritzontal : undefined,
      embalatge,
      transport,
      installation,
      totalSale: Math.round(totalSale * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      effectiveWidth: w,
      effectiveLength: l,
      lamaPricePerM,
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}