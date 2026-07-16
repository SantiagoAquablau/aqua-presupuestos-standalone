import { useBudgetStore } from '@/stores/budgetStore';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const coatings = ['Gresite', 'Pintura', 'Liner', 'Làmina', 'Altres'];
const conditions = [
  { value: 'bo', label: 'Bo', color: 'text-success' },
  { value: 'regular', label: 'Regular', color: 'text-warning' },
  { value: 'dolent', label: 'Dolent', color: 'text-orange-500' },
  { value: 'molt_dolent', label: 'Molt Dolent', color: 'text-destructive' },
];
const problems = [
  "Fuites d'aigua",
  "Esquerdes a l'estructura",
  "Revestiment deteriorat",
  "Sistema de filtració obsolet",
  "Il·luminació defectuosa",
];

export function StepEstatActual() {
  const { draft, updateDraft, setStep } = useBudgetStore();
  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 min-h-[44px]';
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

  const toggleProblem = (p: string) => {
    const current = draft.detectedProblems || [];
    updateDraft({
      detectedProblems: current.includes(p) ? current.filter(x => x !== p) : [...current, p],
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Estat Actual de la Piscina</h2>
        <p className="text-sm text-muted-foreground mt-1">Descriu l'estat actual per determinar els treballs necessaris</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-5">
        <div>
          <label className={labelClass}>Tipus de revestiment actual</label>
          <div className="flex flex-wrap gap-2">
            {coatings.map(c => (
              <button key={c} onClick={() => updateDraft({ currentCoating: c })}
                className={cn('px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all min-h-[44px]',
                  draft.currentCoating === c ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                )}>{c}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Any de construcció aproximat</label>
            <input type="number" className={inputClass} placeholder="2005" value={draft.constructionYear || ''} onChange={e => updateDraft({ constructionYear: parseInt(e.target.value) || undefined })} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Estat general</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {conditions.map(c => (
              <button key={c.value} onClick={() => updateDraft({ generalCondition: c.value })}
                className={cn('p-4 rounded-xl border-2 text-center transition-all min-h-[44px]',
                  draft.generalCondition === c.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                )}>
                <p className={cn('font-semibold', c.color)}>{c.label}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Problemes detectats</label>
          <div className="space-y-2">
            {problems.map(p => (
              <label key={p} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors min-h-[44px]">
                <input type="checkbox" checked={(draft.detectedProblems || []).includes(p)} onChange={() => toggleProblem(p)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                <span className="text-sm text-foreground">{p}</span>
              </label>
            ))}
          </div>
        </div>
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
