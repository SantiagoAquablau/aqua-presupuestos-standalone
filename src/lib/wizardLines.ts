import type { BudgetItem } from '@/stores/budgetStore';
import type { BudgetDraft } from '@/stores/budgetStore';
import {
  getInstallationSelections,
  getAccessorySelections,
  indexArticlesById,
  resolveArticle,
} from '@/lib/wizardEquipment';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Live computation of pool perimeter (must mirror StepInstalacions.tsx).
 * Using the same formula avoids stale draft.instalFontaneriaTotal values
 * that are only persisted on Next/Back.
 */
function computePoolPerimeter(draft: Partial<BudgetDraft>): number {
  const l = Number(draft.poolLength ?? 0);
  const w = Number(draft.poolWidth ?? 0);
  if (l === 0 && w === 0) return 0;
  let p = (((l + 0.3) * 2) + 2) + (((w + 0.3) * 2) + 2);
  if (draft.hasExteriorStairs) {
    const le = Number(draft.extStairsLength ?? 0);
    if (le > 0) p += ((le * 2) + 0.6) + 2;
  }
  return Math.round(p * 100) / 100;
}

function buildItem(
  key: string,
  description: string,
  unit: string,
  qty: number,
  unitCost: number,
  unitSale: number,
  subPhase: string,
  isOptional = false
): BudgetItem {
  return {
    id: `wizard-${key}`,
    description,
    unit,
    quantity: qty,
    unitCost: round2(unitCost),
    unitSale: round2(unitSale),
    source: 'wizard',
    wizardKey: key,
    subPhase: isOptional ? 'Opcionals informatius (no sumen al total)' : subPhase,
  };
}

/**
 * Generate auto budget items for the Instal·lacions phase from the wizard draft.
 * Optional items are tagged with a special sub-phase so the UI can render them
 * separately and the totals can exclude them.
 */
export function buildInstallationLines(
  draft: Partial<BudgetDraft>,
  articles: any[]
): BudgetItem[] {
  const index = indexArticlesById(articles);
  const items: BudgetItem[] = [];
  const selections = getInstallationSelections(draft, index);

  for (const sel of selections) {
    if (!sel.enabled) continue;
    if (sel.qty <= 0) continue;
    // Optional equipment: NOT included as line items at all.
    // The "opcional" toggle in the wizard means the customer can choose to add
    // it later — it must not appear in the budget nor be summed.
    if (sel.isOptional) continue;
    // AFM (vidre ecofiltrant) is an INCREMENT handled by the formula engine,
    // not a standalone budget line. Skip it here so it doesn't double-count
    // and doesn't show wrongly-named articles like "Canvi de sorra per AFM 500".
    if (sel.key === 'instal_afm') continue;
    items.push(
      buildItem(
        sel.key,
        sel.label,
        sel.unit || 'ud',
        sel.qty,
        sel.unitCost,
        sel.unitSale,
        'Equips seleccionats',
        false
      )
    );
  }

  // Fontaneria — recalculated live so it always matches what the wizard shows,
  // even if the user hasn't clicked Next/Back to persist instalFontaneriaTotal.
  if (draft.instalFontaneriaEnabled !== false) {
    const base = resolveArticle(index, draft.instalFontaneriaBaseArticleId);
    const perimeter = computePoolPerimeter(draft);
    const distancia = Number(draft.instalFontaneriaDistancia ?? 10);
    const perimeterExtra = perimeter > 25 ? (perimeter - 25) * 55 : 0;
    const distanciaExtra = distancia > 10 ? (distancia - 10) * 55 : 0;
    const perforacionsArticle = resolveArticle(index, draft.instalFontaneriaPerforacionsArticleId);
    const perforacionsPrice = (draft.instalFontaneriaPerforacions && draft.instalFontaneriaLocalTecnic === 'existent')
      ? perforacionsArticle.sale : 0;
    const rasasPrice = draft.instalFontaneriaRasasEnabled ? Number(draft.instalFontaneriaRasasImport ?? 0) : 0;
    const total = base.sale + perimeterExtra + distanciaExtra + perforacionsPrice + rasasPrice;
    if (total > 0) {
      const cost = base.cost > 0 ? base.cost + perimeterExtra + distanciaExtra + perforacionsPrice + rasasPrice : total / 1.3;
      // Display as metres: qty = distance (metres entered by user), unit = "m".
      // unitSale/unitCost are derived so qty * unitSale equals the live total.
      const qty = distancia > 0 ? distancia : 1;
      items.push({
        id: 'wizard-instal_fontaneria',
        description: draft.instalFontaneriaText || 'Instal·lació de fontaneria',
        unit: 'm',
        quantity: qty,
        unitCost: round2(cost / qty),
        unitSale: round2(total / qty),
        source: 'wizard',
        wizardKey: 'instal_fontaneria',
        subPhase: 'Equips seleccionats',
      });
    }
  }

  if (draft.instalElectricaEnabled !== false) {
    const base = resolveArticle(index, draft.instalElectricaBaseArticleId);
    const perimeter = computePoolPerimeter(draft);
    const distancia = Number(draft.instalFontaneriaDistancia ?? 10); // shares distance with fontaneria
    const distanciaExtra = distancia > 10 ? (distancia - 10) * 20 : 0;
    const perimeterExtra = perimeter > 25 ? (perimeter - 25) * 20 : 0;
    const extra = distanciaExtra + perimeterExtra;
    const total = base.sale + extra;
    if (total > 0) {
      const cost = base.cost > 0 ? base.cost + extra : total / 1.3;
      const qty = distancia > 0 ? distancia : 1;
      items.push({
        id: 'wizard-instal_electrica',
        description: draft.instalElectricaText || 'Instal·lació elèctrica',
        unit: 'm',
        quantity: qty,
        unitCost: round2(cost / qty),
        unitSale: round2(total / qty),
        source: 'wizard',
        wizardKey: 'instal_electrica',
        subPhase: 'Equips seleccionats',
      });
    }
  }

  return items;
}

