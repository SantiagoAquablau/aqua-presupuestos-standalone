import { supabase } from '@/integrations/supabase/client';
import { loadBudgetAsDraft } from '@/lib/budgetMapper';
import { evaluateFormulaRules, type FormulaRule } from '@/lib/formulaEngine';
import { mergeFormulaResultsIntoPhases, filterAcabatsInclusion } from '@/lib/formulaPhases';
import { buildWizardLinesByPhase } from '@/lib/wizardLines';

/**
 * After a budget is accepted, compute the full phase breakdown using the
 * formula engine + wizard lines (the same logic the wizard uses) and insert
 * obra_phases / obra_cost_items so every phase shows its real estimated lines
 * — not just the manual ones persisted in budget_items.
 */
export async function populateObraFromBudget(budgetId: string): Promise<void> {
  // Find the obra created by the trigger
  const { data: obra } = await supabase
    .from('obras' as any)
    .select('id')
    .eq('budget_id', budgetId)
    .maybeSingle();
  if (!obra) return;
  const obraId = (obra as any).id as string;

  // If phases already populated, skip (idempotent)
  const { count } = await supabase
    .from('obra_phases' as any)
    .select('id', { count: 'exact', head: true })
    .eq('obra_id', obraId);
  if ((count ?? 0) > 0) return;

  const { draft } = await loadBudgetAsDraft(budgetId);

  // Recompute phases (only obra_nueva uses the engine)
  const [{ data: rulesRaw }, { data: articlesRaw }] = await Promise.all([
    supabase.from('formula_rules').select('*').eq('is_active', true).order('phase').order('order_index'),
    supabase.from('articles').select('*'),
  ]);
  const rules = (rulesRaw || []) as FormulaRule[];
  const articles = articlesRaw || [];

  let phases = draft.phases || [];
  if ((draft.type === 'obra_nueva' || (draft.type as string) === 'obra_nova') && rules.length > 0) {
    const filtered = rules.filter((r) => r.budget_type === 'obra_nova' || r.budget_type === 'obra_nueva');
    try {
      const rawResults = evaluateFormulaRules(filtered, draft as any, articles as any);
      const results = filterAcabatsInclusion(rawResults, draft as any);
      const wizardLines = buildWizardLinesByPhase(draft as any, articles as any);
      phases = mergeFormulaResultsIntoPhases(results, draft.phases || [], draft as any, wizardLines);
    } catch (err) {
      console.error('[populateObraFromBudget] formula engine error', err);
    }
  }

  // Insert phases + items
  let sumCost = 0;
  let sumSale = 0;
  for (const phase of phases) {
    const includedItems = (phase.items || []).filter((it: any) => Number(it.quantity ?? 0) > 0);
    const costEst = includedItems.reduce((s: number, it: any) => s + Number(it.quantity || 0) * Number(it.unitCost || 0) * 100, 0);
    const saleEst = includedItems.reduce((s: number, it: any) => s + Math.ceil(Number(it.quantity || 0) * Number(it.unitSale || 0)) * 100, 0);
    sumCost += costEst;
    sumSale += saleEst;

    const { data: phaseRow, error: phaseErr } = await supabase
      .from('obra_phases' as any)
      .insert({
        obra_id: obraId,
        phase_name: phase.name,
        order_index: phase.order ?? 0,
        cost_estimated: Math.round(costEst),
        sale_estimated: Math.round(saleEst),
      })
      .select('id')
      .single();
    if (phaseErr || !phaseRow) {
      console.error('[populateObraFromBudget] phase insert error', phaseErr);
      continue;
    }

    if (includedItems.length === 0) continue;

    const itemRows = includedItems.map((it: any) => {
      const qty = Number(it.quantity || 0);
      const unit = Math.round(Number(it.unitCost || 0) * 100);
      return {
        obra_id: obraId,
        phase_id: (phaseRow as any).id,
        description: it.description || '',
        estimated_qty: qty,
        estimated_unit_cost: unit,
        estimated_total_cost: Math.round(qty * unit),
        is_extra: false,
      };
    });
    const { error: itemsErr } = await supabase.from('obra_cost_items' as any).insert(itemRows as any);
    if (itemsErr) console.error('[populateObraFromBudget] items insert error', itemsErr);
  }

  // Sync obra estimated totals to the actual sum of phases (source of truth)
  const marginEst = sumSale > 0 ? ((sumSale - sumCost) / sumSale) * 100 : 0;
  await supabase
    .from('obras' as any)
    .update({
      total_cost_estimated: Math.round(sumCost),
      total_sale_estimated: Math.round(sumSale),
      margin_estimated_pct: Math.round(marginEst * 100) / 100,
    })
    .eq('id', obraId);
}