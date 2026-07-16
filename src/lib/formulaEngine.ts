import { supabase } from '@/integrations/supabase/client';
import { parseRuleConditionGroups } from '@/lib/formulaConditions';
import { injectWizardSelectionsIntoContext } from '@/lib/wizardEquipment';

export const POOL_SURFACE_MIN_M2 = 50;

// ── Types ──────────────────────────────────────────
export interface FormulaRule {
  id: string;
  budget_type: string;
  phase: string;
  sub_phase: string | null;
  order_index: number;
  name: string;
  description: string | null;
  formula_sale: string;
  formula_cost: string | null;
  formula_quantity: string | null;
  unit: string | null;
  article_ref: string | null;
  is_active: boolean;
  is_conditional: boolean;
  condition_field: string | null;
  condition_value: string | null;
  notes: string | null;
}

export interface FormulaVariable {
  id: string;
  variable_name: string;
  label: string;
  description: string | null;
  source_field: string | null;
  category: string;
  example_value: number | null;
}

export interface FormulaResult {
  ruleId: string;
  ruleName: string;
  displayName?: string | null;
  phase: string;
  subPhase: string | null;
  unit: string | null;
  quantity: number;
  unitSale: number;
  unitCost: number;
  sale: number;
  cost: number;
  error: string | null;
  formulaUsed: string;
  variables: Record<string, any>;
}

const CONDITION_VALUE_ALIASES: Record<string, string> = {
  estandar: 'estandard',
  estándar: 'estandard',
  gresite: 'gressite',
  'lamina proof': 'lamina_proof',
};

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeConditionToken(value: unknown): string {
  const normalized = stripAccents(String(value ?? '').trim().toLowerCase());
  return CONDITION_VALUE_ALIASES[normalized] ?? normalized;
}

function normalizeArticleLookup(value: string): string {
  return stripAccents(String(value ?? '').toLowerCase()).replace(/[^a-z0-9]+/g, '');
}

function normalizeFormulaString(formulaStr: string): string {
  return formulaStr.replace(/(['"])(estandar|estándar|gresite|lamina proof)\1/gi, (_, quote: string, literal: string) => {
    const normalized = CONDITION_VALUE_ALIASES[stripAccents(literal.toLowerCase())] ?? literal;
    return `${quote}${normalized}${quote}`;
  });
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }
  return Boolean(value);
}

// ── Helper functions available inside formulas ─────
function articlePriceFactory(articles: any[]) {
  const articleIndex = new Map<string, any>();

  for (const article of articles) {
    const nameKey = normalizeArticleLookup(article.name ?? '');
    const referenceKey = normalizeArticleLookup(article.reference ?? '');

    if (nameKey && !articleIndex.has(nameKey)) {
      articleIndex.set(nameKey, article);
    }

    if (referenceKey && !articleIndex.has(referenceKey)) {
      articleIndex.set(referenceKey, article);
    }
  }

  return function articlePrice(nameOrRef: string): { sale: number; cost: number; supplyOnly: number } {
    const found = articleIndex.get(normalizeArticleLookup(nameOrRef));
    if (!found) return { sale: 0, cost: 0, supplyOnly: 0 };
    return {
      sale: (found.sale_price ?? 0) / 100,
      cost: (found.cost_price ?? 0) / 100,
      supplyOnly: (found.sale_price_supply_only ?? 0) / 100,
    };
  };
}

function roundUp(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.ceil(value * factor) / factor;
}

function roundDown(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.floor(value * factor) / factor;
}

