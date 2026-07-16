import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Check, Maximize2, X, ImageOff, Loader2, AlertTriangle, Calculator, Sparkles } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useCobertorCalc } from '@/hooks/useCobertorCalc';
import type { CobertorCalcResult } from '@/lib/cobertorCalc';

export type CoverTipus = 'fora_aigua' | 'submergit';
export type CoverMaterial = 'pvc' | 'policarbonat';

export interface CoverModel {
  id: string;
  code: string;
  name: string;
  cover_type: CoverTipus;
  image_url: string | null;
  order_index: number;
}

export interface CoverColor {
  id: string;
  code: string;
  name: string;
  material: CoverMaterial;
  image_url: string | null;
  order_index: number;
}

interface CobertorSelectorProps {
  tipus?: CoverTipus;
  modelId?: string;
  lames?: CoverMaterial;
  colorId?: string;
  /** Pool dimensions used for the price calculation. */
  poolWidth?: number;
  poolLength?: number;
  /** Pool depths — used to compute the new-wall surface for s-Lux. */
  poolDepthMin?: number;
  poolDepthMax?: number;
  /** Interior stair type — drives the auto-suggestion for s-Lux (mur nou vs. aprofitar). */
  interiorStairsType?: string;
  /** s-Lux only: whether the user wants to build a new wall instead of reusing the stair. */
  murNou?: boolean;
  /** Manual override (when the customer already has a personalised quote). */
  manualOverride?: boolean;
  manualAmount?: number;
  onChange: (val: {
    tipus?: CoverTipus;
    modelId?: string;
    lames?: CoverMaterial;
    colorId?: string;
    modelName?: string;
    modelCode?: string;
    colorName?: string;
    manualOverride?: boolean;
    manualAmount?: number;
    murNou?: boolean;
    murM2?: number;
    /** Calculated cost/sale + breakdown — written by the selector when a valid calc is available. */
    calcCost?: number | null;
    calcSale?: number | null;
    calcBreakdown?: any;
  }) => void;
}

const TIPUS_OPTIONS: { value: CoverTipus; title: string; desc: string }[] = [
  { value: 'fora_aigua', title: 'Cobertes fora de l\'aigua', desc: 'Models e-Series sobre el coronament' },
  { value: 'submergit', title: 'Cobertes submergides', desc: 'Models s-Series ocultes dins del got' },
];

const LAMES_OPTIONS: { value: CoverMaterial; title: string }[] = [
  { value: 'pvc', title: 'Lames de PVC 83 mm' },
  { value: 'policarbonat', title: 'Lames de Policarbonat 83 mm' },
];

function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted">
      <ImageOff className="w-8 h-8 mb-2 opacity-50" />
      <span className="text-xs px-2 text-center">{label}</span>
    </div>
  );
}

