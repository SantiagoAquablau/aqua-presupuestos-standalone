import type { FormulaResult } from '@/lib/formulaEngine';
import type { BudgetItem, BudgetPhase, BudgetDraft } from '@/stores/budgetStore';

/**
 * Drop coronament / revestiment formula results when the wizard has marked
 * those sub-phases as "no inclòs". Returns the same array reference when no
 * filtering is required.
 */
export function filterAcabatsInclusion(
  results: FormulaResult[],
  draft: Partial<BudgetDraft>,
): FormulaResult[] {
  const coronaOff = draft.coronamentInclos === false;
  const revestOff = draft.revestimentInclos === false;
  if (!coronaOff && !revestOff) return results;
  return results.filter((r) => {
    if (r.phase !== 'acabats') return true;
    const sp = String(r.subPhase || '').toLowerCase();
    if (coronaOff && sp.includes('coronament')) return false;
    if (revestOff && sp.includes('revestiment')) return false;
    return true;
  });
}

function normalizeName(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isGunitadoraItem(description: string): boolean {
  const n = normalizeName(description);
  return n.includes('mano de obra') && n.includes('gunitadora');
}

function isHormigonD400Item(description: string): boolean {
  const n = normalizeName(description);
  return n.includes('hormigon') && n.includes('d 400') && n.includes('fibra');
}

function isManoObraExcavacioItem(description: string): boolean {
  const n = normalizeName(description);
  return n.includes('mano de obra') && n.includes('excavac');
}

const MANO_OBRA_EXCAVACIO_MIN_SALE = 3300;

/**
 * Resolve the sale total for the "MANO DE OBRA EXCAVACION" partide. Only
 * applies when the Annex Excavació section is active.
 *
 * Source of truth, in priority order:
 * 1. A manual edit made directly on the Partides line (`item.userEdited`).
 * 2. The Annex step's "Import mà d'obra" override
 *    (`draft.annexExcavacioManoObraOverride`) — read directly here rather
 *    than via a flag, so it stays authoritative across recalculations
 *    without needing to be mirrored into `item.userEdited`.
 * 3. The automatic 455 €/ud calculation, floored at a 3.300 € minimum sale
 *    (mirrors the 930 € minimum applied to "Re-ompliment de terres" in
 *    wizardLines.ts).
 *
 * The unit price is derived from the resolved total (total / quantity) and
 * unitCost recomputed as unitSale / 1.3 to keep the standard 30% margin used
 * by the formula engine.
 */
function applyExcavacioMinimums(phases: BudgetPhase[], draft: Partial<BudgetDraft>): BudgetPhase[] {
  const estat = (draft as any).annexExcavacioEstat;
  if (estat !== 'inclos' && estat !== 'opcional') return phases;

  const overrideRaw = (draft as any).annexExcavacioManoObraOverride;
  const hasOverride = overrideRaw != null && Number.isFinite(Number(overrideRaw));
  const overrideTotal = Number(overrideRaw);

  return phases.map((phase) => ({
    ...phase,
    items: (phase.items || []).map((item) => {
      if (!isManoObraExcavacioItem(item.description)) return item;
      // Respect manual edits made directly on the Partides line.
      if (item.userEdited) return item;
      const qty = Number(item.quantity || 0);
      if (qty <= 0) return item;

      if (hasOverride) {
        const newUnitSale = Math.round((overrideTotal / qty) * 100) / 100;
        const newUnitCost = Math.round((newUnitSale / 1.3) * 100) / 100;
        return { ...item, unitSale: newUnitSale, unitCost: newUnitCost };
      }

      const currentTotal = qty * Number(item.unitSale || 0);
      if (currentTotal >= MANO_OBRA_EXCAVACIO_MIN_SALE) return item;
      const newUnitSale = Math.round((MANO_OBRA_EXCAVACIO_MIN_SALE / qty) * 100) / 100;
      const newUnitCost = Math.round((newUnitSale / 1.3) * 100) / 100;
      return {
        ...item,
        unitSale: newUnitSale,
        unitCost: newUnitCost,
      };
    }),
  }));
}

/**
 * Apply gunite-specific surcharges to "Mano de Obra (Gunitadora)" item:
 * - Hose extras: base 30m, +50€ per extra 10m tranche (rounded up).
 * - Distance: fixed +50€ if > 30km.
 * - Concrete (D-400 with fibers): +15€ per m³ above 15m³ (× quantity of that item).
 * Sale price is recomputed as cost × 1.3.
 */
function applyGuniteAdjustments(phases: BudgetPhase[], draft: Partial<BudgetDraft>): BudgetPhase[] {
  if (draft.constructionSystem !== 'gunite') return phases;

  const mangueraMetresExtres = Number(draft.guniteMangueraMetres ?? 0);
  const distanciaKm = Number(draft.guniteDistanciaKm ?? 0);

  // Hose extra: per 10m tranche of EXTRA hose, rounded up
  const hoseSurcharge = Math.ceil(Math.max(0, mangueraMetresExtres) / 10) * 50;

  // Distance surcharge
  const distanceSurcharge = distanciaKm > 30 ? 50 : 0;

  // Find hormigón D-400 quantity across all phases
  let hormigonQty = 0;
  for (const phase of phases) {
    for (const item of phase.items || []) {
      if (isHormigonD400Item(item.description)) {
        hormigonQty += Number(item.quantity || 0);
      }
    }
  }
  const concreteSurcharge = hormigonQty > 15 ? (hormigonQty - 15) * 15 : 0;

  const totalUnitCostExtra = hoseSurcharge + distanceSurcharge + concreteSurcharge;

  if (totalUnitCostExtra <= 0) return phases;

  return phases.map((phase) => ({
    ...phase,
    items: (phase.items || []).map((item) => {
      if (!isGunitadoraItem(item.description)) return item;
      if (item.userEdited) return item;
      const newUnitCost = Number(item.unitCost || 0) + totalUnitCostExtra;
      const newUnitSale = Math.round(newUnitCost * 1.3 * 100) / 100;
      return {
        ...item,
        unitCost: Math.round(newUnitCost * 100) / 100,
        unitSale: newUnitSale,
      };
    }),
  }));
}


export const FORMULA_PHASE_MAP: Record<string, string> = {
  estructura: 'Estructura',
  acabats: 'Acabats',
  instalacions: 'Instal·lacions',
  // Accessoris formulas are routed into the Instal·lacions phase (nested as sub-phases)
  accessoris: 'Instal·lacions',
  annex: 'Annex',
};

const DEFAULT_OBRA_NOVA_PHASES = ['Estructura', 'Acabats', 'Instal·lacions', 'Annex'] as const;

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

function normalizeItem(item: BudgetItem): BudgetItem {
  return {
    ...item,
    quantity: Number(item.quantity ?? 1),
    unitCost: Number(item.unitCost ?? 0),
    unitSale: Number(item.unitSale ?? 0),
    source: item.source === 'formula' || item.source === 'wizard' ? item.source : 'manual',
    formulaRuleId: item.formulaRuleId,
    wizardKey: item.wizardKey,
    userEdited: item.userEdited === true ? true : undefined,
  };
}

function normalizeDisplayValue(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function getFormulaItemDescription(result: FormulaResult): string {
  const baseName = result.displayName || result.ruleName;
  return baseName + (result.subPhase ? ` (${result.subPhase})` : '');
}

function getItemDisplayKey(description: string, unit: string | null | undefined): string {
  return `${normalizeDisplayValue(description)}::${normalizeDisplayValue(unit || 'ud')}`;
}

export function createDefaultObraNovaPhases(): BudgetPhase[] {
  return DEFAULT_OBRA_NOVA_PHASES.map((name, index) => ({
    id: `phase-${slugify(name)}`,
    name,
    order: index,
    items: [],
  }));
}

export function mergeFormulaResultsIntoPhases(
  results: FormulaResult[],
  existingPhases: BudgetPhase[] = [],
  draft?: Partial<BudgetDraft>,
  wizardLinesByPhase: Record<string, BudgetItem[]> = {}
): BudgetPhase[] {
  // Deduplicate existingPhases by name (legacy budgets may contain duplicate phases).
  const dedupedExisting: BudgetPhase[] = [];
  const seenByName = new Map<string, BudgetPhase>();
  for (const ph of existingPhases) {
    let key = (ph.name || '').trim();
    // Migrate any legacy stand-alone "Accessoris" phase into "Instal·lacions".
    if (key === 'Accessoris') key = 'Instal·lacions';
    const existing = seenByName.get(key);
    if (existing) {
      existing.items = [...(existing.items || []), ...(ph.items || [])];
    } else {
      const copy = { ...ph, name: key, items: [...(ph.items || [])] };
      seenByName.set(key, copy);
      dedupedExisting.push(copy);
    }
  }

  const basePhases = dedupedExisting.length > 0 ? dedupedExisting : createDefaultObraNovaPhases();
  // Ensure every phase that has wizard lines exists in basePhases.
  for (const phaseName of Object.keys(wizardLinesByPhase)) {
    if (!basePhases.find((p) => p.name === phaseName) && (wizardLinesByPhase[phaseName] || []).length > 0) {
      basePhases.push({ id: `phase-${slugify(phaseName)}`, name: phaseName, order: basePhases.length, items: [] });
    }
  }

  const groupedResults: Record<string, FormulaResult[]> = {};

  for (const result of results) {
    const phaseName = FORMULA_PHASE_MAP[result.phase] || result.phase;
    if (!groupedResults[phaseName]) groupedResults[phaseName] = [];
    groupedResults[phaseName].push(result);
  }

  const merged = basePhases.map((phase, index) => {
    const phaseResults = (groupedResults[phase.name] || [])
      .filter((result) => !result.error && result.quantity > 0 && (result.sale > 0 || result.cost > 0));

    const formulaRuleIds = new Set(phaseResults.map((result) => result.ruleId));
    const formulaDisplayKeys = new Set(
      phaseResults.map((result) => getItemDisplayKey(getFormulaItemDescription(result), result.unit || 'ud'))
    );

    const wizardLines = wizardLinesByPhase[phase.name] || [];
    const wizardKeys = new Set(wizardLines.map((it) => it.wizardKey).filter(Boolean) as string[]);

    // Preserve manual edits (userEdited === true) applied to wizard-generated
    // items. Match by wizardKey; when an existing entry is flagged as edited,
    // keep the user's quantity / unitCost / unitSale. Some older/local wizard
    // lines may have been normalized as "manual", so the stable wizardKey is
    // the source of truth here.
    const editedWizardByKey = new Map<string, BudgetItem>();
    for (const it of phase.items || []) {
      if (it.userEdited === true && it.wizardKey) {
        editedWizardByKey.set(it.wizardKey, it);
      }
    }
    const wizardLinesPreserved: BudgetItem[] = wizardLines.map((wl) => {
      const edited = wl.wizardKey ? editedWizardByKey.get(wl.wizardKey) : undefined;
      if (!edited) return wl;
      return {
        ...wl,
        quantity: Number(edited.quantity ?? wl.quantity),
        unitCost: Number(edited.unitCost ?? wl.unitCost),
        unitSale: Number(edited.unitSale ?? wl.unitSale),
        userEdited: true,
      };
    });

    const manualItems = (phase.items || [])
      .filter((item) => item.source !== 'formula' && item.source !== 'wizard')
      .filter((item) => {
        if (item.formulaRuleId && formulaRuleIds.has(item.formulaRuleId)) {
          return false;
        }
        // Also drop manual items that collide by description with wizard auto items
        if (wizardLines.some((wl) => getItemDisplayKey(wl.description, wl.unit) === getItemDisplayKey(item.description, item.unit))) {
          return false;
        }

        return !formulaDisplayKeys.has(getItemDisplayKey(item.description, item.unit));
      })
      .map(normalizeItem);

    const formulaItems: BudgetItem[] = phaseResults
      .map((result) => {
        // Preserve manual user edits to an auto-generated formula line.
        const existing = (phase.items || []).find(
          (it) => it.formulaRuleId === result.ruleId && it.userEdited === true,
        );
        return {
          id: `formula-${result.ruleId}`,
          description: result.displayName || result.ruleName,
          unit: result.unit || 'ud',
          quantity: existing ? Number(existing.quantity) : result.quantity,
          unitCost: existing ? Number(existing.unitCost) : result.unitCost,
          unitSale: existing ? Number(existing.unitSale) : result.unitSale,
          source: 'formula',
          formulaRuleId: result.ruleId,
          subPhase: result.subPhase || 'General',
          userEdited: existing ? true : undefined,
        } as BudgetItem;
      });

    return {
      ...phase,
      id: phase.id || `phase-${slugify(phase.name)}`,
      order: phase.order ?? index,
      // Order: wizard equipment first (sub-phases group them), then formula labor, then manual extras.
      items: [...wizardLinesPreserved, ...formulaItems, ...manualItems],
    };
  });

  const withGunite = draft ? applyGuniteAdjustments(merged, draft) : merged;
  return draft ? applyExcavacioMinimums(withGunite, draft) : withGunite;
}

export function serializeBudgetPhases(phases: BudgetPhase[] = []): string {
  return JSON.stringify(
    phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      order: phase.order,
      items: (phase.items || []).map((item) => ({
        id: item.id,
        description: item.description,
        unit: item.unit,
        quantity: Number(item.quantity ?? 1),
        unitCost: Number(item.unitCost ?? 0),
        unitSale: Number(item.unitSale ?? 0),
        source: item.source ?? 'manual',
        formulaRuleId: item.formulaRuleId ?? null,
        wizardKey: item.wizardKey ?? null,
        subPhase: item.subPhase ?? null,
        userEdited: item.userEdited === true ? true : false,
      })),
    }))
  );
}