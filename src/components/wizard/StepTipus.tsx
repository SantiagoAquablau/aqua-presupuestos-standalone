import { useBudgetStore, type BudgetType } from '@/stores/budgetStore';
import { Building2, Wrench, CalendarCheck, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';

const types: { value: BudgetType; label: string; desc: string; icon: typeof Building2 }[] = [
  { value: 'obra_nueva', label: 'Obra Nova', desc: 'Nova construcció de piscina des de zero', icon: Building2 },
  { value: 'rehabilitacion', label: 'Rehabilitació', desc: 'Renovació de piscina existent', icon: Wrench },
  { value: 'mantenimiento', label: 'Manteniment', desc: 'Contracte de manteniment periòdic', icon: CalendarCheck },
  { value: 'piscina_autoportant', label: 'Piscina Autoportant', desc: 'Piscina desmuntable / autoportant', icon: Waves },
];

export function StepTipus() {
  const { draft, updateDraft, setStep } = useBudgetStore();
  const [pendingType, setPendingType] = useState<BudgetType | null>(null);

  const handleSelect = (type: BudgetType) => {
    // If changing type after step 2 data exists, warn
    if (draft.type && draft.type !== type && (draft.clientName || draft.poolLength)) {
      setPendingType(type);
      return;
    }
    updateDraft({ type });
    setStep(2);
  };

  const confirmChange = () => {
    if (pendingType) {
      updateDraft({
        type: pendingType,
        poolLength: undefined, poolWidth: undefined, poolDepthMin: undefined, poolDepthMax: undefined,
        constructionSystem: undefined, waterproofingSystem: undefined, interiorStairsType: undefined,
        hasExteriorStairs: false, detectedProblems: [], rehabWorks: [], maintenanceServices: [],
        phases: undefined,
      });
      setPendingType(null);
      setStep(2);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Quin tipus de pressupost vols crear?</h2>
        <p className="text-sm text-muted-foreground mt-1">Selecciona el tipus per determinar les fases del pressupost</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {types.map((t) => (
          <button key={t.value} onClick={() => handleSelect(t.value)}
            className={cn(
              'relative flex flex-col items-center gap-4 p-8 rounded-xl border-2 transition-all duration-200 text-center group',
              draft.type === t.value ? 'border-primary bg-primary/5 shadow-elevated' : 'border-border bg-card hover:border-primary/40 hover:shadow-md'
            )}>
            <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center transition-colors',
              draft.type === t.value ? 'bg-primary/15' : 'bg-muted group-hover:bg-primary/10'
            )}>
              <t.icon className={cn('w-8 h-8', draft.type === t.value ? 'text-primary' : 'text-muted-foreground group-hover:text-primary')} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-lg">{t.label}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <AlertDialog open={!!pendingType} onOpenChange={() => setPendingType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Canviar tipus de pressupost?</AlertDialogTitle>
            <AlertDialogDescription>Canviar el tipus esborrarà les dades de l'estructura. Continuar?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmChange}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
