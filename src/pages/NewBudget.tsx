import { useBudgetStore } from '@/stores/budgetStore';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { StepTipus } from '@/components/wizard/StepTipus';
import { StepClient } from '@/components/wizard/StepClient';
import { StepEstructura } from '@/components/wizard/StepEstructura';
import { StepAcabats } from '@/components/wizard/StepAcabats';
import { StepInstalacions } from '@/components/wizard/StepInstalacions';
import { StepAccessoris } from '@/components/wizard/StepAccessoris';
import { StepAnnex } from '@/components/wizard/StepAnnex';
import { StepJacuzzi } from '@/components/wizard/StepJacuzzi';
import { StepPartides } from '@/components/wizard/StepPartides';
import { StepRevisio } from '@/components/wizard/StepRevisio';
import { StepEstatActual } from '@/components/wizard/StepEstatActual';
import { StepTreballs } from '@/components/wizard/StepTreballs';
import { StepDadesPiscina } from '@/components/wizard/StepDadesPiscina';
import { StepServeis } from '@/components/wizard/StepServeis';
import { StepPiscinaAutoportant } from '@/components/wizard/StepPiscinaAutoportant';
import { StepAcabatsAutoportant } from '@/components/wizard/StepAcabatsAutoportant';
import { StepOpcionalsAutoportant } from '@/components/wizard/StepOpcionalsAutoportant';
import { buildAutoportantPhases, mergeAutoportantPhases, computeTransportPricing, type CatalogArticle, type AutoportantPriceRow, type AutoportantTransportConfig } from '@/lib/autoportantOptions';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { saveBudget } from '@/lib/budgetSave';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { evaluateFormulaRules, type FormulaRule } from '@/lib/formulaEngine';
import { mergeFormulaResultsIntoPhases, serializeBudgetPhases, filterAcabatsInclusion } from '@/lib/formulaPhases';
import { buildWizardLinesByPhase } from '@/lib/wizardLines';
import { useQuadreElectricAuto } from '@/hooks/useQuadreElectricAuto';

const typeConfig: Record<string, { label: string; emoji: string; color: string }> = {
  obra_nueva: { label: 'Obra Nova', emoji: '🏗️', color: 'bg-primary/15 text-primary' },
  rehabilitacion: { label: 'Rehabilitació', emoji: '🔧', color: 'bg-success/15 text-success' },
  mantenimiento: { label: 'Manteniment', emoji: '🛡️', color: 'bg-warning/15 text-warning' },
  piscina_autoportant: { label: 'Piscina Autoportant', emoji: '🌊', color: 'bg-accent/15 text-accent-foreground' },
};

