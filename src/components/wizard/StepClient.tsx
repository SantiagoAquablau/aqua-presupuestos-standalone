import { useBudgetStore } from '@/stores/budgetStore';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const schema = z.object({
  clientName: z.string().min(1, 'El nom del client és obligatori'),
  clientNif: z.string().optional(),
  clientAddress: z.string().min(1, "L'adreça és obligatòria"),
  clientTown: z.string().min(1, 'El municipi és obligatori'),
  clientPhone: z.string().min(1, 'El telèfon és obligatori'),
  clientEmail: z.string().email("L'email no és vàlid"),
  budgetDate: z.string().min(1, 'La data és obligatòria'),
  budgetNumber: z.string().min(1, 'El número de pressupost és obligatori'),
  internalNotes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'XX';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatDateForNumber(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

export function StepClient() {
  const { draft, updateDraft, setStep } = useBudgetStore();
  const { profile } = useAuth();
  const [generatingNumber, setGeneratingNumber] = useState(false);

  const generateBudgetNumber = useCallback(async (dateStr: string) => {
    const rawInitials = getInitials(profile?.full_name || 'XX');
    const initials = draft.type === 'mantenimiento' ? `${rawInitials}M` : rawInitials;
    const datePart = formatDateForNumber(dateStr);
    const base = `${initials}${datePart}`;

    setGeneratingNumber(true);
    try {
      const { data } = await supabase
        .from('budgets')
        .select('number')
        .ilike('number', `${base}%`);

      const existing = (data || []).map((b: any) => b.number);
      let candidate = base;
      if (existing.includes(candidate)) {
        let suffix = 2;
        while (existing.includes(`${base}-${suffix}`)) suffix++;
        candidate = `${base}-${suffix}`;
      }
      return candidate;
    } catch {
      return base;
    } finally {
      setGeneratingNumber(false);
    }
  }, [profile?.full_name, draft.type]);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientName: draft.clientName || '',
      clientNif: draft.clientNif || '',
      clientAddress: draft.clientAddress || '',
      clientTown: draft.clientTown || '',
      clientPhone: draft.clientPhone || '',
      clientEmail: draft.clientEmail || '',
      budgetDate: draft.budgetDate || new Date().toISOString().split('T')[0],
      budgetNumber: draft.budgetNumber || '',
      internalNotes: draft.internalNotes || '',
    },
  });

  const budgetDate = watch('budgetDate');
  const budgetNumber = watch('budgetNumber');

  // Auto-generate budget number on mount if empty
  useEffect(() => {
    if (!draft.budgetNumber && profile?.full_name) {
      const date = draft.budgetDate || new Date().toISOString().split('T')[0];
      generateBudgetNumber(date).then((num) => {
        setValue('budgetNumber', num);
      });
    }
  }, [profile?.full_name]);

  const handleRegenerate = async () => {
    const num = await generateBudgetNumber(budgetDate);
    setValue('budgetNumber', num);
  };

  const rawInitials = getInitials(profile?.full_name || 'XX');
  const initials = draft.type === 'mantenimiento' ? `${rawInitials}M` : rawInitials;

  const onSubmit = (data: FormData) => {
    updateDraft(data);
    setStep(3);
  };

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow';
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5';
  const errorClass = 'text-xs text-destructive mt-1';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Dades del Client</h2>
        <p className="text-sm text-muted-foreground mt-1">Informació del client i de l'obra</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Nom del Client *</label>
            <input {...register('clientName')} className={inputClass} placeholder="Joan García Martínez" />
            {errors.clientName && <p className={errorClass}>{errors.clientName.message}</p>}
          </div>
          <div>
            <label className={labelClass}>NIF/CIF</label>
            <input {...register('clientNif')} className={inputClass} placeholder="12345678A" />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Adreça de l'Obra *</label>
            <input {...register('clientAddress')} className={inputClass} placeholder="Carrer Major, 15" />
            {errors.clientAddress && <p className={errorClass}>{errors.clientAddress.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Municipi *</label>
            <input {...register('clientTown')} className={inputClass} placeholder="Barcelona" />
            {errors.clientTown && <p className={errorClass}>{errors.clientTown.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Telèfon *</label>
            <input {...register('clientPhone')} type="tel" className={inputClass} placeholder="+34 600 000 000" />
            {errors.clientPhone && <p className={errorClass}>{errors.clientPhone.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Email *</label>
            <input {...register('clientEmail')} type="email" className={inputClass} placeholder="client@email.com" />
            {errors.clientEmail && <p className={errorClass}>{errors.clientEmail.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Data del Pressupost *</label>
            <input {...register('budgetDate')} type="date" className={inputClass} />
            {errors.budgetDate && <p className={errorClass}>{errors.budgetDate.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Número de Pressupost *</label>
            <div className="flex items-center gap-2">
              <input {...register('budgetNumber')} className={cn(inputClass, 'font-mono')} />
              <button type="button" onClick={handleRegenerate} disabled={generatingNumber} className="p-2.5 rounded-lg border border-border hover:bg-muted transition-colors flex-shrink-0" title="Regenerar número">
                <RefreshCw className={cn('w-4 h-4 text-muted-foreground', generatingNumber && 'animate-spin')} />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Generat automàticament · {initials} + data · pots editar-lo manualment</p>
            {errors.budgetNumber && <p className={errorClass}>{errors.budgetNumber.message}</p>}
          </div>
        </div>
        <div>
          <label className={labelClass}>Notes internes <span className="text-muted-foreground font-normal">(no apareixeran al PDF)</span></label>
          <textarea {...register('internalNotes')} className={cn(inputClass, 'min-h-[80px]')} placeholder="Notes privades sobre aquest pressupost..." />
        </div>
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" /> Enrere
        </button>
        <button type="submit" className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md">
          Següent <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
