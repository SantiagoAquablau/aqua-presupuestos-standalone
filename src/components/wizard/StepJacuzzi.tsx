import { useBudgetStore, type JacuzziType, type JacuzziPosition } from '@/stores/budgetStore';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Info, Layers, Minus, Plus, Waves, Wind } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DecimalInput } from '@/components/wizard/DecimalInput';
import { EquipmentSelector, type SelectedArticle } from '@/components/wizard/EquipmentSelector';

async function loadArticle(id: string | undefined): Promise<SelectedArticle | null> {
  if (!id) return null;
  const { data } = await supabase
    .from('articles')
    .select('id, name, reference, image_url, suppliers:supplier_id(name)')
    .eq('id', id)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    reference: data.reference,
    image_url: data.image_url,
    supplierName: (data as any).suppliers?.name || null,
  };
}

// Contrapetjada fixa dels escalons interiors del jacuzzi. No es mostra ni
// s'edita — reservada per a càlculs interns (p.ex. revestiment interior).
const RISER_HEIGHT = 0.20;

// Stepper +/- de quantitat — mateix patró que StepAccessoris.tsx (handleRgbQtyChange).
function QtyStepper({ value, onChange, min = 0, max = 99 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, Math.min(max, value - 1)))}
        className="w-9 h-9 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0"
      >
        <Minus className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      <span className="text-sm font-bold text-foreground w-6 text-center">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, Math.min(max, value + 1)))}
        className="w-9 h-9 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0"
      >
        <Plus className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