export function CobertorSelector({
  tipus,
  modelId,
  lames,
  colorId,
  poolWidth,
  poolLength,
  poolDepthMin,
  poolDepthMax,
  interiorStairsType,
  murNou,
  manualOverride,
  manualAmount,
  onChange,
}: CobertorSelectorProps) {
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  const { data: models = [], isLoading: loadingModels } = useQuery({
    queryKey: ['cover_models'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cover_models')
        .select('*')
        .order('cover_type')
        .order('order_index');
      if (error) throw error;
      return data as CoverModel[];
    },
  });

  const { data: colors = [] } = useQuery({
    queryKey: ['cover_colors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cover_colors')
        .select('*')
        .order('material')
        .order('order_index');
      if (error) throw error;
      return data as CoverColor[];
    },
  });

  const { data: relations = [] } = useQuery({
    queryKey: ['cover_model_colors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cover_model_colors').select('model_id, color_id');
      if (error) throw error;
      return data as { model_id: string; color_id: string }[];
    },
  });

  const filteredModels = useMemo(
    () => models.filter((m) => m.cover_type === tipus),
    [models, tipus],
  );

  /** Wrap onChange so we always enrich the payload with cached model + color names. */
  const emit = (val: {
    tipus?: CoverTipus;
    modelId?: string;
    lames?: CoverMaterial;
    colorId?: string;
    manualOverride?: boolean;
    manualAmount?: number;
    murNou?: boolean;
  }) => {
    const code = val.modelId ? models.find((m) => m.id === val.modelId)?.code ?? '' : '';
    const isSLux = code === 's-lux';
    const isSPremiumForced = code === 's-premium' || code === 's-premium-cs';
    // Auto-default murNou for s-Lux based on the interior stair type, unless the user already chose.
    let nextMurNou = val.murNou;
    if (isSLux && nextMurNou === undefined) {
      // Preserve previous user selection if any, otherwise auto-suggest from stair type.
      if (murNou !== undefined) {
        nextMurNou = murNou;
      } else {
        const stair = (interiorStairsType ?? '').toLowerCase();
        const aprofita = stair === 'plataforma' || stair === 'banc' || stair === 'tot_ample';
        nextMurNou = !aprofita;
      }
    }
    // S-Premium / S-Premium CS: el muro nuevo SIEMPRE es obligatorio (no preguntamos).
    if (isSPremiumForced) nextMurNou = true;
    else if (!isSLux) nextMurNou = undefined;
    const murM2 = nextMurNou
      ? round2((Number(poolWidth) || 0) * (((Number(poolDepthMin) || 0) + (Number(poolDepthMax) || 0)) / 2))
      : undefined;
    // Preserve current calc values so partial emits don't wipe them. The calc useEffect
    // will overwrite them later with fresh values when inputs change.
    const preservedCalc = val.manualOverride
      ? { calcCost: null, calcSale: null, calcBreakdown: null }
      : calc?.ok && calc.breakdown
        ? {
            calcCost: calc.breakdown.totalCost,
            calcSale: calc.breakdown.totalSale,
            calcBreakdown: calc.breakdown,
          }
        : {};
    onChange({
      ...val,
      modelName: val.modelId ? models.find((m) => m.id === val.modelId)?.name : undefined,
      modelCode: val.modelId ? models.find((m) => m.id === val.modelId)?.code : undefined,
      colorName: val.colorId ? colors.find((c) => c.id === val.colorId)?.name : undefined,
      murNou: nextMurNou,
      murM2,
      ...preservedCalc,
    });
  };

  // Live calculation
  const selectedModel = models.find((m) => m.id === modelId);
  const selectedCode = selectedModel?.code ?? '';
  const isSLux = selectedCode === 's-lux';
  const isSPremiumFamily = selectedCode === 's-premium' || selectedCode === 's-premium-cs';
  const { result: calc, modelPrices } = useCobertorCalc({
    modelId,
    modelName: selectedModel?.name,
    modelCode: selectedModel?.code,
    coverType: tipus,
    material: lames,
    poolWidth,
    poolLength,
  });

  // Push calculated cost/sale upstream whenever the result changes (and not in manual mode).
  useEffect(() => {
    if (manualOverride) return;
    const effectiveMurNou = isSPremiumFamily ? true : isSLux ? murNou : undefined;
    const effectiveMurM2 = effectiveMurNou
      ? round2((Number(poolWidth) || 0) * (((Number(poolDepthMin) || 0) + (Number(poolDepthMax) || 0)) / 2))
      : undefined;
    if (calc?.ok && calc.breakdown) {
      onChange({
        tipus,
        modelId,
        lames,
        colorId,
        modelName: selectedModel?.name,
        modelCode: selectedModel?.code,
        colorName: colors.find((c) => c.id === colorId)?.name,
        manualOverride: false,
        manualAmount,
        murNou: effectiveMurNou,
        murM2: effectiveMurM2,
        calcCost: calc.breakdown.totalCost,
        calcSale: calc.breakdown.totalSale,
        calcBreakdown: calc.breakdown,
      });
    } else if (calc && !calc.ok) {
      onChange({
        tipus,
        modelId,
        lames,
        colorId,
        modelName: selectedModel?.name,
        modelCode: selectedModel?.code,
        colorName: colors.find((c) => c.id === colorId)?.name,
        manualOverride: false,
        manualAmount,
        murNou: effectiveMurNou,
        murM2: effectiveMurM2,
        calcCost: 0,
        calcSale: 0,
        calcBreakdown: null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calc?.ok, calc?.breakdown?.totalSale, manualOverride]);

  const allowedColorIds = useMemo(() => {
    if (!modelId) return new Set<string>();
    return new Set(relations.filter((r) => r.model_id === modelId).map((r) => r.color_id));
  }, [relations, modelId]);

  const availableColors = useMemo(
    () => colors.filter((c) => allowedColorIds.has(c.id) && c.material === lames),
    [colors, allowedColorIds, lames],
  );

  // Reset model if tipus changes and current model doesn't match
  useEffect(() => {
    if (modelId && tipus) {
      const m = models.find((x) => x.id === modelId);
      if (m && m.cover_type !== tipus) emit({ tipus, modelId: undefined, lames: undefined, colorId: undefined });
    }
  }, [tipus, modelId, models, onChange]);

  // When the user picks s-Lux, ensure murNou is initialised from the stair type.
  useEffect(() => {
    if (isSPremiumFamily) {
      // Force-emit so murNou=true and murM2 are computed and saved on the draft.
      emit({ tipus, modelId, lames, colorId, manualOverride, manualAmount, murNou: true });
      return;
    }
    if (!isSLux) return;
    if (murNou === undefined) {
      emit({ tipus, modelId, lames, colorId, manualOverride, manualAmount });
    } else {
      // Re-emit so murM2 stays in sync if pool dimensions changed.
      emit({ tipus, modelId, lames, colorId, manualOverride, manualAmount, murNou });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSLux, isSPremiumFamily, poolWidth, poolDepthMin, poolDepthMax]);

  // Reset color if not in available list anymore
  useEffect(() => {
    if (colorId && lames) {
      const c = colors.find((x) => x.id === colorId);
      if (!c || c.material !== lames || !allowedColorIds.has(colorId)) {
        emit({ tipus, modelId, lames, colorId: undefined });
      }
    }
  }, [lames, modelId, colorId, colors, allowedColorIds]);

  return (
    <div className="space-y-6">
      {/* STEP 1 — Tipus */}
      <section>
        <h4 className="text-sm font-semibold text-foreground mb-3">1. Tipus de cobertor</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TIPUS_OPTIONS.map((opt) => {
            const selected = tipus === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => emit({ tipus: opt.value, modelId: undefined, lames: undefined, colorId: undefined })}
                className={cn(
                  'text-left p-4 rounded-xl border-2 transition-all',
                  selected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:border-primary/40',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{opt.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </div>
                  {selected && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* STEP 2 — Model */}
      {tipus && (
        <section>
          <h4 className="text-sm font-semibold text-foreground mb-3">2. Model</h4>
          {loadingModels ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredModels.map((m) => {
                const selected = modelId === m.id;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      'group relative rounded-xl overflow-hidden border-2 transition-all bg-card',
                      selected ? 'border-primary shadow-md' : 'border-border hover:border-primary/40',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => emit({ tipus, modelId: m.id, lames: undefined, colorId: undefined })}
                      className="block w-full text-left"
                    >
                      <div className="relative aspect-[4/3] bg-muted">
                        {m.image_url ? (
                          <img src={m.image_url} alt={m.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImagePlaceholder label="Sense imatge" />
                        )}
                        {selected && (
                          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow">
                            <Check className="w-4 h-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                      </div>
                    </button>
                    {m.image_url && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setLightbox({ url: m.image_url!, name: m.name }); }}
                        className="absolute top-2 left-2 w-8 h-8 rounded-full bg-background/90 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                        aria-label="Ampliar imatge"
                      >
                        <Maximize2 className="w-4 h-4 text-foreground" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* S-Premium / S-Premium CS — non-blocking length reminder */}
      {tipus && modelId && isSPremiumFamily && (
        <div className="rounded-xl border-2 border-warning/50 bg-warning/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-foreground mb-0.5">Recordatori — {selectedModel?.name}</p>
            <p className="text-muted-foreground">
              Aquest model porta el calaix integrat al got. Recorda <strong>afegir mínim 1 m</strong> al llarg
              de la piscina (Pas 3 — Estructura) per allotjar el calaix de la coberta.
            </p>
            <p className="text-muted-foreground mt-2">
              ✅ S'inclouen automàticament els materials i mà d'obra del <strong>mur del cobertor</strong>{' '}
              (blocs, varilles, morter i mà d'obra) i s'afegeix la superfície del mur (×2) al revestiment interior.
            </p>
          </div>
        </div>
      )}

      {/* s-Lux — escala vs. mur nou */}
      {tipus && modelId && isSLux && (
        <SLuxWallSection
          murNou={murNou}
          interiorStairsType={interiorStairsType}
          poolWidth={poolWidth}
          poolDepthMin={poolDepthMin}
          poolDepthMax={poolDepthMax}
          onChange={(v) =>
            emit({ tipus, modelId, lames, colorId, manualOverride, manualAmount, murNou: v })
          }
        />
      )}

      {/* STEP 3 — Lames */}
      {tipus && modelId && (
        <section>
          <h4 className="text-sm font-semibold text-foreground mb-3">3. Tipus de lames</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LAMES_OPTIONS.map((opt) => {
              const selected = lames === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => emit({ tipus, modelId, lames: opt.value, colorId: undefined })}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between gap-2',
                    selected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-card hover:border-primary/40',
                  )}
                >
                  <span className="font-medium text-foreground">{opt.title}</span>
                  {selected && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* STEP 4 — Color */}
      {tipus && modelId && lames && (
        <section>
          <h4 className="text-sm font-semibold text-foreground mb-3">4. Color de les lames</h4>
          {availableColors.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No hi ha colors disponibles per a aquesta combinació.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {availableColors.map((c) => {
                const selected = colorId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => emit({ tipus, modelId, lames, colorId: c.id })}
                    className={cn(
                      'group relative rounded-xl overflow-hidden border-2 transition-all bg-card text-left',
                      selected ? 'border-primary shadow-md' : 'border-border hover:border-primary/40',
                    )}
                  >
                    <div className="relative aspect-square bg-muted">
                      {c.image_url ? (
                        <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImagePlaceholder label={c.name} />
                      )}
                      {selected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow">
                          <Check className="w-3.5 h-3.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="px-2 py-1.5">
                      <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* SUMMARY */}
      {tipus && modelId && lames && colorId && (
        <>
          <CobertorSummary
            tipus={tipus}
            model={models.find((m) => m.id === modelId)}
            lames={lames}
            color={colors.find((c) => c.id === colorId)}
          />
          <CobertorPriceBlock
            calc={calc}
            poolWidth={poolWidth}
            poolLength={poolLength}
            modelPrices={modelPrices}
            allModels={models}
            currentTipus={tipus}
            manualOverride={!!manualOverride}
            manualAmount={manualAmount}
            onManualToggle={(checked) =>
              emit({ tipus, modelId, lames, colorId, manualOverride: checked, manualAmount })
            }
            onManualAmount={(v) =>
              emit({ tipus, modelId, lames, colorId, manualOverride: true, manualAmount: v })
            }
          />
        </>
      )}

      {/* LIGHTBOX */}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {lightbox && (
            <div className="relative bg-black">
              <img src={lightbox.url} alt={lightbox.name} className="w-full max-h-[80vh] object-contain" />
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/90 flex items-center justify-center hover:bg-background"
                aria-label="Tancar"
              >
                <X className="w-5 h-5 text-foreground" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-white font-semibold">{lightbox.name}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CobertorSummary({
  tipus,
  model,
  lames,
  color,
}: {
  tipus: CoverTipus;
  model?: CoverModel;
  lames: CoverMaterial;
  color?: CoverColor;
}) {
  if (!model || !color) return null;
  const tipusLabel = tipus === 'fora_aigua' ? 'Fora de l\'aigua' : 'Submergit';
  const lamesLabel = lames === 'pvc' ? 'Lames PVC 83 mm' : 'Lames Policarbonat 83 mm';

  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 p-4 sm:p-5">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-card border border-border flex-shrink-0">
          {model.image_url ? (
            <img src={model.image_url} alt={model.name} className="w-full h-full object-cover" />
          ) : (
            <ImagePlaceholder label="" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wide text-primary">Cobertor seleccionat</span>
          </div>
          <p className="text-base font-bold text-foreground">{model.name}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-card border border-border text-muted-foreground">{tipusLabel}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-card border border-border text-muted-foreground">{lamesLabel}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-card border border-border text-muted-foreground flex items-center gap-1.5">
              {color.image_url && (
                <span className="w-3 h-3 rounded-full bg-cover bg-center border border-border/50" style={{ backgroundImage: `url(${color.image_url})` }} />
              )}
              {color.name}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtEur(n: number | undefined | null): string {
  if (n == null || isNaN(n as number)) return '—';
  return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * s-Lux only: lets the user choose between reusing the existing interior stair (platform/bench)
 * to host the cover, or building a new wall. Pre-selects automatically based on the stair type
 * but the user can override.
 */
function SLuxWallSection({
  murNou,
  interiorStairsType,
  poolWidth,
  poolDepthMin,
  poolDepthMax,
  onChange,
}: {
  murNou: boolean | undefined;
  interiorStairsType?: string;
  poolWidth?: number;
  poolDepthMin?: number;
  poolDepthMax?: number;
  onChange: (v: boolean) => void;
}) {
  const stair = (interiorStairsType ?? '').toLowerCase();
  const aprofitable = stair === 'plataforma' || stair === 'banc' || stair === 'tot_ample';
  const stairLabel =
    stair === 'plataforma' ? 'Plataforma' :
    stair === 'banc' ? 'Banc' :
    stair === 'tot_ample' ? 'Tot ample' :
    stair === 'estandard' ? 'Escala estàndard' :
    stair === 'sense' ? 'Sense escala interior' :
    'no definida';
  const avgDepth = ((Number(poolDepthMin) || 0) + (Number(poolDepthMax) || 0)) / 2;
  const m2 = round2((Number(poolWidth) || 0) * avgDepth);

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-5 space-y-3">
      <div className="flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-primary mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">s-Lux — Allotjament del cobertor</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            El s-Lux necessita un suport per amagar el cobertor. Escala detectada:{' '}
            <strong className="text-foreground">{stairLabel}</strong>.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          disabled={!aprofitable}
          onClick={() => onChange(false)}
          className={cn(
            'text-left p-3 rounded-lg border-2 transition-all',
            !aprofitable
              ? 'border-border bg-muted/40 opacity-60 cursor-not-allowed'
              : murNou === false
                ? 'border-primary bg-primary/10 shadow-sm'
                : 'border-border bg-card hover:border-primary/40',
          )}
        >
          <p className="text-sm font-semibold text-foreground">Aprofitar l'escala existent</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {aprofitable
              ? 'La plataforma/banc allotja el cobertor.'
              : "Aquesta escala no permet aprofitar — cal mur nou."}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            'text-left p-3 rounded-lg border-2 transition-all',
            murNou === true
              ? 'border-primary bg-primary/10 shadow-sm'
              : 'border-border bg-card hover:border-primary/40',
          )}
        >
          <p className="text-sm font-semibold text-foreground">Construir un mur nou</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {poolWidth && avgDepth > 0
              ? `Superfície estimada: ${m2.toFixed(2)} m² (${poolWidth} × ${avgDepth.toFixed(2)})`
              : 'Cal indicar amplada i profunditats al pas Estructura.'}
          </p>
        </button>
      </div>
      {murNou && (
        <p className="text-[11px] text-muted-foreground italic">
          Les partides de materials del mur s'afegiran automàticament a la sub-fase Cobertor segons les fórmules
          configurades pel motor de càlcul.
        </p>
      )}
    </div>
  );
}

function CobertorPriceBlock({
  calc,
  poolWidth,
  poolLength,
  modelPrices,
  allModels,
  currentTipus,
  manualOverride,
  manualAmount,
  onManualToggle,
  onManualAmount,
}: {
  calc: CobertorCalcResult | null;
  poolWidth?: number;
  poolLength?: number;
  modelPrices: any[];
  allModels: CoverModel[];
  currentTipus: CoverTipus;
  manualOverride: boolean;
  manualAmount?: number;
  onManualToggle: (v: boolean) => void;
  onManualAmount: (v: number | undefined) => void;
}) {
  // Compute compatible models (when calc fails)
  const compatible = useMemo(() => {
    if (!poolWidth || !poolLength) return [];
    const w = Math.ceil(poolWidth * 2) / 2; // closest 0.5 step (display only)
    const l = Math.ceil(poolLength);
    const okIds = new Set(
      modelPrices
        .filter((p: any) => p.width_m >= w && p.max_length_m >= l)
        .map((p: any) => p.model_id),
    );
    return allModels.filter((m) => okIds.has(m.id));
  }, [modelPrices, allModels, poolWidth, poolLength]);

  return (
    <div className="space-y-3">
      {/* Manual override toggle */}
      <label className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card cursor-pointer hover:border-primary/40 transition-colors">
        <input
          type="checkbox"
          className="mt-0.5 w-4 h-4 accent-primary"
          checked={manualOverride}
          onChange={(e) => onManualToggle(e.target.checked)}
        />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Ja tinc un pressupost personalitzat per a aquest cobertor</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Marca aquesta opció si has rebut un pressupost específic del fabricant i vols introduir l'import manualment.
          </p>
        </div>
      </label>

      {manualOverride ? (
        <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
          <label className="block text-sm font-semibold text-foreground mb-2">Import del pressupost personalitzat (€)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={manualAmount ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? undefined : Number(e.target.value);
              onManualAmount(v);
            }}
            placeholder="Ex: 4500.00"
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-card text-base font-semibold focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Aquest import substituirà el càlcul automàtic i apareixerà al resum financer.
          </p>
        </div>
      ) : !calc ? (
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Calculant…
        </div>
      ) : calc.ok && calc.breakdown ? (
        <div className="rounded-xl border border-success/40 bg-gradient-to-br from-success/5 to-success/10 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-4 h-4 text-success" />
            <span className="text-xs font-bold uppercase tracking-wide text-success">Càlcul automàtic</span>
          </div>
          <div className="space-y-1.5 text-sm">
            <Row label={`Estructura (${calc.breakdown.effectiveWidth} m d'ample)`} value={calc.breakdown.estructura} />
            <Row
              label={`Lames × ${calc.breakdown.effectiveLength} m (${fmtEur(calc.breakdown.lamaPricePerM)}/m)`}
              value={calc.breakdown.lames}
            />
            {calc.breakdown.tapaHoritzontal != null && (
              <Row
                label={`Tapa horitzontal PVC per revestir (${calc.breakdown.effectiveWidth} × 0,72 × 462 €)`}
                value={calc.breakdown.tapaHoritzontal}
              />
            )}
            <Row label="Embalatge" value={calc.breakdown.embalatge} />
            <Row label="Transport" value={calc.breakdown.transport} />
            <Row label="Instal·lació" value={calc.breakdown.installation} />
            <div className="border-t border-success/30 pt-2 mt-2 flex items-center justify-between">
              <span className="font-bold text-foreground">Total venda</span>
              <span className="text-lg font-bold text-success">{fmtEur(calc.breakdown.totalSale)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Cost estimat</span>
              <span>{fmtEur(calc.breakdown.totalCost)}</span>
            </div>
          </div>
          {(calc.breakdown.effectiveWidth !== poolWidth || calc.breakdown.effectiveLength !== poolLength) && (
            <p className="text-[11px] text-muted-foreground mt-3 italic">
              Mides arrodonides cap amunt: ample {poolWidth}m → {calc.breakdown.effectiveWidth}m, llarg {poolLength}m → {calc.breakdown.effectiveLength}m
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-warning/50 bg-warning/5 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground mb-1">No es pot calcular el preu d'aquest model</p>
              <p className="text-sm text-muted-foreground">{calc.message}</p>
              {compatible.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> Models compatibles amb la teva piscina:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {compatible.map((m) => (
                      <span
                        key={m.id}
                        className="text-xs px-2 py-1 rounded-full bg-card border border-primary/30 text-primary font-medium"
                      >
                        {m.name} {m.cover_type === 'submergit' ? '(submergit)' : '(fora aigua)'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                També pots marcar <strong>"Ja tinc un pressupost personalitzat"</strong> més amunt per introduir un import específic.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-foreground/90">
      <span>{label}</span>
      <span className="tabular-nums">{fmtEur(value)}</span>
    </div>
  );
}

/** Build a single-line description of the selected cobertor for the budget summary. */
export function buildCobertorDescription(
  modelName?: string,
  lames?: CoverMaterial,
  colorName?: string,
): string {
  const parts: string[] = [];
  if (modelName) parts.push(`Cobertor ${modelName}`);
  else parts.push('Cobertor');
  if (lames) parts.push(lames === 'pvc' ? 'Lames PVC 83 mm' : 'Lames Policarbonat 83 mm');
  if (colorName) parts.push(colorName);
  return parts.join(' · ');
}