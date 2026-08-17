import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Filter, Fan, Zap, ChevronDown, Sparkles, AlertTriangle, Check, X, Droplets, Cable, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getRecommendedPipeDiameter } from "@/lib/pipeDiameter";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ArticleWithSpecs {
  id: string;
  name: string;
  technical_specs: Record<string, any> | null;
  linia_preferent?: boolean;
  fase?: string | null;
}

export interface AppliedRecommendations {
  filterId?: string;
  onoffId?: string;
  variableId?: string;
  dosifStdId?: string;
}

interface Props {
  poolVolumeLiters: number;
  poolDimensionsReady: boolean;
  onApply: (rec: AppliedRecommendations) => void;
  /** Si true, el material filtrant és vidre AFM (multiplicador rentat × 40).
   *  Si false, és arena silícia (multiplicador rentat × 60). */
  useAfm?: boolean;
  /** Nombre de banyistes estimat (per defecte 5). */
  bathers?: number;
  /** Línia elèctrica del Quadre elèctric (draft.instalQuadreLinia). Filtra les
   *  bombes On/Off recomanades perquè coincideixin amb la fase seleccionada. */
  quadreLinia?: "monofasica" | "trifasica";
}

const num = (v: any): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v).replace(",", ".")) || 0;
};

function ratingFromVF(vf: number) {
  // Rang ideal de velocitat de filtració: 34-42 m³/h/m²
  if (vf >= 34 && vf <= 42)
    return { label: "ÒPTIM 34-42 ✅", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (vf >= 30 && vf < 34) return { label: "ACCEPTABLE ⚠️", className: "bg-amber-50 text-amber-700 border-amber-200" };
  if (vf > 42 && vf <= 45) return { label: "ACCEPTABLE ⚠️", className: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "FORA RANG ❌", className: "bg-red-50 text-red-700 border-red-200" };
}

function ConditionRow({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? (
        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
      ) : (
        <X className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
      )}
      <span className={ok ? "text-foreground" : "text-red-700"}>{children}</span>
    </div>
  );
}

