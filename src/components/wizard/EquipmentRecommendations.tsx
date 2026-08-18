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
  /** Quantitat a aplicar per a la bomba de velocitat variable (combo de 2 o
   *  3 unitats quan cap model individual cobreix el rentat). Absent = 1. */
  variableQty?: number;
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
  /** draft.poolType. Quan és 'comunitaria' es mostra, a més de la recomanació
   *  "Ideal", una segona opció "Acceptable" (una talla per sota) per al filtre
   *  i la bomba On/Off. */
  poolType?: "particular" | "comunitaria";
  /** Notifica el diàmetre (mm) del filtre Ideal recomanat (idealPair.filter)
   *  cada cop que canviï, o null si encara no hi ha recomanació vàlida.
   *  Permet a components pare (ex. l'auto-default del "Filtre especial" a
   *  StepInstalacions) condicionar-se a la talla del filtre sense esperar
   *  que l'usuari premi "Aplicar". */
  onIdealFilterDiametro?: (diametro_mm: number | null) => void;
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

interface PairResult {
  onoff: { article: ArticleWithSpecs; caudal: number };
  filter: { article: ArticleWithSpecs; area_m2: number; vf: number };
  lavado_requerit: number;
  cond_filt: boolean;
  cond_lav: boolean;
  vf_pump: number;
  vf_in_range: boolean;
}

const distanceToOptim = (vf: number) => (vf < 34 ? 34 - vf : vf > 42 ? vf - 42 : 0);

// Norma 3×3 en 2 passos: primer la bomba On/Off (segons caudal_necesario =
// volum/turnover), després el filtre segons el caudal REAL d'aquesta bomba
// (no un caudal teòric aïllat). El filtre triat és el que minimitza la
// distància al rang òptim 34-42 m³/h/m² (0 si ja hi cau dins).
// allowFallback controla què passa quan cap bomba arriba al caudal_necesario:
// true (Ideal) → s'usa la bomba més gran disponible igualment (cond_filt=false,
// es mostra avís). false (Acceptable) → es retorna null i la targeta s'amaga.
// optimizeVfRange (només Ideal): en lloc de quedar-se amb la primera bomba
// que cobreix caudalNecesario, prova bombes cada cop més grans (començant
// per aquesta) fins trobar la primera combinació bomba+filtre amb VF dins
// 34-42 exacte — evitar un "Ideal" que tècnicament funciona però queda per
// sota de l'òptim (ex. 50M + filtre 600 → VF=31,8). Si cap combinació hi
// entra, es queda amb la de mínima distància al rang (mateix criteri que el
// filtre). Acceptable no usa aquest mode: accepta la banda més àmplia
// 30-45 vista a ratingFromVF, ja que el seu propòsit és ser una alternativa
// més laxa, no la més ajustada a l'òptim.
function selectPair(
  caudalNecesario: number,
  onoffBase: { article: ArticleWithSpecs; caudal: number }[],
  filtersSorted: ArticleWithSpecs[],
  washMultiplier: number,
  allowFallback: boolean,
  optimizeVfRange: boolean,
): PairResult | null {
  if (onoffBase.length === 0 || filtersSorted.length === 0) return null;

  const bestFilterFor = (caudal: number) => {
    const filterEvals = filtersSorted.map((art) => {
      const area = num(art.technical_specs?.area_m2);
      const vf = area > 0 ? caudal / area : Infinity;
      return { article: art, area_m2: area, vf };
    });
    return filterEvals.reduce((best, cur) => (distanceToOptim(cur.vf) < distanceToOptim(best.vf) ? cur : best));
  };

  const candidatePumps = onoffBase.filter((p) => p.caudal >= caudalNecesario);
  const searchPool =
    candidatePumps.length > 0 ? candidatePumps : allowFallback ? [onoffBase[onoffBase.length - 1]] : [];
  if (searchPool.length === 0) return null;

  let onoffChosen = searchPool[0];
  let filterChosen = bestFilterFor(onoffChosen.caudal);

  if (optimizeVfRange && candidatePumps.length > 0) {
    let bestSoFar = { onoff: onoffChosen, filter: filterChosen };
    for (const pump of candidatePumps) {
      const filt = bestFilterFor(pump.caudal);
      if (filt.vf >= 34 && filt.vf <= 42) {
        bestSoFar = { onoff: pump, filter: filt };
        break;
      }
      if (distanceToOptim(filt.vf) < distanceToOptim(bestSoFar.filter.vf)) {
        bestSoFar = { onoff: pump, filter: filt };
      }
    }
    onoffChosen = bestSoFar.onoff;
    filterChosen = bestSoFar.filter;
  }

  const cond_filt = onoffChosen.caudal >= caudalNecesario;
  const lavado_requerit = filterChosen.area_m2 * washMultiplier;
  const cond_lav = onoffChosen.caudal >= lavado_requerit;
  const vf_in_range = filterChosen.vf >= 34 && filterChosen.vf <= 42;

  return {
    onoff: onoffChosen,
    filter: filterChosen,
    lavado_requerit,
    cond_filt,
    cond_lav,
    vf_pump: filterChosen.vf,
    vf_in_range,
  };
}