export function buildAccessoryLines(
  draft: Partial<BudgetDraft>,
  articles: any[]
): BudgetItem[] {
  const index = indexArticlesById(articles);
  const items: BudgetItem[] = [];
  const selections = getAccessorySelections(draft, index);

  for (const sel of selections) {
    if (!sel.enabled) continue;
    if (sel.qty <= 0) continue;
    // Cascada gets its own subPhase ("cascada", matching the Motor de
    // Càlcul's SUB_PHASES.accessoris dropdown value) instead of the shared
    // "Accessoris opcionals" bucket, so its lines group together with the
    // "Mà d'obra instal·lació cascada" line generated by a formula-engine
    // rule using that same subfase.
    const subPhase = sel.key === 'acc_cascada' ? 'cascada' : sel.isOptional ? 'Accessoris opcionals' : 'Accessoris bàsics';
    items.push({
      id: `wizard-${sel.key}`,
      description: sel.label,
      unit: sel.unit || 'ud',
      quantity: sel.qty,
      unitCost: round2(sel.unitCost),
      unitSale: round2(sel.unitSale),
      source: 'wizard',
      wizardKey: sel.key,
      subPhase,
    });
  }

  // Cascada extras — bomba Dolfi + pulsador(s) piezoelèctric. Custom-built
  // (not through the generic mk() helper above) because a single toggle
  // must produce several distinctly-labelled lines, mirroring the "Gespa"
  // pattern in buildAnnexLines() (1 toggle → N lines). Same "cascada"
  // subPhase as the main Cascada line above, for the same grouping reason.
  // Mà d'obra d'instal·lació NO es genera aquí: la crea una regla
  // condicional del Motor de Càlcul (Configuració → Motor de Càlcul) quan
  // acc_cascada_enabled és true, igual que "VARILLAS DE REA 10MM"/"VIDRE AFM".
  const cascadaQty = Number(draft.accCascadaQty ?? 1);
  if (draft.accCascadaEnabled && cascadaQty > 0) {
    const bomba = resolveArticle(index, draft.accCascadaBombaArticleId);
    items.push({
      id: 'wizard-acc_cascada_bomba',
      description: bomba.id ? `Bomba ${bomba.name} per a cascada` : 'Bomba per a cascada · A determinar',
      unit: bomba.unit || 'ud',
      quantity: 1,
      unitCost: round2(bomba.cost),
      unitSale: round2(bomba.sale),
      source: 'wizard',
      wizardKey: 'acc_cascada_bomba',
      subPhase: 'cascada',
    });

    const pulsador = resolveArticle(index, draft.accCascadaPulsadorArticleId);
    const pulsadorQty = Math.max(1, Number(draft.accCascadaPulsadorQty ?? 1));
    items.push({
      id: 'wizard-acc_cascada_pulsador',
      description: pulsador.id
        ? 'Pulsador piezoelèctric per a cascada'
        : 'Pulsador piezoelèctric per a cascada · A determinar',
      unit: pulsador.unit || 'ud',
      quantity: pulsadorQty,
      unitCost: round2(pulsador.cost),
      unitSale: round2(pulsador.sale),
      source: 'wizard',
      wizardKey: 'acc_cascada_pulsador',
      subPhase: 'cascada',
    });
  }

  return items;
}

