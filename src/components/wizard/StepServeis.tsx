import { useBudgetStore, type MaintenancePlan } from '@/stores/budgetStore';
import { ArrowLeft, ArrowRight, Clock, Car, Fuel, ParkingCircle, Calendar, Package, RotateCcw } from 'lucide-react';
import { NumberInput } from '@/components/ui/NumberInput';
import { useEffect, useMemo } from 'react';
import { useMaintenanceMaterials, MATERIAL_DEFS, type MaterialKey } from '@/lib/maintenanceMaterials';
import {
  VISIT_FREQ_OPTIONS,
  visitsForFrequency,
  visitsFromFrequency,
  frequencyFromVisits,
  type MaintenanceVisitFreq,
} from '@/lib/maintenanceVisits';

const MONTHS = [
  'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny',
  'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre',
];

const DEFAULT_PLAN: MaintenancePlan = {
  visitsPerMonth: Array(12).fill(0),
  visitFrequency: Array(12).fill('none') as MaintenanceVisitFreq[],
  visitDurationHours: 1,
  hourlyCost: 25,
  parkingCostPerVisit: 0,
  vanMonthlyRenting: 300,
  fuelCostPerHour: 3,
};

// Default seasonal visit plan per pool type. Months Jan..Dec.
const DEFAULT_FREQ_BY_POOL_TYPE: Record<string, MaintenanceVisitFreq[]> = {
  particular: [
    'monthly2','monthly2','monthly2','monthly2',
    'weekly1','weekly1','weekly1','weekly1','weekly1','weekly1',
    'monthly2','monthly2',
  ],
  comunitaria: [
    'monthly2','monthly2','monthly2','monthly2',
    'weekly2','weekly2','weekly2','weekly2','weekly2','weekly2',
    'monthly2','monthly2',
  ],
};

