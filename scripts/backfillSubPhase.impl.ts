import { supabase } from '@/integrations/supabase/client';
import { loadBudgetAsDraft } from '@/lib/budgetMapper';
import { evaluateFormulaRules, type FormulaRule } from '@/lib/formulaEngine';
import { mergeFormulaResultsIntoPhases, filterAcabatsInclusion } from '@/lib/formulaPhases';
import { buildWizardLinesByPhase } from '@/lib/wizardLines';

interface Args {
  apply: boolean;
  obraId?: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  return {
    apply: argv.includes('--apply'),
    obraId: argv.find((a) => a.startsWith('--obra-id='))?.split('=')[1],
  };
}

interface RecomputedLine {
  description: string;
  subPhase?: string;
}

/**
 * Recompute the same `phases` structure populateObraFromBudget.ts built the
 * first time (formula engine + wizard lines, obra_nova/obra_nueva only —
 * mirrors that file's branch exactly), keyed by phase name -> the lines that
 * actually got inserted (quantity > 0), each carrying its subPhase.
 */
async function recomputeLinesByPhaseName(
  budgetId: string,
  rules: FormulaRule[],
  articles: any[],
): Promise<Map<string, RecomputedLine[]>> {
  const { draft } = await loadBudgetAsDraft(budgetId);

  let phases = draft.phases || [];
  if ((draft.type === 'obra_nueva' || (draft.type as string) === 'obra_nova') && rules.length > 0) {
    const filtered = rules.filter((r) => r.budget_type === 'obra_nova' || r.budget_type === 'obra_nueva');
    const rawResults = evaluateFormulaRules(filtered, draft as any, articles as any);
    const results = filterAcabatsInclusion(rawResults, draft as any);
    const wizardLines = buildWizardLinesByPhase(draft as any, articles as any);
    phases = mergeFormulaResultsIntoPhases(results, draft.phases || [], draft as any, wizardLines);
  }

  const byPhaseName = new Map<string, RecomputedLine[]>();
  for (const phase of phases) {
    // Same filter populateObraFromBudget.ts applies before insert — only
    // these lines actually exist as obra_cost_items rows.
    const included = (phase.items || []).filter((it: any) => Number(it.quantity ?? 0) > 0);
    byPhaseName.set(
      phase.name,
      included.map((it: any) => ({ description: it.description || '', subPhase: it.subPhase })),
    );
  }
  return byPhaseName;
}

