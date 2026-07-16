import type { BudgetDraft, BudgetPhase, BudgetItem } from '@/stores/budgetStore';

export type AutoportantModel = 'line_confort' | 'line_luxe' | 'line_luxe_plus';

export const AUTOPORTANT_MODEL_LABELS: Record<AutoportantModel, string> = {
  line_confort: 'LINE CONFORT',
  line_luxe: 'LINE LUXE',
  line_luxe_plus: 'LINE LUXE PLUS',
};

export interface OpcionalDef {
  key: string;
  label: string;
  description?: string;
  models: AutoportantModel[];
  unit: 'ml' | 'ud';
  perMeter: boolean;
  /** Matcher on article name (case-insensitive contains all tokens). */
  articleMatch: string[];
  defaultQty?: number;
}

export const AUTOPORTANT_OPCIONALS: OpcionalDef[] = [
  {
    key: 'asiento_acrilico',
    label: 'Asiento / Macetero 100×50×50 — acabat enlluït acrílic',
    description: 'Preu per metre lineal. Indica els metres desitjats.',
    models: ['line_confort'],
    unit: 'ml',
    perMeter: true,
    articleMatch: ['ASIENTO', 'MACETERO', 'ACRILICO'],
    defaultQty: 1,
  },
  {
    key: 'colchoneta',
    label: 'Colchoneta 100×50',
    description: 'Es col·loca sobre el seient-macetero. Preu unitari.',
    models: ['line_confort', 'line_luxe', 'line_luxe_plus'],
    unit: 'ud',
    perMeter: false,
    articleMatch: ['COLCHONETA'],
    defaultQty: 1,
  },
  {
    key: 'cubierta_electrica',
    label: 'Coberta elèctrica elevada',
    description: 'La mida es selecciona automàticament segons les mides de la piscina (arrodonint cap amunt).',
    models: ['line_confort', 'line_luxe', 'line_luxe_plus'],
    unit: 'ud',
    perMeter: false,
    articleMatch: ['CUBIERTA', 'ELECTRICA', 'ELEVADA'], // size resolved dynamically
    defaultQty: 1,
  },
  {
    key: 'banco_gresite',
    label: 'Banc interior de gresite',
    description: 'Preu per metre lineal. Per defecte 1 m.',
    models: ['line_confort'],
    unit: 'ml',
    perMeter: true,
    articleMatch: ['BANCO', 'GRESSITE'],
    defaultQty: 1,
  },
  {
    key: 'spa',
    label: 'SPA 8 boquilles bufants + bomba bufant 1 CV + polsador tàctil',
    models: ['line_confort', 'line_luxe', 'line_luxe_plus'],
    unit: 'ud',
    perMeter: false,
    articleMatch: ['SPA', 'BOQUILLAS'],
    defaultQty: 1,
  },
  {
    key: 'cascada',
    label: 'Cascada d\'aigua de 60 cm encastada',
    models: ['line_confort', 'line_luxe', 'line_luxe_plus'],
    unit: 'ud',
    perMeter: false,
    articleMatch: ['CASCADA'],
    defaultQty: 1,
  },
  {
    key: 'asiento_porcelanico',
    label: 'Asiento / Macetero 100×50×50 — acabat porcelànic DEKTON',
    description: 'Preu per metre lineal. Indica els metres desitjats.',
    models: ['line_luxe', 'line_luxe_plus'],
    unit: 'ml',
    perMeter: true,
    articleMatch: ['ASIENTO', 'MACETERO', 'PORCELANICO'],
    defaultQty: 1,
  },
  {
    key: 'cristal',
    label: 'Cristall estàndard 1,40 × 0,40 m',
    models: ['line_confort'],
    unit: 'ud',
    perMeter: false,
    articleMatch: ['CRISTAL', 'STANDARD'],
    defaultQty: 1,
  },
];

