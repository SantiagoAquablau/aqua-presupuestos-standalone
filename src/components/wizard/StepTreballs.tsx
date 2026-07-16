import { useBudgetStore, type WaterproofingSystem } from '@/stores/budgetStore';
import { ArrowLeft, ArrowRight, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';

const works = [
  "Sanejament d'esquerdes",
  "Impermeabilització",
  "Nou revestiment",
  "Substitució sistema de filtració",
  "Nova il·luminació",
  "Reforma d'escales",
  "Reforma de coronació",
];

const newCoatings = ['Gresite', 'Microciment', 'Gres Porcelànic', 'Pintura Piscina'];

const waterproofingOptions: { value: WaterproofingSystem; label: string; desc: string; badge?: string }[] = [
  { value: 'impertot', label: 'Impertot', desc: 'Impermeabilització cimentosa bicomponent' },
  { value: 'hidrofix', label: 'Hidrofix', desc: 'Revestiment impermeabilitzant flexible' },
  { value: 'lamina_proof', label: 'Làmina Proof (Fixcer)', desc: 'Làmina flexible PVC premium. Garantia 10 anys.' },
];

export function StepTreballs() {
  const { draft, updateDraft, setStep } = useBudgetStore();
  const rehabWorks = draft.rehabWorks || [];
  const rehabNotes = draft.rehabNotes || {};

  const toggleWork = (w: string) => {
    updateDraft({
      rehabWorks: rehabWorks.includes(w) ? rehabWorks.filter(x => x !== w) : [...rehabWorks, w],
    });
  };

  const updateNote = (work: string, note: string) => {
    updateDraft({ rehabNotes: { ...rehabNotes, [work]: note } });
  };

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 min-h-[44px]';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Treballs a Realitzar</h2>
        <p className="text-sm text-muted-foreground mt-1">Selecciona els treballs necessaris per a la rehabilitació</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-4">
        {works.map(w => (
          <div key={w}>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors min-h-[44px]">
              <input type="checkbox" checked={rehabWorks.includes(w)} onChange={() => toggleWork(w)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
              <span className="text-sm font-medium text-foreground">{w}</span>
            </label>
            {rehabWorks.includes(w) && (
              <div className="ml-7 mt-2">
                <input type="text" className={inputClass} placeholder="Notes sobre aquest treball..." value={rehabNotes[w] || ''} onChange={e => updateNote(w, e.target.value)} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Waterproofing if selected */}
      {rehabWorks.includes("Impermeabilització") && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2"><Droplets className="w-4 h-4 text-primary" /> Nou sistema d'impermeabilització</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {waterproofingOptions.map(opt => (
              <button key={opt.value} onClick={() => updateDraft({ waterproofingSystem: opt.value })}
                className={cn('relative p-4 rounded-xl border-2 text-left transition-all',
                  draft.waterproofingSystem === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                )}>
                {opt.badge && <span className="absolute -top-2.5 right-3 bg-secondary text-secondary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">{opt.badge}</span>}
                <p className="font-semibold text-foreground">{opt.label}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* New coating if selected */}
      {rehabWorks.includes("Nou revestiment") && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-3">
          <h3 className="font-semibold text-foreground">Nou revestiment</h3>
          <div className="flex flex-wrap gap-2">
            {newCoatings.map(c => (
              <button key={c} onClick={() => updateDraft({ newCoating: c })}
                className={cn('px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all min-h-[44px]',
                  draft.newCoating === c ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                )}>{c}</button>
            ))}
          </div>
        </div>
      )}

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