export function StepJacuzzi() {
  const { draft, updateDraft, currentStep, setStep } = useBudgetStore();

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 min-h-[44px]';
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

  const typeOptions: { value: JacuzziType; label: string; desc: string }[] = [
    { value: 'interior', label: 'Jacuzzi interior en piscina', desc: "Integrat dins del vas de la piscina" },
    { value: 'independent', label: 'Jacuzzi independent', desc: 'Element separat de la piscina' },
  ];

  const positionOptions: { value: JacuzziPosition; label: string; desc: string }[] = [
    { value: 'dins_estructura', label: "Dins de l'estructura del vas", desc: "El jacuzzi queda integrat dins del perímetre construït de la piscina" },
    { value: 'parcialment_fora', label: "Parcialment fora de l'estructura del vas", desc: "El jacuzzi sobresurt, en part, del perímetre de la piscina" },
  ];

  const handleNumberChange = (field: 'jacuzziLength' | 'jacuzziWidth' | 'jacuzziDepth') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const value = raw === '' ? undefined : (Number.isFinite(parseFloat(raw)) ? parseFloat(raw) : undefined);
    updateDraft({ [field]: value });
  };

  const isIndependent = draft.jacuzziType === 'independent';

  // Bombes de jets d'aire/aigua del jacuzzi — mateix patró de càrrega que
  // StepInstalacions.tsx (loadArticle per id, sincronitzat amb el draft).
  const [airPumpArticle, setAirPumpArticle] = useState<SelectedArticle | null>(null);
  const [waterPumpArticle, setWaterPumpArticle] = useState<SelectedArticle | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ap, wp] = await Promise.all([
        loadArticle(draft.jacuzziAirPumpArticleId),
        loadArticle(draft.jacuzziWaterPumpArticleId),
      ]);
      if (cancelled) return;
      setAirPumpArticle(ap);
      setWaterPumpArticle(wp);
    })();
    return () => {
      cancelled = true;
    };
  }, [draft.jacuzziAirPumpArticleId, draft.jacuzziWaterPumpArticleId]);

  // Nom del model de revestiment interior triat per a la piscina principal
  // (fase Acabats) — perquè el jacuzzi reutilitza sempre el mateix model.
  const { data: mainRevestimentArticle } = useQuery({
    queryKey: ['jacuzzi-main-revestiment-article', draft.revestimentModelId],
    enabled: !!draft.revestimentModelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('name')
        .eq('id', draft.revestimentModelId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Superfície i volum — mateix patró que StepEstructura.tsx (piscina principal),
  // però amb una única profunditat (el jacuzzi no distingeix min/max).
  const jacuzziSurface = useMemo(() => {
    if (draft.jacuzziLength && draft.jacuzziWidth && draft.jacuzziDepth) {
      return (draft.jacuzziLength * draft.jacuzziWidth)
        + 2 * (draft.jacuzziLength * draft.jacuzziDepth)
        + 2 * (draft.jacuzziWidth * draft.jacuzziDepth);
    }
    return 0;
  }, [draft.jacuzziLength, draft.jacuzziWidth, draft.jacuzziDepth]);

  const jacuzziVolume = useMemo(() => {
    if (draft.jacuzziLength && draft.jacuzziWidth && draft.jacuzziDepth) {
      return draft.jacuzziLength * draft.jacuzziWidth * draft.jacuzziDepth * 1000;
    }
    return 0;
  }, [draft.jacuzziLength, draft.jacuzziWidth, draft.jacuzziDepth]);

  // Defaults inicials (un sol cop): compte de bancs, gruix/alçada de banc,
  // compte d'escalons i petjada. Mateix patró que constructionSystem/
  // waterproofingSystem a StepEstructura.tsx — simples valors per defecte,
  // sense recàlcul en viu (no depenen de les mesures del jacuzzi).
  useEffect(() => {
    const patch: Partial<typeof draft> = {};
    if (draft.jacuzziBenchCount === undefined) patch.jacuzziBenchCount = 4;
    if (draft.jacuzziBenchDepth === undefined) patch.jacuzziBenchDepth = 0.50;
    if (draft.jacuzziBenchHeight === undefined) patch.jacuzziBenchHeight = 0.50;
    if (draft.jacuzziStairsCount === undefined) patch.jacuzziStairsCount = 2;
    if (draft.jacuzziStairsTread === undefined) patch.jacuzziStairsTread = 0.30;
    if (draft.jacuzziAirPumpQty === undefined) patch.jacuzziAirPumpQty = 1;
    if (draft.jacuzziWaterPumpQty === undefined) patch.jacuzziWaterPumpQty = 1;
    if (Object.keys(patch).length) updateDraft(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Jacuzzi</h2>
        <p className="text-sm text-muted-foreground mt-1">Tipus i mesures del jacuzzi</p>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Waves className="w-4 h-4 text-primary" /></div>
          <h3 className="font-semibold text-foreground">Configuració del jacuzzi</h3>
        </div>

        <div className="p-4 space-y-5">
          <div>
            <label className={labelClass}>Tipus de jacuzzi</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {typeOptions.map((o) => {
                const selected = draft.jacuzziType === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => updateDraft({ jacuzziType: o.value })}
                    className={cn(
                      'p-4 rounded-xl border-2 text-left transition-all',
                      selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    )}
                  >
                    <p className="font-semibold text-foreground">{o.label}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{o.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {isIndependent && (
            <div>
              <label className={labelClass}>Posició respecte al vas de la piscina</label>
              <div className="space-y-2">
                {positionOptions.map((o) => {
                  const active = draft.jacuzziPosition === o.value;
                  return (
                    <label
                      key={o.value}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                        active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                      )}
                    >
                      <input
                        type="radio"
                        name="jacuzziPosition"
                        value={o.value}
                        checked={active}
                        onChange={() => updateDraft({ jacuzziPosition: o.value })}
                        className="accent-primary w-4 h-4 mt-0.5"
                      />
                      <div>
                        <p className="font-semibold text-foreground text-sm">{o.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{o.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Llarg (m)</label>
              <input type="number" step="0.01" className={inputClass} value={draft.jacuzziLength ?? ''} onChange={handleNumberChange('jacuzziLength')} />
            </div>
            <div>
              <label className={labelClass}>Ample (m)</label>
              <input type="number" step="0.01" className={inputClass} value={draft.jacuzziWidth ?? ''} onChange={handleNumberChange('jacuzziWidth')} />
            </div>
            <div>
              <label className={labelClass}>Profunditat (m)</label>
              <input type="number" step="0.01" className={inputClass} value={draft.jacuzziDepth ?? ''} onChange={handleNumberChange('jacuzziDepth')} />
            </div>
          </div>

          {(jacuzziVolume > 0 || jacuzziSurface > 0) && (
            <div className="grid grid-cols-2 gap-2">
              {jacuzziVolume > 0 && <div className="bg-card rounded-lg p-3 border border-border text-center"><p className="text-[10px] text-muted-foreground">Capacitat</p><p className="text-sm font-bold text-foreground">{Math.round(jacuzziVolume).toLocaleString('ca-ES')} L</p></div>}
              {jacuzziSurface > 0 && <div className="bg-card rounded-lg p-3 border border-border text-center"><p className="text-[10px] text-muted-foreground">Superfície</p><p className="text-sm font-bold text-foreground">{jacuzziSurface.toFixed(2)} m²</p></div>}
            </div>
          )}
        </div>
      </div>

      {isIndependent && (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Layers className="w-4 h-4 text-primary" /></div>
            <h3 className="font-semibold text-foreground">Estructura del jacuzzi independent</h3>
          </div>

          <div className="p-4 space-y-6">
            {/* Bancs interiors */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Bancs interiors</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Nombre de bancs</label>
                  <DecimalInput
                    className={inputClass}
                    integer
                    value={draft.jacuzziBenchCount ?? 4}
                    onChange={(v) => updateDraft({ jacuzziBenchCount: v ?? 0 })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Gruix del banc (m)</label>
                  <DecimalInput
                    className={inputClass}
                    value={draft.jacuzziBenchDepth ?? 0.50}
                    onChange={(v) => updateDraft({ jacuzziBenchDepth: v ?? 0 })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Alçada del banc (m)</label>
                  <DecimalInput
                    className={inputClass}
                    value={draft.jacuzziBenchHeight ?? 0.50}
                    onChange={(v) => updateDraft({ jacuzziBenchHeight: v ?? 0 })}
                  />
                </div>
              </div>
            </div>

            {/* Escalons */}
            <div className="pt-4 border-t border-border">
              <p className="text-sm font-semibold text-foreground mb-2">Escalons</p>
              <p className="text-xs text-muted-foreground mb-3">
                El jacuzzi porta escalons: un muntat sobre el banc perimetral i l'altre per sota, dins del gruix del banc.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nombre d'escalons</label>
                  <DecimalInput
                    className={inputClass}
                    integer
                    value={draft.jacuzziStairsCount ?? 2}
                    onChange={(v) => updateDraft({ jacuzziStairsCount: v ?? 0 })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Petjada (m)</label>
                  <DecimalInput
                    className={inputClass}
                    value={draft.jacuzziStairsTread ?? 0.30}
                    onChange={(v) => updateDraft({ jacuzziStairsTread: v ?? 0 })}
                  />
                </div>
              </div>
            </div>

            {/* Revestiment interior */}
            <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 p-2 rounded-lg">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {mainRevestimentArticle?.name
                  ? `El revestiment interior del jacuzzi utilitzarà el mateix model que la piscina: ${mainRevestimentArticle.name}.`
                  : "El revestiment interior del jacuzzi utilitzarà el mateix model que s'esculli per a la piscina principal."}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Wind className="w-4 h-4 text-primary" /></div>
          <h3 className="font-semibold text-foreground">Instal·lació jacuzzi</h3>
        </div>

        <div className="p-4 space-y-6">
          {/* Jets d'aire */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">Jets d'aire</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <div>
                <label className={labelClass}>Nombre de jets d'aire</label>
                <QtyStepper
                  value={draft.jacuzziAirJetsCount ?? 0}
                  onChange={(v) => updateDraft({ jacuzziAirJetsCount: v })}
                />
              </div>
              <div>
                <label className={labelClass}>Preses d'aspiració de jets d'aire</label>
                <QtyStepper
                  value={draft.jacuzziAirJetsIntakeCount ?? 0}
                  onChange={(v) => updateDraft({ jacuzziAirJetsIntakeCount: v })}
                />
              </div>
              <EquipmentSelector
                label="Bomba d'aire d'ús continu"
                placeholder="Cercar bomba d'aire..."
                categoryFilter="Bomba"
                value={airPumpArticle}
                onChange={(a) => {
                  setAirPumpArticle(a);
                  updateDraft({ jacuzziAirPumpArticleId: a?.id || undefined });
                }}
                noneLabel="No s'inclou"
                quantity={draft.jacuzziAirPumpQty ?? 1}
                onQuantityChange={(q) => updateDraft({ jacuzziAirPumpQty: q })}
              />
            </div>
          </div>

          {/* Jets d'aigua */}
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-semibold text-foreground mb-2">Jets d'aigua</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <div>
                <label className={labelClass}>Nombre de jets rotatoris 2½"</label>
                <QtyStepper
                  value={draft.jacuzziWaterJetsCount ?? 0}
                  onChange={(v) => updateDraft({ jacuzziWaterJetsCount: v })}
                />
              </div>
              <div>
                <label className={labelClass}>Preses d'aspiració de jets d'aigua</label>
                <QtyStepper
                  value={draft.jacuzziWaterJetsIntakeCount ?? 0}
                  onChange={(v) => updateDraft({ jacuzziWaterJetsIntakeCount: v })}
                />
              </div>
              <EquipmentSelector
                label="Bomba de jets"
                placeholder="Cercar bomba d'aigua..."
                categoryFilter="Bomba"
                value={waterPumpArticle}
                onChange={(a) => {
                  setWaterPumpArticle(a);
                  updateDraft({ jacuzziWaterPumpArticleId: a?.id || undefined });
                }}
                noneLabel="No s'inclou"
                quantity={draft.jacuzziWaterPumpQty ?? 1}
                onQuantityChange={(q) => updateDraft({ jacuzziWaterPumpQty: q })}
              />
            </div>
          </div>

          {/* Polsadors */}
          <div className="pt-4 border-t border-border">
            <div>
              <label className={labelClass}>Polsadors piezoelèctrics "paro i marxa"</label>
              <QtyStepper
                value={draft.jacuzziPiezoButtonsCount ?? 0}
                onChange={(v) => updateDraft({ jacuzziPiezoButtonsCount: v })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={() => setStep(currentStep - 1)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Enrere
        </button>
        <button type="button" onClick={() => setStep(currentStep + 1)} className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md min-h-[44px]">
          Següent <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