interface VariablePumpSingle {
  article: ArticleWithSpecs;
  qmax: number;
  valid: boolean;
  vf_optim: number;
}
interface VariablePumpCombo {
  article: ArticleWithSpecs;
  qmax: number;
  qty: 2 | 3;
  totalQmax: number;
  vf_optim: number;
  valid: boolean;
}
interface VariablePumpResult {
  single: VariablePumpSingle | null;
  combo: VariablePumpCombo | null;
}

// Bomba de velocitat variable per a un lavado_requerit/àrea de filtre
// concrets — funció pura reutilitzable perquè Ideal i Acceptable calculen
// cadascun el seu propi resultat (basat en el seu propi filtre), no un únic
// càlcul fixat al filtre Ideal.
function selectVariablePump(
  lavado_requerit: number,
  filterAreaM2: number,
  varSorted: ArticleWithSpecs[],
): VariablePumpResult {
  const varEvals = varSorted.map((art) => {
    const qmax = num(art.technical_specs?.qmax_m3h);
    const valid = qmax >= lavado_requerit;
    const vf_optim = filterAreaM2 > 0 ? (qmax * 0.35) / filterAreaM2 : 0;
    return { article: art, qmax, valid, vf_optim };
  });
  const single = varEvals.find((p) => p.valid) || null;

  // Combo: cap bomba individual cobreix lavado_requerit. Prova 2 unitats
  // del mateix model, començant pel més petit disponible (varSorted ja
  // exclou IP20) i pujant de talla per minimitzar cost; si ni 2× el més
  // gran arriba, prova 3× el més gran abans de rendir-se.
  let combo: VariablePumpCombo | null = null;
  if (!single && varEvals.length > 0) {
    const comboAt2 = varEvals.find((p) => p.qmax * 2 >= lavado_requerit);
    const chosen = comboAt2 ? { ...comboAt2, qty: 2 as const } : { ...varEvals[varEvals.length - 1], qty: 3 as const };
    const totalQmax = chosen.qmax * chosen.qty;
    const vf_optim = filterAreaM2 > 0 ? (totalQmax * 0.35) / filterAreaM2 : 0;
    combo = {
      article: chosen.article,
      qmax: chosen.qmax,
      qty: chosen.qty,
      totalQmax,
      vf_optim,
      valid: totalQmax >= lavado_requerit,
    };
  }

  return { single, combo };
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
  poolType = "particular",
  onIdealFilterDiametro,
}: Props) {
  const { isAdmin } = useAuth();
  const isComunitaria = poolType === "comunitaria";
  const [expanded, setExpanded] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  // Previsualització visual del material filtrant: no toca el draft real.
  // null = sense override, s'usa l'ajust real (prop useAfm).
  const [previewAfm, setPreviewAfm] = useState<boolean | null>(null);
  const effectiveUseAfm = previewAfm ?? useAfm;
  const isPreviewing = previewAfm !== null && previewAfm !== useAfm;
  // Flip 3D de les targetes Filtre / On/Off: un únic control global gira
  // totes dues simultàniament per mostrar l'alternativa Acceptable al
  // revers, en el mateix espai que ocupa la targeta Ideal.
  const [showAcceptable, setShowAcceptable] = useState(false);
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
    // Turnover 4h per al parell Ideal, 4,5h per al parell Acceptable.
    const caudal_necesario = volumen_m3 / 4;
    const caudal_necesario_acceptable = volumen_m3 / 4.5;

    // Multiplicador segons material filtrant: 40 vidre AFM, 60 arena silícia
    const washMultiplier = effectiveUseAfm ? 40 : 60;

    const filtersSorted = [...filters].sort(
      (a, b) => num(a.technical_specs?.diametro_mm) - num(b.technical_specs?.diametro_mm),
    );

    // Bombes On/Off candidates: només línia preferent (ex. DOLFI) i que
    // coincideixin amb la fase elèctrica del Quadre elèctric. Base independent
    // del filtre amb què acabin emparellades.
    const expectedFase = quadreLinia === "trifasica" ? "Trifàsic" : "Monofàsic";
    const onoffCandidates = onoffPumps.filter((p) => p.linia_preferent === true && p.fase === expectedFase);
    const onoffSorted = [...onoffCandidates].sort(
      (a, b) => num(a.technical_specs?.caudal_m3h) - num(b.technical_specs?.caudal_m3h),
    );
    const onoffBase = onoffSorted.map((art) => ({ article: art, caudal: num(art.technical_specs?.caudal_m3h) }));

    // Norma 3×3 en 2 passos: bomba primer (segons caudal_necesario), filtre
    // després (segons el caudal real de la bomba ja triada). Ideal i Acceptable
    // són parells totalment independents, no un derivat de l'altre.
    const idealPair = selectPair(caudal_necesario, onoffBase, filtersSorted, washMultiplier, true, true);
    const acceptablePairRaw = isComunitaria
      ? selectPair(caudal_necesario_acceptable, onoffBase, filtersSorted, washMultiplier, false, false)
      : null;
    // Si el parell Acceptable acaba coincidint exactament (mateixa bomba i
    // mateix filtre) amb el parell Ideal, no és una alternativa real — s'amaga.
    const acceptablePair =
      acceptablePairRaw &&
      idealPair &&
      acceptablePairRaw.onoff.article.id === idealPair.onoff.article.id &&
      acceptablePairRaw.filter.article.id === idealPair.filter.article.id
        ? null
        : acceptablePairRaw;

    const lavado_requerit = idealPair?.lavado_requerit ?? 0;
    const lavado_requerit_acceptable = acceptablePair?.lavado_requerit ?? 0;

    // Diàmetre de canonada recomanat, a partir del cabal real de la bomba
    // On/Off Ideal. Norma 3×3 de l'empresa: taula de lookup ja calculada a 2 m/s.
    const pipeDiameterMm = idealPair ? getRecommendedPipeDiameter(idealPair.onoff.caudal) : null;

    // Variable pump: calculada per a un filtre/lavado_requerit concrets
    // (funció reutilitzable perquè Ideal i Acceptable necessiten cadascun el
    // seu propi resultat, basat en el seu propi filtre — no un càlcul únic
    // fixat al filtre Ideal).
    const varSorted = [...variablePumps].sort(
      (a, b) => num(a.technical_specs?.qmax_m3h) - num(b.technical_specs?.qmax_m3h),
    );
    const idealVariablePump = selectVariablePump(lavado_requerit, idealPair?.filter.area_m2 ?? 0, varSorted);
    const acceptableVariablePump = acceptablePair
      ? selectVariablePump(lavado_requerit_acceptable, acceptablePair.filter.area_m2, varSorted)
      : null;

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
      caudal_necesario_acceptable,
      lavado_requerit,
      lavado_requerit_acceptable,
      idealPair,
      acceptablePair,
      idealVariablePump,
      acceptableVariablePump,
      cloro_dia,
      gr_per_hora,
      recommendedChlorinator,
      pipeDiameterMm,
      // Cap filtre disponible s'acosta al rang òptim amb el caudal de la bomba
      // Ideal triada (el millor filtre disponible encara excedeix vf=42).
      noFilterCovers: idealPair !== null && idealPair.vf_pump > 42,
    };
  }, [filters, onoffPumps, variablePumps, chlorinators, poolVolumeLiters, effectiveUseAfm, bathers, quadreLinia, isComunitaria]);

  // Si l'alternativa Acceptable desapareix (canvi de previsualització, de
  // dimensions, etc.) mentre una targeta estava girada, torna-la a Ideal per
  // no deixar el revers en blanc.
  useEffect(() => {
    if (!calc.acceptablePair) {
      setShowAcceptable(false);
    }
  }, [calc.acceptablePair]);

  // Notifica el diàmetre del filtre Ideal al component pare (vàlid només
  // quan les dimensions de la piscina ja estan definides — calc es computa
  // sempre, fins i tot abans que poolDimensionsReady sigui true, però amb
  // un volum de 0 el resultat no és significatiu).
  const idealFilterDiametroMm =
    poolDimensionsReady && calc.idealPair
      ? num(calc.idealPair.filter.article.technical_specs?.diametro_mm)
      : null;
  useEffect(() => {
    onIdealFilterDiametro?.(idealFilterDiametroMm);
  }, [idealFilterDiametroMm, onIdealFilterDiametro]);

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

  const idealPair = calc.idealPair;
  const acceptablePair = calc.acceptablePair;
  const f = idealPair?.filter ?? null;
  const onoffShown = idealPair?.onoff ?? null;
  const variable = calc.idealVariablePump.single;
  const variableCombo = calc.idealVariablePump.combo;
  const chlor = calc.recommendedChlorinator;

  const applyAll = () => {
    onApply({
      filterId: f?.article.id,
      onoffId: onoffShown?.article.id,
      variableId: variable?.article.id ?? variableCombo?.article.id,
      variableQty: variable ? 1 : variableCombo?.qty,
      dosifStdId: chlor?.article.id,
    });
    toast.success("Equips recomanats aplicats. Pots modificar-los manualment si cal.");
  };

  // Renderitza el cos de la targeta de bomba variable (individual, combo, o
  // "sense catàleg") per a un resultat i lavado_requerit concrets — reutilitzat
  // per al revers (Acceptable) de la mateixa targeta.
  const renderVariablePumpBody = (result: VariablePumpResult, lavadoRequerit: number) => {
    if (result.single) {
      const v = result.single;
      return (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground leading-tight">{v.article.name}</p>
          <p className="text-xs text-muted-foreground">
            Qmax: {v.qmax} m³/h · Hmax: {num(v.article.technical_specs?.hmax_m)}m ·{" "}
            {num(v.article.technical_specs?.p1_kw)} kW
          </p>
          <ConditionRow ok={true}>
            Cobreix rentat: {v.qmax} ≥ {lavadoRequerit.toFixed(1)} m³/h
          </ConditionRow>
          <p className="text-[11px] text-muted-foreground bg-muted/40 rounded p-1.5">
            En filtració treballarà al ~35% → <strong>{(v.qmax * 0.35).toFixed(1)} m³/h</strong> · VF:{" "}
            {v.vf_optim.toFixed(1)} m³/h/m²
            {v.vf_optim >= 20 && v.vf_optim <= 30 && " [òptim ✅]"}
          </p>
          <button
            type="button"
            onClick={() => {
              onApply({ variableId: v.article.id, variableQty: 1 });
              toast.success("Bomba variable aplicada");
            }}
            className="w-full text-xs font-medium text-primary hover:bg-primary/10 border border-primary/30 rounded-md py-1.5 transition-colors"
          >
            Aplicar recomanació →
          </button>
        </div>
      );
    }
    if (result.combo) {
      const c = result.combo;
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Combo</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold bg-violet-50 text-violet-700 border-violet-200">
              {c.qty} UNITATS
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground leading-tight">
            {c.qty}× {c.article.name}
          </p>
          <p className="text-xs text-muted-foreground">
            Qmax unitari: {c.qmax} m³/h · Hmax: {num(c.article.technical_specs?.hmax_m)}m ·{" "}
            {num(c.article.technical_specs?.p1_kw)} kW
          </p>
          <ConditionRow ok={c.valid}>
            Cobreix rentat combinat: {c.totalQmax} ≥ {lavadoRequerit.toFixed(1)} m³/h
          </ConditionRow>
          <p className="text-[11px] text-muted-foreground bg-muted/40 rounded p-1.5 leading-snug">
            Cap bomba individual del catàleg cobreix el caudal de rentat necessari. Es proposen {c.qty} unitats del
            mateix model treballant en paral·lel per sumar el seu Qmax.
          </p>
          <p className="text-[11px] text-muted-foreground bg-muted/40 rounded p-1.5">
            En filtració treballarà al ~35% → <strong>{(c.totalQmax * 0.35).toFixed(1)} m³/h</strong> · VF:{" "}
            {c.vf_optim.toFixed(1)} m³/h/m²
            {c.vf_optim >= 20 && c.vf_optim <= 30 && " [òptim ✅]"}
          </p>
          {!c.valid && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5">
              ⚠️ Ni {c.qty} unitats del model més gran del catàleg cobreixen el rentat necessari.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              onApply({ variableId: c.article.id, variableQty: c.qty });
              toast.success(`Combo de ${c.qty} bombes variables aplicat`);
            }}
            className="w-full text-xs font-medium text-primary hover:bg-primary/10 border border-primary/30 rounded-md py-1.5 transition-colors"
          >
            Aplicar recomanació ({c.qty} unitats) →
          </button>
        </div>
      );
    }
    return <p className="text-xs text-muted-foreground">Sense bombes variables vàlides al catàleg.</p>;
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

          {isComunitaria && calc.acceptablePair && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">
                Filtre i bomba On/Off:
              </span>
              <button
                type="button"
                onClick={() => setShowAcceptable((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                  showAcceptable
                    ? "bg-slate-100 text-slate-700 border-slate-300"
                    : "bg-background text-muted-foreground border-border hover:text-foreground",
                )}
              >
                ↻ {showAcceptable ? "Veure Ideal" : "Veure alternativa Acceptable"}
              </button>
            </div>
          )}

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
              {f && idealPair ? (
                <div className="[perspective:1200px]">
                  <div
                    className={cn(
                      "relative transition-transform duration-500 [transform-style:preserve-3d]",
                      showAcceptable && "[transform:rotateY(180deg)]",
                    )}
                  >
                    {/* Front: Ideal */}
                    <div className="[backface-visibility:hidden] space-y-2">
                      <p className="text-sm font-semibold text-foreground leading-tight">{f.article.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Ø{num(f.article.technical_specs?.diametro_mm)}mm · Àrea: {f.area_m2} m²
                      </p>
                      {(() => {
                        const rating = ratingFromVF(idealPair.vf_pump);
                        return (
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <span className="text-xs">
                              VF: <strong>{idealPair.vf_pump.toFixed(1)} m³/h/m²</strong>
                            </span>
                            <span
                              className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full border font-semibold",
                                rating.className,
                              )}
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
                    </div>
                    {/* Back: Acceptable */}
                    {acceptablePair && (
                      <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Alternativa acceptable
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold bg-slate-100 text-slate-600 border-slate-300">
                            ACCEPTABLE
                          </span>
                        </div>
                        <p className="text-xs font-medium text-foreground leading-tight">
                          {acceptablePair.filter.article.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Ø{num(acceptablePair.filter.article.technical_specs?.diametro_mm)}mm · Àrea:{" "}
                          {acceptablePair.filter.area_m2} m²
                        </p>
                        {(() => {
                          const rating = ratingFromVF(acceptablePair.vf_pump);
                          return (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px]">
                                VF: <strong>{acceptablePair.vf_pump.toFixed(1)} m³/h/m²</strong>
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] px-2 py-0.5 rounded-full border font-semibold",
                                  rating.className,
                                )}
                              >
                                {rating.label}
                              </span>
                            </div>
                          );
                        })()}
                        <p className="text-[11px] text-muted-foreground">
                          Caudal mínim per rentar: {calc.lavado_requerit_acceptable.toFixed(1)} m³/h
                        </p>
                        <p className="text-[11px] text-muted-foreground italic">
                          Basat en un cicle de renovació de 4,5h (en lloc de 4h)
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            onApply({ filterId: acceptablePair.filter.article.id });
                            toast.success("Filtre aplicat");
                          }}
                          className="w-full text-[11px] font-medium text-muted-foreground hover:bg-muted/60 border border-border rounded-md py-1 transition-colors"
                        >
                          Aplicar alternativa →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sense filtres al catàleg.</p>
              )}
            </div>

            {/* On/Off pump card */}
            <div className="rounded-lg border border-border bg-background/60 p-3 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                <Fan className="w-4 h-4" /> Bomba On/Off recomanada
              </div>
              {onoffShown && idealPair ? (
                <div className="[perspective:1200px]">
                  <div
                    className={cn(
                      "relative transition-transform duration-500 [transform-style:preserve-3d]",
                      showAcceptable && "[transform:rotateY(180deg)]",
                    )}
                  >
                    {/* Front: Ideal */}
                    <div className="[backface-visibility:hidden] space-y-2">
                      <p className="text-sm font-semibold text-foreground leading-tight">{onoffShown.article.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {onoffShown.caudal} m³/h · {num(onoffShown.article.technical_specs?.cv)} CV
                      </p>
                      <div className="space-y-1 pt-1">
                        <ConditionRow ok={idealPair.cond_filt}>
                          Filtració: {onoffShown.caudal} ≥ {calc.caudal_necesario.toFixed(1)} m³/h
                        </ConditionRow>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span>
                            VF amb caudal màx: <strong>{idealPair.vf_pump.toFixed(1)} m³/h/m²</strong>
                          </span>
                          <span
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full border font-semibold",
                              idealPair.vf_in_range
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200",
                            )}
                          >
                            {idealPair.vf_in_range ? "ÒPTIM 34-42 ✅" : "FORA RANG ⚠️"}
                          </span>
                        </div>
                        <ConditionRow ok={idealPair.cond_lav}>
                          Rentat (info): {onoffShown.caudal} ≥ {calc.lavado_requerit.toFixed(1)} m³/h
                        </ConditionRow>
                        {!idealPair.cond_lav && (
                          <p className="text-[11px] text-muted-foreground bg-muted/40 border border-border rounded p-1.5 leading-snug">
                            ℹ️ Aquest model no arriba al caudal òptim de rentat del filtre. És habitual amb bombes
                            On/Off: caldrà allargar el temps de contrarentat per netejar bé el filtre.
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
                      {!idealPair.cond_filt && (
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
                    </div>
                    {/* Back: Acceptable */}
                    {acceptablePair && (
                      <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Alternativa acceptable
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold bg-slate-100 text-slate-600 border-slate-300">
                            ACCEPTABLE
                          </span>
                        </div>
                        <p className="text-xs font-medium text-foreground leading-tight">
                          {acceptablePair.onoff.article.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {acceptablePair.onoff.caudal} m³/h ·{" "}
                          {num(acceptablePair.onoff.article.technical_specs?.cv)} CV
                        </p>
                        <ConditionRow ok={acceptablePair.cond_filt}>
                          Filtració: {acceptablePair.onoff.caudal} ≥ {calc.caudal_necesario_acceptable.toFixed(1)} m³/h
                        </ConditionRow>
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span>
                            VF amb caudal màx: <strong>{acceptablePair.vf_pump.toFixed(1)} m³/h/m²</strong>
                          </span>
                          {(() => {
                            const rating = ratingFromVF(acceptablePair.vf_pump);
                            return (
                              <span
                                className={cn(
                                  "text-[10px] px-2 py-0.5 rounded-full border font-semibold",
                                  rating.className,
                                )}
                              >
                                {rating.label}
                              </span>
                            );
                          })()}
                        </div>
                        <ConditionRow ok={acceptablePair.cond_lav}>
                          Rentat (info): {acceptablePair.onoff.caudal} ≥{" "}
                          {calc.lavado_requerit_acceptable.toFixed(1)} m³/h
                        </ConditionRow>
                        {!acceptablePair.cond_lav && (
                          <p className="text-[11px] text-muted-foreground bg-muted/40 border border-border rounded p-1.5 leading-snug">
                            ℹ️ Aquest model no arriba al caudal òptim de rentat del filtre. És habitual amb bombes
                            On/Off: caldrà allargar el temps de contrarentat per netejar bé el filtre.
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground italic">
                          Basat en un cicle de renovació de 4,5h (en lloc de 4h)
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            onApply({ onoffId: acceptablePair.onoff.article.id });
                            toast.success("Bomba On/Off aplicada");
                          }}
                          className="w-full text-[11px] font-medium text-muted-foreground hover:bg-muted/60 border border-border rounded-md py-1 transition-colors"
                        >
                          Aplicar alternativa →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sense bombes On/Off al catàleg.</p>
              )}
            </div>

            {/* Variable pump card */}
            <div className="rounded-lg border border-border bg-background/60 p-3 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-violet-700">
                <Zap className="w-4 h-4" /> Bomba velocitat variable
              </div>
              {isComunitaria && acceptablePair && calc.acceptableVariablePump ? (
                <div className="[perspective:1200px]">
                  <div
                    className={cn(
                      "relative transition-transform duration-500 [transform-style:preserve-3d]",
                      showAcceptable && "[transform:rotateY(180deg)]",
                    )}
                  >
                    {/* Front: Ideal */}
                    <div className="[backface-visibility:hidden]">
                      {renderVariablePumpBody(calc.idealVariablePump, calc.lavado_requerit)}
                    </div>
                    {/* Back: Acceptable */}
                    <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Alternativa acceptable
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold bg-slate-100 text-slate-600 border-slate-300">
                          ACCEPTABLE
                        </span>
                      </div>
                      {renderVariablePumpBody(calc.acceptableVariablePump, calc.lavado_requerit_acceptable)}
                      <p className="text-[11px] text-muted-foreground italic">
                        Basat en un cicle de renovació de 4,5h (en lloc de 4h)
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                renderVariablePumpBody(calc.idealVariablePump, calc.lavado_requerit)
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
                  <div className="text-amber-700">
                    <strong>Parell Ideal (turnover 4h):</strong>
                    <br />
                    caudal_necesario: {calc.caudal_necesario.toFixed(2)} m³/h
                    <br />
                    {idealPair ? (
                      <>
                        Bomba: {idealPair.onoff.article.name} · Caudal: {idealPair.onoff.caudal} m³/h · cond_filt:{" "}
                        {idealPair.cond_filt ? "sí" : "NO (fallback: bomba més gran disponible)"}
                        <br />
                        Filtre: {idealPair.filter.article.name} · Àrea: {idealPair.filter.area_m2} m² · vf_pump:{" "}
                        {idealPair.vf_pump.toFixed(2)} (òptim 34-42: {idealPair.vf_in_range ? "sí" : "no"}) · cond_lav:{" "}
                        {idealPair.cond_lav ? "sí" : "no"}
                        {calc.pipeDiameterMm != null && (
                          <>
                            <br />
                            Diàmetre canonada recomanat: Ø{calc.pipeDiameterMm}mm (lookup taula 2 m/s, cabal{" "}
                            {idealPair.onoff.caudal} m³/h, mínim 63mm)
                          </>
                        )}
                      </>
                    ) : (
                      "null (sense bombes o filtres al catàleg)"
                    )}
                  </div>
                  <div className="text-amber-700">
                    <strong>Parell Acceptable (turnover 4,5h):</strong>
                    <br />
                    caudal_necesario_acceptable: {calc.caudal_necesario_acceptable.toFixed(2)} m³/h
                    <br />
                    {acceptablePair ? (
                      <>
                        Bomba: {acceptablePair.onoff.article.name} · Caudal: {acceptablePair.onoff.caudal} m³/h
                        <br />
                        Filtre: {acceptablePair.filter.article.name} · Àrea: {acceptablePair.filter.area_m2} m² ·
                        vf_pump: {acceptablePair.vf_pump.toFixed(2)} (òptim 34-42: {acceptablePair.vf_in_range ? "sí" : "no"}) ·
                        cond_lav: {acceptablePair.cond_lav ? "sí" : "no"}
                      </>
                    ) : (
                      "null (amagat — cap bomba arriba al caudal_necesario_acceptable, o no és piscina comunitària)"
                    )}
                  </div>
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
