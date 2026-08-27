/**
 * One-time maintenance script: backfill `obra_cost_items.sub_phase` for rows
 * created before that column existed (see
 * supabase/migrations/20260827090000_add_obra_cost_items_sub_phase.sql).
 *
 * This is a bootstrap file ONLY. It exists to install a `localStorage`
 * polyfill (Node has none, but `src/integrations/supabase/client.ts` — the
 * same client the app uses, reused here on purpose for exact fidelity with
 * populateObraFromBudget.ts — references it at module-eval time) *before*
 * the implementation module (which statically imports that client, plus
 * loadBudgetAsDraft / buildWizardLinesByPhase / evaluateFormulaRules /
 * mergeFormulaResultsIntoPhases) gets loaded. Static imports are hoisted, so
 * the polyfill has to live in a separate file loaded via dynamic import().
 *
 * HOW TO RUN (do not run against production without a backup / a supabase
 * point-in-time restore available, and start with --obra-id on one obra):
 *
 *   # Reads use the anon key by default (works for public tables like
 *   # formula_rules/articles, but obras/obra_cost_items/obra_phases and the
 *   # budget tables are RLS-restricted to their owning user). To run this
 *   # unattended across ALL obras you almost certainly need the service
 *   # role key so RLS doesn't hide/half-fill other people's obras:
 *   VITE_SUPABASE_PUBLISHABLE_KEY=<service_role_key> npx vite-node scripts/backfillSubPhase.ts -- --obra-id=<uuid-de-prova>
 *
 *   # Dry run (default) over every obra, no writes:
 *   VITE_SUPABASE_PUBLISHABLE_KEY=<service_role_key> npx vite-node scripts/backfillSubPhase.ts
 *
 *   # Apply for real, once the dry run output looks right:
 *   VITE_SUPABASE_PUBLISHABLE_KEY=<service_role_key> npx vite-node scripts/backfillSubPhase.ts -- --apply
 *
 * Flags:
 *   --obra-id=<uuid>   Restrict to a single obra (use this first, on a test
 *                      obra, before running unrestricted).
 *   --apply            Actually write sub_phase updates. Without it, the
 *                      script only prints what it WOULD do (dry run).
 *
 * Safety: the script only ever writes the single column `sub_phase`, via
 * `.update({ sub_phase })`. It never touches real_qty/real_unit_cost/notes
 * or any other column, and it skips is_extra rows entirely (those were
 * never part of the original budget, so there's nothing to recover for
 * them).
 */
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
}

await import('./backfillSubPhase.impl.ts');