function round(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function maxVal(a: number, b: number): number {
  return Math.max(a, b);
}

function minVal(a: number, b: number): number {
  return Math.min(a, b);
}

function ifVal(condition: boolean, trueVal: number, falseVal: number): number {
  return condition ? trueVal : falseVal;
}

// Lookup table for "a determinar" placeholder articles by model type
const TBD_REFERENCE_BY_MODEL: Record<string, (ctx: Record<string, any>) => string | null> = {
  coronament: () => 'CORONA_TBD',
  revestiment: (ctx) => {
    const tipus = String(ctx.revestiment_tipus ?? '').toLowerCase();
    const format = String(ctx.revestiment_format ?? '').toLowerCase();
    if (tipus === 'porcelanic') {
      if (format.includes('49') || format.includes('98')) return 'PORCELANIC_49_TBD';
      if (format.includes('31') || format.includes('62')) return 'PORCELANIC_31_TBD';
      return 'PORCELANIC_TBD';
    }
    if (format.includes('5x5') || format === '5x5') return 'GRESITE_5_TBD';
    return 'GRESITE_25_TBD';
  },
  opcional_revestiment: (ctx) => {
    const tipus = String(ctx.opcional_revestiment_tipus ?? '').toLowerCase();
    const format = String(ctx.opcional_revestiment_format ?? '').toLowerCase();
    if (tipus === 'porcelanic') {
      if (format.includes('49') || format.includes('98')) return 'PORCELANIC_49_TBD';
      if (format.includes('31') || format.includes('62')) return 'PORCELANIC_31_TBD';
      return 'PORCELANIC_TBD';
    }
    if (format.includes('5x5') || format === '5x5') return 'GRESITE_5_TBD';
    return 'GRESITE_25_TBD';
  },
  // Annex — Paviment perimetral (aplacat). Falls back to a placeholder article so the
  // budget always shows a line with a baseline price even when the user hasn't picked a model.
  annex_paviment: (ctx) => {
    const material = String(ctx.annex_paviment_material ?? '').toLowerCase();
    if (material !== 'aplacat') return null;
    const format = String(ctx.annex_paviment_format ?? '');
    // Map UI format labels to format-specific TBD references.
    if (format.includes('31 × 31') || format.includes('31 x 31') || format.includes('31x31')) return 'PAVIMENT_APLACAT_31x31_TBD';
    if (format.includes('31 × 62') || format.includes('31 x 62') || format.includes('31x62')) return 'PAVIMENT_APLACAT_31_TBD';
    if (format.includes('48')) return 'PAVIMENT_APLACAT_48_TBD';
    if (format.includes('98 × 98') || format.includes('98 x 98')) return 'PAVIMENT_APLACAT_98_TBD';
    // Fallback to the smallest format if user hasn't picked one yet.
    return 'PAVIMENT_APLACAT_31_TBD';
  },
};

function modelPriceFactory(articles: any[], context: Record<string, any>) {
  const byId = new Map<string, any>();
  const byRef = new Map<string, any>();
  for (const a of articles) {
    if (a.id) byId.set(String(a.id), a);
    if (a.reference) byRef.set(normalizeArticleLookup(a.reference), a);
  }

  return function modelPrice(modelType: string): { sale: number; cost: number; supplyOnly: number } {
    const isToBeDetermined = toBoolean(context[`${modelType}_model_a_determinar`]);
    const modelId = context[`${modelType}_model_id`];
    let article: any = null;

    if (!isToBeDetermined && modelId) {
      article = byId.get(String(modelId));
    }

    if (!article) {
      const tbdResolver = TBD_REFERENCE_BY_MODEL[modelType];
      const ref = tbdResolver ? tbdResolver(context) : null;
      if (ref) article = byRef.get(normalizeArticleLookup(ref));
    }

    if (!article) return { sale: 0, cost: 0, supplyOnly: 0 };
    return {
      sale: (article.sale_price ?? 0) / 100,
      cost: (article.cost_price ?? 0) / 100,
      supplyOnly: (article.sale_price_supply_only ?? 0) / 100,
    };
  };
}

function getReferenceArticleUnitPrices(
  rule: FormulaRule,
  context: Record<string, any>
): { sale: number; cost: number } | null {
  if (!rule.article_ref || !rule.formula_quantity || typeof context.articlePrice !== 'function') {
    return null;
  }

  const pricing = context.articlePrice(rule.article_ref);

  return {
    sale: Number(pricing?.sale ?? 0),
    cost: Number(pricing?.cost ?? 0),
  };
}

// ── Context builder ────────────────────────────────
export function buildVariablesContext(budget: any, articles: any[] = []): Record<string, any> {
  const poolLength = Number(budget.pool_length ?? budget.poolLength ?? 0);
  const poolWidth = Number(budget.pool_width ?? budget.poolWidth ?? 0);
  const poolDepthMin = Number(budget.pool_depth_min ?? budget.poolDepthMin ?? 0);
  const poolDepthMax = Number(budget.pool_depth_max ?? budget.poolDepthMax ?? 0);
  const poolDepthAvg = Number(budget.pool_depth_avg ?? budget.poolDepthAvg ?? ((poolDepthMin + poolDepthMax) / 2));
  const poolFloorSurface = poolLength * poolWidth;
  const poolPerimeter = 2 * (poolLength + poolWidth);
  const poolWallSurface = poolPerimeter * poolDepthAvg;
  const poolSurfaceReal = poolFloorSurface + poolWallSurface;
  // Business rule: minimum surface for SALE pricing is 50 m² (small pools still bill a baseline).
  // Cost calculations always use the REAL surface so margin reflects reality.
  // For SALE mode we substitute pool_surface/total_surface with max(real, 50) so any formula
  // (whether m² of revestiment, units of tochos, ml of coronament, etc.) reads the billed
  // surface naturally — no post-clamp needed.
  const useBilledSurface = (budget as any).__pricingMode === 'sale';
  const poolSurface = useBilledSurface ? Math.max(poolSurfaceReal, POOL_SURFACE_MIN_M2) : poolSurfaceReal;
  const poolVolume = Number(budget.pool_volume_liters ?? budget.poolVolumeLiters ?? (poolLength * poolWidth * poolDepthAvg * 1000));

  const extStairLength = Number(budget.ext_stairs_length ?? budget.ext_stair_length ?? budget.extStairsLength ?? 0);
  const extStairWidth = Number(budget.ext_stairs_width ?? budget.ext_stair_width ?? budget.extStairsWidth ?? 0);
  const hasExteriorStair = toBoolean(budget.has_exterior_stairs ?? budget.has_exterior_stair ?? budget.hasExteriorStairs ?? false);
  const extStairSurface = hasExteriorStair ? extStairLength * extStairWidth : 0;

  const stairsWidth = Number(budget.stairs_width ?? budget.stairsWidth ?? 0);
  const stairsLength = Number(budget.stairs_length ?? budget.stairsLength ?? 0);
  const stairsHeight = Number(budget.stairs_height ?? budget.stairsHeight ?? 0);

  const platformLength = Number(budget.platform_length ?? budget.platformLength ?? 0);
  const platformWidth = Number(budget.platform_width ?? budget.platformWidth ?? 0);
  const platformHeight = Number(budget.platform_height ?? budget.platformHeight ?? 0);

  const benchLength = Number(budget.bench_length ?? budget.benchLength ?? 0);
  const benchWidth = Number(budget.bench_width ?? budget.benchWidth ?? 0);
  const benchHeight = Number(budget.bench_height ?? budget.benchHeight ?? 0);

  // Coronament ML: same formula as StepAcabats
  // base = (((LARGO+W)*2)+2) + (((ANCHO+W)*2)+2)
  // W depends on coronament type (0.3, 0.4 or 0.5)
  // if exterior stairs: + (((LARGO_ESCALERA*2)+0.6)+2)
  let coronamentMl = Number(budget.coronament_ml ?? budget.coronamentMl ?? 0);
  const coronamentTipusEarly = budget.coronament_tipus ?? budget.coronamentTipus ?? '';
  const coronamentPieceWidth =
    coronamentTipusEarly === 'gres_50x62' || coronamentTipusEarly === 'gres_98x50' ? 0.5 :
    coronamentTipusEarly === 'pedra_blanca' || coronamentTipusEarly === 'breinco' ? 0.4 :
    0.3;
  if (coronamentMl === 0 && (poolLength > 0 || poolWidth > 0)) {
    coronamentMl = (((poolLength + coronamentPieceWidth) * 2) + 2) + (((poolWidth + coronamentPieceWidth) * 2) + 2);
    if (hasExteriorStair && extStairLength > 0) {
      coronamentMl += ((extStairLength * 2) + 0.6) + 2;
    }
    coronamentMl = Math.round(coronamentMl * 100) / 100;
  }
  const totalSurfaceReal = Math.ceil(poolSurfaceReal + extStairSurface);
  const totalSurface = useBilledSurface ? Math.max(totalSurfaceReal, POOL_SURFACE_MIN_M2) : totalSurfaceReal;
  // Flag exposed via context (kept for backward compat / debugging only).
  const surfaceBelowMin = useBilledSurface && totalSurfaceReal < POOL_SURFACE_MIN_M2;

  const constructionSystem = budget.construction_system ?? budget.constructionSystem ?? '';
  const waterproofingSystem = budget.waterproofing_system ?? budget.waterproofingSystem ?? '';
  const interiorStairType = budget.interior_stairs_type ?? budget.interiorStairsType ?? '';
  const guniteMangueraMetres = Number(budget.gunite_manguera_metres ?? budget.guniteMangueraMetres ?? 0);
  const guniteDistanciaKm = Number(budget.gunite_distancia_km ?? budget.guniteDistanciaKm ?? 0);

  // Pool disposition (enterrada / semi_enterrada / elevada) + altura vista.
  const poolDisposition = String(budget.pool_disposition ?? budget.poolDisposition ?? 'enterrada');
  const alturaVista = Number(budget.altura_vista ?? budget.alturaVista ?? 0);
  // Superfície exterior del vas que queda vista (per rebosat en semi-enterrada):
  // perímetre * altura vista.
  const exteriorWallSurface = poolDisposition === 'semi_enterrada' && alturaVista > 0
    ? round(poolPerimeter * alturaVista, 2)
    : 0;

  // Acabats
  const coronamentTipus = budget.coronament_tipus ?? budget.coronamentTipus ?? '';
  const coronamentFormat = budget.coronament_format ?? budget.coronamentFormat ?? '';
  const coronamentActuacio = budget.coronament_actuacio ?? budget.coronamentActuacio ?? '';
  const revestimentTipus = budget.revestiment_tipus ?? budget.revestimentTipus ?? '';
  const revestimentFormat = budget.revestiment_format ?? budget.revestimentFormat ?? '';
  const revestimentActuacio = budget.revestiment_actuacio ?? budget.revestimentActuacio ?? '';
  const revestimentQualitat = budget.revestiment_qualitat ?? budget.revestimentQualitat ?? '';
  const coronamentBeurada = budget.coronament_beurada ?? budget.coronamentBeurada ?? '';
  const revestimentBeurada = budget.revestiment_beurada ?? budget.revestimentBeurada ?? '';

  // Model selections (IDs + a_determinar flags)
  const coronamentModelId = budget.coronament_model_id ?? budget.coronamentModelId ?? null;
  const coronamentADeterminar = toBoolean(budget.coronament_model_a_determinar ?? budget.coronamentModelADeterminar ?? false);
  const revestimentModelId = budget.revestiment_model_id ?? budget.revestimentModelId ?? null;
  const revestimentADeterminar = toBoolean(budget.revestiment_model_a_determinar ?? budget.revestimentModelADeterminar ?? false);
  const opcionalRevestimentTipus = budget.opcional_revestiment_tipus ?? budget.opcionalRevestimentTipus ?? '';
  const opcionalRevestimentFormat = budget.opcional_revestiment_format ?? budget.opcionalRevestimentFormat ?? '';
  const opcionalRevestimentModelId = budget.opcional_revestiment_model_id ?? budget.opcionalRevestimentModelId ?? null;

  // Accessori quantities
  const accImpulsorsQty = Number(budget.acc_impulsors_qty ?? budget.accImpulsorsQty ?? 0);
  const accSkimmersQty = Number(budget.acc_skimmers_qty ?? budget.accSkimmersQty ?? 0);
  const accEmbornalQty = Number(budget.acc_embornal_qty ?? budget.accEmbornalQty ?? 0);
  const accFocusLedQty = Number(budget.acc_focus_led_qty ?? budget.accFocusLedQty ?? 0);
  const accReguladorQty = Number(budget.acc_regulador_qty ?? budget.accReguladorQty ?? 0);
  const accNetejafonsQty = Number(budget.acc_netejafons_qty ?? budget.accNetejafonsQty ?? 0);
  const accProjectorMiniLedQty = Number(budget.acc_projector_mini_led_qty ?? budget.accProjectorMiniLedQty ?? 0);
  const accControlRgbQty = Number(budget.acc_control_rgb_qty ?? budget.accControlRgbQty ?? 0);

  // Cobertor — mur nou (afecta superfície de revestiment interior).
  // Quan el cobertor submergit requereix muro nou, els dos costats del mur
  // (cara interior + cara exterior) s'han de revestir igual que la piscina.
  const annexCobertorModelCode = String(
    budget.annex_cobertor_model_code ?? (budget as any).annexCobertorModelCode ?? '',
  ).toLowerCase();
  // S-Premium / S-Premium CS sempre porten muro nou obligatori.
  const isSPremiumForcedWall =
    annexCobertorModelCode === 's-premium' || annexCobertorModelCode === 's-premium-cs';
  const annexCobertorMurNou =
    isSPremiumForcedWall ||
    toBoolean(budget.annex_cobertor_mur_nou ?? (budget as any).annexCobertorMurNou ?? false);
  let annexCobertorMurM2 = Number(budget.annex_cobertor_mur_m2 ?? (budget as any).annexCobertorMurM2 ?? 0);
  // Safety net: recompute m² del mur si manca però el muro és obligatori (model s-Premium).
  if (annexCobertorMurNou && (!annexCobertorMurM2 || annexCobertorMurM2 <= 0)) {
    annexCobertorMurM2 = Math.round(poolWidth * poolDepthAvg * 100) / 100;
  }
  const annexCobertorMurExtraM2 = annexCobertorMurNou ? annexCobertorMurM2 * 2 : 0;
  const revestimentSurfaceM2 = totalSurface + annexCobertorMurExtraM2;
  const revestimentSurfaceRealM2 = totalSurfaceReal + annexCobertorMurExtraM2;

  const context: Record<string, any> = {
    // Pool dimensions
    pool_length: poolLength,
    pool_width: poolWidth,
    pool_depth_min: poolDepthMin,
    pool_depth_max: poolDepthMax,
    pool_depth_avg: poolDepthAvg,
    pool_floor_surface: poolFloorSurface,
    pool_wall_surface: poolWallSurface,
    pool_surface: poolSurface,
    pool_surface_real: poolSurfaceReal,
    pool_perimeter: poolPerimeter,
    pool_volume_liters: poolVolume,
    total_surface: totalSurface,
    total_surface_real: totalSurfaceReal,
    // Revestiment interior surface — same as total_surface but adds (mur_m2 × 2)
    // when the submerged cover requires building a new wall.
    revestiment_surface_m2: revestimentSurfaceM2,
    revestiment_surface_real_m2: revestimentSurfaceRealM2,
    annex_cobertor_mur_extra_m2: annexCobertorMurExtraM2,
    // Stairs
    has_exterior_stair: hasExteriorStair,
    ext_stair_length: extStairLength,
    ext_stair_width: extStairWidth,
    ext_stair_surface: extStairSurface,
    interior_stair_type: interiorStairType,
    stairs_width: stairsWidth,
    stairs_length: stairsLength,
    stairs_height: stairsHeight,
    // Platform & bench
    platform_length: platformLength,
    platform_width: platformWidth,
    platform_height: platformHeight,
    bench_length: benchLength,
    bench_width: benchWidth,
    bench_height: benchHeight,
    // Construction
    construction_system: constructionSystem,
    waterproofing_system: waterproofingSystem,
    coronament_ml: coronamentMl,
    // Disposició + altura vista (semi-enterrada)
    pool_disposition: poolDisposition,
    altura_vista: alturaVista,
    exterior_wall_surface: exteriorWallSurface,
    // Gunite-specific
    gunite_manguera_metres: guniteMangueraMetres,
    gunite_distancia_km: guniteDistanciaKm,
    // Acabats
    coronament_tipus: coronamentTipus,
    coronament_format: coronamentFormat,
    coronament_actuacio: coronamentActuacio,
    coronament_beurada: coronamentBeurada,
    coronament_model_id: coronamentModelId,
    coronament_model_a_determinar: coronamentADeterminar,
    revestiment_tipus: revestimentTipus,
    revestiment_format: revestimentFormat,
    revestiment_actuacio: revestimentActuacio,
    revestiment_qualitat: revestimentQualitat,
    revestiment_beurada: revestimentBeurada,
    revestiment_model_id: revestimentModelId,
    revestiment_model_a_determinar: revestimentADeterminar,
    opcional_revestiment_tipus: opcionalRevestimentTipus,
    opcional_revestiment_format: opcionalRevestimentFormat,
    opcional_revestiment_model_id: opcionalRevestimentModelId,
    // Accessoris
    acc_impulsors_qty: accImpulsorsQty,
    acc_skimmers_qty: accSkimmersQty,
    acc_embornal_qty: accEmbornalQty,
    acc_focus_led_qty: accFocusLedQty,
    acc_regulador_qty: accReguladorQty,
    acc_netejafons_qty: accNetejafonsQty,
    acc_projector_mini_led_qty: accProjectorMiniLedQty,
    acc_control_rgb_qty: accControlRgbQty,
    // Helpers
    articlePrice: articlePriceFactory(articles),
    roundUp,
    roundDown,
    round,
    maxVal,
    minVal,
    ifVal,
    // Internal flags (used by the rule evaluator, not directly by formulas)
    __pricingMode: useBilledSurface ? 'sale' : 'cost',
    __surfaceBelowMin: surfaceBelowMin,
  };

  // modelPrice needs access to context (model IDs / a_determinar flags)
  context.modelPrice = modelPriceFactory(articles, context);

  // Helper to resolve the picked-article name for a given model type ('coronament', 'revestiment',
  // 'annex_paviment', etc.). Returns null when the user hasn't picked a real article (TBD).
  context.__resolveModelArticleName = (modelType: string): string | null => {
    const isToBeDetermined = toBoolean(context[`${modelType}_model_a_determinar`]);
    const modelId = context[`${modelType}_model_id`];
    if (isToBeDetermined || !modelId) return null;
    const article = articles.find((a: any) => String(a.id) === String(modelId));
    return article?.name ?? null;
  };

  // Inject wizard equipment selections (instal·lacions, accessoris, annex cross-phase).
  injectWizardSelectionsIntoContext(context, budget, articles);

  return context;
}

// ── Formula evaluator ──────────────────────────────
export function evaluateFormula(
  formulaStr: string,
  context: Record<string, any>
): { value: number; error: string | null } {
  try {
    const keys = Object.keys(context);
    const values = Object.values(context);
    const normalizedFormula = normalizeFormulaString(formulaStr);
    // Security: reject formulas that contain JS constructs outside the math/expression sandbox.
    // Formulas are stored by admins but executed in every user's browser, so an injection
    // here would let a compromised admin run arbitrary JS for all staff.
    const FORBIDDEN_IDENT = /\b(new|function|eval|constructor|prototype|window|globalThis|document|fetch|XMLHttpRequest|setTimeout|setInterval|setImmediate|Function|require|import|export|process|Deno|self|top|parent|location|alert|atob|btoa|navigator|localStorage|sessionStorage|indexedDB|WebSocket|EventSource|postMessage|console|chrome|trustedTypes|__proto__|this)\b/;
    if (FORBIDDEN_IDENT.test(normalizedFormula)) {
      return { value: 0, error: 'Fórmula no permesa (identificador prohibit)' };
    }
    if (/[\[\]`;{}\\]/.test(normalizedFormula)) {
      return { value: 0, error: 'Fórmula no permesa (caràcter prohibit)' };
    }
    if (/=>/.test(normalizedFormula) || /(?<![<>!=])=(?!=)/.test(normalizedFormula)) {
      return { value: 0, error: 'Fórmula no permesa (assignació)' };
    }
    const fn = new Function(...keys, `"use strict"; return (${normalizedFormula});`);
    const result = fn(...values);
    if (typeof result !== 'number' || isNaN(result)) {
      return { value: 0, error: `Resultat no numèric: ${result}` };
    }
    return { value: result, error: null };
  } catch (err: any) {
    return { value: 0, error: err.message };
  }
}

// ── Check if a conditional rule applies ────────────
export function ruleApplies(rule: FormulaRule, context: Record<string, any>): boolean {
  if (!rule.is_conditional) return true;
  const groups = parseRuleConditionGroups(rule);
  if (groups.length === 0) return true;

  const matcher = (pair: { field: string; value: string; op?: string }) => {
    const raw = context[pair.field];
    const op = pair.op ?? 'eq';
    if (op === 'is_true') return raw === true || normalizeConditionToken(raw) === 'true';
    if (op === 'is_false') {
      // Treat null/undefined/empty as falsy too, matching usual intent in conditions.
      if (raw === false || raw === null || raw === undefined || raw === '') return true;
      return normalizeConditionToken(raw) === 'false';
    }
    const fieldVal = normalizeConditionToken(raw);
    const expected = normalizeConditionToken(pair.value);
    if (op === 'neq') return fieldVal !== expected;
    return fieldVal === expected;
  };

  // AND across groups, OR within each group.
  return groups.every((g) => g.pairs.some(matcher));
}

export function evaluateFormulaRuleWithContext(
  rule: FormulaRule,
  context: Record<string, any>,
  options?: { defaultCostRatio?: number; costContext?: Record<string, any> }
): FormulaResult | null {
  if (!ruleApplies(rule, context)) return null;

  const defaultCostRatio = options?.defaultCostRatio ?? 0.65;
  const costContext = options?.costContext ?? context;
  const referenceArticleUnitPrices = getReferenceArticleUnitPrices(rule, context);

  // Quantity for SALE side (context already has pool_surface/total_surface clamped to min 50 m²)
  let saleQuantity = 1;
  let quantityError: string | null = null;

  // Detect if this rule's quantity formula references surface variables — if so, and we're below
  // the 50 m² minimum, we must clamp the final billed quantity to exactly 50 (no waste % on top).
  const qtyFormula = rule.formula_quantity ?? '';
  const referencesSurface = /\b(pool_surface|total_surface)\b/.test(qtyFormula);
  const surfaceBelowMin = Boolean(context.__surfaceBelowMin);

  if (rule.formula_quantity) {
    const qtyResult = evaluateFormula(rule.formula_quantity, context);
    if (qtyResult.error) {
      quantityError = qtyResult.error;
    } else {
      let q = Math.max(0, qtyResult.value);
      // Floor billed surface-based quantities to the minimum (50 m²) — strip the waste %.
      if (referencesSurface && surfaceBelowMin && q > POOL_SURFACE_MIN_M2) {
        q = POOL_SURFACE_MIN_M2;
      }
      saleQuantity = round(q, 2);
    }
  }

  // Quantity for COST side (uses real surface, no clamp)
  let costQuantity = saleQuantity;
  if (rule.formula_quantity && context !== costContext) {
    const qtyCostResult = evaluateFormula(rule.formula_quantity, costContext);
    if (!qtyCostResult.error) {
      costQuantity = round(Math.max(0, qtyCostResult.value), 2);
    }
  }

  let saleResult = { value: 0, error: null as string | null };
  let costResult = { value: 0, error: null as string | null };

  if (referenceArticleUnitPrices) {
    saleResult.value = referenceArticleUnitPrices.sale;
    costResult.value = referenceArticleUnitPrices.cost;
  } else {
    saleResult = evaluateFormula(rule.formula_sale, context);

    if (rule.formula_cost) {
      costResult = evaluateFormula(rule.formula_cost, costContext);
    } else {
      costResult.value = saleResult.value * defaultCostRatio;
    }
  }

  const unitSale = round(saleResult.value);
  const unitCost = round(costResult.value);

  // If the rule's sale formula uses modelPrice('xxx') and the user picked a real article,
  // override the display name with the article's actual name so the budget shows the model
  // (e.g. "PORCELANIC CORAL BLUE 49x98") instead of the generic rule label.
  let displayName: string | null = null;
  const modelPriceMatch = /modelPrice\(\s*['"]([^'"]+)['"]\s*\)/.exec(rule.formula_sale || '');
  if (modelPriceMatch && typeof context.__resolveModelArticleName === 'function') {
    const resolved = context.__resolveModelArticleName(modelPriceMatch[1]);
    if (resolved) displayName = resolved;
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    displayName,
    phase: rule.phase,
    subPhase: rule.sub_phase,
    unit: rule.unit,
    quantity: saleQuantity,
    unitSale,
    unitCost,
    sale: round(unitSale * saleQuantity),
    cost: round(unitCost * costQuantity),
    error: quantityError || saleResult.error || costResult.error,
    formulaUsed: referenceArticleUnitPrices
      ? `articlePrice('${rule.article_ref}').sale × ${rule.formula_quantity}`
      : rule.formula_sale,
    variables: {
      ...context,
      articlePrice: undefined,
      modelPrice: undefined,
      roundUp: undefined,
      roundDown: undefined,
      round: undefined,
      maxVal: undefined,
      minVal: undefined,
      ifVal: undefined,
      __pricingMode: undefined,
      __surfaceBelowMin: undefined,
      __resolveModelArticleName: undefined,
    },
  };
}

export function evaluateFormulaRules(
  rules: FormulaRule[],
  budget: any,
  articles: any[]
): FormulaResult[] {
  if (!rules || rules.length === 0) return [];

  const saleContext = buildVariablesContext({ ...budget, __pricingMode: 'sale' }, articles);
  const costContext = buildVariablesContext({ ...budget, __pricingMode: 'cost' }, articles);
  const primary = rules
    .map((rule) => evaluateFormulaRuleWithContext(rule, saleContext, { costContext }))
    .filter((result): result is FormulaResult => result !== null);

  // ── Segona passada: escala d'accés exterior (piscina semi-enterrada) ──
  // Reutilitza exactament les mateixes fórmules de la subfase "escala" dins
  // d'Estructura, però alimentades amb les dimensions de l'escala d'accés
  // exterior i tractant-la sempre com a "plataforma" (escala + plataforma).
  const disposition = String(budget.pool_disposition ?? budget.poolDisposition ?? 'enterrada');
  const hasAccess = toBoolean(budget.has_access_stair ?? budget.hasAccessStair ?? false);
  if (disposition === 'semi_enterrada' && hasAccess) {
    const alt = Number(budget.altura_vista ?? budget.alturaVista ?? 0);
    const stairW = Number(budget.access_stair_width ?? budget.accessStairWidth ?? 0.70);
    // The draft carries only accessTotalLength + accessStairWidth; recompute the
    // stair/platform breakdown here so it works both from the wizard (camelCase
    // draft) and from a saved budget (snake_case row).
    const poolWidthLocal = Number(budget.pool_width ?? budget.poolWidth ?? 0);
    const totalLen = Number(
      budget.access_total_length
        ?? budget.accessTotalLength
        ?? ((Number(budget.access_stair_length ?? 0) + Number(budget.access_platform_length ?? 0)) || (poolWidthLocal + 0.60)),
    );
    const steps = alt > 0 ? Math.max(0, (alt / 0.20) - 1) : 0;
    const stairL = Math.round(steps * 0.30 * 100) / 100;
    const platW = Number(budget.access_platform_width ?? stairW);
    const platL = Math.max(0, Math.round((totalLen - stairL) * 100) / 100);
    if (alt > 0 && stairW > 0) {
      const stairRules = rules.filter(
        (r) => r.phase === 'estructura' && (r.sub_phase || '').toLowerCase() === 'escala',
      );
      if (stairRules.length > 0) {
        const overrides = {
          interior_stairs_type: 'plataforma',
          interiorStairsType: 'plataforma',
          stairs_width: stairW,
          stairs_length: stairL,
          stairs_height: alt,
          platform_width: platW,
          platform_length: platL,
          platform_height: alt,
          bench_width: 0,
          bench_length: 0,
          bench_height: 0,
          // Les fórmules d'escala fan servir pool_depth_min per calcular
          // peldaños/superfície — la substituïm per l'altura vista.
          pool_depth_min: alt,
          // Force acabat porcelànic per a l'escala exterior d'accés: mai
          // s'aplacarà amb gresite (que activaria BORDILLO JARDIN). Així,
          // la partida MASSÍS GRIS és la que apareix per l'escala d'accés.
          revestiment_tipus: 'porcelanic',
          revestimentTipus: 'porcelanic',
        };
        const altSale = buildVariablesContext(
          { ...budget, ...overrides, __pricingMode: 'sale' },
          articles,
        );
        const altCost = buildVariablesContext(
          { ...budget, ...overrides, __pricingMode: 'cost' },
          articles,
        );
        const extResults = stairRules
          .map((rule) => evaluateFormulaRuleWithContext(rule, altSale, { costContext: altCost }))
          .filter((r): r is FormulaResult => r !== null)
          .map((r) => ({
            ...r,
            ruleId: `${r.ruleId}::ext-access`,
            subPhase: "Escala exterior d'accés",
          }));
        return withExteriorRevestiment([...primary, ...extResults], rules, budget, articles);
      }
    }
  }

  return withExteriorRevestiment(primary, rules, budget, articles);
}

/**
 * Third pass: exterior pool-wall revestiment (piscines semi-enterrades /
 * elevades amb la superfície vista revestida). Reutilitza EXACTAMENT les
 * regles de la subfase "revestiment" d'acabats, però substitueix les
 * variables de superfície per la superfície exterior del vas
 * (perímetre × altura vista) i força el tipus a porcelànic (mai gressite).
 */
function withExteriorRevestiment(
  primary: FormulaResult[],
  rules: FormulaRule[],
  budget: any,
  articles: any[],
): FormulaResult[] {
  const inclos = toBoolean(
    budget.revestiment_exterior_inclos ?? budget.revestimentExteriorInclos ?? false,
  );
  if (!inclos) return primary;

  const poolLength = Number(budget.pool_length ?? budget.poolLength ?? 0);
  const poolWidth = Number(budget.pool_width ?? budget.poolWidth ?? 0);
  const alt = Number(budget.altura_vista ?? budget.alturaVista ?? 0);
  if (alt <= 0 || (poolLength <= 0 && poolWidth <= 0)) return primary;

  const perimeter = 2 * (poolLength + poolWidth);
  let extSurface = round(perimeter * alt, 2);
  if (extSurface <= 0) return primary;

  // ── Escala + plataforma d'accés exterior ──
  // Si el client té activada l'escala d'accés exterior, reutilitzem la
  // mateixa lògica de PIEZA L / MANO DE OBRA ESCALERA / BANCO-PLATAFORMA
  // que ja existeix per l'escala interior porcelànica, però alimentada
  // amb les dimensions de l'escala + plataforma exterior. A més sumem
  // la superfície horitzontal de la plataforma al total revestit.
  const hasAccess = toBoolean(budget.has_access_stair ?? budget.hasAccessStair ?? false);
  const disposition = String(budget.pool_disposition ?? budget.poolDisposition ?? 'enterrada');
  const accessStairWidth = Number(budget.access_stair_width ?? budget.accessStairWidth ?? 0.70);
  const accessTotalLength = Number(
    budget.access_total_length
      ?? budget.accessTotalLength
      ?? ((Number(budget.access_stair_length ?? 0) + Number(budget.access_platform_length ?? 0)) || (poolWidth + 0.60)),
  );
  const accessSteps = alt > 0 ? Math.max(0, (alt / 0.20) - 1) : 0;
  const accessStairLength = Math.round(accessSteps * 0.30 * 100) / 100;
  const accessPlatformWidth = Number(budget.access_platform_width ?? accessStairWidth);
  const accessPlatformLength = Math.max(0, Math.round((accessTotalLength - accessStairLength) * 100) / 100);
  const accessActive = disposition === 'semi_enterrada' && hasAccess && alt > 0 && accessStairWidth > 0;
  const platformSurface = accessActive
    ? round(accessPlatformWidth * accessPlatformLength, 2)
    : 0;
  if (platformSurface > 0) extSurface = round(extSurface + platformSurface, 2);

  const revestimentRules = rules.filter(
    (r) => r.phase === 'acabats' && (r.sub_phase || '').toLowerCase() === 'revestiment',
  );
  if (revestimentRules.length === 0) return primary;

  const overrides: Record<string, any> = {
    // Sempre porcelànic per l'exterior (mai gressite).
    revestiment_tipus: 'porcelanic',
    revestimentTipus: 'porcelanic',
    // Borada normal (l'exterior no és epoxi). L'única partida que
    // substituïm per la seva versió +EPOXI és la mà d'obra (veure sota).
    revestiment_beurada: 'normal',
    revestimentBeurada: 'normal',
    revestiment_format:
      budget.revestiment_exterior_format ?? budget.revestimentExteriorFormat ?? '',
    revestimentFormat:
      budget.revestiment_exterior_format ?? budget.revestimentExteriorFormat ?? '',
    revestiment_model_id:
      budget.revestiment_exterior_model_id ?? budget.revestimentExteriorModelId ?? null,
    revestimentModelId:
      budget.revestiment_exterior_model_id ?? budget.revestimentExteriorModelId ?? null,
    revestiment_model_a_determinar:
      budget.revestiment_exterior_model_a_determinar
      ?? budget.revestimentExteriorModelADeterminar
      ?? !(budget.revestiment_exterior_model_id ?? budget.revestimentExteriorModelId),
    // Escala d'accés exterior: reutilitzem l'estructura de "plataforma"
    // perquè s'activin PIEZA L, MANO DE OBRA ESCALERA i MANO DE OBRA
    // BANCO/PLATAFORMA amb les dimensions correctes. Si no hi ha escala
    // d'accés, ho deixem com "sense" perquè no s'afegeixi cap partida.
    interior_stair_type: accessActive ? 'plataforma' : 'sense',
    interior_stairs_type: accessActive ? 'plataforma' : 'sense',
    interiorStairsType: accessActive ? 'plataforma' : 'sense',
    stairs_width: accessActive ? accessStairWidth : 0,
    stairs_length: accessActive ? accessStairLength : 0,
    stairs_height: accessActive ? alt : 0,
    platform_width: accessActive ? accessPlatformWidth : 0,
    platform_length: accessActive ? accessPlatformLength : 0,
    platform_height: accessActive ? alt : 0,
    bench_width: 0,
    bench_length: 0,
    bench_height: 0,
    // PIEZA L usa pool_depth_min per calcular els peldaños; per l'exterior
    // la profunditat efectiva és l'altura vista.
    pool_depth_min: alt,
    // Sense skimmers extra ni mur del cobertor.
    acc_skimmers_qty: 0,
    annex_cobertor_mur_nou: false,
    annex_cobertor_mur_m2: 0,
  };

  const buildCtx = (mode: 'sale' | 'cost') => {
    const ctx = buildVariablesContext({ ...budget, ...overrides, __pricingMode: mode }, articles);
    // Substituïm les superfícies pel valor exterior perquè totes les fórmules
    // (m² de revestiment, cola, borada, epoxi, mà d'obra...) treballin sobre
    // la superfície visible del vas.
    ctx.pool_surface = extSurface;
    ctx.pool_surface_real = extSurface;
    ctx.total_surface = extSurface;
    ctx.total_surface_real = extSurface;
    ctx.revestiment_surface_m2 = extSurface;
    ctx.revestiment_surface_real_m2 = extSurface;
    ctx.annex_cobertor_mur_extra_m2 = 0;
    ctx.__surfaceBelowMin = false;
    return ctx;
  };

  const extSale = buildCtx('sale');
  const extCost = buildCtx('cost');

  // Substitució de mà d'obra: a l'exterior no fem servir MANO DE OBRA
  // (PORCELANICO) sinó MANO DE OBRA (PORCELANICO + EPOXI) — mateixa
  // fórmula/preu comercial però sense canviar el tipus de borada real.
  const isManoObraPorcelanic = (r: FormulaRule) =>
    r.name.trim().toUpperCase() === 'MANO DE OBRA (PORCELANICO)';
  const isManoObraPorcelanicEpoxi = (r: FormulaRule) =>
    r.name.trim().toUpperCase() === 'MANO DE OBRA (PORCELANICO + EPOXI)';

  const epoxiOverrides = { ...overrides, revestiment_beurada: 'epoxi', revestimentBeurada: 'epoxi' };
  const epoxiSale = (() => {
    const ctx = buildVariablesContext({ ...budget, ...epoxiOverrides, __pricingMode: 'sale' }, articles);
    ctx.pool_surface = extSurface;
    ctx.pool_surface_real = extSurface;
    ctx.total_surface = extSurface;
    ctx.total_surface_real = extSurface;
    ctx.revestiment_surface_m2 = extSurface;
    ctx.revestiment_surface_real_m2 = extSurface;
    ctx.annex_cobertor_mur_extra_m2 = 0;
    ctx.__surfaceBelowMin = false;
    return ctx;
  })();
  const epoxiCost = (() => {
    const ctx = buildVariablesContext({ ...budget, ...epoxiOverrides, __pricingMode: 'cost' }, articles);
    ctx.pool_surface = extSurface;
    ctx.pool_surface_real = extSurface;
    ctx.total_surface = extSurface;
    ctx.total_surface_real = extSurface;
    ctx.revestiment_surface_m2 = extSurface;
    ctx.revestiment_surface_real_m2 = extSurface;
    ctx.annex_cobertor_mur_extra_m2 = 0;
    ctx.__surfaceBelowMin = false;
    return ctx;
  })();

  const extResults = revestimentRules
    .map((rule) => {
      if (isManoObraPorcelanic(rule)) return null; // sempre skip a l'exterior
      if (isManoObraPorcelanicEpoxi(rule)) {
        return evaluateFormulaRuleWithContext(rule, epoxiSale, { costContext: epoxiCost });
      }
      return evaluateFormulaRuleWithContext(rule, extSale, { costContext: extCost });
    })
    .filter((r): r is FormulaResult => r !== null)
    .map((r) => ({
      ...r,
      ruleId: `${r.ruleId}::ext-revestiment`,
      subPhase: 'Revestiment exterior',
    }));

  return [...primary, ...extResults];
}

// ── Run all rules for a budget ─────────────────────
export async function runFormulaEngine(
  budgetType: string,
  budget: any,
  articles: any[]
): Promise<FormulaResult[]> {
  const { data: rules } = await supabase
    .from('formula_rules')
    .select('*')
    .eq('budget_type', budgetType)
    .eq('is_active', true)
    .order('phase')
    .order('order_index');

  if (!rules || rules.length === 0) return [];

  return evaluateFormulaRules(rules as FormulaRule[], budget, articles);
}

// ── Log execution to audit table ───────────────────
export async function logFormulaExecution(
  budgetId: string,
  results: FormulaResult[]
): Promise<void> {
  const rows = results.map((r) => ({
    budget_id: budgetId,
    rule_id: r.ruleId,
    formula_used: r.formulaUsed,
    variables_snapshot: r.variables,
    result_sale: r.sale,
    result_cost: r.cost,
  }));

  if (rows.length > 0) {
    await supabase.from('formula_execution_log').insert(rows as any);
  }
}

// ── Default simulation values ──────────────────────
export const DEFAULT_SIM_VALUES: Record<string, any> = {
  pool_length: 8,
  pool_width: 4,
  pool_depth_min: 1.2,
  pool_depth_max: 1.6,
  pool_depth_avg: 1.4,
  pool_floor_surface: 32,
  pool_wall_surface: 33.6,
  pool_surface: 65.6,
  pool_perimeter: 24,
  pool_volume_liters: 44800,
  total_surface: 66,
  coronament_ml: 29.2,
  has_exterior_stair: false,
  ext_stair_length: 0,
  ext_stair_width: 0,
  ext_stair_surface: 0,
  interior_stair_type: 'estandard',
  stairs_width: 2,
  stairs_length: 1.5,
  stairs_height: 0.8,
  platform_length: 0,
  platform_width: 0,
  platform_height: 0,
  bench_length: 0,
  bench_width: 0,
  bench_height: 0,
  construction_system: 'gunite',
  waterproofing_system: 'impertot',
  gunite_manguera_metres: 30,
  gunite_distancia_km: 0,
  
  coronament_tipus: '',
  coronament_format: '',
  coronament_actuacio: '',
  revestiment_tipus: '',
  revestiment_format: '',
  revestiment_actuacio: '',
  acc_impulsors_qty: 2,
  acc_skimmers_qty: 2,
  acc_embornal_qty: 1,
  acc_focus_led_qty: 2,
  acc_regulador_qty: 1,
  acc_netejafons_qty: 1,
  acc_projector_mini_led_qty: 0,
  acc_control_rgb_qty: 0,
};
