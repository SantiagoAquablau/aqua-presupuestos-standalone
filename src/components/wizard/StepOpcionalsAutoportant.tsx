import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useBudgetStore } from '@/stores/budgetStore';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatEUR } from '@/lib/formatters';
import { NumberInput } from '@/components/ui/NumberInput';
import {
  AUTOPORTANT_OPCIONALS,
  resolveCubiertaSize,
  type AutoportantModel,
  type CatalogArticle,
} from '@/lib/autoportantOptions';

export function StepOpcionalsAutoportant() {
  const { draft, updateDraft, setStep } = useBudgetStore();
  const model = draft.autoportantModel as AutoportantModel | undefined;

  const { data: articles = [] } = useQuery<CatalogArticle[]>({
    queryKey: ['autoportant-articles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('id, name, unit, cost_price, sale_price, category')
        .ilike('category', 'Autoportant');
      if (error) throw error;
      return (data || []) as CatalogArticle[];
    },
  });

  const available = useMemo(
    () => (model ? AUTOPORTANT_OPCIONALS.filter((o) => o.models.includes(model)) : []),
    [model]
  );

  const cubiertaSize = resolveCubiertaSize(draft);

  const normalize = (value: string) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();

  const findPrice = (def: (typeof AUTOPORTANT_OPCIONALS)[number]) => {
    if (def.key === 'cubierta_electrica') {
      const a = articles.find((art) => {
        const n = normalize(art.name || '');
        const compact = n.replace(/\s+/g, '');
        return n.includes('CUBIERTA') && n.includes('ELECTRICA') && compact.includes(`${cubiertaSize}X3`);
      });
      return { article: a, sale: (a?.sale_price || 0) / 100 };
    }
    const a = articles.find((art) =>
      def.articleMatch.every((t) => normalize(art.name || '').includes(normalize(t)))
    );
    return { article: a, sale: (a?.sale_price || 0) / 100 };
  };

  const isSelected = (key: string): boolean => {
    switch (key) {
      case 'asiento_acrilico': return Number(draft.autoportantOpcAsientoAcrilicoQty ?? 0) > 0;
      case 'colchoneta': return !!draft.autoportantOpcColchoneta;
      case 'cubierta_electrica': return !!draft.autoportantOpcCubiertaElectrica;
      case 'banco_gresite': return Number(draft.autoportantOpcBancoGresiteQty ?? 0) > 0;
      case 'spa': return !!draft.autoportantOpcSpa;
      case 'cascada': return !!draft.autoportantOpcCascada;
      case 'asiento_porcelanico': return Number(draft.autoportantOpcAsientoPorcelanicoQty ?? 0) > 0;
      case 'cristal': return !!draft.autoportantOpcCristal;
      default: return false;
    }
  };

  const getQty = (key: string): number => {
    switch (key) {
      case 'asiento_acrilico': return Number(draft.autoportantOpcAsientoAcrilicoQty ?? 0);
      case 'banco_gresite': return Number(draft.autoportantOpcBancoGresiteQty ?? 0);
      case 'asiento_porcelanico': return Number(draft.autoportantOpcAsientoPorcelanicoQty ?? 0);
      default: return 1;
    }
  };

  const setQty = (key: string, qty: number) => {
    const safe = Math.max(0, qty);
    switch (key) {
      case 'asiento_acrilico': updateDraft({ autoportantOpcAsientoAcrilicoQty: safe }); break;
      case 'banco_gresite': updateDraft({ autoportantOpcBancoGresiteQty: safe }); break;
      case 'asiento_porcelanico': updateDraft({ autoportantOpcAsientoPorcelanicoQty: safe }); break;
    }
  };

  const toggle = (key: string) => {
    const on = !isSelected(key);
    switch (key) {
      case 'asiento_acrilico': updateDraft({ autoportantOpcAsientoAcrilicoQty: on ? 1 : 0 }); break;
      case 'colchoneta': updateDraft({ autoportantOpcColchoneta: on }); break;
      case 'cubierta_electrica': updateDraft({ autoportantOpcCubiertaElectrica: on }); break;
      case 'banco_gresite': updateDraft({ autoportantOpcBancoGresiteQty: on ? 1 : 0 }); break;
      case 'spa': updateDraft({ autoportantOpcSpa: on }); break;
      case 'cascada': updateDraft({ autoportantOpcCascada: on }); break;
      case 'asiento_porcelanico': updateDraft({ autoportantOpcAsientoPorcelanicoQty: on ? 1 : 0 }); break;
      case 'cristal': updateDraft({ autoportantOpcCristal: on }); break;
    }
  };

  if (!model) {
    return (
      <div className="space-y-4">
        <div className="p-6 rounded-xl border-2 border-dashed border-border bg-muted/30 text-center">
          <p className="text-sm text-muted-foreground">Primer selecciona un model de piscina.</p>
        </div>
        <button
          type="button"
          onClick={() => setStep(3)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" /> Enrere
        </button>
      </div>
    );
  }

  const totalSale = available.reduce((sum, def) => {
    if (!isSelected(def.key)) return sum;
    const { sale } = findPrice(def);
    return sum + sale * getQty(def.key);
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Opcionals</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecciona els opcionals disponibles per al model. Els preus es sumen automàticament a la fase d'Opcionals.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {available.map((def) => {
          const selected = isSelected(def.key);
          const { article, sale } = findPrice(def);
          const qty = getQty(def.key);
          const subtotal = selected ? sale * qty : sale;
          return (
            <div
              key={def.key}
              className={cn(
                'rounded-xl border-2 bg-card p-4 transition-all',
                selected ? 'border-primary shadow-elevated ring-1 ring-primary/20' : 'border-border hover:border-primary/40'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground leading-snug">{def.label}</h3>
                  {def.description && (
                    <p className="text-xs text-muted-foreground mt-1">{def.description}</p>
                  )}
                  {def.key === 'cubierta_electrica' && (
                    <p className="text-xs text-primary mt-1 font-medium">
                      Mida auto-seleccionada: {cubiertaSize}×3
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggle(def.key)}
                  className={cn(
                    'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[36px]',
                    selected
                      ? 'gradient-primary text-primary-foreground shadow-md'
                      : 'border-2 border-border text-foreground hover:border-primary/60'
                  )}
                >
                  {selected ? <><Check className="w-3.5 h-3.5" /> Inclòs</> : 'Incloure'}
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-border/60 flex items-end justify-between gap-3">
                {def.perMeter && selected ? (
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Metres lineals
                    </label>
                    <NumberInput
                      value={qty}
                      onChange={(v) => setQty(def.key, v ?? 0)}
                      className="w-28 px-2 py-1.5 rounded border border-input bg-card text-sm min-h-[40px]"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {article ? `Unitat: ${article.unit || def.unit}` : 'Article no trobat al catàleg'}
                  </span>
                )}
                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground">
                    {def.perMeter ? 'Preu per unitat' : 'Preu'}
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {formatEUR(sale)}{def.perMeter ? ' / ml' : ''}
                  </div>
                  {selected && def.perMeter && qty > 0 && (
                    <div className="text-xs text-primary font-medium mt-0.5">
                      Subtotal: {formatEUR(subtotal)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Total opcionals seleccionats</span>
        <span className="text-lg font-bold text-primary">{formatEUR(totalSale)}</span>
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep(4)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" /> Enrere
        </button>
        <button
          type="button"
          onClick={() => setStep(6)}
          className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md min-h-[44px]"
        >
          Següent <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}