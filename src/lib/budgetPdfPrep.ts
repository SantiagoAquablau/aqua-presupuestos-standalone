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
    const rawResults = evaluateFormulaRules(
      (rules || []) as FormulaRule[],
      current,
      (arts || []) as any,
    );
    const results = filterAcabatsInclusion(rawResults, current);
    const wizardLines = buildWizardLinesByPhase(current, (arts || []) as any);
    const mergedPhases = mergeFormulaResultsIntoPhases(
      results,
      current.phases,
      current,
      wizardLines,
    );
    if (
      serializeBudgetPhases(mergedPhases) ===
      serializeBudgetPhases(current.phases || [])
    ) {
      return current;
    }
    return { ...current, phases: mergedPhases };
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