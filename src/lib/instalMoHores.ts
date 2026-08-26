import type { BudgetDraft } from '@/stores/budgetStore';

/**
 * Mà d'obra tècnic instal·lador — hores per unitat d'equip, per secció.
 * Substitueix les 11h/18h/4h/8h que abans estaven hardcodejades a
 * budgetSave.ts (Depuració/Dosificació/Quadre/Bomba respectivament).
 */
export interface MoHoresPerUnitat {
  depuracio?: number;
  dosificacio?: number;
  quadre?: number;
  bomba?: number;
}

export const MO_HORES_DEFAULTS: Required<MoHoresPerUnitat> = {
  depuracio: 11,
  dosificacio: 18,
  quadre: 4,
  bomba: 8,
};

export const MO_HORES_LABELS: Record<keyof MoHoresPerUnitat, string> = {
  depuracio: 'Depuració',
  dosificacio: 'Dosificació',
  quadre: 'Quadre elèctric',
  bomba: 'Bomba',
};

export interface MoHoresSeccio {
  key: keyof MoHoresPerUnitat;
  label: string;
  /** Quantitat de l'equip realment inclòs en aquesta secció (0 = secció apagada / sense equip). */
  qty: number;
  /** Hores per unitat — valor editat per l'usuari o el default. */
  horesPerUnitat: number;
  /** horesPerUnitat * qty. No s'arrodoneix. */
  horesTotal: number;
}

/**
 * Resol, per a cada secció, la quantitat de l'equip realment INCLÒS al
 * pressupost (0 si la secció està apagada o no hi ha equip triat). Mirroreja
 * la lògica de "quin equip està inclòs" ja usada a budgetSave.ts
 * (filtreInclosArt / bombaSaleVal) i a wizardEquipment.ts (getInstallationSelections).
 */
function resolveIncludedQty(draft: Partial<BudgetDraft>): Record<keyof MoHoresPerUnitat, number> {
  const depuracioOn = draft.instalDepuracioEnabled !== false;
  const sorraInclos = depuracioOn && !!draft.instalFiltrePoliesId && !draft.instalFiltrePoliesOpcional;
  const cartutxInclos =
    depuracioOn && !!draft.instalFiltreEspecialId && !draft.instalFiltreEspecialOpcional && !sorraInclos;
  const depuracioQty = cartutxInclos
    ? Number(draft.instalFiltreEspecialQty ?? 1)
    : sorraInclos
      ? Number(draft.instalFiltrePoliesQty ?? 1)
      : 0;

  const bombaOn = draft.instalBombaEnabled !== false;
  const onoffInclos = bombaOn && !!draft.instalBombaOnoffId && !draft.instalBombaOnoffOpcional;
  const variableInclos = bombaOn && !!draft.instalBombaVariableId && !draft.instalBombaVariableOpcional && !onoffInclos;
  const bombaQty = variableInclos
    ? Number(draft.instalBombaVariableQty ?? 1)
    : onoffInclos
      ? Number(draft.instalBombaOnoffQty ?? 1)
      : 0;

  const dosificacioOn = draft.instalDosificacioEnabled !== false;
  const dosificacioInclos = dosificacioOn && !!draft.instalDosificacioStdId && !draft.instalDosificacioStdOpcional;
  const dosificacioQty = dosificacioInclos ? Number(draft.instalDosificacioStdQty ?? 1) : 0;

  const quadreOn = draft.instalQuadreEnabled !== false;
  const quadreQty = quadreOn && !!draft.instalQuadreId ? 1 : 0;

  return { depuracio: depuracioQty, dosificacio: dosificacioQty, quadre: quadreQty, bomba: bombaQty };
}

/**
 * Calcula les hores d'instal·lador per secció i el total, a partir dels
 * overrides editables de l'usuari (draft.instalMoHoresPerUnitat) i de la
 * quantitat d'equip realment inclòs a cada secció. No s'arrodoneix: el
 * redondeo (Math.ceil per al preu) es fa fora d'aquesta funció, a l'hora de
 * multiplicar per preuMo.
 */
export function computeMoHores(draft: Partial<BudgetDraft>): { seccions: MoHoresSeccio[]; total: number } {
  const qtys = resolveIncludedQty(draft);
  const perUnitat = draft.instalMoHoresPerUnitat || {};

  const seccions: MoHoresSeccio[] = (Object.keys(MO_HORES_DEFAULTS) as (keyof MoHoresPerUnitat)[]).map((key) => {
    const horesPerUnitat = Number(perUnitat[key] ?? MO_HORES_DEFAULTS[key]);
    const qty = qtys[key];
    return {
      key,
      label: MO_HORES_LABELS[key],
      qty,
      horesPerUnitat,
      horesTotal: horesPerUnitat * qty,
    };
  });

  const total = seccions.reduce((sum, s) => sum + s.horesTotal, 0);
  return { seccions, total };
}