async function main() {
  const { apply, obraId } = parseArgs();
  console.log(`[backfillSubPhase] mode=${apply ? 'APPLY (writes sub_phase)' : 'DRY-RUN (no writes)'}${obraId ? ` obra=${obraId}` : ' — ALL obres'}`);
  if (!apply) console.log('[backfillSubPhase] pass --apply once the dry-run output looks correct.\n');

  const [{ data: rulesRaw, error: rulesErr }, { data: articlesRaw, error: articlesErr }] = await Promise.all([
    supabase.from('formula_rules').select('*').eq('is_active', true).order('phase').order('order_index'),
    supabase.from('articles').select('*'),
  ]);
  if (rulesErr) throw rulesErr;
  if (articlesErr) throw articlesErr;
  const rules = (rulesRaw || []) as FormulaRule[];
  const articles = articlesRaw || [];

  let obrasQuery = supabase.from('obras' as any).select('id, budget_id, budget_number');
  if (obraId) obrasQuery = obrasQuery.eq('id', obraId);
  const { data: obrasRaw, error: obrasErr } = await obrasQuery;
  if (obrasErr) throw obrasErr;
  const obras = (obrasRaw || []) as { id: string; budget_id: string | null; budget_number: string }[];

  console.log(`[backfillSubPhase] la query d'obres ha retornat ${obras.length} fila(es).`);
  if (obras.length === 0) {
    console.warn(
      '⚠️  No s\'ha trobat cap obra. Si esperaves trobar-ne (p.ex. amb --obra-id d\'una obra que saps que existeix),\n' +
      '    això gairebé sempre vol dir que la consulta s\'ha executat sense sessió autenticada i les policies RLS\n' +
      '    ("... TO authenticated") l\'han filtrada silenciosament (Supabase no llança error en aquest cas, torna\n' +
      '    data: [] tal qual). Revisa que estiguis passant la SERVICE_ROLE_KEY del projecte a\n' +
      '    VITE_SUPABASE_PUBLISHABLE_KEY (no la clau anon/publishable per defecte) en invocar l\'script.\n' +
      '    Amb tots els comptadors a 0 des d\'aquest punt, NO és evidència que "no hi havia res per fer".',
    );
  }

  let totalMatched = 0;
  let totalUnmatched = 0;
  let totalAmbiguous = 0;
  let totalSkippedNoBudget = 0;
  let totalNothingToBackfill = 0;

  for (const obra of obras) {
    if (!obra.budget_id) {
      console.warn(`[skip] obra ${obra.id} (${obra.budget_number}) has no budget_id`);
      totalSkippedNoBudget++;
      continue;
    }

    // Only pull rows that still need it. is_extra rows never came from the
    // original budget calculation, so there is no sub_phase to recover for
    // them — leave them alone entirely (they're excluded from the query).
    const { data: itemsRaw, error: itemsErr } = await supabase
      .from('obra_cost_items' as any)
      .select('id, phase_id, description')
      .eq('obra_id', obra.id)
      .is('sub_phase', null)
      .eq('is_extra', false);
    if (itemsErr) { console.error(`[error] obra ${obra.id}: ${itemsErr.message}`); continue; }
    const items = (itemsRaw || []) as { id: string; phase_id: string; description: string }[];
    console.log(`[obra] ${obra.budget_number} (${obra.id}): ${items.length} partida(es) amb sub_phase IS NULL i is_extra=false trobades.`);
    if (items.length === 0) {
      console.log(`[obra] ${obra.budget_number}: res a fer — ja no li queda cap partida pendent de sub_phase.`);
      continue;
    }

    const { data: phasesRaw, error: phasesErr } = await supabase
      .from('obra_phases' as any)
      .select('id, phase_name')
      .eq('obra_id', obra.id);
    if (phasesErr) { console.error(`[error] obra ${obra.id}: ${phasesErr.message}`); continue; }
    const phaseNameById = new Map<string, string>();
    for (const p of (phasesRaw || []) as { id: string; phase_name: string }[]) phaseNameById.set(p.id, p.phase_name);

    let recomputedByPhaseName: Map<string, RecomputedLine[]>;
    try {
      recomputedByPhaseName = await recomputeLinesByPhaseName(obra.budget_id, rules, articles);
    } catch (err: any) {
      console.error(`[error] obra ${obra.budget_number} (${obra.id}): failed to recompute budget — ${err?.message || err}`);
      continue;
    }

    for (const item of items) {
      const phaseName = phaseNameById.get(item.phase_id);
      if (!phaseName) {
        console.warn(`[unmatched] obra ${obra.budget_number} item ${item.id}: phase_id ${item.phase_id} not found in obra_phases`);
        totalUnmatched++;
        continue;
      }
      const candidates = (recomputedByPhaseName.get(phaseName) || []).filter((c) => c.description === item.description);
      if (candidates.length === 0) {
        console.warn(`[unmatched] obra ${obra.budget_number} / fase "${phaseName}": cap línia recalculada coincideix amb "${item.description}" (item ${item.id})`);
        totalUnmatched++;
        continue;
      }
      if (candidates.length > 1) {
        console.warn(`[ambiguous] obra ${obra.budget_number} / fase "${phaseName}": ${candidates.length} línies recalculades coincideixen amb "${item.description}" (item ${item.id}) — omès`);
        totalAmbiguous++;
        continue;
      }
      const subPhase = candidates[0].subPhase ?? null;
      if (!subPhase) {
        // Exact, unambiguous match — but the original computation itself
        // never assigned a sub_phase to this line. Nothing to backfill.
        totalNothingToBackfill++;
        continue;
      }
      totalMatched++;
      console.log(`[match] ${obra.budget_number} / "${phaseName}" / "${item.description}" -> sub_phase="${subPhase}"`);
      if (apply) {
        const { error: updErr } = await supabase.from('obra_cost_items' as any).update({ sub_phase: subPhase }).eq('id', item.id);
        if (updErr) console.error(`[error] failed to update item ${item.id}: ${updErr.message}`);
      }
    }
  }

  console.log('\n---');
  console.log(`Obres sense budget_id (omeses): ${totalSkippedNoBudget}`);
  console.log(`Partides emparellades ${apply ? '(actualitzades)' : '(pendents — executa amb --apply)'}: ${totalMatched}`);
  console.log(`Partides sense sub_phase a recalcular (match exacte però sense subfase original): ${totalNothingToBackfill}`);
  console.log(`Partides sense coincidència (revisar manualment): ${totalUnmatched}`);
  console.log(`Partides ambigües, 2+ coincidències (revisar manualment): ${totalAmbiguous}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