const fmtEur = (v: number) =>
  new Intl.NumberFormat('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' €';

export function StepServeis() {
  const { draft, updateDraft, setStep } = useBudgetStore();
  const plan: MaintenancePlan = { ...DEFAULT_PLAN, ...(draft.maintenancePlan || {}) };
  // Ensure array of 12
  if (!plan.visitsPerMonth || plan.visitsPerMonth.length !== 12) {
    plan.visitsPerMonth = Array(12).fill(0);
  }
  if (!plan.visitFrequency || plan.visitFrequency.length !== 12) {
    // Back-fill from the legacy raw counts when opening an older budget.
    plan.visitFrequency = plan.visitsPerMonth.map(frequencyFromVisits);
  }

  const planYear = (() => {
    const d = draft.budgetDate ? new Date(draft.budgetDate) : new Date();
    return Number.isFinite(d.getTime()) ? d.getFullYear() : new Date().getFullYear();
  })();

  const update = (patch: Partial<MaintenancePlan>) => {
    updateDraft({ maintenancePlan: { ...plan, ...patch } });
  };

  // Prefill default visit frequency based on pool type. Re-applied whenever
  // the pool type changes (so switching particular ↔ comunitària updates
  // the recommended periodicity). Uses a persisted marker so it survives
  // remounts when navigating between wizard steps.
  useEffect(() => {
    const poolType = draft.poolType;
    if (!poolType) return;
    const defaults = DEFAULT_FREQ_BY_POOL_TYPE[poolType];
    if (!defaults) return;
    const freq = plan.visitFrequency || [];
    const counts = plan.visitsPerMonth || [];
    const untouched =
      freq.every((f) => !f || f === 'none') &&
      counts.every((c) => !c);
    const appliedFor = plan.defaultsAppliedForPoolType;
    const poolTypeChanged = !!appliedFor && appliedFor !== poolType;
    if (!untouched && !poolTypeChanged) return;
    const vArr = visitsFromFrequency(defaults, planYear);
    update({
      visitFrequency: [...defaults],
      visitsPerMonth: vArr,
      defaultsAppliedForPoolType: poolType,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.poolType]);

  // A second pool sharing the same visit needs more time on-site. Bump the
  // default 1h → 1.5h once, but only if the user hasn't already touched the
  // duration by hand — same "apply once, marker-guarded" pattern as the
  // pool-type visit defaults above. Symmetrically, turning the toggle back
  // off reverts to 1h only if that 1.5h came from this auto-bump (marker
  // still true); a manual edit clears the marker and is left untouched.
  useEffect(() => {
    if (draft.hasSecondPool) {
      if (plan.secondPoolDurationApplied) return;
      if ((plan.visitDurationHours ?? DEFAULT_PLAN.visitDurationHours) === DEFAULT_PLAN.visitDurationHours) {
        update({ visitDurationHours: 1.5, secondPoolDurationApplied: true });
      } else {
        update({ secondPoolDurationApplied: true });
      }
    } else if (plan.secondPoolDurationApplied) {
      update({ visitDurationHours: 1, secondPoolDurationApplied: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.hasSecondPool]);

  const setMaterialQty = (key: MaterialKey, value: number | undefined) => {
    const next = { ...(plan.materialQty || {}) };
    if (value === undefined) delete next[key];
    else next[key] = value;
    // Clear total override too so it recomputes from qty * unit
    const nextTot = { ...(plan.materialTotal || {}) };
    delete nextTot[key];
    update({ materialQty: next, materialTotal: nextTot });
  };
  const setMaterialTotal = (key: MaterialKey, value: number | undefined) => {
    const next = { ...(plan.materialTotal || {}) };
    if (value === undefined) delete next[key];
    else next[key] = value;
    update({ materialTotal: next });
  };
  const resetMaterial = (key: MaterialKey) => {
    const q = { ...(plan.materialQty || {}) };
    const t = { ...(plan.materialTotal || {}) };
    delete q[key];
    delete t[key];
    update({ materialQty: q, materialTotal: t });
  };

  const setFrequency = (idx: number, value: MaintenanceVisitFreq) => {
    const fArr = [...(plan.visitFrequency || Array(12).fill('none'))] as MaintenanceVisitFreq[];
    fArr[idx] = value;
    const vArr = visitsFromFrequency(fArr, planYear);
    update({ visitFrequency: fArr, visitsPerMonth: vArr });
  };

  const calc = useMemo(() => {
    const totalVisits = plan.visitsPerMonth.reduce((a, b) => a + (b || 0), 0);
    const totalHours = totalVisits * (plan.visitDurationHours || 0);
    const totalLabour = totalHours * (plan.hourlyCost || 0);
    const totalParking = totalVisits * (plan.parkingCostPerVisit || 0);
    // Van cost/hour = (monthly renting × 12) / (40h × 48 weeks)
    const billableHoursYear = 40 * 48;
    const vanCostPerHour = ((plan.vanMonthlyRenting || 0) * 12) / billableHoursYear;
    const totalVan = totalHours * vanCostPerHour;
    const totalFuel = totalHours * (plan.fuelCostPerHour || 0);
    const grandTotal = totalLabour + totalParking + totalVan + totalFuel;
    return { totalVisits, totalHours, totalLabour, totalParking, vanCostPerHour, totalVan, totalFuel, grandTotal };
  }, [plan]);

  const materials = useMaintenanceMaterials(draft, calc.grandTotal);

  const sectionCard = 'bg-card rounded-xl border border-border p-5 shadow-card space-y-4';
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Pla de Manteniment</h2>
        <p className="text-sm text-muted-foreground mt-1">Defineix la planificació de visites i els costos associats</p>
      </div>

      {/* Planificació de visites */}
      <div className={sectionCard}>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Planificació de visites</h3>
        </div>
        <p className="text-xs text-muted-foreground">Indica quantes visites planifiques cada mes per a aquesta piscina</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {MONTHS.map((m, idx) => {
            const freq = (plan.visitFrequency?.[idx] || 'none') as MaintenanceVisitFreq;
            const count = visitsForFrequency(freq, planYear, idx);
            return (
              <div key={m} className="rounded-lg border border-border p-2.5 bg-muted/20">
                <label className={labelClass + ' flex items-center justify-between'}>
                  <span>{m}</span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {count} {count === 1 ? 'visita' : 'visites'}
                  </span>
                </label>
                <select
                  value={freq}
                  onChange={(e) => setFrequency(idx, e.target.value as MaintenanceVisitFreq)}
                  className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {VISIT_FREQ_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-border">
          <div>
            <label className={labelClass}>Durada de cada visita (h)</label>
            <NumberInput
              value={plan.visitDurationHours}
              onChange={(v) => update({ visitDurationHours: v ?? 0, secondPoolDurationApplied: false })}
            />
          </div>
          <div>
            <label className={labelClass}>Cost per hora (€)</label>
            <NumberInput
              value={plan.hourlyCost}
              onChange={(v) => update({ hourlyCost: v ?? 0 })}
            />
          </div>
          <div className="flex flex-col justify-end">
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <div className="text-xs text-muted-foreground">Total visites · hores anuals</div>
              <div className="font-semibold text-foreground">
                {calc.totalVisits} visites · {calc.totalHours.toFixed(2)} h
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Clock className="w-4 h-4 text-primary" />
            Cost total mà d'obra (hores × cost/hora)
          </div>
          <div className="font-bold text-primary">{fmtEur(calc.totalLabour)}</div>
        </div>
      </div>

      {/* Cost vehicle, combustible i parking */}
      <div className={sectionCard}>
        <div className="flex items-center gap-2">
          <Car className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Cost vehicle, combustible i parking</h3>
        </div>

        {/* Parking */}
        <div className="space-y-2 pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ParkingCircle className="w-4 h-4 text-muted-foreground" /> Parking
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Cost del parking per visita (€)</label>
              <NumberInput
                value={plan.parkingCostPerVisit}
                onChange={(v) => update({ parkingCostPerVisit: v ?? 0 })}
              />
            </div>
            <div className="flex flex-col justify-end">
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">Total parking ({calc.totalVisits} visites)</div>
                <div className="font-semibold text-foreground">{fmtEur(calc.totalParking)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle */}
        <div className="space-y-2 pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Car className="w-4 h-4 text-muted-foreground" /> Vehicle (renting furgoneta)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Renting mensual (€)</label>
              <NumberInput
                value={plan.vanMonthlyRenting}
                onChange={(v) => update({ vanMonthlyRenting: v ?? 0 })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cost/hora = (renting × 12) / (40h × 48 setmanes) = <strong>{fmtEur(calc.vanCostPerHour)}</strong>/h
              </p>
            </div>
            <div className="flex flex-col justify-end">
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">Cost vehicle ({calc.totalHours.toFixed(2)} h)</div>
                <div className="font-semibold text-foreground">{fmtEur(calc.totalVan)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Fuel */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Fuel className="w-4 h-4 text-muted-foreground" /> Combustible
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Combustible per hora (€)</label>
              <NumberInput
                value={plan.fuelCostPerHour}
                onChange={(v) => update({ fuelCostPerHour: v ?? 0 })}
              />
            </div>
            <div className="flex flex-col justify-end">
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">Total combustible ({calc.totalHours.toFixed(2)} h)</div>
                <div className="font-semibold text-foreground">{fmtEur(calc.totalFuel)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resum */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Cost operatiu anual (mà d'obra + vehicle)</div>
            <div className="text-xs text-muted-foreground mt-1">Mà d'obra + parking + vehicle + combustible</div>
          </div>
          <div className="text-2xl font-bold text-primary">{fmtEur(calc.grandTotal)}</div>
        </div>
      </div>

      {/* Materials */}
      <div className={sectionCard}>
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Materials</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Quantitats calculades automàticament segons mides de la piscina, electròlisi i tipus.
          Pots editar quantitats o el total per cada producte.
        </p>

        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="py-2 pr-2">Producte</th>
                <th className="py-2 px-2 w-32">Quantitat</th>
                <th className="py-2 px-2 w-24 hidden md:table-cell">Preu/u</th>
                <th className="py-2 px-2 w-36">Total (€)</th>
                <th className="py-2 pl-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {materials.rows.filter((r) => r.visible).map((row) => {
                const def = MATERIAL_DEFS.find((d) => d.key === row.key)!;
                const qtyOverridden = plan.materialQty?.[row.key] !== undefined;
                const totalOverridden = plan.materialTotal?.[row.key] !== undefined;
                const isVarios = row.key === 'varios';
                return (
                  <tr key={row.key} className="border-b border-border last:border-0">
                    <td className="py-2 pr-2">
                      <div className="font-medium text-foreground">{def.label}</div>
                      <div className="text-xs text-muted-foreground">{def.articleName}</div>
                    </td>
                    <td className="py-2 px-2">
                      <NumberInput
                        value={row.qty}
                        onChange={(v) => setMaterialQty(row.key, v)}
                        className={qtyOverridden ? 'border-warning/60' : ''}
                      />
                    </td>
                    <td className="py-2 px-2 hidden md:table-cell text-muted-foreground">
                      {isVarios ? '—' : fmtEur(row.unitSale)}
                    </td>
                    <td className="py-2 px-2">
                      <NumberInput
                        value={row.total}
                        onChange={(v) => setMaterialTotal(row.key, v)}
                        className={totalOverridden ? 'border-warning/60 font-semibold' : ''}
                      />
                    </td>
                    <td className="py-2 pl-2">
                      {(qtyOverridden || totalOverridden) && (
                        <button
                          type="button"
                          onClick={() => resetMaterial(row.key)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                          title="Restaurar valor automàtic"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pt-3 border-t border-border">
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm inline-flex flex-col">
            <div className="text-xs text-muted-foreground">Subtotal materials</div>
            <div className="font-semibold text-foreground">{fmtEur(materials.subtotal)}</div>
          </div>
        </div>
      </div>

      {/* Total anual / mensual */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-primary/20">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Subtotal global</div>
            <div className="text-xs text-muted-foreground mt-1">Cost operatiu anual + subtotal materials</div>
          </div>
          <div className="text-lg font-bold text-foreground">{fmtEur(calc.grandTotal + materials.subtotal)}</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3 border-b border-primary/20">
          <div>
            <label className={labelClass}>% estructural</label>
            <div className="flex items-center gap-2">
              <NumberInput
                value={materials.structuralPct}
                onChange={(v) => update({ structuralPct: v ?? 0 })}
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">= {fmtEur(materials.structuralAmount)}</span>
            </div>
          </div>
          <div>
            <label className={labelClass}>% benefici</label>
            <div className="flex items-center gap-2">
              <NumberInput
                value={materials.benefitPct}
                onChange={(v) => update({ benefitPct: v ?? 0 })}
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">= {fmtEur(materials.benefitAmount)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total anual</div>
            <div className="text-xs text-muted-foreground mt-1">Subtotal global + estructural + benefici</div>
          </div>
          <div className="text-2xl font-bold text-primary">{fmtEur(materials.totalAnual)}</div>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-primary/20">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total mensual</div>
            <div className="text-xs text-muted-foreground mt-1">Total anual / 12</div>
          </div>
          <div className="text-xl font-bold text-primary">{fmtEur(materials.totalMensual)}</div>
        </div>
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={() => setStep(3)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Enrere
        </button>
        <button type="button" onClick={() => setStep(5)} className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md min-h-[44px]">
          Següent <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