/**
 * Annex equipment lines for items that the user marks as "inclos":
 * Bomba de calor, Robot netejafons and Cobertor. Other annex items
 * (excavació, paviment, gespa, projecte, netejafons system) are managed
 * by formulas or specific calculations elsewhere.
 */
export function buildAnnexLines(
  draft: Partial<BudgetDraft>,
  articles: any[]
): BudgetItem[] {
  const index = indexArticlesById(articles);
  const items: BudgetItem[] = [];

  type AnnexEntry = {
    key: string;
    estat: string | undefined;
    articleId: string | null | undefined;
    qty: number;
    fallbackLabel: string;
  };

  const entries: AnnexEntry[] = [
    {
      key: 'annex_bomba_calor',
      estat: draft.annexBombaCalorEstat,
      articleId: draft.annexBombaCalorArticleId,
      qty: 1,
      fallbackLabel: 'Bomba de calor',
    },
    {
      key: 'annex_robot',
      estat: draft.annexRobotEstat,
      articleId: draft.annexRobotArticleId,
      qty: Number(draft.annexRobotQty ?? 1),
      fallbackLabel: 'Robot netejafons',
    },
  ];

  for (const e of entries) {
    if (e.estat !== 'inclos') continue;
    if (e.qty <= 0) continue;
    const a = resolveArticle(index, e.articleId);
    if (!a.id) continue;
    items.push({
      id: `wizard-${e.key}`,
      description: a.name || e.fallbackLabel,
      unit: a.unit || 'ud',
      quantity: e.qty,
      unitCost: round2(a.cost),
      unitSale: round2(a.sale),
      source: 'wizard',
      wizardKey: e.key,
      subPhase: 'Equips annex',
    });
  }

  // Cobertor — description-only line. Pricing is calculated separately (TBD).
  if (draft.annexCobertorEstat === 'inclos' && draft.annexCobertorModelId) {
    const tipusLabel = draft.annexCobertorTipus === 'submergit' ? 'Submergit' : 'Fora aigua';
    const lamesLabel =
      draft.annexCobertorLames === 'pvc'
        ? 'Lames PVC 83 mm'
        : draft.annexCobertorLames === 'policarbonat'
          ? 'Lames Policarbonat 83 mm'
          : null;
    const parts = [
      `Cobertor ${draft.annexCobertorModelName || ''}`.trim(),
      tipusLabel,
      lamesLabel,
      draft.annexCobertorColorName,
    ].filter(Boolean);

    // Resolve price: manual override > automatic calc > 0 (pending).
    let unitSale = 0;
    let unitCost = 0;
    let descSuffix = '';
    if (draft.annexCobertorManualOverride && Number(draft.annexCobertorManualAmount ?? 0) > 0) {
      unitSale = Number(draft.annexCobertorManualAmount);
      // Sale prices already include a 45% margin on cost → cost = sale / 1.45.
      unitCost = round2(unitSale / 1.45);
      descSuffix = ' · PRESSUPOST PERSONALITZAT';
    } else if (Number(draft.annexCobertorCalcSale ?? 0) > 0) {
      unitSale = Number(draft.annexCobertorCalcSale);
      unitCost = Number(draft.annexCobertorCalcCost ?? unitSale / 1.45);
    }

    items.push({
      id: 'wizard-annex_cobertor',
      description: (parts.join(' · ') + descSuffix).toUpperCase(),
      unit: 'ud',
      quantity: 1,
      unitCost: round2(unitCost),
      unitSale: round2(unitSale),
      source: 'wizard',
      wizardKey: 'annex_cobertor',
      subPhase: 'Equips annex',
    });
  }

  // Re-ompliment de terres (sub-phase "excavacio") — only when excavació is included.
  // Mirrors the calculation in StepAnnex.tsx so the budget summary shows the same value.
  if (draft.annexExcavacioEstat === 'inclos') {
    const l = Number(draft.poolLength ?? 0);
    const w = Number(draft.poolWidth ?? 0);
    const dMin = Number(draft.poolDepthMin ?? 0);
    const dMax = Number(draft.poolDepthMax ?? 0);
    const dAvg = dMin && dMax ? (dMin + dMax) / 2 : 0;
    if (l > 0 && w > 0 && dAvg > 0) {
      const sacos = Math.ceil((((l + w) * 2) * (dAvg + 0.3) * 0.2) / 0.67);
      const costMaterial = sacos * 33.88;
      const viatges = Math.ceil(sacos / 8);
      const costTransport = viatges * 175;
      const rawCost = (costMaterial + costTransport) * 1.55;
      const autoReompliment = Math.round(Math.max(930, rawCost) * 100) / 100;
      // Respect the wizard's manual override when present, same "override ??
      // auto calc" pattern used for mà d'obra d'excavació.
      const overrideRaw = draft.annexExcavacioReomplimentOverride;
      const reompliment =
        overrideRaw != null && Number.isFinite(Number(overrideRaw)) ? Number(overrideRaw) : autoReompliment;
      if (reompliment > 0) {
        items.push({
          id: 'wizard-annex_excavacio_reompliment',
          description: 'Re-ompliment de terres',
          unit: 'pa',
          quantity: 1,
          unitCost: round2(reompliment / 1.3),
          unitSale: round2(reompliment),
          source: 'wizard',
          wizardKey: 'annex_excavacio_reompliment',
          subPhase: 'excavacio',
        });
      }
    }
  }

  // Gespa artificial (sub-phase "Gespa") — when included.
  if (draft.annexGespaEstat === 'inclos') {
    // Preparació de terreny: user enters TOTAL sale price; cost = sale * 0.7 (30% margin).
    if (draft.annexGespaPreparacioEnabled) {
      const sale = Number(draft.annexGespaPreparacioM2 ?? 0);
      if (sale > 0) {
        items.push({
          id: 'wizard-annex_gespa_preparacio',
          description: 'Preparació de terreny per gespa artificial',
          unit: 'pa',
          quantity: 1,
          unitCost: round2(sale * 0.7),
          unitSale: round2(sale),
          source: 'wizard',
          wizardKey: 'annex_gespa_preparacio',
          subPhase: 'Gespa',
        });
      }
    }
    // Model de gespa: qty = m², unit cost/sale from selected article.
    const m2 = Number(draft.annexGespaM2 ?? 0);
    if (m2 > 0 && draft.annexGespaArticleId) {
      const a = resolveArticle(index, draft.annexGespaArticleId);
      if (a.id) {
        items.push({
          id: 'wizard-annex_gespa_model',
          description: a.name || draft.annexGespaModel || 'Gespa artificial',
          unit: a.unit || 'm²',
          quantity: m2,
          unitCost: round2(a.cost),
          unitSale: round2(a.sale),
          source: 'wizard',
          wizardKey: 'annex_gespa_model',
          subPhase: 'Gespa',
        });
      }
    }
  }

  // Entrada de material a mà (sub-phase "Equips annex") — manual cost/sale, no article.
  if (draft.hasManualMaterialEntry) {
    const sale = Number(draft.manualMaterialEntrySale ?? 0);
    if (sale > 0) {
      items.push({
        id: 'wizard-annex_manual_material_entry',
        description: 'Entrada de material a mà',
        unit: 'pa',
        quantity: 1,
        unitCost: round2(Number(draft.manualMaterialEntryCost ?? 0)),
        unitSale: round2(sale),
        source: 'wizard',
        wizardKey: 'annex_manual_material_entry',
        subPhase: 'Equips annex',
      });
    }
  }

  return items;
}

/** All wizard auto-generated lines grouped by phase name (Catalan, matches FORMULA_PHASE_MAP). */
export function buildWizardLinesByPhase(
  draft: Partial<BudgetDraft>,
  articles: any[]
): Record<string, BudgetItem[]> {
  // Accessoris are nested INSIDE the Instal·lacions phase as sub-phases
  // ("Accessoris bàsics" / "Accessoris opcionals"). They are NOT a separate phase.
  return {
    'Instal·lacions': [
      ...buildInstallationLines(draft, articles),
      ...buildAccessoryLines(draft, articles),
    ],
    'Annex': buildAnnexLines(draft, articles),
  };
}