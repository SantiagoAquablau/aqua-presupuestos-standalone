import { useBudgetStore, type InteriorStairsType, type ConstructionSystem, type WaterproofingSystem, type PoolDisposition } from '@/stores/budgetStore';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, ChevronDown, Info, Droplets, Layers, Shield, Waves } from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWizardValidation, fieldErrorClass } from '@/hooks/useWizardValidation';
import { FieldError } from '@/components/wizard/FieldError';
import { DecimalInput } from '@/components/wizard/DecimalInput';
import { computeInteriorStepsCount } from '@/lib/stairsGeometry';

export function StepEstructura() {
  const { draft, updateDraft, setStep } = useBudgetStore();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    piscina: true, extStairs: false, jacuzzi: false, intStairs: false, tecnica: false, impermeabilitzant: false,
  });
  const { validate, hasError, clearError, registerField, shakeKey } = useWizardValidation();

  // Sensible defaults: Gunite + Impertot are the most common picks.
  useEffect(() => {
    const patch: Partial<typeof draft> = {};
    if (!draft.constructionSystem) patch.constructionSystem = 'gunite';
    if (!draft.waterproofingSystem) patch.waterproofingSystem = 'impertot';
    if (Object.keys(patch).length) updateDraft(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNext = () => {
    const ok = validate([
      { field: 'poolType', isValid: !!draft.poolType, message: 'Selecciona el tipus de piscina' },
      { field: 'poolShape', isValid: !!draft.poolShape, message: 'Selecciona la forma de la piscina' },
      { field: 'interiorStairsType', isValid: !!draft.interiorStairsType, message: 'Selecciona el tipus d\'escala interior' },
      { field: 'constructionSystem', isValid: !!draft.constructionSystem, message: 'Selecciona el sistema constructiu' },
      { field: 'waterproofingSystem', isValid: !!draft.waterproofingSystem, message: 'Selecciona el sistema impermeabilitzant' },
    ]);
    if (ok) setStep(4);
    else {
      // Open relevant sections so the user sees the error
      setOpenSections((s) => ({ ...s, piscina: true, intStairs: true, tecnica: true, impermeabilitzant: true }));
    }
  };

  const toggle = (key: string) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  // Selecting 'Elevada' preselects Bloc Encofrat Armat + Làmina Proof (the usual
  // technique for elevated pools) and makes the exterior access stair mandatory.
  // This only fires at the moment of selection — it never re-forces the values
  // on later renders, so a manual change afterwards sticks.
  const handleSelectDisposition = (value: PoolDisposition) => {
    const patch: Partial<typeof draft> = { poolDisposition: value };
    if (value === 'elevada') {
      patch.constructionSystem = 'bloc_encofrat';
      patch.waterproofingSystem = 'lamina_proof';
      patch.hasAccessStair = true;
    }
    if (value === 'enterrada') {
      // "Revestiment exterior" + "altura vista" only make sense with a visible
      // wall (semi-enterrada / elevada). Clear them so a stale value from a
      // previous disposition doesn't silently keep generating partides/import
      // in the PDF after switching back to enterrada.
      patch.revestimentExteriorInclos = false;
      patch.revestimentExteriorFormat = undefined;
      patch.revestimentExteriorModelId = undefined;
      patch.revestimentExteriorModelADeterminar = undefined;
      patch.revestimentExteriorBeurada = undefined;
      patch.revestimentExteriorBeuradaColor = undefined;
      patch.alturaVista = undefined;
    }
    updateDraft(patch);
  };

  // Turning the jacuzzi off must clear every jacuzzi* field — otherwise stale
  // data (measures, jets, equips addicionals) reappears if the toggle is
  // re-enabled later, or leaks into formula calculations/PDF while hidden.
  const handleToggleJacuzzi = () => {
    if (!draft.hasJacuzzi) {
      updateDraft({ hasJacuzzi: true });
      return;
    }
    updateDraft({
      hasJacuzzi: false,
      jacuzziType: undefined,
      jacuzziPosition: undefined,
      jacuzziLength: undefined,
      jacuzziWidth: undefined,
      jacuzziDepth: undefined,
      jacuzziBenchCount: undefined,
      jacuzziBenchDepth: undefined,
      jacuzziBenchHeight: undefined,
      jacuzziStairsCount: undefined,
      jacuzziStairsTread: undefined,
      jacuzziAirJetsCount: undefined,
      jacuzziAirJetsIntakeCount: undefined,
      jacuzziAirPumpQty: undefined,
      jacuzziAirPumpArticleId: undefined,
      jacuzziWaterJetsCount: undefined,
      jacuzziWaterJetsIntakeCount: undefined,
      jacuzziWaterPumpQty: undefined,
      jacuzziWaterPumpArticleId: undefined,
      jacuzziPiezoButtonsCount: undefined,
      jacuzziFiltrationPumpArticleId: undefined,
      jacuzziFiltrationPumpQty: undefined,
      jacuzziFilterArticleId: undefined,
      jacuzziFilterQty: undefined,
      jacuzziLedArticleId: undefined,
      jacuzziLedCount: undefined,
      jacuzziHeatPumpArticleId: undefined,
      jacuzziHeatPumpQty: undefined,
      jacuzziSalineElectrolysisArticleId: undefined,
      jacuzziSalineElectrolysisQty: undefined,
    });
  };

  const { data: stairImages = [] } = useQuery({
    queryKey: ['stair-images'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stair_images').select('*');
      if (error) throw error;
      return data;
    },
  });

  const depthAvg = useMemo(() => {
    if (draft.poolDepthMin && draft.poolDepthMax) return (draft.poolDepthMin + draft.poolDepthMax) / 2;
    return 0;
  }, [draft.poolDepthMin, draft.poolDepthMax]);

  const poolSurface = useMemo(() => {
    if (draft.poolShape === 'irregular') return draft.poolSurfaceIrregular || 0;
    if (draft.poolShape === 'regular' && draft.poolLength && draft.poolWidth && depthAvg) {
      return (draft.poolLength * draft.poolWidth) + 2 * (draft.poolLength * depthAvg) + 2 * (draft.poolWidth * depthAvg);
    }
    return 0;
  }, [draft.poolShape, draft.poolLength, draft.poolWidth, draft.poolSurfaceIrregular, depthAvg]);

  const volume = useMemo(() => {
    // Irregular: no floor-only dimension is collected, so we approximate volume
    // as total vessel surface × avg depth (overestimates somewhat, since the
    // surface includes wall area, not just floor — best available without a
    // dedicated floor-area input).
    if (draft.poolShape === 'irregular') return (draft.poolSurfaceIrregular || 0) * depthAvg * 1000;
    if (draft.poolShape === 'regular' && draft.poolLength && draft.poolWidth && depthAvg) {
      return draft.poolLength * draft.poolWidth * depthAvg * 1000;
    }
    return 0;
  }, [draft.poolShape, draft.poolLength, draft.poolWidth, draft.poolSurfaceIrregular, depthAvg]);

  const extSurface = (draft.hasExteriorStairs && draft.extStairsLength && draft.extStairsWidth)
    ? draft.extStairsLength * draft.extStairsWidth : 0;
  const totalSurface = poolSurface + extSurface;

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 min-h-[44px]';
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

  const SectionHeader = ({ id, title, icon: Icon }: { id: string; title: string; icon: typeof Droplets }) => (
    <button onClick={() => toggle(id)} className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-t-xl">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Icon className="w-4 h-4 text-primary" /></div>
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <ChevronDown className={cn('w-5 h-5 text-muted-foreground transition-transform', openSections[id] && 'rotate-180')} />
    </button>
  );

  const interiorStairsOptions: { value: InteriorStairsType; label: string; desc: string }[] = [
    { value: 'estandard', label: 'Estàndard', desc: 'Escala de graons integrada al vas' },
    { value: 'plataforma', label: 'Amb Plataforma', desc: 'Escala amb zona de repòs horitzontal' },
    { value: 'banc', label: 'Amb Banc', desc: "Seient perimetral al llarg d'un costat" },
    { value: 'tot_ample', label: "A Tot l'Ample", desc: "Escala que ocupa tot l'ample del costat curt" },
    { value: 'sense', label: 'Sense Escala', desc: "No s'inclou escala interior d'obra" },
  ];

  const getStairImage = (type: string) => {
    const labelMap: Record<string, string> = {
      estandard: 'Escala Estàndard',
      plataforma: 'Escala amb Plataforma',
      banc: 'Escala amb Banc',
      tot_ample: "Escala a Tot l'Ample",
    };
    const target = labelMap[type] || type;
    const img = stairImages.find((s: any) => s.stair_type === target);
    return img?.image_url || '';
  };

  // Track which stair fields have been manually edited by the user.
  // Resets whenever interiorStairsType changes so suggestions re-apply fresh.
  type StairField =
    | 'stairsWidth' | 'stairsLength' | 'stairsHeight'
    | 'platformWidth' | 'platformLength' | 'platformHeight'
    | 'benchWidth' | 'benchLength' | 'benchHeight'
    | 'extStairsLength';
  const userModifiedRef = useRef<Record<StairField, boolean> | null>(null);
  if (userModifiedRef.current === null) {
    // Initialize from existing draft: if a stair field already has a value
    // that differs from the auto-suggestion, treat it as user-modified so
    // we don't overwrite it on mount / when navigating back to this step.
    const init: Record<StairField, boolean> = {
      stairsWidth: false, stairsLength: false, stairsHeight: false,
      platformWidth: false, platformLength: false, platformHeight: false,
      benchWidth: false, benchLength: false, benchHeight: false,
      extStairsLength: false,
    };
    const type = draft.interiorStairsType;
    if (type && type !== 'sense') {
      const suggestions = (() => {
        try {
          return computeSuggestions(type, draft.poolWidth || 0, draft.poolDepthMin || 0);
        } catch { return {} as Partial<Record<StairField, number | undefined>>; }
      })();
      (Object.keys(init) as StairField[]).forEach((f) => {
        const cur = (draft as any)[f];
        const sug = suggestions[f];
        if (cur !== undefined && cur !== null && Number(cur) !== Number(sug ?? NaN)) {
          init[f] = true;
        }
      });
    }
    userModifiedRef.current = init;
  }

  const markUserModified = (field: StairField) => {
    userModifiedRef.current[field] = true;
  };

  function round2(n: number) { return Math.round(n * 100) / 100; }

  function computeSuggestions(
    type: InteriorStairsType,
    poolWidth: number,
    poolDepthMin: number,
  ): Partial<Record<StairField, number | undefined>> {
    const w = poolWidth > 0 ? poolWidth : 0;
    const d = poolDepthMin > 0 ? poolDepthMin : 0;
    const widthExtra = w > 3 ? w - 3 : 0;

    const empty: Partial<Record<StairField, number | undefined>> = {
      stairsWidth: undefined, stairsLength: undefined, stairsHeight: undefined,
      platformWidth: undefined, platformLength: undefined, platformHeight: undefined,
      benchWidth: undefined, benchLength: undefined, benchHeight: undefined,
    };

    // Ext-stairs own length suggestion — poolDepthMin stays the source of
    // truth for how many risers the exterior escala needs (same
    // computeInteriorStepsCount*0.30 formula the no-exterior-stairs
    // stairsLength case already uses below), independently of whichever
    // interiorStairsType is selected: the exterior escala is a physical
    // structure of its own (section 3B), not a property of the interior
    // escala type (section 3C). Deliberately NOT folded into `empty`/the
    // 'sense' branch below — 'sense' means "no interior escala", not "no
    // exterior escala", so switching interiorStairsType to 'sense' must not
    // wipe out an unrelated extStairsLength the user already has (whether
    // auto-suggested or hand-edited).
    const extStairsLen = draft.hasExteriorStairs && d > 0 ? round2(computeInteriorStepsCount(d) * 0.30) : undefined;

    if (type === 'sense') {
      return { ...empty, stairsWidth: 0, stairsLength: 0, stairsHeight: 0, platformWidth: 0, platformLength: 0, platformHeight: 0, benchWidth: 0, benchLength: 0, benchHeight: 0 };
    }

    if (type === 'estandard') {
      // When "Escala Exterior d'Obra" is active, treat it as describing the
      // SAME physical escala as this 'estandard' interior one, just built
      // outside the vas instead of carved into its corner (see
      // PagePlanol.tsx's ext-stairs block) — so the interior W×L fields
      // default to whatever the user already entered for the exterior
      // escala, instead of the depth-derived formula. Still just a
      // suggestion: markUserModified/userModifiedRef below let the user
      // override either pair independently, same as always.
      const useExtSize = !!draft.hasExteriorStairs && (draft.extStairsLength || 0) > 0 && (draft.extStairsWidth || 0) > 0;
      return {
        ...empty,
        stairsWidth: useExtSize
          ? round2(draft.extStairsWidth as number)
          : w > 0 ? Math.min(round2(1.5 + widthExtra), 1.5) : undefined,
        stairsLength: useExtSize
          ? round2(draft.extStairsLength as number)
          : d > 0 ? round2(computeInteriorStepsCount(d) * 0.30) : undefined,
        stairsHeight: d > 0 ? round2(d) : undefined,
        extStairsLength: extStairsLen,
      };
    }

    if (type === 'plataforma') {
      const platformH = d > 0 ? round2(d - 0.4) : undefined;
      const stairLen = d > 0 ? round2(computeInteriorStepsCount(d) * 0.30) : undefined;
      // Same "Escala Exterior d'Obra describes this same physical escala"
      // idea as 'estandard' above (see its own useExtSize comment): when
      // active, stairsWidth/platformWidth apply the SAME 1:2 split formula
      // but driven by extStairsWidth instead of poolWidth, and
      // stairsLength/platformLength both mirror extStairsLength directly
      // (both sub-blocks share the exterior escala's own protrusion depth —
      // see PagePlanol.tsx's ext-stairs block). Still just a suggestion:
      // markUserModified/userModifiedRef let the user override any of the 4
      // fields independently, same as always.
      const useExtSize = !!draft.hasExteriorStairs && (draft.extStairsLength || 0) > 0 && (draft.extStairsWidth || 0) > 0;
      const extW = useExtSize ? (draft.extStairsWidth as number) : 0;
      const widthExtraExt = extW > 3 ? extW - 3 : 0;
      const extLen = useExtSize ? round2(draft.extStairsLength as number) : undefined;
      return {
        ...empty,
        stairsWidth: useExtSize
          ? round2((3 + widthExtraExt) * (1 / 3))
          : w > 0 ? round2((3 + widthExtra) * (1 / 3)) : undefined,
        stairsLength: useExtSize ? extLen : stairLen,
        stairsHeight: d > 0 ? round2(d) : undefined,
        platformWidth: useExtSize
          ? round2((3 + widthExtraExt) * (2 / 3))
          : w > 0 ? round2((3 + widthExtra) * (2 / 3)) : undefined,
        // Platform length must mirror the stair length (per business rule)
        platformLength: useExtSize ? extLen : stairLen,
        platformHeight: platformH,
        extStairsLength: extStairsLen,
      };
    }

    if (type === 'banc') {
      // Same "Escala Exterior d'Obra describes this same physical escala"
      // idea as 'estandard'/'plataforma' above: when active, stairsWidth/
      // benchWidth apply the SAME 1:2 split formula as plataforma's own
      // stairsWidth/platformWidth, just driven by extStairsWidth instead of
      // poolWidth, and stairsLength mirrors extStairsLength directly (the
      // escala sub-block shares the exterior escala's own protrusion depth
      // — see PagePlanol.tsx's ext-stairs block). benchLength, UNLIKE
      // platformLength, does NOT mirror stairsLength/extStairsLength — it
      // stays fixed at 0.6m regardless (confirmed business rule: the banc
      // always protrudes LESS than the escala, snapped in PagePlanol.tsx to
      // the step-2/step-3 riser divider — see its own extBenchProtrusion —
      // independent of poolDepthMin/extStairsLength). Still just a
      // suggestion: markUserModified/userModifiedRef let the user override
      // any of the 4 fields independently, same as always.
      const useExtSize = !!draft.hasExteriorStairs && (draft.extStairsLength || 0) > 0 && (draft.extStairsWidth || 0) > 0;
      const extW = useExtSize ? (draft.extStairsWidth as number) : 0;
      const widthExtraExt = extW > 3 ? extW - 3 : 0;
      return {
        ...empty,
        stairsWidth: useExtSize
          ? round2((3 + widthExtraExt) * (1 / 3))
          : w > 0 ? round2((3 + widthExtra) * (1 / 3)) : undefined,
        stairsLength: useExtSize
          ? round2(draft.extStairsLength as number)
          : d > 0 ? round2(computeInteriorStepsCount(d) * 0.30) : undefined,
        stairsHeight: d > 0 ? round2(d) : undefined,
        benchWidth: useExtSize
          ? round2((3 + widthExtraExt) * (2 / 3))
          : w > 0 ? round2((3 + widthExtra) * (2 / 3)) : undefined,
        benchLength: 0.6,
        benchHeight: d > 0 ? round2(d - 0.4) : undefined,
        extStairsLength: extStairsLen,
      };
    }

    if (type === 'tot_ample') {
      return {
        ...empty,
        stairsWidth: w > 0 ? round2(w) : undefined,
        stairsLength: d > 0 ? round2(computeInteriorStepsCount(d) * 0.30) : undefined,
        stairsHeight: d > 0 ? round2(d) : undefined,
        extStairsLength: extStairsLen,
      };
    }

    return empty;
  }

  const handleSelectStairs = (value: InteriorStairsType) => {
    // Reset userModified tracking so suggestions re-apply fresh on type change
    userModifiedRef.current = {
      stairsWidth: false, stairsLength: false, stairsHeight: false,
      platformWidth: false, platformLength: false, platformHeight: false,
      benchWidth: false, benchLength: false, benchHeight: false,
      extStairsLength: false,
    };
    const suggestions = computeSuggestions(value, draft.poolWidth || 0, draft.poolDepthMin || 0);
    updateDraft({ interiorStairsType: value, ...suggestions });
  };

  // Recalculate suggested measures whenever pool dimensions change,
  // but only overwrite fields the user hasn't manually edited.
  useEffect(() => {
    const type = draft.interiorStairsType;
    if (!type || type === 'sense') return;
    const suggestions = computeSuggestions(type, draft.poolWidth || 0, draft.poolDepthMin || 0);
    const patch: Record<string, number | undefined> = {};
    (Object.keys(suggestions) as StairField[]).forEach((field) => {
      if (!userModifiedRef.current[field]) {
        patch[field] = suggestions[field];
      }
    });
    if (Object.keys(patch).length > 0) updateDraft(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.poolWidth, draft.poolDepthMin, draft.interiorStairsType, draft.hasExteriorStairs, draft.extStairsLength, draft.extStairsWidth]);

  const constructionOptions: { value: ConstructionSystem; label: string; desc: string }[] = [
    { value: 'gunite', label: 'Gunite', desc: 'Projecció de formigó. Alta resistència i adaptabilitat.' },
    { value: 'bloc_encofrat', label: 'Bloc Encofrat Armat', desc: 'Blocs de formigó armat. Sistema tradicional i econòmic.' },
  ];

  const waterproofingOptions: { value: WaterproofingSystem; label: string; desc: string; badge?: string }[] = [
    { value: 'impertot', label: 'Impertot', desc: 'Impermeabilització cimentosa bicomponent' },
    { value: 'lamina_proof', label: 'Làmina Proof (Fixcer)', desc: 'Làmina flexible PVC premium. Garantia 10 anys.' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Estructura de la Piscina</h2>
        <p className="text-sm text-muted-foreground mt-1">Defineix les característiques constructives</p>
      </div>

      {/* Metric cards */}
      {(depthAvg > 0 || volume > 0 || poolSurface > 0) && (
        <div className="grid grid-cols-3 gap-2">
          {depthAvg > 0 && <div className="bg-card rounded-lg p-3 border border-border text-center"><p className="text-[10px] text-muted-foreground">Prof. mitjana</p><p className="text-sm font-bold text-foreground">{depthAvg.toFixed(2)} m</p></div>}
          {volume > 0 && <div className="bg-card rounded-lg p-3 border border-border text-center"><p className="text-[10px] text-muted-foreground">Capacitat</p><p className="text-sm font-bold text-foreground">{Math.round(volume).toLocaleString('ca-ES')} L</p></div>}
          {poolSurface > 0 && <div className="bg-card rounded-lg p-3 border border-border text-center"><p className="text-[10px] text-muted-foreground">Superfície</p><p className="text-sm font-bold text-foreground">{poolSurface.toFixed(2)} m²</p></div>}
        </div>
      )}

      {/* 3A - Pool */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <SectionHeader id="piscina" title="Característiques de la Piscina" icon={Droplets} />
        {openSections.piscina && (
          <div className="p-4 pt-0 space-y-5 border-t border-border">
            <div className="pt-4" ref={registerField('poolType')}>
              <label className={labelClass}>Tipus de piscina</label>
              <div className="flex gap-3">
                {(['particular', 'comunitaria'] as const).map((v) => (
                  <button key={v} onClick={() => { updateDraft({ poolType: v }); clearError('poolType'); }}
                    className={cn('flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all min-h-[44px]',
                      draft.poolType === v ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40',
                      hasError('poolType') && draft.poolType !== v && fieldErrorClass
                    )}>{v === 'particular' ? 'Particular' : 'Comunitària'}</button>
                ))}
              </div>
              {hasError('poolType') && <FieldError message="Selecciona el tipus de piscina" shakeKey={shakeKey} />}
            </div>
            <div ref={registerField('poolShape')}>
              <label className={labelClass}>Forma de la piscina</label>
              <div className="flex gap-3">
                {(['regular', 'irregular'] as const).map((v) => (
                  <button key={v} onClick={() => {
                    // Clear the fields specific to the shape being left, so no
                    // "ghost" value from a previous shape silently leaks into
                    // any calculation that reads poolLength/poolWidth or
                    // poolSurfaceIrregular without branching by poolShape.
                    updateDraft(v === 'irregular'
                      ? { poolShape: v, poolLength: undefined, poolWidth: undefined }
                      : { poolShape: v, poolSurfaceIrregular: undefined });
                    clearError('poolShape');
                  }}
                    className={cn('flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all min-h-[44px]',
                      draft.poolShape === v ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40',
                      hasError('poolShape') && draft.poolShape !== v && fieldErrorClass
                    )}>{v === 'regular' ? 'Regular (rectangular)' : 'Irregular'}</button>
                ))}
              </div>
              {hasError('poolShape') && <FieldError message="Selecciona la forma de la piscina" shakeKey={shakeKey} />}
            </div>
            {draft.poolShape === 'regular' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div><label className={labelClass}>Llarg (m)</label><input type="number" step="0.01" className={inputClass} value={draft.poolLength || ''} onChange={(e) => updateDraft({ poolLength: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) })} /></div>
                <div><label className={labelClass}>Ample (m)</label><input type="number" step="0.01" className={inputClass} value={draft.poolWidth || ''} onChange={(e) => updateDraft({ poolWidth: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) })} /></div>
                <div><label className={labelClass}>Prof. mínima (m)</label><input type="number" step="0.01" className={inputClass} value={draft.poolDepthMin || ''} onChange={(e) => updateDraft({ poolDepthMin: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) })} /></div>
                <div><label className={labelClass}>Prof. màxima (m)</label><input type="number" step="0.01" className={inputClass} value={draft.poolDepthMax || ''} onChange={(e) => updateDraft({ poolDepthMax: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) })} /></div>
              </div>
            )}
            {draft.poolShape === 'irregular' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelClass}>Superfície del vas (m²)</label><input type="number" step="0.01" className={inputClass} value={draft.poolSurfaceIrregular || ''} onChange={(e) => updateDraft({ poolSurfaceIrregular: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) })} /></div>
                <div><label className={labelClass}>Prof. mínima (m)</label><input type="number" step="0.01" className={inputClass} value={draft.poolDepthMin || ''} onChange={(e) => updateDraft({ poolDepthMin: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) })} /></div>
                <div><label className={labelClass}>Prof. màxima (m)</label><input type="number" step="0.01" className={inputClass} value={draft.poolDepthMax || ''} onChange={(e) => updateDraft({ poolDepthMax: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) })} /></div>
              </div>
            )}

            {/* Disposició de la piscina */}
            <div>
              <label className={labelClass}>Disposició de la piscina</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  { v: 'enterrada', l: 'Enterrada' },
                  { v: 'semi_enterrada', l: 'Semi enterrada' },
                  { v: 'elevada', l: 'Elevada' },
                ] as const).map((o) => {
                  const current = draft.poolDisposition || 'enterrada';
                  const selected = current === o.v;
                  return (
                    <button key={o.v} type="button" onClick={() => handleSelectDisposition(o.v)}
                      className={cn('py-2.5 rounded-lg border-2 text-sm font-medium transition-all min-h-[44px]',
                        selected ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                      )}>{o.l}</button>
                  );
                })}
              </div>
            </div>

            {(draft.poolDisposition === 'semi_enterrada' || draft.poolDisposition === 'elevada') && (
              <DispositionAccessFields disposition={draft.poolDisposition} inputClass={inputClass} labelClass={labelClass} />
            )}
          </div>
        )}
      </div>

      {/* 3B - Exterior stairs */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <SectionHeader id="extStairs" title="Escala Exterior d'Obra" icon={Layers} />
        {openSections.extStairs && (
          <div className="p-4 pt-0 space-y-4 border-t border-border">
            <div className="pt-4 flex items-center gap-3">
              <label className="text-sm font-medium text-foreground">La piscina inclou escala exterior d'obra?</label>
              <button onClick={() => updateDraft({ hasExteriorStairs: !draft.hasExteriorStairs })}
                className={cn('w-12 h-6 rounded-full transition-colors relative', draft.hasExteriorStairs ? 'bg-primary' : 'bg-muted')}>
                <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform', draft.hasExteriorStairs ? 'translate-x-6' : 'translate-x-0.5')} />
              </button>
            </div>
            {draft.hasExteriorStairs && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className={labelClass}>Llarg escala (m)</label><input type="number" step="0.01" className={inputClass} value={draft.extStairsLength || ''} onChange={(e) => { markUserModified('extStairsLength'); updateDraft({ extStairsLength: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) }); }} /></div>
                <div><label className={labelClass}>Ample escala (m)</label><input type="number" step="0.01" className={inputClass} value={draft.extStairsWidth || ''} onChange={(e) => updateDraft({ extStairsWidth: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) })} /></div>
              </div>
            )}
            {totalSurface > 0 && draft.hasExteriorStairs && extSurface > 0 && (
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                <p className="text-xs text-muted-foreground">Superfície total (vas + escala exterior)</p>
                <p className="text-lg font-bold text-primary">{totalSurface.toFixed(2)} m²</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3B-2 - Jacuzzi (fase condicional del wizard) */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <SectionHeader id="jacuzzi" title="Jacuzzi" icon={Waves} />
        {openSections.jacuzzi && (
          <div className="p-4 pt-0 space-y-4 border-t border-border">
            <div className="pt-4 flex items-center gap-3">
              <label className="text-sm font-medium text-foreground">Vol jacuzzi?</label>
              <button onClick={handleToggleJacuzzi}
                className={cn('w-12 h-6 rounded-full transition-colors relative', draft.hasJacuzzi ? 'bg-primary' : 'bg-muted')}>
                <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform', draft.hasJacuzzi ? 'translate-x-6' : 'translate-x-0.5')} />
              </button>
            </div>
            {draft.hasJacuzzi && (
              <p className="text-xs text-muted-foreground">El tipus i les mesures del jacuzzi es demanaran a la fase "Jacuzzi" del pas a pas.</p>
            )}
          </div>
        )}
      </div>

      {/* 3C - Interior stairs */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <SectionHeader id="intStairs" title="Escala Interior" icon={Layers} />
        {openSections.intStairs && (
          <div className="p-4 pt-0 space-y-4 border-t border-border">
            <div ref={registerField('interiorStairsType')} className="pt-4 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {interiorStairsOptions.map((opt) => {
                const imgUrl = getStairImage(opt.value);
                const isSelected = draft.interiorStairsType === opt.value;
                return (
                  <button key={opt.value} onClick={() => { handleSelectStairs(opt.value); clearError('interiorStairsType'); }}
                    className={cn(
                      'rounded-xl border-2 transition-all overflow-hidden',
                      'flex sm:flex-col items-center sm:items-stretch gap-3 sm:gap-0 p-3 sm:p-3',
                      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                      hasError('interiorStairsType') && !isSelected && fieldErrorClass
                    )}>
                    <div className={cn(
                      'bg-muted rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden',
                      'w-20 h-20 sm:w-full sm:h-[120px] lg:h-[100px] sm:mb-2'
                    )}>
                      {imgUrl ? <img src={imgUrl} alt={opt.label} className="w-full h-full object-cover" /> : <Layers className="w-6 h-6 text-muted-foreground" />}
                    </div>
                    <div className="text-left sm:text-center flex-1">
                      <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{opt.desc}</p>
                    </div>
                    {isSelected && (
                      <div className="sm:hidden w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {hasError('interiorStairsType') && <FieldError message="Selecciona el tipus d'escala interior" shakeKey={shakeKey} />}

            {draft.interiorStairsType && draft.interiorStairsType !== 'sense' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 p-2 rounded-lg">
                  <Info className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Mesures suggerides. Pots modificar-les.</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">Mesures de l'escala</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div><label className={labelClass}>Ample (m)</label><input type="number" step="0.01" className={inputClass} value={draft.stairsWidth ?? ''} onChange={(e) => { markUserModified('stairsWidth'); updateDraft({ stairsWidth: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) }); }} /></div>
                    <div><label className={labelClass}>Llarg (m)</label><input type="number" step="0.01" className={inputClass} value={draft.stairsLength ?? ''} onChange={(e) => { markUserModified('stairsLength'); updateDraft({ stairsLength: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) }); }} /></div>
                    <div><label className={labelClass}>Alçada (m)</label><input type="number" step="0.01" className={inputClass} value={draft.stairsHeight ?? ''} onChange={(e) => { markUserModified('stairsHeight'); updateDraft({ stairsHeight: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) }); }} /></div>
                  </div>
                </div>
                {draft.interiorStairsType === 'plataforma' && (
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">Mesures de la plataforma</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div><label className={labelClass}>Ample (m)</label><input type="number" step="0.01" className={inputClass} value={draft.platformWidth ?? ''} onChange={(e) => { markUserModified('platformWidth'); updateDraft({ platformWidth: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) }); }} /></div>
                      <div><label className={labelClass}>Llarg (m)</label><input type="number" step="0.01" className={inputClass} value={draft.platformLength ?? ''} onChange={(e) => { markUserModified('platformLength'); updateDraft({ platformLength: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) }); }} /></div>
                      <div><label className={labelClass}>Alçada (m)</label><input type="number" step="0.01" className={inputClass} value={draft.platformHeight ?? ''} onChange={(e) => { markUserModified('platformHeight'); updateDraft({ platformHeight: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) }); }} /></div>
                    </div>
                  </div>
                )}
                {draft.interiorStairsType === 'banc' && (
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">Mesures del banc</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div><label className={labelClass}>Ample (m)</label><input type="number" step="0.01" className={inputClass} value={draft.benchWidth ?? ''} onChange={(e) => { markUserModified('benchWidth'); updateDraft({ benchWidth: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) }); }} /></div>
                      <div><label className={labelClass}>Llarg (m)</label><input type="number" step="0.01" className={inputClass} value={draft.benchLength ?? ''} onChange={(e) => { markUserModified('benchLength'); updateDraft({ benchLength: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) }); }} /></div>
                      <div><label className={labelClass}>Alçada (m)</label><input type="number" step="0.01" className={inputClass} value={draft.benchHeight ?? ''} onChange={(e) => { markUserModified('benchHeight'); updateDraft({ benchHeight: (e.target.value === "" ? undefined : (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : undefined)) }); }} /></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3D - Construction */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <SectionHeader id="tecnica" title="Tècnica del Vas" icon={Shield} />
        {openSections.tecnica && (
          <div className="p-4 pt-0 border-t border-border">
            <div ref={registerField('constructionSystem')} className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {constructionOptions.map((opt) => (
                <button key={opt.value} onClick={() => {
                    const patch: any = { constructionSystem: opt.value };
                    if (opt.value === 'bloc_encofrat') patch.waterproofingSystem = 'lamina_proof';
                    updateDraft(patch);
                    clearError('constructionSystem');
                    if (opt.value === 'bloc_encofrat') clearError('waterproofingSystem');
                  }}
                  className={cn('flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all min-h-[44px]',
                    draft.constructionSystem === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                    hasError('constructionSystem') && draft.constructionSystem !== opt.value && fieldErrorClass
                  )}>
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><Shield className="w-6 h-6 text-muted-foreground" /></div>
                  <div><p className="font-semibold text-foreground">{opt.label}</p><p className="text-sm text-muted-foreground mt-0.5">{opt.desc}</p></div>
                </button>
              ))}
            </div>
            {hasError('constructionSystem') && <FieldError message="Selecciona el sistema constructiu" shakeKey={shakeKey} />}

            {draft.constructionSystem === 'gunite' && (
              <div className="mt-5 p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Info className="w-4 h-4" /> Configuració específica del gunite
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Metres de manguera extres</label>
                    <input type="number" step="1" min="0" className={inputClass}
                      value={draft.guniteMangueraMetres ?? 0}
                      onChange={(e) => updateDraft({ guniteMangueraMetres: parseFloat(e.target.value) || 0 })} />
                    <p className="text-xs text-muted-foreground mt-1">Base inclou fins a 30 m sense cost. Cada tram extra de 10 m: +50 € (cost i venda).</p>
                  </div>
                  <div>
                    <label className={labelClass}>Distància fins a la piscina (km)</label>
                    <input type="number" step="1" min="0" className={inputClass}
                      value={draft.guniteDistanciaKm ?? 0}
                      onChange={(e) => updateDraft({ guniteDistanciaKm: parseFloat(e.target.value) || 0 })} />
                    <p className="text-xs text-muted-foreground mt-1">Si supera 30 km, s'afegeix un càrrec fix de +50 € per desplaçament.</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground bg-card rounded-lg p-3 border border-border">
                  <strong className="text-foreground">Recàrrec hormigó:</strong> Si la quantitat d'<em>Hormigón D-400 amb fibres</em> supera els 15 m³, cada m³ addicional suma +15 € al cost de la mà d'obra (gunitadora). El preu de venda es calcula com a cost × 1,3.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3E - Waterproofing */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <SectionHeader id="impermeabilitzant" title="Impermeabilitzant" icon={Droplets} />
        {openSections.impermeabilitzant && (
          <div className="p-4 pt-0 border-t border-border">
            <div ref={registerField('waterproofingSystem')} className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {waterproofingOptions.map((opt) => (
                <button key={opt.value} onClick={() => { updateDraft({ waterproofingSystem: opt.value }); clearError('waterproofingSystem'); }}
                  className={cn('relative p-4 rounded-xl border-2 text-left transition-all',
                    draft.waterproofingSystem === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                    hasError('waterproofingSystem') && draft.waterproofingSystem !== opt.value && fieldErrorClass
                  )}>
                  {opt.badge && <span className="absolute -top-2.5 right-3 bg-secondary text-secondary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">{opt.badge}</span>}
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3"><Droplets className="w-5 h-5 text-muted-foreground" /></div>
                  <p className="font-semibold text-foreground">{opt.label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
            {hasError('waterproofingSystem') && <FieldError message="Selecciona el sistema impermeabilitzant" shakeKey={shakeKey} />}
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={() => setStep(2)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Enrere
        </button>
        <button type="button" onClick={handleNext} className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md min-h-[44px]">
          Següent <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function DispositionAccessFields({
  disposition,
  inputClass,
  labelClass,
}: {
  disposition: 'semi_enterrada' | 'elevada';
  inputClass: string;
  labelClass: string;
}) {
  const { draft, updateDraft } = useBudgetStore();
  const isElevada = disposition === 'elevada';

  // Elevada: altura efectiva = profunditat màxima − rebaix (opcional). No hi ha
  // input manual (a diferència de semi-enterrada, on és "altura vista").
  // Round to avoid floating-point artifacts (e.g. 1.4 - 0.10 = 1.2999999999999998).
  const alturaElevada = Math.round(Math.max(0, Number(draft.poolDepthMax || 0) - (draft.hasRebaix ? Number(draft.rebaixAmount || 0) : 0)) * 100) / 100;
  const alt = isElevada ? alturaElevada : Number(draft.alturaVista || 0);

  // L'escala i plataforma d'accés exterior és obligatòria per a piscines elevades.
  // Es força en seleccionar 'elevada' (handleSelectDisposition), però també ho
  // garantim aquí per si el draft ve d'un pressupost desat abans d'aquest camp.
  useEffect(() => {
    if (isElevada && !draft.hasAccessStair) updateDraft({ hasAccessStair: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isElevada, draft.hasAccessStair]);

  const hasAccess = isElevada ? true : !!draft.hasAccessStair;
  const steps = alt > 0 ? Math.max(0, (alt / 0.20) - 1) : 0;
  const stairW = Number(draft.accessStairWidth ?? 0.70);
  const defaultTotal = Math.round(((Number(draft.poolWidth || 0) || 0) + 0.60) * 100) / 100;
  const totalL = Number(draft.accessTotalLength ?? defaultTotal);
  const stairL = Math.round(steps * 0.30 * 100) / 100;
  const platL = Math.max(0, Math.round((totalL - stairL) * 100) / 100);

  return (
    <div className="space-y-4 mt-2 p-4 rounded-xl border border-primary/20 bg-primary/5">
      {isElevada ? (
        <div>
          <label className={labelClass}>Altura vista (m)</label>
          <DecimalInput className={inputClass} value={alt || undefined} onChange={() => {}} disabled />
          <p className="text-xs text-muted-foreground mt-1">
            = Profunditat màxima{draft.hasRebaix ? ' − rebaix' : ''}.
          </p>

          <div className="pt-3 mt-3 border-t border-primary/15">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">Rebaix del vas</p>
              <button type="button"
                onClick={() => updateDraft({ hasRebaix: !draft.hasRebaix })}
                className={cn('w-12 h-6 rounded-full transition-colors relative',
                  draft.hasRebaix ? 'bg-primary' : 'bg-muted')}>
                <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform',
                  draft.hasRebaix ? 'translate-x-6' : 'translate-x-0.5')} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Redueix l'altura de paret vista respecte a la profunditat màxima.</p>
            {draft.hasRebaix && (
              <div className="mt-3">
                <label className={labelClass}>Rebaix (m)</label>
                <DecimalInput className={inputClass}
                  value={draft.rebaixAmount}
                  onChange={(v) => updateDraft({ rebaixAmount: v })} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <label className={labelClass}>Altura vista (m)</label>
          <DecimalInput className={inputClass}
            value={draft.alturaVista}
            onChange={(v) => updateDraft({ alturaVista: v })} />
          <p className="text-xs text-muted-foreground mt-1">Alçada del vas per damunt del terreny (ex: 0,80 / 1,00 / 1,20).</p>
        </div>
      )}

      <div className="pt-3 border-t border-primary/15">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">Escala i plataforma d'accés exterior</p>
          {isElevada ? (
            <div
              title="Obligatori per a piscines elevades"
              className="w-12 h-6 rounded-full relative bg-primary opacity-60 cursor-not-allowed"
            >
              <div className="absolute top-0.5 w-5 h-5 rounded-full bg-card shadow translate-x-6" />
            </div>
          ) : (
            <button type="button"
              onClick={() => updateDraft({ hasAccessStair: !draft.hasAccessStair })}
              className={cn('w-12 h-6 rounded-full transition-colors relative',
                draft.hasAccessStair ? 'bg-primary' : 'bg-muted')}>
              <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform',
                draft.hasAccessStair ? 'translate-x-6' : 'translate-x-0.5')} />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {isElevada ? "Obligatòria per a piscines elevades." : "¿Incloure escala d'accés?"}
        </p>

        {hasAccess && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Ample (m)</label>
                <DecimalInput className={inputClass}
                  value={draft.accessStairWidth ?? 0.70}
                  onChange={(v) => updateDraft({ accessStairWidth: v ?? 0 })} />
              </div>
              <div>
                <label className={labelClass}>Llarg total (m)</label>
                <DecimalInput className={inputClass}
                  value={draft.accessTotalLength ?? defaultTotal}
                  onChange={(v) => updateDraft({ accessTotalLength: v ?? 0 })} />
                <p className="text-[11px] text-muted-foreground mt-1">Suggerit: ample piscina + 0,60 m.</p>
              </div>
              <div>
                <label className={labelClass}>Alçada (m)</label>
                <DecimalInput className={inputClass} value={alt || undefined} onChange={() => {}} disabled />
                <p className="text-[11px] text-muted-foreground mt-1">{isElevada ? "= Altura vista (profunditat màxima − rebaix)." : "= Altura vista."}</p>
              </div>
            </div>

            {alt > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-card border border-border rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">Peldaños</p>
                  <p className="font-semibold text-foreground">{steps.toFixed(0)}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">Llarg escala</p>
                  <p className="font-semibold text-foreground">{stairL.toFixed(2)} m</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">Llarg plataforma</p>
                  <p className="font-semibold text-foreground">{platL.toFixed(2)} m</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">Ample plataforma</p>
                  <p className="font-semibold text-foreground">{stairW.toFixed(2)} m</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
