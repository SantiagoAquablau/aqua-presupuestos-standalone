/**
 * Shared helper used by every flow that needs to produce a PDF from a
 * persisted budget (BudgetList → Descarregar PDF, BudgetList → Comanda,
 * …). Replicates exactly what `StepRevisio` does before calling
 * `buildBudgetPdf`: load the row, rehydrate as `BudgetDraft`, then run
 * the formula engine + wizard-lines merger so the resulting `phases`
 * (and therefore every total shown in the PDF) match what the wizard
 * would generate live.
 */
import { supabase } from "@/integrations/supabase/client";
import { loadBudgetAsDraft } from "@/lib/budgetMapper";
import type { BudgetDraft } from "@/stores/budgetStore";
import { evaluateFormulaRules, type FormulaRule } from "@/lib/formulaEngine";
import {
  mergeFormulaResultsIntoPhases,
  serializeBudgetPhases,
  filterAcabatsInclusion,
  computeAnnexPavimentRawItems,
} from "@/lib/formulaPhases";
import { buildWizardLinesByPhase } from "@/lib/wizardLines";

export async function recomputeDraftPhases(current: BudgetDraft): Promise<BudgetDraft> {
  if (current.type !== "obra_nueva") return current;
  try {
    const [{ data: arts }, { data: rules }] = await Promise.all([
      supabase.from("articles").select("*"),
      supabase
        .from("formula_rules")
        .select("*")
        .eq("budget_type", "obra_nova")
        .eq("is_active", true)
        .order("phase")
        .order("order_index"),
    ]);
    const articleRows = (arts || []) as any;
    const rawResults = evaluateFormulaRules(
      (rules || []) as FormulaRule[],
      current,
      articleRows,
    );
    const results = filterAcabatsInclusion(rawResults, current);
    const wizardLines = buildWizardLinesByPhase(current, articleRows);
    const mergedPhases = mergeFormulaResultsIntoPhases(
      results,
      current.phases,
      current,
      wizardLines,
    );
    // Evaluated with annexPavimentEstat forced to 'inclos' — several real
    // paviment formula_rules only fire under that estat (confirmed via a
    // live trace: 16 rules under 'inclos' vs 3 under 'opcional' for the
    // same m²/format), so using the real ('opcional') context here would
    // yield a badly incomplete informational total. See
    // computeAnnexPavimentRawItems for the full rationale. This never
    // touches draft.phases/Partides/the total, which stay on `results`
    // (the real, unforced context) via mergedPhases above.
    const annexPavimentRawItems = computeAnnexPavimentRawItems(
      (rules || []) as FormulaRule[],
      articleRows,
      current,
    );
    if (
      serializeBudgetPhases(mergedPhases) ===
      serializeBudgetPhases(current.phases || [])
    ) {
      return { ...current, annexPavimentRawItems };
    }
    return { ...current, phases: mergedPhases, annexPavimentRawItems };
  } catch (e) {
    console.error("[budgetPdfPrep] recomputeDraftPhases failed", e);
    return current;
  }
}

/** Load a budget by id and return a fully-recomputed BudgetDraft ready to
 *  be passed to `buildBudgetPdf`. Use this from any non-wizard flow that
 *  needs to produce a PDF identical to the one StepRevisio generates. */
export async function loadBudgetReadyForPdf(budgetId: string): Promise<BudgetDraft> {
  const { draft } = await loadBudgetAsDraft(budgetId);
  return await recomputeDraftPhases(draft);
}