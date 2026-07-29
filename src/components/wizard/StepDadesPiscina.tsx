import { useBudgetStore } from '@/stores/budgetStore';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMaintenanceKit } from '@/lib/maintenanceKit';
import { formatEUR } from '@/lib/formatters';

const defaultKitItems = ['Llevafangs', 'Raspall', 'Recollidor de fulles'];
const mangueraOptions: Array<{ value: '8' | '10' | '12'; label: string }> = [
  { value: '8', label: '8 metres' },
  { value: '10', label: '10 metres' },
  { value: '12', label: '12 metres' },
];
const pertigaOptions: Array<{ value: 'petita' | 'mitjana' | 'gran'; label: string }> = [
  { value: 'petita', label: 'Petita' },
  { value: 'mitjana', label: 'Mitjana' },
  { value: 'gran', label: 'Gran' },
];

export function StepDadesPiscina() {
  const { draft, updateDraft, setStep } = useBudgetStore();
  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 min-h-[44px]';
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

  const length = draft.poolLength || 0;
  const width = draft.poolWidth || 0;
  const depth = draft.poolDepthAvg || 0;
  const volume = length && width && depth ? length * width * depth : 0;
  const kit = useMaintenanceKit(draft);

  const length2 = draft.poolLength2 || 0;
  const width2 = draft.poolWidth2 || 0;
  const depth2 = draft.poolDepthAvg2 || 0;
  const volume2 = length2 && width2 && depth2 ? length2 * width2 * depth2 : 0;

  // Desactivar la segona piscina neteja explícitament les seves 4 mides —
  // altrament dades obsoletes reapareixerien en reactivar el toggle, o es
  // filtrarien al càlcul de producte químic mentre el bloc està amagat.
  const handleToggleSecondPool = () => {
    if (!draft.hasSecondPool) {
      updateDraft({ hasSecondPool: true });
      return;
    }
    updateDraft({
      hasSecondPool: false,
      poolLength2: undefined,
      poolWidth2: undefined,
      poolDepthAvg2: undefined,
      hasElectrolisi2: undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Dades de la Piscina</h2>
        <p className="text-sm text-muted-foreground mt-1">Informació bàsica de la piscina a mantenir</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-5">
        <div>
          <label className={labelClass}>Tipus de piscina</label>
          <div className="flex gap-3">
            {(['particular', 'comunitaria'] as const).map(v => (
              <button key={v} onClick={() => updateDraft({ poolType: v })}
                className={cn('flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all min-h-[44px]',
                  draft.poolType === v ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                )}>{v === 'particular' ? 'Particular' : 'Comunitària'}</button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Mides de la piscina</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Llarg (m)</label>
              <input type="number" step="0.01" className={inputClass} value={draft.poolLength || ''} onChange={e => updateDraft({ poolLength: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) })} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Ample (m)</label>
              <input type="number" step="0.01" className={inputClass} value={draft.poolWidth || ''} onChange={e => updateDraft({ poolWidth: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) })} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Profunditat mitjana (m)</label>
              <input type="number" step="0.01" className={inputClass} value={draft.poolDepthAvg || ''} onChange={e => updateDraft({ poolDepthAvg: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) })} />
            </div>
          </div>
          {volume > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary font-medium">
              Volum estimat: <strong>{Math.ceil(volume)} m³</strong>
            </div>
          )}
        </div>

        <div>
          <label className={labelClass}>Té electròlisi?</label>
          <div className="flex gap-3">
            {[true, false].map(v => (
              <button key={String(v)} onClick={() => updateDraft({ hasElectrolisi: v })}
                className={cn('flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all min-h-[44px]',
                  draft.hasElectrolisi === v ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                )}>{v ? 'Sí' : 'No'}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            <label className="text-sm font-medium text-foreground">Segona piscina</label>
            <p className="text-xs text-muted-foreground mt-0.5">El mateix contracte de manteniment inclou una segona piscina (mateixa visita).</p>
          </div>
          <button onClick={handleToggleSecondPool}
            className={cn('w-12 h-6 rounded-full transition-colors relative flex-shrink-0', draft.hasSecondPool ? 'bg-primary' : 'bg-muted')}>
            <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform', draft.hasSecondPool ? 'translate-x-6' : 'translate-x-0.5')} />
          </button>
        </div>

        {draft.hasSecondPool && (
          <div className="pt-2 space-y-5">
            <div>
              <label className={labelClass}>Mides de la segona piscina</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Llarg (m)</label>
                  <input type="number" step="0.01" className={inputClass} value={draft.poolLength2 || ''} onChange={e => updateDraft({ poolLength2: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) })} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Ample (m)</label>
                  <input type="number" step="0.01" className={inputClass} value={draft.poolWidth2 || ''} onChange={e => updateDraft({ poolWidth2: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) })} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Profunditat mitjana (m)</label>
                  <input type="number" step="0.01" className={inputClass} value={draft.poolDepthAvg2 || ''} onChange={e => updateDraft({ poolDepthAvg2: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) })} />
                </div>
              </div>
              {volume2 > 0 && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary font-medium">
                  Volum estimat: <strong>{Math.ceil(volume2)} m³</strong>
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>Té electròlisi? (segona piscina)</label>
              <div className="flex gap-3">
                {[true, false].map(v => (
                  <button key={String(v)} onClick={() => updateDraft({ hasElectrolisi2: v })}
                    className={cn('flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all min-h-[44px]',
                      draft.hasElectrolisi2 === v ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                    )}>{v ? 'Sí' : 'No'}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-5">
        <div>
          <h3 className="text-base font-semibold text-foreground">Kit de neteja</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Articles inclosos per defecte. Tria la mida de mànega i pèrtiga.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {defaultKitItems.map(item => (
            <span key={item} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 text-success border border-success/20 text-xs font-medium">
              ✓ {item}
            </span>
          ))}
        </div>

        <div>
          <label className={labelClass}>Mànega</label>
          <div className="flex flex-wrap gap-2">
            {mangueraOptions.map(o => (
              <button key={o.value} onClick={() => updateDraft({ kitMangueraSize: o.value })}
                className={cn('px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all min-h-[44px]',
                  draft.kitMangueraSize === o.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                )}>{o.label}</button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Pèrtiga</label>
          <div className="flex flex-wrap gap-2">
            {pertigaOptions.map(o => (
              <button key={o.value} onClick={() => updateDraft({ kitPertigaSize: o.value })}
                className={cn('px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all min-h-[44px]',
                  draft.kitPertigaSize === o.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                )}>{o.label}</button>
            ))}
          </div>
        </div>

        {kit.items.length > 0 && (
          <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground">Total Kit de neteja (informatiu)</span>
              <span className="text-base font-bold text-primary">{formatEUR(kit.total)}</span>
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {kit.items.map(it => (
                <li key={it.name} className="flex justify-between">
                  <span>{it.name}</span>
                  <span className="tabular-nums">{formatEUR(it.unitSale)}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground mt-2 italic">
              Aquest import és informatiu per al client i no se suma al total del pressupost.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={() => setStep(2)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Enrere
        </button>
        <button type="button" onClick={() => setStep(4)} className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md min-h-[44px]">
          Següent <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