function parseMeters(s?: string): number {
  if (!s) return 0;
  const m = s.replace(',', '.').match(/([0-9]+(?:\.[0-9]+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

/** Choose the smallest available cubierta size (2..7) x3 that is >= pool dims. */
export function resolveCubiertaSize(draft: Partial<BudgetDraft>): number {
  const l = parseMeters(draft.autoportantLlarg);
  const w = parseMeters(draft.autoportantAmple);
  const needed = Math.max(l, w);
  for (const s of [2, 3, 4, 5, 6, 7]) {
    if (s >= needed) return s;
  }
  return 7;
}

export interface CatalogArticle {
  id: string;
  name: string;
  unit: string | null;
  cost_price: number | null;
  sale_price: number | null;
  category: string | null;
}

export interface AutoportantPriceRow {
  model: string;
  altura_aigua_m: number | string;
  ample_m: number | string;
  llarg_m: number | string;
  cost_price: number | string;
  sale_price: number | string;
}

export interface AutoportantTransportConfig {
  provider_address: string;
  base_fee_cents: number;
  rate_narrow_cents_per_km: number;
  rate_wide_cents_per_km: number;
  narrow_width_threshold_m: number;
  wide_width_threshold_m: number;
  margin_multiplier: number;
}

/** Compute transport cost/sale given draft width + km + config.
 *  Returns euros (not cents). */
export function computeTransportPricing(
  draft: Partial<BudgetDraft>,
  config: AutoportantTransportConfig | undefined,
  kmOverride?: number,
): { km: number; cost: number; sale: number; ratePerKm: number } {
  if (!config) return { km: 0, cost: 0, sale: 0, ratePerKm: 0 };
  const km = Math.max(0, Math.ceil(Number(kmOverride ?? draft.autoportantTransportKm ?? 0)));
  const ample = parseMeters(draft.autoportantAmple);
  const narrowThreshold = Number(config.narrow_width_threshold_m) || 2.5;
  const wideThreshold = Number(config.wide_width_threshold_m) || 3.0;
  const rateNarrow = (Number(config.rate_narrow_cents_per_km) || 0) / 100;
  const rateWide = (Number(config.rate_wide_cents_per_km) || 0) / 100;
  const ratePerKm = ample > 0 && ample >= narrowThreshold && ample <= wideThreshold
    ? rateWide
    : rateNarrow;
  const base = (Number(config.base_fee_cents) || 0) / 100;
  const cost = base + km * ratePerKm;
  const sale = cost * (Number(config.margin_multiplier) || 1.4);
  return { km, cost, sale, ratePerKm };
}

/** Look up the configured cost/sale price for the pool from the
 *  autoportant_prices table. Returns { cost:0, sale:0 } when not found. */
export function findAutoportantPrice(
  draft: Partial<BudgetDraft>,
  prices: AutoportantPriceRow[] | undefined
): { cost: number; sale: number } {
  if (!prices || prices.length === 0 || !draft.autoportantModel) return { cost: 0, sale: 0 };
  const ample = parseMeters(draft.autoportantAmple);
  const llarg = parseMeters(draft.autoportantLlarg);
  const altura = parseMeters(draft.autoportantAlturaAigua);
  if (!ample || !llarg || !altura) return { cost: 0, sale: 0 };
  const eq = (a: number, b: number) => Math.abs(a - b) < 0.005;
  const row = prices.find(
    (p) =>
      p.model === draft.autoportantModel &&
      eq(Number(p.ample_m), ample) &&
      eq(Number(p.llarg_m), llarg) &&
      eq(Number(p.altura_aigua_m), altura)
  );
  if (!row) return { cost: 0, sale: 0 };
  return { cost: Number(row.cost_price) || 0, sale: Number(row.sale_price) || 0 };
}

const normalize = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

function matchArticle(articles: CatalogArticle[], tokens: string[]): CatalogArticle | undefined {
  const upper = tokens.map(normalize);
  return articles.find((a) => {
    if ((a.category || '').toLowerCase() !== 'autoportant') return false;
    const n = normalize(a.name || '');
    const compact = n.replace(/\s+/g, '');
    return upper.every((t) => n.includes(t) || compact.includes(t.replace(/\s+/g, '')));
  });
}

const AUTO_WIZARD_KEYS = new Set([
  'autoportant_piscina',
  'autoportant_transport',
  ...AUTOPORTANT_OPCIONALS.map((def) => `autoportant_opc_${def.key}`),
]);

function isLegacyAutoportantGeneratedItem(item: BudgetItem): boolean {
  const id = String(item.id || '');
  const key = String(item.wizardKey || '');
  const desc = String(item.description || '').toUpperCase();
  const normDesc = normalize(desc);
  return (
    AUTO_WIZARD_KEYS.has(key) ||
    id.startsWith('autoportant-') ||
    normDesc.includes('PISCINA AUTOPORTANT') ||
    AUTOPORTANT_OPCIONALS.some((def) => def.articleMatch.every((token) => normDesc.includes(normalize(token))))
  );
}

function isOpcionalSelected(draft: Partial<BudgetDraft>, key: string): { enabled: boolean; qty: number } {
  switch (key) {
    case 'asiento_acrilico': {
      const q = Number(draft.autoportantOpcAsientoAcrilicoQty ?? 0);
      return { enabled: q > 0, qty: q };
    }
    case 'colchoneta':
      return { enabled: !!draft.autoportantOpcColchoneta, qty: 1 };
    case 'cubierta_electrica':
      return { enabled: !!draft.autoportantOpcCubiertaElectrica, qty: 1 };
    case 'banco_gresite': {
      const q = Number(draft.autoportantOpcBancoGresiteQty ?? 0);
      return { enabled: q > 0, qty: q };
    }
    case 'spa':
      return { enabled: !!draft.autoportantOpcSpa, qty: 1 };
    case 'cascada':
      return { enabled: !!draft.autoportantOpcCascada, qty: 1 };
    case 'asiento_porcelanico': {
      const q = Number(draft.autoportantOpcAsientoPorcelanicoQty ?? 0);
      return { enabled: q > 0, qty: q };
    }
    case 'cristal':
      return { enabled: !!draft.autoportantOpcCristal, qty: 1 };
    default:
      return { enabled: false, qty: 0 };
  }
}

/**
 * Build the two phases for a piscina autoportant budget from the current
 * draft + article catalog. Prices are converted from cents to euros.
 */
export function buildAutoportantPhases(
  draft: Partial<BudgetDraft>,
  articles: CatalogArticle[],
  prices?: AutoportantPriceRow[],
  transportConfig?: AutoportantTransportConfig,
): BudgetPhase[] {
  const model = draft.autoportantModel as AutoportantModel | undefined;
  const modelLabel = model ? AUTOPORTANT_MODEL_LABELS[model] : '—';
  const dims = [draft.autoportantAmple, draft.autoportantLlarg, draft.autoportantAlturaAigua]
    .filter(Boolean).join(' × ');

  const priced = findAutoportantPrice(draft, prices);
  const piscinaItem: BudgetItem = {
    id: 'autoportant-piscina',
    description: `Piscina Autoportant ${modelLabel}${dims ? ` (${dims})` : ''}`,
    unit: 'ud',
    quantity: 1,
    unitCost: priced.cost,
    unitSale: priced.sale,
    source: 'wizard',
    wizardKey: 'autoportant_piscina',
    subPhase: null,
  };

  // Transport (calculated from config + km)
  const transport = computeTransportPricing(draft, transportConfig);
  const useEdited = draft.autoportantTransportUserEdited === true;
  const transportItem: BudgetItem = {
    id: 'autoportant-transport',
    description: `Transport`,
    unit: 'ud',
    quantity: 1,
    unitCost: useEdited && typeof draft.autoportantTransportCost === 'number' ? draft.autoportantTransportCost : transport.cost,
    unitSale: useEdited && typeof draft.autoportantTransportSale === 'number' ? draft.autoportantTransportSale : transport.sale,
    source: 'wizard',
    wizardKey: 'autoportant_transport',
    subPhase: null,
    userEdited: useEdited,
  };

  const opcItems: BudgetItem[] = [];
  for (const def of AUTOPORTANT_OPCIONALS) {
    if (!model || !def.models.includes(model)) continue;
    const sel = isOpcionalSelected(draft, def.key);
    if (!sel.enabled) continue;

    let article: CatalogArticle | undefined;
    if (def.key === 'cubierta_electrica') {
      const size = resolveCubiertaSize(draft);
      article = matchArticle(articles, ['CUBIERTA', 'ELECTRICA', 'ELEVADA', `${size}X3`]);
    } else {
      article = matchArticle(articles, def.articleMatch);
    }
    if (!article) continue;

    opcItems.push({
      id: `autoportant-opc-${def.key}`,
      description: article.name,
      unit: article.unit || def.unit,
      quantity: sel.qty,
      unitCost: (article.cost_price || 0) / 100,
      unitSale: (article.sale_price || 0) / 100,
      source: 'wizard',
      wizardKey: `autoportant_opc_${def.key}`,
      subPhase: null,
    });
  }

  return [
    { id: 'phase-piscina-autoportant', name: 'Piscina', order: 0, items: [piscinaItem, transportItem] },
    { id: 'phase-opcionals-autoportant', name: 'Opcionals', order: 1, items: opcItems },
  ];
}

/** Merge new autoportant phases with existing draft.phases so user edits
 *  (userEdited=true on qty/unitCost/unitSale, or manually added items) are preserved. */
export function mergeAutoportantPhases(
  next: BudgetPhase[],
  prev: BudgetPhase[] | undefined
): BudgetPhase[] {
  if (!prev || prev.length === 0) return next;
  return next.map((phase) => {
    const prevPhase = prev.find((p) => p.id === phase.id || p.name === phase.name);
    if (!prevPhase) return phase;
    // Keep manual items from prev; for wizard items preserve user edits.
    const manualItems = prevPhase.items.filter((i) => i.source === 'manual' && !isLegacyAutoportantGeneratedItem(i));
    const mergedWizard = phase.items.map((item) => {
      const match = prevPhase.items.find((p) => p.wizardKey && p.wizardKey === item.wizardKey);
      if (match && match.userEdited) {
        return {
          ...item,
          quantity: match.quantity,
          unitCost: match.unitCost,
          unitSale: match.unitSale,
          userEdited: true,
          description: match.description || item.description,
        };
      }
      return item;
    });
    return { ...phase, items: [...mergedWizard, ...manualItems] };
  });
}