export default function NewBudget() {
  const { currentStep, setStep, draft, getSteps, updateDraft } = useBudgetStore();
  const { user } = useAuth();
  const [autoSaved, setAutoSaved] = useState(false);
  const steps = getSteps();

  // Keep the electrical panel selection in sync regardless of which step is mounted
  useQuadreElectricAuto();

  const { data: formulaArticles = [], isFetched: articlesFetched } = useQuery({
    queryKey: ['formula-engine-articles'],
    enabled: draft.type === 'obra_nueva',
    queryFn: async () => {
      const { data, error } = await supabase.from('articles').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: autoportantArticles = [], isFetched: autoportantArticlesFetched } = useQuery<CatalogArticle[]>({
    queryKey: ['autoportant-articles'],
    enabled: draft.type === 'piscina_autoportant',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('id, name, unit, cost_price, sale_price, category')
        .ilike('category', 'Autoportant');
      if (error) throw error;
      return (data || []) as CatalogArticle[];
    },
  });

  const { data: autoportantPrices = [], isFetched: autoportantPricesFetched } = useQuery<AutoportantPriceRow[]>({
    queryKey: ['autoportant-prices'],
    enabled: draft.type === 'piscina_autoportant',
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('autoportant_prices').select('*');
      if (error) throw error;
      return (data || []) as AutoportantPriceRow[];
    },
  });

  const { data: transportConfig, isFetched: transportConfigFetched } = useQuery<AutoportantTransportConfig | null>({
    queryKey: ['autoportant-transport-config'],
    enabled: draft.type === 'piscina_autoportant',
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('autoportant_transport_config')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as AutoportantTransportConfig | null;
    },
  });

  // Auto-fetch km via edge function when address / provider / model change.
  const kmFetchSignature = useMemo(() => JSON.stringify({
    a: draft.clientAddress || '',
    t: draft.clientTown || '',
    o: draft.obraLocation || '',
    p: transportConfig?.provider_address || '',
    m: draft.autoportantModel || '',
  }), [draft.clientAddress, draft.clientTown, draft.obraLocation, transportConfig?.provider_address, draft.autoportantModel]);

  useEffect(() => {
    if (draft.type !== 'piscina_autoportant') return;
    if (!transportConfig?.provider_address) return;
    if (draft.autoportantTransportKmOverride) return;
    const addr = (draft.clientAddress || '').trim();
    const town = (draft.clientTown || '').trim();
    const obra = (draft.obraLocation || '').trim();
    // Prefer explicit adreça + municipi; if the address doesn't already include the town, append it.
    const base = obra || addr;
    const destination = town && base && !base.toLowerCase().includes(town.toLowerCase())
      ? `${base}, ${town}`
      : (base || town);
    if (!destination) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('compute-transport-km', {
          body: {
            provider_address: transportConfig.provider_address,
            destination_address: destination,
          },
        });
        if (error) throw error;
        const km = Number((data as any)?.km);
        if (Number.isFinite(km) && km > 0 && km !== draft.autoportantTransportKm) {
          updateDraft({ autoportantTransportKm: km });
        }
      } catch (e) {
        console.warn('[transport-km] fetch failed', e);
      }
    }, 800);
    return () => { controller.abort(); window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kmFetchSignature, transportConfig?.provider_address, draft.autoportantTransportKmOverride]);

  const { data: formulaRules = [], isFetched: rulesFetched } = useQuery({
    queryKey: ['formula-engine-rules', 'obra_nova'],
    enabled: draft.type === 'obra_nueva',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formula_rules')
        .select('*')
        .eq('budget_type', 'obra_nova')
        .eq('is_active', true)
        .order('phase')
        .order('order_index');

      if (error) throw error;
      return (data || []) as FormulaRule[];
    },
  });

  const formulaDraftSignature = useMemo(() => {
    const { phases, ...formulaInputs } = draft;
    return JSON.stringify(formulaInputs);
  }, [draft]);

  const autoSaveSignature = useMemo(() => {
    const { id, ...persistedDraft } = draft;
    return JSON.stringify(persistedDraft);
  }, [draft]);

  const skipFirstAutoSave = useRef(Boolean(draft.id));

  const canGoToStep = (step: number) => {
    if (step === 1) return true;
    if (step === 2) return !!draft.type;
    if (step >= 3) return !!draft.type && !!draft.clientName;
    return false;
  };

  // Auto-save indicator
  const showAutoSave = useCallback(() => {
    setAutoSaved(true);
    setTimeout(() => setAutoSaved(false), 2000);
  }, []);

  // Auto-save draft changes, but avoid resaving immediately when opening an existing budget
  useEffect(() => {
    if (!(currentStep > 1 && user?.id && draft.clientName && draft.budgetNumber)) return;

    if (skipFirstAutoSave.current) {
      skipFirstAutoSave.current = false;
      return;
    }

    const timer = window.setTimeout(async () => {
      // Don't demote an already-accepted budget back to 'borrador' just
      // because the auto-save fired while it's being edited.
      const autoSaveStatus = draft.status === 'acceptat' ? 'acceptat' : 'borrador';
      const { id } = await saveBudget(draft, user.id, autoSaveStatus);
      if (id && !draft.id) {
        updateDraft({ id });
      }
      showAutoSave();
    }, 500);

    return () => window.clearTimeout(timer);
  }, [autoSaveSignature, currentStep, draft.id, draft.clientName, draft.budgetNumber, showAutoSave, updateDraft, user?.id]);
  // Auto-scroll to the top when the step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);
  useEffect(() => {
    if (draft.type !== 'obra_nueva' || !articlesFetched || !rulesFetched) return;

    const timer = window.setTimeout(() => {
      try {
        const rawResults = evaluateFormulaRules(formulaRules as FormulaRule[], draft, formulaArticles);
        const results = filterAcabatsInclusion(rawResults, draft);
        const wizardLines = buildWizardLinesByPhase(draft, formulaArticles);
        const mergedPhases = mergeFormulaResultsIntoPhases(results, draft.phases, draft, wizardLines);

        if (serializeBudgetPhases(mergedPhases) !== serializeBudgetPhases(draft.phases || [])) {
          updateDraft({ phases: mergedPhases });
        }
      } catch (error) {
        console.error('[formula-sync] Error recalculating formula phases', error);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [draft.type, formulaDraftSignature, currentStep, articlesFetched, rulesFetched, formulaArticles, formulaRules, updateDraft]);

  // Auto-sync phases for piscina autoportant based on opcionals selection.
  useEffect(() => {
    if (draft.type !== 'piscina_autoportant') return;
    if (!autoportantArticlesFetched || !autoportantPricesFetched || !transportConfigFetched) return;
    const timer = window.setTimeout(() => {
      try {
        const next = buildAutoportantPhases(draft, autoportantArticles, autoportantPrices, transportConfig || undefined);
        const merged = mergeAutoportantPhases(next, draft.phases);
        if (JSON.stringify(merged) !== JSON.stringify(draft.phases || [])) {
          updateDraft({ phases: merged });
        }
      } catch (e) {
        console.error('[autoportant-sync]', e);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draft.type, autoSaveSignature, autoportantArticlesFetched, autoportantArticles, autoportantPricesFetched, autoportantPrices, transportConfigFetched, transportConfig, updateDraft]);


  const renderStep = () => {
    const type = draft.type;
    if (currentStep === 1) return <StepTipus />;
    if (currentStep === 2) return <StepClient />;

    if (type === 'obra_nueva') {
      const hasJacuzzi = !!draft.hasJacuzzi;
      switch (currentStep) {
        case 3: return <StepEstructura />;
        case 4: return <StepAcabats />;
        case 5: return <StepInstalacions />;
        case 6: return <StepAccessoris />;
        case 7: return hasJacuzzi ? <StepJacuzzi /> : <StepAnnex />;
        case 8: return hasJacuzzi ? <StepAnnex /> : <StepPartides />;
        case 9: return hasJacuzzi ? <StepPartides /> : <StepRevisio />;
        case 10: return <StepRevisio />;
      }
    } else if (type === 'rehabilitacion') {
      switch (currentStep) {
        case 3: return <StepEstatActual />;
        case 4: return <StepTreballs />;
        case 5: return <StepPartides />;
        case 6: return <StepRevisio />;
      }
    } else if (type === 'mantenimiento') {
      switch (currentStep) {
        case 3: return <StepDadesPiscina />;
        case 4: return <StepServeis />;
        case 5: return <StepRevisio />;
      }
    } else if (type === 'piscina_autoportant') {
      switch (currentStep) {
        case 3: return <StepPiscinaAutoportant />;
        case 4: return <StepAcabatsAutoportant />;
        case 5: return <StepOpcionalsAutoportant />;
        case 6: return <StepPartides />;
        case 7: return <StepRevisio />;
      }
    }
    return <StepTipus />;
  };

  const typeBadge = draft.type && currentStep > 1 ? typeConfig[draft.type] : null;

  return (
    <div className="p-4 md:p-8 max-w-5xl xl:max-w-7xl mx-auto space-y-8 pb-28 md:pb-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Nou Pressupost</h1>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <p className="text-muted-foreground">Segueix els passos per crear un pressupost</p>
          {typeBadge && (
            <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold', typeBadge.color)}>
              {typeBadge.emoji} {typeBadge.label}
            </span>
          )}
        </div>
        {currentStep > 2 && (draft.clientName || draft.budgetNumber) && (
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
            {draft.clientName && <span>Per a: <strong className="text-foreground">{draft.clientName}</strong>{draft.clientTown && ` · ${draft.clientTown}`}</span>}
            {draft.budgetNumber && <span className="font-mono text-primary">{draft.budgetNumber}</span>}
          </div>
        )}
      </div>

      {/* Desktop progress */}
      <div className="hidden md:flex items-center justify-between relative">
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-border" />
        <div className="absolute top-4 left-0 h-0.5 bg-primary transition-all duration-500" style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }} />
        {steps.map((s) => (
          <button key={s.num} onClick={() => canGoToStep(s.num) && setStep(s.num)} disabled={!canGoToStep(s.num)} className="relative z-10 flex flex-col items-center gap-2">
            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
              currentStep === s.num ? 'bg-primary text-primary-foreground border-primary scale-110' :
              currentStep > s.num ? 'bg-primary text-primary-foreground border-primary' :
              'bg-card text-muted-foreground border-border'
            )}>{currentStep > s.num ? <Check className="w-4 h-4" /> : s.num}</div>
            <span className={cn('text-xs font-medium', currentStep === s.num ? 'text-primary' : 'text-muted-foreground')}>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Mobile progress */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-primary">Pas {currentStep} de {steps.length}</span>
          <span className="text-sm text-muted-foreground">{steps[currentStep - 1]?.label}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(currentStep / steps.length) * 100}%` }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          {renderStep()}
        </motion.div>
      </AnimatePresence>

      {/* Auto-save indicator */}
      <AnimatePresence>
        {autoSaved && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 right-4 bg-card border border-border rounded-lg px-4 py-2 shadow-lg text-sm text-muted-foreground z-50"
          >
            ✓ Desat automàticament
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
