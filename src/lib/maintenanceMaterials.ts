import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BudgetDraft } from "@/stores/budgetStore";

/** Stable keys we use both in UI and in the per-material override maps. */
export type MaterialKey =
  | "cloro25"
  | "sal25"
  | "cloroRapido5"
  | "hipoclorito"
  | "phMenos"
  | "algaKiller"
  | "eliminadorFosfatos"
  | "varios";

export interface MaterialDef {
  key: MaterialKey;
  articleName: string;
  label: string;
}

/** Catalogue article names (must match exactly the article name in catalog). */
export const MATERIAL_DEFS: MaterialDef[] = [
  { key: "cloro25", articleName: "CLORO TABLETAS 5 KG", label: "Cloro Tabletas 5 KG" },
  { key: "sal25", articleName: "SAL 25 KG", label: "Sal 25 KG" },
  { key: "cloroRapido5", articleName: "CLORO RAPIDO 5 KG", label: "Cloro ràpid 5 KG" },
  { key: "hipoclorito", articleName: "HIPOCLORITO", label: "Hipoclorit" },
  { key: "phMenos", articleName: "PH MENOS LIQUIDO", label: "pH menys líquid" },
  { key: "algaKiller", articleName: "ALGA KILLER", label: "Alga Killer" },
  { key: "eliminadorFosfatos", articleName: "ELIMINADOR DE FOSFATOS 1,2 KG PASTILLAS", label: "Eliminador de fosfats" },
  { key: "varios", articleName: "VARIOS", label: "Varis" },
];

export interface MaterialRow {
  key: MaterialKey;
  name: string;
  unitSale: number; // €/ud (or €/unit) — varios is treated as a lump sum (qty=1, unitSale = total)
  autoQty: number;
  qty: number; // final (override or auto)
  autoTotal: number;
  total: number; // final (override or auto)
  visible: boolean;
}

export interface MaterialsSummary {
  rows: MaterialRow[];
  subtotal: number;
  structuralPct: number;
  structuralAmount: number;
  benefitPct: number;
  benefitAmount: number;
  totalAnual: number;
  totalMensual: number;
}

function piecewise(m3: number, breakpoints: Array<[number, number]>, fallback: number) {
  for (const [limit, value] of breakpoints) {
    if (m3 <= limit) return value;
  }
  return fallback;
}

function autoQtyFor(key: MaterialKey, draft: BudgetDraft): number {
  const L = Number(draft.poolLength) || 0;
  const W = Number(draft.poolWidth) || 0;
  const D = Number(draft.poolDepthAvg) || 0;
  const m3 = Math.ceil(L * W * D);
  const electro = !!draft.hasElectrolisi;

  switch (key) {
    case "cloro25":
      return electro ? 0 : 1;
    case "sal25":
      return electro ? Math.ceil((m3 * 5) / 25) : 0;
    case "cloroRapido5": {
      // same breakpoints for both cases
      return piecewise(
        m3,
        [
          [30, 2],
          [55, 3],
          [70, 4],
          [90, 5],
          [110, 6],
        ],
        7,
      );
    }
    case "hipoclorito":
      return electro
        ? piecewise(
            m3,
            [
              [30, 75],
              [51, 100],
              [70, 125],
              [90, 150],
              [110, 175],
            ],
            200,
          )
        : piecewise(
            m3,
            [
              [30, 75],
              [51, 125],
              [70, 175],
              [90, 225],
              [110, 275],
            ],
            325,
          );
    case "phMenos":
      return electro
        ? piecewise(
            m3,
            [
              [30, 50],
              [40, 50],
              [51, 50],
              [60, 75],
              [70, 100],
            ],
            115,
          )
        : piecewise(
            m3,
            [
              [30, 100],
              [40, 115],
              [51, 130],
              [60, 145],
              [70, 160],
            ],
            175,
          );
    case "algaKiller":
    case "eliminadorFosfatos":
    case "varios":
      return 1;
  }
}