export function EquipmentRecommendations({
  poolVolumeLiters,
  poolDimensionsReady,
  onApply,
  useAfm = false,
  bathers = 5,
  quadreLinia = "monofasica",
}: Props) {
  const { isAdmin } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  // Previsualització visual del material filtrant: no toca el draft real.
  // null = sense override, s'usa l'ajust real (prop useAfm).
  const [previewAfm, setPreviewAfm] = useState<boolean | null>(null);
  const effectiveUseAfm = previewAfm ?? useAfm;
  const isPreviewing = previewAfm !== null && previewAfm !== useAfm;
  const [filters, setFilters] = useState<ArticleWithSpecs[]>([]);
  const [onoffPumps, setOnoffPumps] = useState<ArticleWithSpecs[]>([]);
  const [variablePumps, setVariablePumps] = useState<ArticleWithSpecs[]>([]);
  const [chlorinators, setChlorinators] = useState<ArticleWithSpecs[]>([]);

  useEffect(() => {
    if (!poolDimensionsReady) return;
    let cancelled = false;
    (async () => {
      const [f, p1, p2] = await Promise.all([
        supabase
          .from("articles")
          .select("id, name, technical_specs")
          .eq("category", "Filtració")
          .eq("subtipus", "Polièster")
          .not("technical_specs", "is", null),
        supabase
          .from("articles")
          .select("id, name, technical_specs, linia_preferent, fase")
          .eq("category", "Bomba")
          .eq("subtipus", "On/Off")
          .not("technical_specs", "is", null),
        supabase
          .from("articles")
          .select("id, name, technical_specs")
          .eq("category", "Bomba")
          .eq("subtipus", "Velocitat variable")
          .not("technical_specs", "is", null),
      ]);
      if (cancelled) return;
      // Excloure ASTRAL ASTER/ICE 500 — el mínim recomanable és el 600
      const filteredFilters = ((f.data || []) as ArticleWithSpecs[]).filter((a) => !/ASTER\/?ICE\s*500/i.test(a.name));
      setFilters(filteredFilters);
      setOnoffPumps((p1.data || []) as ArticleWithSpecs[]);
      // Excloure AQUAGEM TOMAHAWK IP 20 de les recomanacions
      const filteredVar = ((p2.data || []) as ArticleWithSpecs[]).filter((a) => !/IP\s*20/i.test(a.name));
      setVariablePumps(filteredVar);

      // Cloradors salins estàndard: categoria Dosificació, subtipus "Estàndard (pH/Cl)".
      // Només es consideren els marcats com "línia preferent" al catàleg (ex. LT NEO) —
      // mateix patró que les bombes On/Off — per excloure la línia Plus NG.
      const chl = await supabase
        .from("articles")
        .select("id, name, technical_specs, linia_preferent")
        .eq("category", "Dosificació")
        .eq("subtipus", "Estàndard (pH/Cl)");
      if (cancelled) return;
      const chlCandidates = ((chl.data || []) as ArticleWithSpecs[]).filter((a) => a.linia_preferent === true);
      setChlorinators(chlCandidates);
    })();
    return () => {
      cancelled = true;
    };
  }, [poolDimensionsReady]);

  const calc = useMemo(() => {
    const volumen_m3 = poolVolumeLiters / 1000;
    const caudal_necesario = volumen_m3 / 4;

    // Filter selection
    const filtersSorted = [...filters].sort(
      (a, b) => num(a.technical_specs?.diametro_mm) - num(b.technical_specs?.diametro_mm),
    );
    const filterEvals = filtersSorted.map((art) => {
      const area = num(art.technical_specs?.area_m2);
      const vf = area > 0 ? caudal_necesario / area : Infinity;
      return { article: art, area_m2: area, vf, valid: vf <= 42 };
    });
    const validFilters = filterEvals.filter((f) => f.valid);
    // Prefer vf <= 30, otherwise first valid
    const recommendedFilter = validFilters.find((f) => f.vf <= 30) || validFilters[0] || null;

    // Multiplicador segons material filtrant: 40 vidre AFM, 60 arena silícia
    const washMultiplier = effectiveUseAfm ? 40 : 60;
    const lavado_requerit = recommendedFilter ? recommendedFilter.area_m2 * washMultiplier : 0;

    // On/Off pump
    // Criteri primordial: filtració. Es busca una bomba el caudal màxim de la qual
    // estigui per sobre del caudal necessari, i que combinada amb el filtre recomanat
    // doni una velocitat de filtració (VF = caudal_bomba / àrea_filtre) entre 34 i 40.
    // El rentat es mostra com a informació però no és condició eliminatòria.
    // Només es consideren bombes marcades com "línia preferent" al catàleg
    // (ex. DOLFI) i que coincideixin amb la fase elèctrica del Quadre elèctric.
    const expectedFase = quadreLinia === "trifasica" ? "Trifàsic" : "Monofàsic";
    const onoffCandidates = onoffPumps.filter((p) => p.linia_preferent === true && p.fase === expectedFase);
    const onoffSorted = [...onoffCandidates].sort(
      (a, b) => num(a.technical_specs?.caudal_m3h) - num(b.technical_specs?.caudal_m3h),
    );
    const filterArea = recommendedFilter?.area_m2 || 0;
    const onoffEvals = onoffSorted.map((art) => {
      const caudal = num(art.technical_specs?.caudal_m3h);
      const cond_filt = caudal >= caudal_necesario;
      const cond_lav = caudal >= lavado_requerit;
      const vf_pump = filterArea > 0 ? caudal / filterArea : 0;
      const vf_in_range = vf_pump >= 34 && vf_pump <= 42;
      return { article: art, caudal, cond_filt, cond_lav, vf_pump, vf_in_range, valid: cond_filt };
    });
    // Preferida: cobreix filtració I VF dins de 34-42
    const recommendedOnoff =
      onoffEvals.find((p) => p.cond_filt && p.vf_in_range) || onoffEvals.find((p) => p.cond_filt) || null;
    const fallbackOnoff = !recommendedOnoff ? onoffEvals[onoffEvals.length - 1] || null : null;

    // Diàmetre de canonada recomanat, a partir del cabal real de la bomba
    // On/Off finalment mostrada (preferida o fallback), no del caudal_necesario
    // teòric. Norma 3×3 de l'empresa: taula de lookup ja calculada a 2 m/s.
    const onoffFlowForPipe = recommendedOnoff?.caudal ?? fallbackOnoff?.caudal ?? null;
    const pipeDiameterMm = onoffFlowForPipe != null ? getRecommendedPipeDiameter(onoffFlowForPipe) : null;

    // Variable pump
    const varSorted = [...variablePumps].sort(
      (a, b) => num(a.technical_specs?.qmax_m3h) - num(b.technical_specs?.qmax_m3h),
    );
    const varEvals = varSorted.map((art) => {
      const qmax = num(art.technical_specs?.qmax_m3h);
      const valid = qmax >= lavado_requerit;
      const vf_optim =
        recommendedFilter && recommendedFilter.area_m2 > 0 ? (qmax * 0.35) / recommendedFilter.area_m2 : 0;
      return { article: art, qmax, valid, vf_optim };
    });
    const recommendedVar = varEvals.find((p) => p.valid) || null;

    // ===== Clorador salí estàndard =====
    // Fórmula: cloro_dia = volumen_m3 * 2 + bathers * 10
    // gr_per_hora_requerit = cloro_dia / 8 (hores filtració)
    // S'extreuen els grams del nom de l'article (ex. "16G/H").
    const cloro_dia = volumen_m3 * 2.5 + bathers * 10;
    const gr_per_hora = cloro_dia / 6;
    const chlorinatorEvals = chlorinators
      .map((art) => {
        const m = art.name.match(/(\d+(?:[.,]\d+)?)\s*G\s*\/\s*H/i);
        const grh = m ? parseFloat(m[1].replace(",", ".")) : 0;
        return { article: art, grh };
      })
      .filter((c) => c.grh > 0)
      .sort((a, b) => a.grh - b.grh);
    const recommendedChlorinator =
      chlorinatorEvals.find((c) => c.grh >= gr_per_hora) || chlorinatorEvals[chlorinatorEvals.length - 1] || null;

    return {
      volumen_m3,
      caudal_necesario,
      lavado_requerit,
      recommendedFilter,
      recommendedOnoff,
      fallbackOnoff,
      recommendedVar,
      cloro_dia,
      gr_per_hora,
      recommendedChlorinator,
      pipeDiameterMm,
      noFilterCovers: validFilters.length === 0 && filterEvals.length > 0,
    };
  }, [filters, onoffPumps, variablePumps, chlorinators, poolVolumeLiters, effectiveUseAfm, bathers, quadreLinia]);

  if (!poolDimensionsReady) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <span>
          Introdueix les dimensions de la piscina a l'<strong>Estructura</strong> per obtenir les recomanacions
          automàtiques d'equipament.
        </span>
      </div>
    );
  }

  const f = calc.recommendedFilter;
  const onoff = calc.recommendedOnoff;
  const onoffShown = onoff || calc.fallbackOnoff;
  const variable = calc.recommendedVar;
  const chlor = calc.recommendedChlorinator;

  const applyAll = () => {
    onApply({
      filterId: f?.article.id,
      onoffId: onoff?.article.id,
      variableId: variable?.article.id,
      dosifStdId: chlor?.article.id,
    });
    toast.success("Equips recomanats aplicats. Pots modificar-los manualment si cal.");
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-card border-l-4 border-l-primary overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-base">Recomanació d'equips per a aquesta piscina</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Basat en {calc.volumen_m3.toFixed(1)} m³ · Caudal necessari: {calc.caudal_necesario.toFixed(1)} m³/h ·{" "}
              <span className={cn("font-medium", effectiveUseAfm ? "text-emerald-700" : "text-foreground")}>
                {effectiveUseAfm ? "Vidre AFM (×40)" : "Arena silícia (×60)"}
              </span>
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn("w-5 h-5 text-muted-foreground transition-transform duration-200", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-5 md:px-5 space-y-4 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">Previsualitzar material filtrant:</span>
            <div className="inline-flex rounded-full border border-border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setPreviewAfm(false)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
                  !effectiveUseAfm ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Arena sílice
              </button>
              <button
                type="button"
                onClick={() => setPreviewAfm(true)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
                  effectiveUseAfm ? "bg-emerald-100 text-emerald-800 shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Vidre AFM
              </button>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[260px] text-xs">
                El vidre AFM redueix el cabal de rentat necessari (×40 en lloc de ×60), permetent que bombes més
                petites cobreixin el rentat del filtre.
              </TooltipContent>
            </Tooltip>
            {previewAfm !== null && (
              <button
                type="button"
                onClick={() => setPreviewAfm(null)}
                className="text-[11px] text-muted-foreground underline hover:text-foreground"
              >
                Restablir a l'ajust real
              </button>
            )}
          </div>

          {isPreviewing && (
            <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Previsualització — l'ajust real del pressupost és {useAfm ? "Vidre AFM" : "Arena sílice"}. Aquest
                canvi és només visual i no modifica el pressupost.
              </span>
            </div>
          )}

          {calc.noFilterCovers && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Cap filtre del catàleg cobreix el caudal necessari ({calc.caudal_necesario.toFixed(1)} m³/h). Considera
                dos filtres en paral·lel o revisa el catàleg.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3">
            {/* Filter card */}
            <div className="rounded-lg border border-border bg-background/60 p-3 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-blue-700">
                <Filter className="w-4 h-4" /> Filtre recomanat
              </div>
              {f ? (
                <>
                  <p className="text-sm font-semibold text-foreground leading-tight">{f.article.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Ø{num(f.article.technical_specs?.diametro_mm)}mm · Àrea: {f.area_m2} m²
                  </p>
                  {(() => {
                    // VF calculada amb el caudal màxim de la bomba On/Off recomanada
                    // (mateixa fórmula que mostra la targeta de la bomba). Si no hi ha
                    // bomba recomanada, fallback al caudal necessari.
                    const pumpFlow = onoffShown?.caudal ?? calc.caudal_necesario;
                    const vfShown = f.area_m2 > 0 ? pumpFlow / f.area_m2 : 0;
                    const rating = ratingFromVF(vfShown);
                    return (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-xs">
                          VF: <strong>{vfShown.toFixed(1)} m³/h/m²</strong>
                        </span>
                        <span
                          className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold", rating.className)}
                        >
                          {rating.label}
                        </span>
                      </div>
                    );
                  })()}
                  <p className="text-[11px] text-muted-foreground">
                    Caudal mínim per rentar: {calc.lavado_requerit.toFixed(1)} m³/h
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onApply({ filterId: f.article.id });
                      toast.success("Filtre aplicat");
                    }}
                    className="w-full text-xs font-medium text-primary hover:bg-primary/10 border border-primary/30 rounded-md py-1.5 transition-colors"
                  >
                    Aplicar recomanació →
                  </button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Sense filtres al catàleg.</p>
              )}
            </div>

            {/* On/Off pump card */}
            <div className="rounded-lg border border-border bg-background/60 p-3 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                <Fan className="w-4 h-4" /> Bomba On/Off recomanada
              </div>
              {onoffShown ? (
                <>
                  <p className="text-sm font-semibold text-foreground leading-tight">{onoffShown.article.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {onoffShown.caudal} m³/h · {num(onoffShown.article.technical_specs?.cv)} CV
                  </p>
                  <div className="space-y-1 pt-1">
                    <ConditionRow ok={onoffShown.cond_filt}>
                      Filtració: {onoffShown.caudal} ≥ {calc.caudal_necesario.toFixed(1)} m³/h
                    </ConditionRow>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span>
                        VF amb caudal màx: <strong>{onoffShown.vf_pump.toFixed(1)} m³/h/m²</strong>
                      </span>
                      <span
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full border font-semibold",
                          onoffShown.vf_in_range
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200",
                        )}
                      >
                        {onoffShown.vf_in_range ? "ÒPTIM 34-42 ✅" : "FORA RANG ⚠️"}
                      </span>
                    </div>
                    <ConditionRow ok={onoffShown.cond_lav}>
                      Rentat (info): {onoffShown.caudal} ≥ {calc.lavado_requerit.toFixed(1)} m³/h
                    </ConditionRow>
                    {!onoffShown.cond_lav && (
                      <p className="text-[11px] text-muted-foreground bg-muted/40 border border-border rounded p-1.5 leading-snug">
                        ℹ️ Aquest model no arriba al caudal òptim de rentat del filtre. És habitual amb bombes On/Off:
                        caldrà allargar el temps de contrarentat per netejar bé el filtre.
                      </p>
                    )}
                  </div>
                  {calc.pipeDiameterMm != null && (
                    <div className="flex items-start gap-2 rounded-lg bg-slate-800 p-2">
                      <Cable className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="text-xs text-slate-100">
                          Diàmetre de canonada recomanat:{" "}
                          <span className="font-bold text-white">Ø{calc.pipeDiameterMm}mm</span>
                        </p>
                      </div>
                    </div>
                  )}
                  {!onoff && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5">
                      ⚠️ Bomba insuficient per a la filtració.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onApply({ onoffId: onoffShown.article.id });
                      toast.success("Bomba On/Off aplicada");
                    }}
                    className="w-full text-xs font-medium text-primary hover:bg-primary/10 border border-primary/30 rounded-md py-1.5 transition-colors"
                  >
                    Aplicar recomanació →
                  </button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Sense bombes On/Off al catàleg.</p>
              )}
            </div>

            {/* Variable pump card */}
            <div className="rounded-lg border border-border bg-background/60 p-3 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-violet-700">
                <Zap className="w-4 h-4" /> Bomba velocitat variable
              </div>
              {variable ? (
                <>
                  <p className="text-sm font-semibold text-foreground leading-tight">{variable.article.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Qmax: {variable.qmax} m³/h · Hmax: {num(variable.article.technical_specs?.hmax_m)}m ·{" "}
                    {num(variable.article.technical_specs?.p1_kw)} kW
                  </p>
                  <ConditionRow ok={true}>
                    Cobreix rentat: {variable.qmax} ≥ {calc.lavado_requerit.toFixed(1)} m³/h
                  </ConditionRow>
                  <p className="text-[11px] text-muted-foreground bg-muted/40 rounded p-1.5">
                    En filtració treballarà al ~35% → <strong>{(variable.qmax * 0.35).toFixed(1)} m³/h</strong> · VF:{" "}
                    {variable.vf_optim.toFixed(1)} m³/h/m²
                    {variable.vf_optim >= 20 && variable.vf_optim <= 30 && " [òptim ✅]"}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onApply({ variableId: variable.article.id });
                      toast.success("Bomba variable aplicada");
                    }}
                    className="w-full text-xs font-medium text-primary hover:bg-primary/10 border border-primary/30 rounded-md py-1.5 transition-colors"
                  >
                    Aplicar recomanació →
                  </button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Sense bombes variables vàlides al catàleg.</p>
              )}
            </div>

            {/* Chlorinator card */}
            <div className="rounded-lg border border-border bg-background/60 p-3 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-cyan-700">
                <Droplets className="w-4 h-4" /> Clorador salí estàndard
              </div>
              {chlor ? (
                <>
                  <p className="text-sm font-semibold text-foreground leading-tight">{chlor.article.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Producció: <strong>{chlor.grh} g/h</strong>
                  </p>
                  <ConditionRow ok={chlor.grh >= calc.gr_per_hora}>
                    Cobreix demanda: {chlor.grh} ≥ {calc.gr_per_hora.toFixed(1)} g/h
                  </ConditionRow>
                  <p className="text-[11px] text-muted-foreground bg-muted/40 rounded p-1.5 leading-snug">
                    Càlcul: ({calc.volumen_m3.toFixed(1)} m³ × 2.5 g) + (5 banyistes × 10 g) ={" "}
                    <strong>{calc.cloro_dia.toFixed(0)} g/dia</strong> ÷ 6 h ={" "}
                    <strong>{calc.gr_per_hora.toFixed(1)} g/h</strong>
                  </p>
                  {chlor.grh < calc.gr_per_hora && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5">
                      ⚠️ El model més gran del catàleg no cobreix la demanda calculada.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onApply({ dosifStdId: chlor.article.id });
                      toast.success("Clorador salí aplicat");
                    }}
                    className="w-full text-xs font-medium text-primary hover:bg-primary/10 border border-primary/30 rounded-md py-1.5 transition-colors"
                  >
                    Aplicar recomanació →
                  </button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Sense cloradors estàndard al catàleg.</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={applyAll}
            className="w-full gradient-primary text-primary-foreground py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-md"
          >
            <Sparkles className="w-4 h-4" /> Aplicar totes les recomanacions
          </button>

          {isAdmin && (
            <div className="border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setShowDetail((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showDetail && "rotate-180")} />
                Detall del càlcul (admin)
              </button>
              {showDetail && (
                <div className="mt-2 p-3 bg-muted/40 rounded-lg text-[11px] font-mono text-muted-foreground space-y-2">
                  <div>
                    <strong>Volum piscina:</strong> {calc.volumen_m3.toFixed(2)} m³
                    <br />
                    <strong>Caudal necessari (V/4):</strong> {calc.caudal_necesario.toFixed(2)} m³/h
                    <br />
                    <strong>Material filtrant:</strong> {effectiveUseAfm ? "Vidre AFM (×40)" : "Arena silícia (×60)"}
                    {isPreviewing && " (previsualització)"}
                  </div>
                  {f && (
                    <div>
                      <strong>Filtre:</strong> {f.article.name}
                      <br />
                      Àrea: {f.area_m2} m² · VF: {f.vf.toFixed(2)} · Rentat mín: {calc.lavado_requerit.toFixed(2)} m³/h
                    </div>
                  )}
                  {onoffShown && (
                    <div>
                      <strong>Bomba On/Off:</strong> {onoffShown.article.name}
                      <br />
                      Caudal: {onoffShown.caudal} m³/h · VF amb caudal màx: {onoffShown.vf_pump.toFixed(2)} (òptim
                      34-42: {onoffShown.vf_in_range ? "sí" : "no"}) · Filtra: {onoffShown.cond_filt ? "sí" : "no"} ·
                      Renta: {onoffShown.cond_lav ? "sí" : "no"}
                      {calc.pipeDiameterMm != null && (
                        <>
                          <br />
                          Diàmetre canonada recomanat: Ø{calc.pipeDiameterMm}mm (lookup taula 2 m/s, cabal{" "}
                          {onoffShown.caudal} m³/h, mínim 63mm)
                        </>
                      )}
                    </div>
                  )}
                  {variable && (
                    <div>
                      <strong>Bomba Inverter:</strong> {variable.article.name}
                      <br />
                      Qmax: {variable.qmax} · Punt 35%: {(variable.qmax * 0.35).toFixed(2)} · VF òptima:{" "}
                      {variable.vf_optim.toFixed(2)}
                    </div>
                  )}
                  {chlor && (
                    <div>
                      <strong>Clorador salí:</strong> {chlor.article.name}
                      <br />
                      Cloro/dia: {calc.cloro_dia.toFixed(2)} g · Demanda: {calc.gr_per_hora.toFixed(2)} g/h · Producció:{" "}
                      {chlor.grh} g/h · Cobreix: {chlor.grh >= calc.gr_per_hora ? "sí" : "no"}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
