import { useBudgetStore } from '@/stores/budgetStore';
import { ArrowLeft, ArrowRight, Plus, Trash2, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { createDefaultObraNovaPhases, serializeBudgetPhases } from '@/lib/formulaPhases';
import { formatEUR } from '@/lib/formatters';
import {
  isOptionalSubPhase,
  countableItems,
  lineSaleBase,
  lineSaleDisplay as sharedLineSaleDisplay,
  itemsSaleDisplay as sharedItemsSaleDisplay,
  computePhaseTotals,
  computeGrandTotal,
} from '@/lib/budgetFinancials';
import { NumberInput } from '@/components/ui/NumberInput';
import { useShowMargins } from '@/hooks/useShowMargins';
interface LineItem {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number;
  unitSale: number;
  source?: 'formula' | 'manual' | 'wizard';
  formulaRuleId?: string;
  subPhase?: string | null;
  userEdited?: boolean;
}

interface Phase {
  id: string;
  name: string;
  items: LineItem[];
  isOpen: boolean;
}

const createItem = (): LineItem => ({
  id: crypto.randomUUID(),
  description: '',
  unit: 'ud',
  quantity: 1,
  unitCost: 0,
  unitSale: 0,
  source: 'manual',
});

const createPhaseId = (name: string) => `phase-${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

const serializeLocalPhases = (phases: Phase[]) => serializeBudgetPhases(
  phases.map(({ isOpen, ...phase }, index) => ({
    ...phase,
    order: index,
  }))
);

export function StepPartides() {
  const { setStep, draft, updateDraft, getLastStep } = useBudgetStore();
  const nextStep = getLastStep();
  const prevStep = draft.type === 'obra_nueva' ? (draft.hasJacuzzi ? 8 : 7) : draft.type === 'piscina_autoportant' ? 5 : 4;
  const isObraNova = draft.type === 'obra_nueva';

  const getDefaultPhases = (): Phase[] => {
    if (draft.type === 'rehabilitacion') {
      const works = draft.rehabWorks || [];
      const phases: Phase[] = works.map((work, index) => ({ id: createPhaseId(work), name: work, items: [], isOpen: index === 0 }));
      phases.push({ id: createPhaseId('Varios / Extres'), name: 'Varios / Extres', items: [], isOpen: false });
      return phases.length === 1 ? [{ id: createPhaseId('Treballs'), name: 'Treballs', items: [], isOpen: true }, ...phases] : phases;
    }

    if (draft.type === 'mantenimiento') {
      const services = draft.maintenanceServices || [];
      const phases: Phase[] = services.map((service, index) => ({ id: createPhaseId(service), name: service, items: [], isOpen: index === 0 }));
      phases.push({ id: createPhaseId('Varios / Extres'), name: 'Varios / Extres', items: [], isOpen: false });
      return phases.length === 1 ? [{ id: createPhaseId('Serveis'), name: 'Serveis', items: [], isOpen: true }, ...phases] : phases;
    }

    if (draft.type === 'piscina_autoportant') {
      return [
        { id: 'phase-piscina-autoportant', name: 'Piscina', items: [], isOpen: true },
        { id: 'phase-opcionals-autoportant', name: 'Opcionals', items: [], isOpen: true },
      ];
    }

    return createDefaultObraNovaPhases().map((phase, index) => ({
      ...phase,
      items: phase.items as LineItem[],
      isOpen: index === 0,
    }));
  };

  const mapDraftPhasesToLocal = (previousOpen: Phase[] = []): Phase[] => {
    if (!draft.phases || draft.phases.length === 0) {
      return getDefaultPhases();
    }

    return draft.phases.map((phase, index) => ({
      id: phase.id || createPhaseId(phase.name),
      name: phase.name,
      items: phase.items.map((item) => ({
        ...item,
        source: item.source === 'formula' || item.source === 'wizard' ? item.source : 'manual',
        subPhase: item.subPhase ?? null,
        userEdited: item.userEdited === true,
      })),
      isOpen: previousOpen.find((entry) => entry.id === phase.id)?.isOpen ?? previousOpen.find((entry) => entry.name === phase.name)?.isOpen ?? index === 0,
    }));
  };

  const [phases, setPhases] = useState<Phase[]>(() => mapDraftPhasesToLocal());
  const [adjustmentPct, setAdjustmentPct] = useState<number>(draft.marginPctAdjustment || 0);
  const [openSubPhases, setOpenSubPhases] = useState<Record<string, boolean>>({});
  const [showMargins, , toggleMargins] = useShowMargins();

  useEffect(() => {
    setPhases((previousPhases) => {
      const nextPhases = mapDraftPhasesToLocal(previousPhases);
      return serializeLocalPhases(nextPhases) === serializeLocalPhases(previousPhases) ? previousPhases : nextPhases;
    });
  }, [draft.phases, draft.type, draft.rehabWorks, draft.maintenanceServices]);

  useEffect(() => {
    const serializedDraft = serializeBudgetPhases(draft.phases || []);
    const serializedLocal = serializeLocalPhases(phases);

    if (serializedDraft !== serializedLocal) {
      updateDraft({
        phases: phases.map(({ isOpen, ...phase }, index) => ({
          ...phase,
          order: index,
        })),
      });
    }
  }, [phases, draft.phases, updateDraft]);

  useEffect(() => {
    if ((draft.marginPctAdjustment || 0) !== adjustmentPct) {
      updateDraft({ marginPctAdjustment: adjustmentPct });
    }
  }, [adjustmentPct, draft.marginPctAdjustment, updateDraft]);

  const togglePhase = (index: number) => setPhases((currentPhases) => currentPhases.map((phase, phaseIndex) => phaseIndex === index ? { ...phase, isOpen: !phase.isOpen } : phase));
  const toggleSubPhase = (key: string) => setOpenSubPhases((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
  const addItem = (index: number, subPhase?: string | null) => setPhases((currentPhases) => currentPhases.map((phase, phaseIndex) => phaseIndex === index ? { ...phase, items: [...phase.items, { ...createItem(), subPhase: subPhase ?? null }] } : phase));
  const removeItem = (phaseIndex: number, itemId: string) => setPhases((currentPhases) => currentPhases.map((phase, currentIndex) => currentIndex === phaseIndex ? { ...phase, items: phase.items.filter((item) => item.id !== itemId) } : phase));
  const updateItem = (phaseIndex: number, itemId: string, field: keyof LineItem, value: string | number) => {
    const marksAsEdited = field === 'quantity' || field === 'unitCost' || field === 'unitSale';
    setPhases((currentPhases) => currentPhases.map((phase, currentIndex) => currentIndex === phaseIndex ? {
      ...phase,
      items: phase.items.map((item) => item.id === itemId
        ? { ...item, [field]: value, ...(marksAsEdited && (item.source === 'formula' || (item as any).wizardKey) ? { userEdited: true } : {}) }
        : item),
    } : phase));
  };

  const showIncrement = adjustmentPct > 0;
  const lineSaleDisplay = (item: LineItem, optional = false) => sharedLineSaleDisplay(item, adjustmentPct, optional);
  const itemsSaleDisplay = (items: LineItem[], optional = false) => sharedItemsSaleDisplay(items, adjustmentPct, optional);
  // For visual feedback in the partides list: positive adjustments are
  // propagated to every displayed amount (same behaviour as the PDF).
  // Negative adjustments (descompte) stay as a separate line in the summary.
  // See src/lib/budgetFinancials.ts for the shared rule (also used by
  // StepRevisio.tsx's Resum Financer, so both panels always agree).
  const grandTotal = computeGrandTotal(phases, adjustmentPct);
  const totalCost = grandTotal.cost;
  const totalSale = grandTotal.sale;
  const markup = grandTotal.marginPct;
  const phaseTotalsByName = new Map(computePhaseTotals(phases, adjustmentPct).map((p) => [p.name, p]));

  const inputClass = 'w-full px-2 py-1.5 rounded border border-input bg-card text-sm focus:outline-none focus:ring-1 focus:ring-ring/20 min-h-[44px]';

  const groupBySubPhase = (items: LineItem[]): Array<{ name: string; items: LineItem[]; total: number; displayTotal: number; cost: number }> => {
    const groups = new Map<string, LineItem[]>();
    for (const item of items) {
      const key = item.subPhase || 'General';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries()).map(([name, groupItems]) => ({
      name,
      items: groupItems,
      total: groupItems.reduce((s, i) => s + lineSaleBase(i), 0),
      displayTotal: itemsSaleDisplay(groupItems, isOptionalSubPhase(name)),
      cost: groupItems.reduce((s, i) => s + i.quantity * i.unitCost, 0),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Partides i Fases</h2>
          <p className="text-sm text-muted-foreground mt-1">Afegeix les partides de cada fase del pressupost</p>
          {isObraNova && (
            <p className="text-xs text-primary mt-2">Les partides automàtiques es recalculen mentre completes el wizard.</p>
          )}
        </div>
        <button
          type="button"
          onClick={toggleMargins}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors min-h-[40px]',
            showMargins
              ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
              : 'border-border bg-muted text-muted-foreground hover:bg-muted/80',
          )}
          title={showMargins ? 'Ocultar costos i marges' : 'Mostrar costos i marges'}
        >
          {showMargins ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {showMargins ? 'Marges visibles' : 'Marges ocults'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0 space-y-4">
          {phases.map((phase, phaseIndex) => {
            const phaseTotalBase = phaseTotalsByName.get(phase.name)?.saleBase ?? 0;
            const phaseTotal = phaseTotalsByName.get(phase.name)?.sale ?? 0;
            return (
              <div key={phase.id} className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                <button onClick={() => togglePhase(phaseIndex)} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-foreground">{phase.name}</h3>
                    <span className="text-xs text-muted-foreground">{phase.items.length} partides</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">{phaseTotal.toLocaleString('ca-ES', { minimumFractionDigits: 2 })} €</span>
                    {showIncrement && phaseTotalBase > 0 && (
                      <span className="text-[10px] text-warning font-semibold">+{adjustmentPct}%</span>
                    )}
                    <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', phase.isOpen && 'rotate-180')} />
                  </div>
                </button>
                {phase.isOpen && (
                  <div className="border-t border-border p-4 space-y-4">
                    {groupBySubPhase(phase.items).map((group) => {
                      const isOptionalGroup = isOptionalSubPhase(group.name);
                      const subKey = `${phase.id}::${group.name}`;
                      const isSubOpen = openSubPhases[subKey] ?? false;
                      const subMarkup = group.cost > 0 ? ((group.total - group.cost) / group.cost) * 100 : 0;
                      return (
                        <div key={subKey} className={cn(
                          'rounded-lg border overflow-hidden',
                          isOptionalGroup ? 'border-warning/40 bg-warning/5' : 'border-border/60 bg-muted/20'
                        )}>
                          <button
                            onClick={() => toggleSubPhase(subKey)}
                            className={cn(
                              'w-full flex items-center justify-between px-3 py-2.5 transition-colors',
                              isOptionalGroup ? 'hover:bg-warning/10' : 'hover:bg-muted/40'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              {isSubOpen
                                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                              <span className={cn('text-sm font-medium', isOptionalGroup ? 'text-warning' : 'text-foreground')}>{group.name}</span>
                              <span className="text-[11px] text-muted-foreground">{group.items.length} partides</span>
                              {showMargins && !isOptionalGroup && group.cost > 0 && (
                                <span className={cn(
                                  'text-[10px] font-bold px-1.5 py-0.5 rounded',
                                  subMarkup >= 30 ? 'text-success bg-success/10' : subMarkup >= 20 ? 'text-warning bg-warning/10' : 'text-destructive bg-destructive/10'
                                )}>
                                  {subMarkup.toFixed(0)}%
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              {showMargins && isSubOpen && (
                                <span className="text-xs text-muted-foreground tabular-nums">cost {group.cost.toLocaleString('ca-ES', { minimumFractionDigits: 2 })} €</span>
                              )}
                              {(() => {
                                const val = showIncrement && !isOptionalGroup ? group.displayTotal : group.total;
                                return (
                                  <span className={cn(
                                    'text-sm font-semibold',
                                    isOptionalGroup ? 'text-warning line-through opacity-60' : 'text-foreground'
                                  )} title={isOptionalGroup ? 'Opcional · no se suma al total' : undefined}>
                                    {val.toLocaleString('ca-ES', { minimumFractionDigits: 2 })} €
                                  </span>
                                );
                              })()}
                            </div>
                          </button>
                          {isSubOpen && (
                            <div className="border-t border-border/60 p-3 space-y-2 bg-card">
                              <div className={cn(
                                'hidden lg:grid gap-1.5 items-end px-1',
                                showMargins
                                  ? 'lg:grid-cols-[minmax(180px,2.5fr)_60px_60px_80px_80px_85px_90px_52px_28px]'
                                  : 'lg:grid-cols-[minmax(180px,2.5fr)_60px_60px_80px_90px_28px]',
                              )}>
                                <span className="text-[10px] text-muted-foreground uppercase">Descripció</span>
                                <span className="text-[10px] text-muted-foreground uppercase">Unitat</span>
                                <span className="text-[10px] text-muted-foreground uppercase">Qty</span>
                                {showMargins && <span className="text-[10px] text-muted-foreground uppercase">P. Cost €</span>}
                                <span className="text-[10px] text-muted-foreground uppercase">P. Venda €</span>
                                {showMargins && <span className="text-[10px] text-muted-foreground uppercase text-right">Total Cost</span>}
                                <span className="text-[10px] text-muted-foreground uppercase text-right">Total Venda</span>
                                {showMargins && <span className="text-[10px] text-muted-foreground uppercase text-center">Marge</span>}
                                <span></span>
                              </div>
                              {group.items.map((item) => {
                                const itemMarkup = item.unitCost > 0 ? ((item.unitSale - item.unitCost) / item.unitCost) * 100 : 0;
                                const itemTotalCost = item.quantity * item.unitCost;
                                const itemTotalSale = lineSaleDisplay(item, isOptionalSubPhase(group.name));
                                return (
                                  <div key={item.id} className={cn(
                                    'grid grid-cols-12 gap-1.5 items-start',
                                    showMargins
                                      ? 'lg:grid-cols-[minmax(180px,2.5fr)_60px_60px_80px_80px_85px_90px_52px_28px]'
                                      : 'lg:grid-cols-[minmax(180px,2.5fr)_60px_60px_80px_90px_28px]',
                                  )}>
                                    <div className="col-span-12 lg:col-span-1">
                                      <textarea
                                        value={item.description}
                                        onChange={(e) => updateItem(phaseIndex, item.id, 'description', e.target.value)}
                                        className={cn(inputClass, 'resize-y min-h-[36px] leading-snug py-2 whitespace-pre-wrap break-words')}
                                        placeholder="Descripció..."
                                        rows={2}
                                        title={item.description}
                                      />
                                    </div>
                                    <div className="col-span-3 lg:col-span-1">
                                      <select value={item.unit} onChange={(e) => updateItem(phaseIndex, item.id, 'unit', e.target.value)} className={cn(inputClass, 'appearance-none pr-1 text-center text-xs')}>
                                        <option value="ud">ud</option>
                                        <option value="m²">m²</option>
                                        <option value="ml">ml</option>
                                        <option value="l">l</option>
                                        <option value="kg">kg</option>
                                        <option value="m³">m³</option>
                                        <option value="sacs">sacs</option>
                                      </select>
                                    </div>
                                    <div className="col-span-3 lg:col-span-1">
                                      <NumberInput value={item.quantity} onChange={(v) => updateItem(phaseIndex, item.id, 'quantity', v ?? 0)} className={cn(inputClass, 'text-center')} />
                                    </div>
                                    {showMargins && (
                                      <div className="col-span-3 lg:col-span-1">
                                        <NumberInput value={item.unitCost} onChange={(v) => updateItem(phaseIndex, item.id, 'unitCost', v ?? 0)} className={inputClass} />
                                      </div>
                                    )}
                                    <div className="col-span-3 lg:col-span-1">
                                      <NumberInput value={item.unitSale} onChange={(v) => updateItem(phaseIndex, item.id, 'unitSale', v ?? 0)} className={inputClass} />
                                    </div>
                                    {showMargins && (
                                      <div className="col-span-6 lg:col-span-1 flex items-center justify-end">
                                        <span className="text-xs font-medium text-muted-foreground tabular-nums">{itemTotalCost.toLocaleString('ca-ES', { minimumFractionDigits: 2 })} €</span>
                                      </div>
                                    )}
                                    <div className="col-span-6 lg:col-span-1 flex items-center justify-end">
                                      <span className="text-xs font-semibold text-foreground tabular-nums">{itemTotalSale.toLocaleString('ca-ES', { minimumFractionDigits: 2 })} €</span>
                                    </div>
                                    {showMargins && (
                                      <div className="col-span-6 lg:col-span-1 flex items-center justify-center">
                                        <span className={cn(
                                          'text-xs font-bold px-2 py-1 rounded-full min-w-[42px] text-center',
                                          item.unitCost > 0
                                            ? (itemMarkup >= 30 ? 'text-success bg-success/10' : itemMarkup >= 20 ? 'text-warning bg-warning/10' : 'text-destructive bg-destructive/10')
                                            : 'text-muted-foreground'
                                        )}>
                                          {item.unitCost > 0 ? `${itemMarkup.toFixed(0)}%` : '-'}
                                        </span>
                                      </div>
                                    )}
                                    <div className="col-span-6 lg:col-span-1 flex justify-end lg:justify-center">
                                      <button onClick={() => removeItem(phaseIndex, item.id)} className="p-1.5 rounded hover:bg-destructive/10">
                                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                              <button onClick={() => addItem(phaseIndex, group.name === 'General' ? null : group.name)} className="flex items-center gap-2 text-xs text-primary font-medium hover:underline mt-1">
                                <Plus className="w-3.5 h-3.5" /> Afegir partida a {group.name}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {phase.items.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">Sense partides encara.</p>
                    )}
                    <button onClick={() => addItem(phaseIndex)} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                      <Plus className="w-4 h-4" /> Afegir partida (General)
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="lg:w-72 flex-shrink-0">
          <div className="bg-card rounded-xl border border-border shadow-card p-5 lg:sticky lg:top-8 space-y-4">
            <h3 className="font-semibold text-foreground">Resum Financer</h3>
            {phases.map((phase) => {
              const totalBase = phaseTotalsByName.get(phase.name)?.saleBase ?? 0;
              const total = phaseTotalsByName.get(phase.name)?.sale ?? 0;
              return totalBase > 0 ? (
                <div key={phase.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{phase.name}</span>
                  <span className="text-foreground font-medium">{formatEUR(total)}</span>
                </div>
              ) : null;
            })}
            <div className="border-t border-border pt-3 space-y-2">
              {showMargins && (
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total cost</span><span className="text-foreground">{formatEUR(totalCost)}</span></div>
              )}
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total venda</span><span className="text-foreground font-medium">{formatEUR(totalSale)}</span></div>
              {showMargins && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Marge (s/venda)</span>
                    <span className={cn('font-bold', markup >= 30 ? 'text-success' : markup >= 20 ? 'text-warning' : 'text-destructive')}>{markup.toFixed(2)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', markup >= 30 ? 'bg-success' : markup >= 20 ? 'bg-warning' : 'bg-destructive')} style={{ width: `${Math.min(markup, 60) * 1.66}%` }} />
                  </div>
                </>
              )}
              <div className="border-t border-border pt-2 mt-2">
                <label className="block text-xs text-muted-foreground mb-1">Ajust de preu (%)</label>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setAdjustmentPct(Math.round((adjustmentPct - 1) * 10) / 10)} className="w-9 h-9 rounded-lg border border-border bg-muted flex items-center justify-center text-base font-bold text-foreground hover:bg-muted/80 transition-colors">−</button>
                  <NumberInput value={adjustmentPct} onChange={(v) => setAdjustmentPct(v ?? 0)} className="w-16 px-1 py-1.5 rounded border border-input bg-card text-sm text-center min-h-[36px]" placeholder="0" />
                  <button type="button" onClick={() => setAdjustmentPct(Math.round((adjustmentPct + 1) * 10) / 10)} className="w-9 h-9 rounded-lg border border-border bg-muted flex items-center justify-center text-base font-bold text-foreground hover:bg-muted/80 transition-colors">+</button>
                  <span className="text-xs text-muted-foreground ml-1">%</span>
                </div>
                {adjustmentPct !== 0 && (
                  <p className="text-xs mt-1">
                    {adjustmentPct > 0 ? (
                      <span className="text-warning">Increment: +{adjustmentPct}% → {formatEUR(totalSale)}</span>
                    ) : (
                      <span className="text-primary">Descompte: {adjustmentPct}% → {formatEUR(totalSale)}</span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex justify-between text-base font-bold border-t border-border pt-2">
                <span className="text-foreground">TOTAL VENDA</span>
                <span className="text-primary">{formatEUR(totalSale)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={() => setStep(prevStep)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Enrere
        </button>
        <button type="button" onClick={() => setStep(nextStep)} className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md min-h-[44px]">
          Següent <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}