function autoVariosTotal(draft: BudgetDraft): number {
  const L = Number(draft.poolLength) || 0;
  const W = Number(draft.poolWidth) || 0;
  const D = Number(draft.poolDepthAvg) || 0;
  const m3 = Math.ceil(L * W * D);
  const electro = !!draft.hasElectrolisi;
  const isComunitaria = draft.poolType === "comunitaria";

  if (isComunitaria) {
    return electro
      ? piecewise(
          m3,
          [
            [30, 200],
            [40, 200],
            [51, 200],
            [60, 220],
            [70, 240],
          ],
          260,
        )
      : piecewise(
          m3,
          [
            [30, 200],
            [40, 200],
            [51, 200],
            [60, 245],
            [70, 260],
          ],
          275,
        );
  }
  // particular (default)
  return electro
    ? piecewise(
        m3,
        [
          [30, 100],
          [40, 100],
          [51, 100],
          [60, 120],
          [70, 140],
        ],
        160,
      )
    : piecewise(
        m3,
        [
          [30, 100],
          [40, 100],
          [51, 100],
          [60, 145],
          [70, 160],
        ],
        175,
      );
}

function isVisible(key: MaterialKey, draft: BudgetDraft): boolean {
  const electro = !!draft.hasElectrolisi;
  if (key === "cloro25") return !electro;
  if (key === "sal25") return electro;
  return true;
}

export function computeMaintenanceMaterials(
  draft: BudgetDraft,
  articles: Array<{ name: string; cost_price: number | null }>,
  operationalTotal: number = 0,
): MaterialsSummary {
  const plan = draft.maintenancePlan;
  const byName: Record<string, number> = {};
  for (const a of articles) {
    byName[a.name.trim().toUpperCase()] = Number(a.cost_price || 0) / 100;
  }

  const overridesQty = plan?.materialQty || {};
  const overridesTotal = plan?.materialTotal || {};

  const rows: MaterialRow[] = MATERIAL_DEFS.map((def) => {
    const unitSale = byName[def.articleName.toUpperCase()] ?? 0;
    const autoQty = autoQtyFor(def.key, draft);
    const qty = overridesQty[def.key] ?? autoQty;
    let autoTotal: number;
    if (def.key === "varios") {
      autoTotal = autoVariosTotal(draft);
    } else {
      autoTotal = qty * unitSale;
    }
    const total = overridesTotal[def.key] ?? (overridesQty[def.key] !== undefined ? qty * unitSale : autoTotal);
    return {
      key: def.key,
      name: def.label,
      unitSale,
      autoQty,
      qty,
      autoTotal,
      total,
      visible: isVisible(def.key, draft),
    };
  });

  const subtotal = rows.filter((r) => r.visible).reduce((s, r) => s + (r.total || 0), 0);
  const structuralPct = plan?.structuralPct ?? 15;
  const benefitPct = plan?.benefitPct ?? 55;
  const baseForPct = subtotal + (operationalTotal || 0);
  const structuralAmount = baseForPct * (structuralPct / 100);
  const benefitAmount = baseForPct * (benefitPct / 100);
  // Canonical monthly value: round UP to whole cents so the amount the
  // client pays each month, multiplied by 12, matches (or slightly exceeds)
  // the annual total shown. Annual is then recomputed as 12 × monthly to
  // keep both figures perfectly consistent across wizard, PDF and contract.
  const rawAnual = baseForPct + structuralAmount + benefitAmount;
  const totalMensual = Math.ceil((rawAnual / 12) * 100) / 100;
  const totalAnual = Math.round(totalMensual * 12 * 100) / 100;

  return {
    rows,
    subtotal,
    structuralPct,
    structuralAmount,
    benefitPct,
    benefitAmount,
    totalAnual,
    totalMensual,
  };
}

export function useMaintenanceMaterials(draft: BudgetDraft, operationalTotal: number = 0): MaterialsSummary {
  const { data: articles = [] } = useQuery({
    queryKey: ["manteniment-materials-articles"],
    queryFn: async () => {
      const { data } = await supabase.from("articles").select("name, cost_price").eq("category", "Manteniment");
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
  return computeMaintenanceMaterials(draft, articles as any, operationalTotal);
}
