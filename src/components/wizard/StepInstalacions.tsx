import { useBudgetStore } from "@/stores/budgetStore";
import {
  ArrowLeft,
  ArrowRight,
  Droplets,
  Fan,
  FlaskConical,
  Zap,
  ChevronDown,
  Info,
  AlertTriangle,
  Wrench,
  Cable,
  Home,
  HelpCircle,
  Warehouse,
  TreePine,
  Filter,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { EquipmentSelector, type SelectedArticle } from "./EquipmentSelector";
import { EquipmentRecommendations, type AppliedRecommendations } from "./EquipmentRecommendations";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { NumberInput } from "@/components/ui/NumberInput";
import { useQuadreRecommendationStore } from "@/hooks/useQuadreElectricAuto";

interface AccordionSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  content: React.ReactNode;
  enabled?: boolean;
  onEnabledChange?: (v: boolean) => void;
  alwaysShowContent?: boolean;
}

function SectionAccordion({
  section,
  isOpen,
  onToggle,
}: {
  section: AccordionSection;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const hasToggle = section.enabled !== undefined && section.onEnabledChange;
  const isEnabled = section.enabled ?? true;
  return (
    <div className="bg-card rounded-xl border border-border shadow-card">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", section.iconBg)}>
            {section.icon}
          </div>
          <h3 className="font-semibold text-foreground text-base">{section.title}</h3>
          {hasToggle && !isEnabled && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              No inclòs
            </span>
          )}
        </div>
        <ChevronDown
          className={cn("w-5 h-5 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-5 md:px-5 space-y-5 border-t border-border pt-4">
          {hasToggle && (
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <label className="text-sm font-medium text-foreground">Incloure aquesta secció en el pressupost</label>
              <Switch checked={isEnabled} onCheckedChange={section.onEnabledChange!} />
            </div>
          )}
          {section.alwaysShowContent ? (
            section.content
          ) : isEnabled ? (
            section.content
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground bg-muted/30 rounded-lg">
              Aquesta secció no s'inclou en el pressupost
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
      <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function OpcionalToggle({ opcional, onChange }: { opcional: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!opcional)}
      className={cn(
        "text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors",
        opcional
          ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
          : "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10",
      )}
    >
      {opcional ? "◎ Opcional per al client" : "● Inclòs al pressupost"}
    </button>
  );
}

function EquipColumn({ opcional, children }: { opcional: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-lg p-3",
        opcional ? "bg-amber-50/50 border border-dashed border-amber-200" : "border border-border",
      )}
    >
      {children}
    </div>
  );
}

function ColumnHeader({
  title,
  opcional,
  onOpcionalChange,
}: {
  title: string;
  opcional: boolean;
  onOpcionalChange: (v: boolean) => void;
}) {
  return (
    <div className="min-h-[52px] flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">{title}</span>
        {opcional && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">OPCIONAL</span>
        )}
      </div>
      <OpcionalToggle opcional={opcional} onChange={onOpcionalChange} />
    </div>
  );
}

async function loadArticle(id: string | undefined): Promise<SelectedArticle | null> {
  if (!id) return null;
  const { data } = await supabase
    .from("articles")
    .select("id, name, reference, image_url, suppliers:supplier_id(name)")
    .eq("id", id)
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

function calcAfmQty(filterName: string): number {
  const n = filterName.toLowerCase();
  // Sacs de 25 kg necessaris segons el diàmetre del filtre.
  // Coincideix amb la fórmula del motor de càlcul (kg/25, arrodonit amunt).
  if (n.includes("500")) return Math.ceil(90 / 25); // 4
  if (n.includes("600")) return Math.ceil(125 / 25); // 5
  if (n.includes("650")) return Math.ceil(200 / 25); // 8
  if (n.includes("750")) return Math.ceil(290 / 25); // 12
  if (n.includes("900")) return Math.ceil(500 / 25); // 20
  if (n.includes("1050")) return Math.ceil(660 / 25); // 27
  return 0;
}

export function StepInstalacions() {
  const { setStep, draft, updateDraft } = useBudgetStore();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    depuracio: true,
    bomba: true,
    dosificacio: true,
    quadre: true,
    fontaneria: true,
    electrica: true,
  });

  const [filtrePolies, setFiltrePolies] = useState<SelectedArticle | null>(null);
  const [filtreEspecial, setFiltreEspecial] = useState<SelectedArticle | null>(null);
  const [canviMediArticle, setCanviMediArticle] = useState<SelectedArticle | null>(null);
  const [bombaOnoff, setBombaOnoff] = useState<SelectedArticle | null>(null);
  const [bombaVariable, setBombaVariable] = useState<SelectedArticle | null>(null);
  const [dosifStd, setDosifStd] = useState<SelectedArticle | null>(null);
  const [hidrolisi, setHidrolisi] = useState<SelectedArticle | null>(null);
  const [quadre, setQuadre] = useState<SelectedArticle | null>(null);
  const [prefiltreArticle, setPrefiltreArticle] = useState<{
    id: string;
    name: string;
    sale_price: number;
  } | null>(null);
  const [prefiltreNotFound, setPrefiltreNotFound] = useState(false);

  const [wifiAutoArticle, setWifiAutoArticle] = useState<{ id: string; name: string } | null>(null);
  const [wifiNotFound, setWifiNotFound] = useState(false);
  // True when the chosen dosificació estàndard (clorador salí) already has
  // WiFi/Ethernet built in (technical_specs.wifi_incorporat) — in that case
  // the separate WiFi module add-on doesn't apply at all.
  const [dosifWifiIncorporat, setDosifWifiIncorporat] = useState(false);
  const [afmAutoArticle, setAfmAutoArticle] = useState<{ id: string; name: string; sale_price: number } | null>(null);
  const [afmNotFound, setAfmNotFound] = useState(false);

  // Re-runs whenever any of the underlying draft IDs changes (not just on
  // mount) so a newer write (e.g. the Hayward auto-default effect below, a
  // manual EquipmentSelector pick, or an applied recommendation) always
  // supersedes an in-flight load instead of racing it. `cancelled` guards the
  // superseded run so its late resolution can never clobber fresher state —
  // a mount-only ([]) effect can't do this: it snapshots the IDs once and any
  // async response it gets, however late, still wins if a stale check only
  // guards against unmount.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [fp, fe, cm, bo, bv, ds, hi, qu] = await Promise.all([
        loadArticle(draft.instalFiltrePoliesId),
        loadArticle(draft.instalFiltreEspecialId),
        loadArticle(draft.instalCanviMediArticleId),
        loadArticle(draft.instalBombaOnoffId),
        loadArticle(draft.instalBombaVariableId),
        loadArticle(draft.instalDosificacioStdId),
        loadArticle(draft.instalHidrolisiId),
        loadArticle(draft.instalQuadreId),
      ]);
      if (cancelled) return;
      setFiltrePolies(fp);
      setFiltreEspecial(fe);
      setCanviMediArticle(cm);
      setBombaOnoff(bo);
      setBombaVariable(bv);
      setDosifStd(ds);
      setHidrolisi(hi);
      setQuadre(qu);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [
    draft.instalFiltrePoliesId,
    draft.instalFiltreEspecialId,
    draft.instalCanviMediArticleId,
    draft.instalBombaOnoffId,
    draft.instalBombaVariableId,
    draft.instalDosificacioStdId,
    draft.instalHidrolisiId,
    draft.instalQuadreId,
  ]);

  // Auto-find Wi-Fi article — prioritize Dosificació + Mòdul connectivitat, then name search across all categories
  useEffect(() => {
    const find = async () => {
      // First try specific category+subtipus
      const { data: specific } = await supabase
        .from("articles")
        .select("id, name")
        .eq("category", "Dosificació")
        .eq("subtipus", "Mòdul connectivitat")
        .limit(1);
      if (specific && specific.length > 0) {
        setWifiAutoArticle({ id: specific[0].id, name: specific[0].name });
        setWifiNotFound(false);
        return;
      }
      // Fallback: search by name across all categories
      const { data } = await supabase
        .from("articles")
        .select("id, name")
        .or("name.ilike.%wifi%,name.ilike.%ethernet%,name.ilike.%mòdul%")
        .limit(1);
      if (data && data.length > 0) {
        setWifiAutoArticle({ id: data[0].id, name: data[0].name });
        setWifiNotFound(false);
      } else {
        setWifiAutoArticle(null);
        setWifiNotFound(true);
      }
    };
    find();
  }, []);

  // Check whether the chosen dosificació estàndard already has WiFi built in.
  useEffect(() => {
    let cancelled = false;
    const id = draft.instalDosificacioStdId;
    if (!id) {
      setDosifWifiIncorporat(false);
      return;
    }
    (async () => {
      const { data } = await supabase.from("articles").select("technical_specs").eq("id", id).single();
      if (cancelled) return;
      const specs = (data?.technical_specs as any) || {};
      setDosifWifiIncorporat(specs?.wifi_incorporat === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [draft.instalDosificacioStdId]);

  // Keep instalWifiArticleId synced to the auto-found module article so its
  // price is always available in the PDF as the informational "No inclou"
  // alternative — EXCEPT when the chosen equip already has WiFi incorporated
  // (wifi_incorporat === true), in which case the separate module doesn't
  // apply at all and any leftover selection/toggle must be forced off.
  // Without this "else" branch restoring the id, a leftover clear from a
  // previously wifi_incorporat=true article (or the toggle's own onChange)
  // could leave the id undefined and the PDF price blank even for equips
  // that don't have WiFi incorporated.
  useEffect(() => {
    if (dosifWifiIncorporat) {
      if (draft.instalWifiEnabled || draft.instalWifiArticleId) {
        updateDraft({ instalWifiEnabled: false, instalWifiArticleId: undefined });
      }
    } else if (wifiAutoArticle && draft.instalWifiArticleId !== wifiAutoArticle.id) {
      updateDraft({ instalWifiArticleId: wifiAutoArticle.id });
    }
  }, [dosifWifiIncorporat, wifiAutoArticle, draft.instalWifiEnabled, draft.instalWifiArticleId]);

  // Auto-find AFM article
  useEffect(() => {
    const find = async () => {
      const { data } = await supabase
        .from("articles")
        .select("id, name, sale_price")
        // Buscar nomès el sac individual de vidre AFM, NO articles tipus
        // "Canvi de sorra per AFM 500" que són serveis complets.
        .or("name.ilike.vidre afm%,name.ilike.vidre ecofiltrant%,name.ilike.afm ecofiltrant%")
        .not("name", "ilike", "%canvi%")
        .not("name", "ilike", "%per afm%")
        .order("sale_price", { ascending: true })
        .limit(1);
      if (data && data.length > 0) {
        setAfmAutoArticle({ id: data[0].id, name: data[0].name, sale_price: data[0].sale_price });
        setAfmNotFound(false);
      } else {
        setAfmAutoArticle(null);
        setAfmNotFound(true);
      }
    };
    find();
  }, []);

  // Auto-find prefiltre HYDROSPIN COMPACT article
  useEffect(() => {
    const find = async () => {
      const { data } = await supabase
        .from("articles")
        .select("id, name, sale_price")
        .eq("category", "Filtració")
        .eq("subtipus", "Components filtració")
        .ilike("name", "%hydrospin%")
        .limit(1);
      if (data && data.length > 0) {
        setPrefiltreArticle(data[0]);
        setPrefiltreNotFound(false);
        return;
      }
      // Fallback by name only
      const { data: d2 } = await supabase
        .from("articles")
        .select("id, name, sale_price")
        .ilike("name", "%hydrospin%")
        .limit(1);
      if (d2 && d2.length > 0) {
        setPrefiltreArticle(d2[0]);
        setPrefiltreNotFound(false);
      } else {
        setPrefiltreArticle(null);
        setPrefiltreNotFound(true);
      }
    };
    find();
  }, []);

  // Auto-default "Filtre especial" to HAYWARD SWIMCLEAR C200SE (opcional, qty=1)
  // unless the user has already chosen another article.
  useEffect(() => {
    if (draft.instalFiltreEspecialId) return;
    const find = async () => {
      const { data } = await supabase
        .from("articles")
        .select("id, name, reference, image_url, supplier_id, suppliers:supplier_id(name)")
        .or("name.ilike.%HAYWARD%SWIMCLEAR%C200SE%,name.ilike.%SWIMCLEAR%C200%,name.ilike.%HAYWARD%C200%")
        .limit(1);
      const art = data?.[0];
      if (!art) return;
      const selected: SelectedArticle = {
        id: art.id,
        name: art.name,
        reference: art.reference,
        image_url: art.image_url,
        supplierName: (art.suppliers as any)?.name,
      };
      setFiltreEspecial(selected);
      updateDraft({
        instalFiltreEspecialId: art.id,
        instalFiltreEspecialQty: draft.instalFiltreEspecialQty || 1,
        instalFiltreEspecialOpcional:
          draft.instalFiltreEspecialOpcional === undefined ? true : draft.instalFiltreEspecialOpcional,
      });
    };
    find();
  }, [draft.instalFiltreEspecialId]);

  // Auto-find fontaneria base article
  const [fontaneriaArticle, setFontaneriaArticle] = useState<{ id: string; name: string; sale_price: number } | null>(
    null,
  );
  const [fontaneriaNotFound, setFontaneriaNotFound] = useState(false);
  useEffect(() => {
    supabase
      .from("articles")
      .select("id, name, sale_price")
      .or("name.ilike.%tuberias%,name.ilike.%tuberies%,name.ilike.%fontaneria%")
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setFontaneriaArticle(data[0]);
          setFontaneriaNotFound(false);
        } else {
          setFontaneriaNotFound(true);
        }
      });
  }, []);

  // Auto-find elèctrica base article
  const [electricaArticle, setElectricaArticle] = useState<{ id: string; name: string; sale_price: number } | null>(
    null,
  );
  const [electricaNotFound, setElectricaNotFound] = useState(false);
  useEffect(() => {
    supabase
      .from("articles")
      .select("id, name, sale_price")
      .eq("subtipus", "Material elèctric")
      .or("name.ilike.%cable%,name.ilike.%toma tierra%,name.ilike.%elèctric%")
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setElectricaArticle(data[0]);
          setElectricaNotFound(false);
        } else {
          // Fallback without subtipus filter
          supabase
            .from("articles")
            .select("id, name, sale_price")
            .or("name.ilike.%cable%,name.ilike.%toma tierra%")
            .limit(1)
            .then(({ data: d2 }) => {
              if (d2 && d2.length > 0) {
                setElectricaArticle(d2[0]);
                setElectricaNotFound(false);
              } else {
                setElectricaNotFound(true);
              }
            });
        }
      });
  }, []);

  // Auto-find perforacions article
  const [perforacionsArticle, setPerforacionsArticle] = useState<{
    id: string;
    name: string;
    sale_price: number;
  } | null>(null);
  useEffect(() => {
    supabase
      .from("articles")
      .select("id, name, sale_price")
      .or("name.ilike.%perforacion%,name.ilike.%perforació%")
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPerforacionsArticle(data[0]);
          if (!draft.instalFontaneriaPerforacionsArticleId) {
            updateDraft({ instalFontaneriaPerforacionsArticleId: data[0].id });
          }
        }
      });
  }, []);

  // ==========================================================
  // AUTOMATIC ELECTRICAL PANEL SELECTION
  // ==========================================================
  // The actual selection logic now lives in `useQuadreElectricAuto`,
  // mounted at the wizard root so it keeps running across all steps.
  const quadreRecommendation = useQuadreRecommendationStore((s) => s.recommendation);
  const quadreLoading = useQuadreRecommendationStore((s) => s.loading);
  const [showManualOverride, setShowManualOverride] = useState(
    !!draft.instalQuadreManualOverride,
  );

  // When the global hook auto-selects a different panel, refresh the
  // EquipmentSelector's local article so the UI label updates instantly.
  useEffect(() => {
    if (!draft.instalQuadreId) return;
    let cancelled = false;
    supabase
      .from('articles')
      .select('id, name, reference, image_url')
      .eq('id', draft.instalQuadreId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setQuadre({
          id: data.id,
          name: data.name,
          reference: (data as any).reference ?? null,
          image_url: (data as any).image_url ?? null,
          supplierName: null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [draft.instalQuadreId]);

  // Pool perimeter calculation (coronament formula)
  const poolPerimeter = useMemo(() => {
    const l = draft.poolLength || 0;
    const w = draft.poolWidth || 0;
    if (l === 0 && w === 0) return 0;
    let p = (l + 0.3) * 2 + 2 + ((w + 0.3) * 2 + 2);
    if (draft.hasExteriorStairs) {
      const le = draft.extStairsLength || 0;
      if (le > 0) p += le * 2 + 0.6 + 2;
    }
    return Math.round(p * 100) / 100;
  }, [draft.poolLength, draft.poolWidth, draft.hasExteriorStairs, draft.extStairsLength]);

  const hasPoolDimensions = poolPerimeter > 0;

  // Fontaneria calculations
  const fontaneriaDistancia = draft.instalFontaneriaDistancia ?? 10;
  const fontaneriaBasePrice = fontaneriaArticle ? fontaneriaArticle.sale_price / 100 : 0;
  const fontaneriaPerimeterExtra = poolPerimeter > 25 ? (poolPerimeter - 25) * 55 : 0;
  const fontaneriaDistanciaExtra = fontaneriaDistancia > 10 ? (fontaneriaDistancia - 10) * 55 : 0;
  const perforacionsPrice =
    draft.instalFontaneriaPerforacions && draft.instalFontaneriaLocalTecnic === "existent" && perforacionsArticle
      ? perforacionsArticle.sale_price / 100
      : 0;
  const rasasPrice = draft.instalFontaneriaRasasEnabled ? Number(draft.instalFontaneriaRasasImport ?? 0) : 0;
  const fontaneriaTotal =
    fontaneriaBasePrice + fontaneriaPerimeterExtra + fontaneriaDistanciaExtra + perforacionsPrice + rasasPrice;

  const getFontaneriaAutoText = useCallback((distancia: number) => {
    return `TUBERÍAS 10ATM PRESIÓN DEPURADORA + PISCINA + ACCESORIOS HASTA ${Math.round(distancia)}M`;
  }, []);

  // Elèctrica calculations
  const electricaDistancia = fontaneriaDistancia; // Uses same distance as fontaneria
  const electricaBasePrice = electricaArticle ? electricaArticle.sale_price / 100 : 0;
  const electricaDistanciaExtra = electricaDistancia > 10 ? (electricaDistancia - 10) * 20 : 0;
  const electricaPerimetreExtra = poolPerimeter > 25 ? (poolPerimeter - 25) * 20 : 0;
  const electricaExtraCost = electricaDistanciaExtra + electricaPerimetreExtra;
  const electricaTotal = electricaBasePrice + electricaExtraCost;

  const getElectricaAutoText = useCallback(() => {
    return "CABLE TOMA TIERRA + PIQUETA + BRIDA";
  }, []);

  // Sync fontaneria/electrica article IDs and totals
  useEffect(() => {
    if (fontaneriaArticle && !draft.instalFontaneriaBaseArticleId) {
      updateDraft({ instalFontaneriaBaseArticleId: fontaneriaArticle.id });
    }
  }, [fontaneriaArticle]);
  useEffect(() => {
    if (electricaArticle && !draft.instalElectricaBaseArticleId) {
      updateDraft({ instalElectricaBaseArticleId: electricaArticle.id });
    }
  }, [electricaArticle]);
  // Keep instalElectricaTotal/instalElectricaExtraCost synced reactively —
  // previously they were only persisted inside syncDraft() on Next/Enrere,
  // so the PDF's "Presa de terra" line could show 0,00€ (stale/never-set
  // cached total) even though Partides always recomputed the right amount
  // live from the article + extra cost.
  useEffect(() => {
    if (draft.instalElectricaTotal !== electricaTotal || draft.instalElectricaExtraCost !== electricaExtraCost) {
      updateDraft({ instalElectricaTotal: electricaTotal, instalElectricaExtraCost: electricaExtraCost });
    }
  }, [electricaTotal, electricaExtraCost]);

  const afmQty = useMemo(() => {
    if (!filtrePolies) return 0;
    return calcAfmQty(filtrePolies.name);
  }, [filtrePolies]);

  const afmTotalPrice = useMemo(() => {
    if (!afmAutoArticle) return 0;
    return (afmAutoArticle.sale_price / 100) * afmQty;
  }, [afmAutoArticle, afmQty]);

  // Increment diferencial AFM vs sorra silícia.
  // Càlcul senzill: qty_sacs × (preu_VIDRE_AFM − preu_ARENA_SILICE)
  // Els dos articles són sacs unitaris del catàleg (mateixa unitat).
  const [arenaSilicePrice, setArenaSilicePrice] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("articles")
        .select("name, sale_price")
        .ilike("name", "arena silice%")
        .not("name", "ilike", "%canvi%")
        .order("sale_price", { ascending: true })
        .limit(1);
      if (cancelled) return;
      if (data && data.length > 0) setArenaSilicePrice(data[0].sale_price / 100);
      else setArenaSilicePrice(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const afmIncrement = useMemo(() => {
    if (!afmAutoArticle || arenaSilicePrice === null || afmQty <= 0) return null;
    const afmUnit = afmAutoArticle.sale_price / 100;
    return (afmUnit - arenaSilicePrice) * afmQty;
  }, [afmAutoArticle, arenaSilicePrice, afmQty]);

  // Keep instalAfmQty/instalAfmIncrement synced reactively — previously they
  // were only set when the user touched the AFM toggle (or via syncDraft on
  // Next/Enrere), so switching the underlying filtre (which changes afmQty)
  // without re-touching the toggle could leave a stale informational AFM
  // increment price in the PDF.
  useEffect(() => {
    const qty = filtrePolies ? afmQty : undefined;
    const increment = afmIncrement ?? undefined;
    if (draft.instalAfmQty !== qty || draft.instalAfmIncrement !== increment) {
      updateDraft({ instalAfmQty: qty, instalAfmIncrement: increment });
    }
  }, [filtrePolies, afmQty, afmIncrement]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const depuracioEnabled = draft.instalDepuracioEnabled ?? true;
  const bombaEnabled = draft.instalBombaEnabled ?? true;
  const dosificacioEnabled = draft.instalDosificacioEnabled ?? true;
  const quadreEnabled = draft.instalQuadreEnabled ?? true;
  const fontaneriaEnabled = draft.instalFontaneriaEnabled ?? true;
  const electricaEnabled = draft.instalElectricaEnabled ?? true;

  const { principalCount, opcionalCount, principalBadges, opcionalBadges } = useMemo(() => {
    let principal = 0;
    let opcional = 0;
    const pBadges: string[] = [];
    const oBadges: string[] = [];

    const check = (article: SelectedArticle | null, isOpcional: boolean, category: string, sectionEnabled: boolean) => {
      if (!article || !sectionEnabled) return;
      if (isOpcional) {
        opcional++;
        if (!oBadges.includes(category)) oBadges.push(category);
      } else {
        principal++;
        if (!pBadges.includes(category)) pBadges.push(category);
      }
    };

    check(filtrePolies, draft.instalFiltrePoliesOpcional ?? false, "Depuració", depuracioEnabled);
    check(filtreEspecial, draft.instalFiltreEspecialOpcional ?? true, "Depuració", depuracioEnabled);
    if (depuracioEnabled && draft.instalAfmEnabled && afmAutoArticle && filtrePolies) {
      principal++;
      if (!pBadges.includes("Depuració")) pBadges.push("Depuració");
    }
    if (depuracioEnabled && draft.instalCanviSorraEnabled && canviMediArticle) {
      principal++;
      if (!pBadges.includes("Depuració")) pBadges.push("Depuració");
    }

    check(bombaOnoff, draft.instalBombaOnoffOpcional ?? false, "Bomba", bombaEnabled);
    check(bombaVariable, draft.instalBombaVariableOpcional ?? true, "Bomba", bombaEnabled);

    check(dosifStd, draft.instalDosificacioStdOpcional ?? false, "Dosificació", dosificacioEnabled);
    check(hidrolisi, draft.instalHidrolisiOpcional ?? true, "Dosificació", dosificacioEnabled);
    if (dosificacioEnabled && draft.instalWifiEnabled && wifiAutoArticle) {
      principal++;
      if (!pBadges.includes("Dosificació")) pBadges.push("Dosificació");
    }

    if (quadreEnabled && quadre) {
      principal++;
      if (!pBadges.includes("Quadre")) pBadges.push("Quadre");
    }

    return { principalCount: principal, opcionalCount: opcional, principalBadges: pBadges, opcionalBadges: oBadges };
  }, [
    filtrePolies,
    filtreEspecial,
    canviMediArticle,
    bombaOnoff,
    bombaVariable,
    dosifStd,
    hidrolisi,
    quadre,
    draft.instalAfmEnabled,
    draft.instalCanviSorraEnabled,
    draft.instalWifiEnabled,
    draft.instalFiltrePoliesOpcional,
    draft.instalFiltreEspecialOpcional,
    draft.instalBombaOnoffOpcional,
    draft.instalBombaVariableOpcional,
    draft.instalDosificacioStdOpcional,
    draft.instalHidrolisiOpcional,
    afmAutoArticle,
    wifiAutoArticle,
    depuracioEnabled,
    bombaEnabled,
    dosificacioEnabled,
    quadreEnabled,
  ]);

  const syncDraft = (overrides: Partial<typeof draft> = {}) => {
    updateDraft({
      instalFiltrePoliesId: filtrePolies?.id || undefined,
      instalFiltreEspecialId: filtreEspecial?.id || undefined,
      // Save AFM article + qty + increment ALWAYS (even when disabled) so the
      // PDF can display the alternative "+xxx €" price for the client.
      instalAfmArticleId: afmAutoArticle ? afmAutoArticle.id : undefined,
      instalAfmQty: filtrePolies ? afmQty : undefined,
      instalAfmIncrement: afmIncrement ?? undefined,
      instalCanviMediArticleId: canviMediArticle?.id || undefined,
      instalCanviSorraArticleId: canviMediArticle?.id || undefined,
      instalBombaOnoffId: bombaOnoff?.id || undefined,
      instalBombaVariableId: bombaVariable?.id || undefined,
      // Save WiFi article ALWAYS (even when disabled) so the PDF can show
      // its catalog price as the "No inclou" alternative.
      instalWifiArticleId: wifiAutoArticle ? wifiAutoArticle.id : undefined,
      // Save prefiltre article ALWAYS so PDF can display its price as
      // an alternative even when not included.
      instalPrefiltreArticleId: prefiltreArticle ? prefiltreArticle.id : undefined,
      instalDosificacioStdId: dosifStd?.id || undefined,
      instalHidrolisiId: hidrolisi?.id || undefined,
      instalQuadreId: quadre?.id || undefined,
      // Fontaneria
      instalFontaneriaBaseArticleId: fontaneriaArticle?.id || undefined,
      instalFontaneriaExtraCost: fontaneriaPerimeterExtra,
      instalFontaneriaTotal: fontaneriaTotal,
      instalFontaneriaPerforacionsArticleId: perforacionsArticle?.id || undefined,
      // Elèctrica
      instalElectricaBaseArticleId: electricaArticle?.id || undefined,
      instalElectricaExtraCost: electricaExtraCost,
      instalElectricaTotal: electricaTotal,
      ...overrides,
    });
  };

  const handleNext = () => {
    syncDraft();
    setStep(6);
  };
  const handleBack = () => {
    syncDraft();
    setStep(4);
  };

  const sections: AccordionSection[] = [
    {
      id: "depuracio",
      title: "Depuració",
      icon: <Droplets className="w-5 h-5 text-blue-600" />,
      iconBg: "bg-blue-100",
      enabled: depuracioEnabled,
      onEnabledChange: (v) => updateDraft({ instalDepuracioEnabled: v }),
      alwaysShowContent: true,
      content: (
        <div className="space-y-5">
          {depuracioEnabled && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <EquipColumn opcional={draft.instalFiltrePoliesOpcional ?? false}>
                  <ColumnHeader
                    title="Filtre de fibra"
                    opcional={draft.instalFiltrePoliesOpcional ?? false}
                    onOpcionalChange={(v) => {
                      updateDraft({ instalFiltrePoliesOpcional: v });
                      if (!v) updateDraft({ instalFiltreEspecialOpcional: true });
                      else updateDraft({ instalFiltreEspecialOpcional: false });
                    }}
                  />
                  <EquipmentSelector
                    label=""
                    placeholder="Cercar filtre de fibra..."
                    categoryFilter="Filtració"
                    subtipusFilter="Polièster"
                    value={filtrePolies}
                    onChange={(a) => {
                      setFiltrePolies(a);
                      updateDraft({ instalFiltrePoliesId: a?.id || undefined });
                    }}
                    noneLabel="Sense filtre"
                    quantity={draft.instalFiltrePoliesQty || 1}
                    onQuantityChange={(q) => updateDraft({ instalFiltrePoliesQty: q })}
                  />
                </EquipColumn>
                <EquipColumn opcional={draft.instalFiltreEspecialOpcional ?? true}>
                  <ColumnHeader
                    title="Filtre especial"
                    opcional={draft.instalFiltreEspecialOpcional ?? true}
                    onOpcionalChange={(v) => {
                      updateDraft({ instalFiltreEspecialOpcional: v });
                      if (!v) updateDraft({ instalFiltrePoliesOpcional: true });
                      else updateDraft({ instalFiltrePoliesOpcional: false });
                    }}
                  />
                  <EquipmentSelector
                    label=""
                    placeholder="Cercar filtre especial..."
                    categoryFilter="Filtració"
                    subtipusFilter="Especial (diatomees/cartutx)"
                    value={filtreEspecial}
                    onChange={(a) => {
                      setFiltreEspecial(a);
                      updateDraft({ instalFiltreEspecialId: a?.id || undefined });
                    }}
                    noneLabel="Sense filtre"
                    quantity={draft.instalFiltreEspecialQty || 1}
                    onQuantityChange={(q) => updateDraft({ instalFiltreEspecialQty: q })}
                  />
                </EquipColumn>
              </div>

              {/* AFM - only visible when filtre de fibra selected */}
              {filtrePolies && (
                <div className="space-y-2">
                  {!draft.instalAfmEnabled ? (
                    <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                      <p className="text-muted-foreground">Inclou: sorra silícia estàndard</p>
                      {afmAutoArticle ? (
                        <p className="text-muted-foreground">
                          + Amb vidre AFM ecofiltrant ({afmQty} sacs de 25 kg):{" "}
                          <span className="text-primary font-medium">
                            {afmIncrement !== null ? `+${afmIncrement.toFixed(2)} €` : "increment a determinar"}
                          </span>{" "}
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft({
                                instalAfmEnabled: true,
                                instalAfmArticleId: afmAutoArticle.id,
                                instalAfmQty: afmQty,
                              })
                            }
                            className="text-primary font-medium hover:underline"
                          >
                            Activar AFM
                          </button>
                        </p>
                      ) : afmNotFound ? (
                        <p className="text-amber-600 text-xs flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          No s'ha trobat l'article AFM al catàleg.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-foreground">Increment AFM (vidre ecofiltrant)</label>
                        <Switch
                          checked={true}
                          onCheckedChange={(checked) => {
                            updateDraft({
                              instalAfmEnabled: checked,
                              instalAfmArticleId: afmAutoArticle ? afmAutoArticle.id : undefined,
                              instalAfmQty: filtrePolies ? afmQty : undefined,
                              instalAfmIncrement: afmIncrement ?? undefined,
                            });
                          }}
                        />
                      </div>
                      {afmAutoArticle ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
                          <p>
                            Inclou: vidre AFM ecofiltrant · {afmQty} sacs de 25 kg · Increment per al client:{" "}
                            <strong>{afmIncrement !== null ? `+${afmIncrement.toFixed(2)} €` : "a determinar"}</strong>
                          </p>
                          <p className="text-xs text-emerald-700/80 mt-1">
                            Diferència respecte a la sorra silícia estàndard del mateix filtre.
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft({
                                instalAfmEnabled: false,
                                instalAfmArticleId: afmAutoArticle ? afmAutoArticle.id : undefined,
                                instalAfmQty: filtrePolies ? afmQty : undefined,
                                instalAfmIncrement: afmIncrement ?? undefined,
                              })
                            }
                            className="text-xs text-emerald-600 hover:underline mt-1"
                          >
                            Desactivar
                          </button>
                        </div>
                      ) : (
                        <p className="text-amber-600 text-xs flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          No s'ha trobat l'article AFM al catàleg.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {!depuracioEnabled && (
            <div className="py-4 text-center text-sm text-muted-foreground bg-muted/30 rounded-lg">
              Filtres no inclosos en el pressupost
            </div>
          )}

          {/* Canvi de sorra/vidre toggle — ALWAYS visible regardless of depuració toggle */}
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Incloure canvi de sorra o vidre (material de recanvi)
              </label>
              <Switch
                checked={draft.instalCanviSorraEnabled || false}
                onCheckedChange={(checked) => {
                  updateDraft({ instalCanviSorraEnabled: checked });
                  if (!checked) {
                    setCanviMediArticle(null);
                    updateDraft({ instalCanviMediArticleId: undefined, instalCanviMediFiltre: undefined });
                  }
                }}
              />
            </div>
            {draft.instalCanviSorraEnabled && (
              <EquipmentSelector
                label="Material de recanvi"
                placeholder="Cercar material..."
                categoryFilter="Filtració"
                subtipusFilter="Canvi de medi filtrant"
                value={canviMediArticle}
                onChange={(a) => {
                  setCanviMediArticle(a);
                  updateDraft({ instalCanviMediArticleId: a?.id || undefined });
                }}
              />
            )}
          </div>

          {/* Prefiltre HYDROSPIN COMPACT — toggle independent del depuració */}
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-100 flex-shrink-0">
                  <Filter className="w-5 h-5 text-cyan-700" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground block">
                    Incloure prefiltre HYDROSPIN COMPACT
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Prefiltre centrífug que protegeix el filtre principal i allarga la seva vida útil.
                  </p>
                </div>
              </div>
              <Switch
                checked={draft.instalPrefiltreEnabled || false}
                onCheckedChange={(checked) => {
                  updateDraft({
                    instalPrefiltreEnabled: checked,
                    instalPrefiltreArticleId: prefiltreArticle ? prefiltreArticle.id : undefined,
                    instalPrefiltreQty: checked ? (draft.instalPrefiltreQty || 1) : undefined,
                  });
                }}
              />
            </div>
            {draft.instalPrefiltreEnabled && (
              <div className="ml-13 pl-0">
                {prefiltreArticle ? (
                  <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-sm text-cyan-900 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{prefiltreArticle.name}</p>
                      <p className="text-xs text-cyan-700/80 mt-0.5">
                        S'afegirà automàticament a "Equips seleccionats" del pressupost.
                      </p>
                    </div>
                    <span className="text-base font-semibold whitespace-nowrap">
                      {(prefiltreArticle.sale_price / 100).toFixed(2)} €
                    </span>
                  </div>
                ) : prefiltreNotFound ? (
                  <p className="text-amber-600 text-xs flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    No s'ha trobat l'article HYDROSPIN COMPACT al catàleg.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "bomba",
      title: "Bomba",
      icon: <Fan className="w-5 h-5 text-emerald-600" />,
      iconBg: "bg-emerald-100",
      enabled: bombaEnabled,
      onEnabledChange: (v) => updateDraft({ instalBombaEnabled: v }),
      content: (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <EquipColumn opcional={draft.instalBombaOnoffOpcional ?? false}>
              <ColumnHeader
                title="Bomba On/Off"
                opcional={draft.instalBombaOnoffOpcional ?? false}
                onOpcionalChange={(v) => {
                  updateDraft({ instalBombaOnoffOpcional: v });
                  if (!v) updateDraft({ instalBombaVariableOpcional: true });
                  else updateDraft({ instalBombaVariableOpcional: false });
                }}
              />
              <EquipmentSelector
                label=""
                placeholder="Cercar bomba on/off..."
                categoryFilter="Bomba"
                subtipusFilter="On/Off"
                value={bombaOnoff}
                onChange={(a) => {
                  setBombaOnoff(a);
                  updateDraft({ instalBombaOnoffId: a?.id || undefined });
                }}
                noneLabel="No s'inclou"
                quantity={draft.instalBombaOnoffQty || 1}
                onQuantityChange={(q) => updateDraft({ instalBombaOnoffQty: q })}
              />
            </EquipColumn>
            <EquipColumn opcional={draft.instalBombaVariableOpcional ?? true}>
              <ColumnHeader
                title="Bomba velocitat variable"
                opcional={draft.instalBombaVariableOpcional ?? true}
                onOpcionalChange={(v) => {
                  updateDraft({ instalBombaVariableOpcional: v });
                  if (!v) updateDraft({ instalBombaOnoffOpcional: true });
                  else updateDraft({ instalBombaOnoffOpcional: false });
                }}
              />
              <EquipmentSelector
                label=""
                placeholder="Cercar bomba variable..."
                categoryFilter="Bomba"
                subtipusFilter="Velocitat variable"
                value={bombaVariable}
                onChange={(a) => {
                  setBombaVariable(a);
                  updateDraft({ instalBombaVariableId: a?.id || undefined });
                }}
                noneLabel="No s'inclou"
                quantity={draft.instalBombaVariableQty || 1}
                onQuantityChange={(q) => updateDraft({ instalBombaVariableQty: q })}
              />
            </EquipColumn>
          </div>
          <InfoNote>Normalment s'instal·la un sol tipus de bomba</InfoNote>
        </div>
      ),
    },
    {
      id: "dosificacio",
      title: "Cloració Salina",
      icon: <FlaskConical className="w-5 h-5 text-amber-600" />,
      iconBg: "bg-amber-100",
      enabled: dosificacioEnabled,
      onEnabledChange: (v) => updateDraft({ instalDosificacioEnabled: v }),
      content: (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <EquipColumn opcional={draft.instalDosificacioStdOpcional ?? false}>
              <ColumnHeader
                title="Equip dosificació estàndard"
                opcional={draft.instalDosificacioStdOpcional ?? false}
                onOpcionalChange={(v) => {
                  updateDraft({ instalDosificacioStdOpcional: v });
                  if (!v) updateDraft({ instalHidrolisiOpcional: true });
                  else updateDraft({ instalHidrolisiOpcional: false });
                }}
              />
              <EquipmentSelector
                label=""
                placeholder="Cercar equip dosificació..."
                categoryFilter="Dosificació"
                subtipusFilter="Estàndard (pH/Cl)"
                value={dosifStd}
                onChange={(a) => {
                  setDosifStd(a);
                  updateDraft({ instalDosificacioStdId: a?.id || undefined });
                }}
                noneLabel="No s'inclou"
                quantity={draft.instalDosificacioStdQty || 1}
                onQuantityChange={(q) => updateDraft({ instalDosificacioStdQty: q })}
              />
            </EquipColumn>
            <EquipColumn opcional={draft.instalHidrolisiOpcional ?? true}>
              <ColumnHeader
                title="Hidròlisi / UV"
                opcional={draft.instalHidrolisiOpcional ?? true}
                onOpcionalChange={(v) => {
                  updateDraft({ instalHidrolisiOpcional: v });
                  if (!v) updateDraft({ instalDosificacioStdOpcional: true });
                  else updateDraft({ instalDosificacioStdOpcional: false });
                }}
              />
              <EquipmentSelector
                label=""
                placeholder="Cercar equip hidròlisi..."
                categoryFilter="Dosificació"
                subtipusFilter="Hidròlisi / UV"
                value={hidrolisi}
                onChange={(a) => {
                  setHidrolisi(a);
                  updateDraft({ instalHidrolisiId: a?.id || undefined });
                }}
                noneLabel="No s'inclou"
                quantity={draft.instalHidrolisiQty || 1}
                onQuantityChange={(q) => updateDraft({ instalHidrolisiQty: q })}
              />
            </EquipColumn>
          </div>

          {/* Wi-Fi module - moved here from Bomba. Hidden entirely when the
              chosen dosificació estàndard already has WiFi incorporated. */}
          {!dosifWifiIncorporat && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Afegir mòdul ethernet / Wi-Fi</label>
                <Switch
                  checked={draft.instalWifiEnabled || false}
                  onCheckedChange={(checked) => {
                    updateDraft({
                      instalWifiEnabled: checked,
                      // Keep the article id set regardless of checked: the PDF
                      // needs it even when off, to show its price as the
                      // informational "No inclou" alternative.
                      instalWifiArticleId: wifiAutoArticle ? wifiAutoArticle.id : undefined,
                    });
                  }}
                />
              </div>
              {draft.instalWifiEnabled &&
                (wifiAutoArticle ? (
                  <p className="text-xs text-muted-foreground pl-1">Article: {wifiAutoArticle.name}</p>
                ) : wifiNotFound ? (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    No s'ha trobat l'article de mòdul Wi-Fi al catàleg. Afegeix-lo per incloure'l.
                  </p>
                ) : null)}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "quadre",
      title: "Quadre elèctric",
      icon: <Zap className="w-5 h-5 text-slate-600" />,
      iconBg: "bg-slate-200",
      enabled: quadreEnabled,
      onEnabledChange: (v) => updateDraft({ instalQuadreEnabled: v }),
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Línia elèctrica</label>
            <div className="grid grid-cols-2 gap-2 max-w-md">
              {[
                { value: "monofasica", title: "Monofàsica" },
                { value: "trifasica", title: "Trifàsica" },
              ].map((opt) => {
                const current = draft.instalQuadreLinia ?? "monofasica";
                const active = current === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateDraft({ instalQuadreLinia: opt.value as 'monofasica' | 'trifasica' })}
                    className={cn(
                      "p-3 rounded-xl border-2 text-center transition-all text-sm font-semibold",
                      active
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-muted-foreground/30 text-foreground",
                    )}
                  >
                    {opt.title}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">Per defecte Monofàsica. Canvia a Trifàsica si la instal·lació ho requereix.</p>
          </div>

          {/* Recommendation card */}
          {quadreLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Actualitzant quadre...
            </div>
          )}

          {quadreRecommendation && quadreRecommendation.article && !draft.instalQuadreManualOverride && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">
                    Quadre elèctric seleccionat automàticament
                  </p>
                  <p className="text-sm font-medium text-foreground mt-1">
                    {quadreRecommendation.article.name}
                  </p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1 pl-12">
                <p className="font-medium text-foreground">Motiu de la selecció:</p>
                <p>
                  • Transformador: <span className="font-semibold text-foreground">{quadreRecommendation.transformer}</span>{' '}
                  ({Number(draft.accFocusLedQty ?? 0)} focus × {quadreRecommendation.wattsPerFocus}W
                  {Number(draft.accProjectorMiniLedQty ?? 0) > 0 &&
                    ` + ${Number(draft.accProjectorMiniLedQty)} mini × 9W`}
                  {' = '}{quadreRecommendation.totalWatts}W)
                </p>
                <p>
                  • Potència bomba:{' '}
                  <span className="font-semibold text-foreground">
                    {quadreRecommendation.cvBomba != null ? `${quadreRecommendation.cvBomba} CV` : 'sense bomba'}
                  </span>{' '}
                  → rang <span className="font-semibold text-foreground">{quadreRecommendation.cvRange}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  updateDraft({ instalQuadreManualOverride: true });
                  setShowManualOverride(true);
                }}
                className="text-xs text-primary hover:text-primary/80 font-medium pl-12"
              >
                Canviar manualment →
              </button>
            </div>
          )}

          {quadreRecommendation && quadreRecommendation.notFound && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                ⚠️ No s'ha trobat cap quadre per {quadreRecommendation.transformer} + {quadreRecommendation.cvRange}. Comprova el catàleg.
              </span>
            </div>
          )}

          {(draft.instalQuadreManualOverride || showManualOverride) && (
            <>
              {quadreRecommendation?.article && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium">Selecció manual</span>
                    <span> (el sistema recomanava: {quadreRecommendation.article.name})</span>
                    <button
                      type="button"
                      onClick={() => {
                        updateDraft({
                          instalQuadreManualOverride: false,
                          instalQuadreId: quadreRecommendation.article!.id,
                        });
                        setQuadre({
                          id: quadreRecommendation.article!.id,
                          name: quadreRecommendation.article!.name,
                          reference: null,
                          image_url: null,
                          supplierName: null,
                        });
                        setShowManualOverride(false);
                      }}
                      className="ml-2 underline font-medium"
                    >
                      Tornar a recomanació
                    </button>
                  </div>
                </div>
              )}
              <EquipmentSelector
                label="Seleccionar quadre elèctric"
                placeholder="Cercar quadre elèctric..."
                categoryFilter="Elèctric"
                subtipusFilter="Quadre elèctric"
                value={quadre}
                onChange={(a) => {
                  setQuadre(a);
                  updateDraft({ instalQuadreId: a?.id || undefined });
                }}
                noneLabel="No s'inclou"
              />
            </>
          )}
        </div>
      ),
    },
    {
      id: "fontaneria",
      title: "Fontaneria",
      icon: <Wrench className="w-5 h-5 text-slate-500" />,
      iconBg: "bg-slate-100",
      enabled: fontaneriaEnabled,
      onEnabledChange: (v) => updateDraft({ instalFontaneriaEnabled: v }),
      content: (
        <div className="space-y-4">
          {fontaneriaNotFound ? (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              No s'ha trobat l'article de fontaneria al catàleg.
            </p>
          ) : fontaneriaArticle ? (
            <>
              <p className="text-xs text-muted-foreground">
                Article base: <span className="font-medium text-foreground">{fontaneriaArticle.name}</span>
              </p>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Distància fins a depuradora (m)
                </label>
                <NumberInput
                  allowDecimals={false}
                  className="w-full px-3 py-2.5 rounded-lg text-sm min-h-[44px] max-w-[200px]"
                  value={fontaneriaDistancia}
                  onChange={(v) => {
                    const d = v && v > 0 ? v : 10;
                    updateDraft({ instalFontaneriaDistancia: d, instalFontaneriaText: getFontaneriaAutoText(d) });
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">Per defecte: 10 m.</p>
              </div>
              {!hasPoolDimensions ? (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>Introdueix les dimensions de la piscina a l'Estructura per calcular.</span>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Perímetre de la piscina:{" "}
                    <span className="font-medium text-foreground">{poolPerimeter.toFixed(1)} ml</span>
                    {draft.hasExteriorStairs && " (+ escala exterior inclosa)"}
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">Descripció</label>
                      <button
                        type="button"
                        onClick={() =>
                          updateDraft({ instalFontaneriaText: getFontaneriaAutoText(fontaneriaDistancia) })
                        }
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        ↺ Restaurar text automàtic
                      </button>
                    </div>
                    <Textarea
                      value={draft.instalFontaneriaText || getFontaneriaAutoText(fontaneriaDistancia)}
                      onChange={(e) => updateDraft({ instalFontaneriaText: e.target.value })}
                      rows={2}
                    />
                  </div>
                  {/* Local tècnic */}
                  <div className="space-y-3 border-t border-border pt-4">
                    <label className="block text-sm font-medium text-foreground">Tipus de local tècnic</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { value: "existent", icon: <Warehouse className="w-5 h-5" />, title: "Obra existent" },
                        { value: "nou", icon: <Home className="w-5 h-5" />, title: "Local tècnic nou" },
                        { value: "determinar", icon: <HelpCircle className="w-5 h-5" />, title: "A determinar" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            if (opt.value === "nou") {
                              updateDraft({ instalFontaneriaLocalTecnic: opt.value });
                            } else {
                              // Limpiar todos los campos relacionados con caseta nova
                              updateDraft({
                                instalFontaneriaLocalTecnic: opt.value,
                                instalFontaneriaCasetaTipus: undefined,
                                instalCasetaObraLlarg: undefined,
                                instalCasetaObraAmple: undefined,
                                instalCasetaObraAlt: undefined,
                                instalCasetaObraPortes: undefined,
                              });
                            }
                          }}
                          className={cn(
                            "p-3 rounded-xl border-2 text-left transition-all space-y-1",
                            (draft.instalFontaneriaLocalTecnic || "determinar") === opt.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/30",
                          )}
                        >
                          <div className="text-muted-foreground">{opt.icon}</div>
                          <p className="text-xs font-semibold text-foreground">{opt.title}</p>
                        </button>
                      ))}
                    </div>
                    {draft.instalFontaneriaLocalTecnic === "existent" && (
                      <div className="space-y-3 pl-2 border-l-2 border-primary/20">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-foreground">Perforacions</label>
                          <Switch
                            checked={draft.instalFontaneriaPerforacions ?? false}
                            onCheckedChange={(v) => updateDraft({ instalFontaneriaPerforacions: v })}
                          />
                        </div>
                        {(draft.instalFontaneriaPerforacions ?? false) && perforacionsArticle && (
                          <div className="p-2 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                            Article: <span className="font-medium text-foreground">{perforacionsArticle.name}</span> —{" "}
                            {(perforacionsArticle.sale_price / 100).toFixed(2)} €
                          </div>
                        )}
                        {(draft.instalFontaneriaPerforacions ?? false) && !perforacionsArticle && (
                          <p className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Crea un article "Perforaciones" al catàleg per incloure el preu.
                          </p>
                        )}
                      </div>
                    )}
                    {draft.instalFontaneriaLocalTecnic === "nou" && (
                      <div className="space-y-2 pl-2 border-l-2 border-primary/20">
                        <label className="block text-sm font-medium text-foreground">Tipus de caseta nova</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {[
                            { value: "caseta_elevada", title: "Caseta depuradora elevada prefabricada" },
                            { value: "caseta_soterrada", title: "Caseta depuradora soterrada prefabricada" },
                            { value: "caseta_obra", title: "Caseta d'Obra" },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                if (opt.value === "caseta_obra") {
                                  updateDraft({ instalFontaneriaCasetaTipus: opt.value });
                                } else {
                                  // Cambia a un tipo que no es caseta d'obra: limpiar medidas/portes
                                  updateDraft({
                                    instalFontaneriaCasetaTipus: opt.value,
                                    instalCasetaObraLlarg: undefined,
                                    instalCasetaObraAmple: undefined,
                                    instalCasetaObraAlt: undefined,
                                    instalCasetaObraPortes: undefined,
                                  });
                                }
                              }}
                              className={cn(
                                "p-3 rounded-xl border-2 text-left transition-all",
                                draft.instalFontaneriaCasetaTipus === opt.value
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-muted-foreground/30",
                              )}
                            >
                              <p className="text-xs font-semibold text-foreground">{opt.title}</p>
                            </button>
                          ))}
                        </div>
                        {!draft.instalFontaneriaCasetaTipus && (
                          <p className="text-xs text-muted-foreground">
                            Selecciona el tipus de caseta. Apareixerà a la partida Annex › Caseta del pressupost.
                          </p>
                        )}
                        {draft.instalFontaneriaCasetaTipus === "caseta_obra" && (
                          <div className="mt-3 p-3 rounded-lg border border-border bg-muted/30 space-y-3">
                            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                              Mesures caseta d'obra
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Llarg (m)</label>
                                <NumberInput
                                  value={draft.instalCasetaObraLlarg ?? null}
                                  onChange={(v) => updateDraft({ instalCasetaObraLlarg: v ?? undefined })}
                                  step={0.1}
                                  min={0}
                                  placeholder="0.0"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Ample (m)</label>
                                <NumberInput
                                  value={draft.instalCasetaObraAmple ?? null}
                                  onChange={(v) => updateDraft({ instalCasetaObraAmple: v ?? undefined })}
                                  step={0.1}
                                  min={0}
                                  placeholder="0.0"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Alt (m)</label>
                                <NumberInput
                                  value={draft.instalCasetaObraAlt ?? null}
                                  onChange={(v) => updateDraft({ instalCasetaObraAlt: v ?? undefined })}
                                  step={0.1}
                                  min={0}
                                  placeholder="0.0"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-foreground uppercase tracking-wide">
                                Portes
                              </label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {[
                                  { value: "frontal", title: "Només porta frontal" },
                                  { value: "frontal_superior", title: "Porta frontal i superior" },
                                  { value: "sense_portes", title: "Sense portes" },
                                ].map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => updateDraft({ instalCasetaObraPortes: opt.value })}
                                    className={cn(
                                      "p-3 rounded-xl border-2 text-left transition-all",
                                      draft.instalCasetaObraPortes === opt.value
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-muted-foreground/30",
                                    )}
                                  >
                                    <p className="text-xs font-semibold text-foreground">{opt.title}</p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-foreground">Rasas</label>
                        <Switch
                          checked={draft.instalFontaneriaRasasEnabled ?? false}
                          onCheckedChange={(v) =>
                            updateDraft({
                              instalFontaneriaRasasEnabled: v,
                              instalFontaneriaRasasImport: v ? draft.instalFontaneriaRasasImport ?? 0 : 0,
                            })
                          }
                        />
                      </div>
                      {draft.instalFontaneriaRasasEnabled ? (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Import venda (€)</label>
                          <NumberInput
                            value={draft.instalFontaneriaRasasImport ?? null}
                            onChange={(v) => updateDraft({ instalFontaneriaRasasImport: v ?? 0 })}
                            step={1}
                            min={0}
                            placeholder="0.00"
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Les condicions de rasas es determinaran posteriorment.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <p className="text-sm font-medium text-foreground">
                      Total fontaneria: <span className="text-primary">{fontaneriaTotal.toFixed(2)} €</span>
                    </p>
                    {fontaneriaPerimeterExtra > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        + Perímetre extra: {(poolPerimeter - 25).toFixed(1)} ml × 55 €/ml ={" "}
                        {fontaneriaPerimeterExtra.toFixed(2)} €
                      </p>
                    )}
                    {fontaneriaDistanciaExtra > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        + Distància extra: {(fontaneriaDistancia - 10).toFixed(0)} m × 55 €/m ={" "}
                        {fontaneriaDistanciaExtra.toFixed(2)} €
                      </p>
                    )}
                    {perforacionsPrice > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        + Perforacions: {perforacionsPrice.toFixed(2)} €
                      </p>
                    )}
                    {rasasPrice > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        + Rasas: {rasasPrice.toFixed(2)} €
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>
      ),
    },
    {
      id: "electrica",
      title: "Instal·lació elèctrica",
      icon: <Cable className="w-5 h-5 text-amber-500" />,
      iconBg: "bg-amber-50",
      enabled: electricaEnabled,
      onEnabledChange: (v) => updateDraft({ instalElectricaEnabled: v }),
      content: (
        <div className="space-y-4">
          {electricaNotFound ? (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              No s'ha trobat l'article d'instal·lació elèctrica.
            </p>
          ) : electricaArticle ? (
            <>
              <p className="text-xs text-muted-foreground">
                Article base: <span className="font-medium text-foreground">{electricaArticle.name}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Distància fins a depuradora: <span className="font-medium text-foreground">{electricaDistancia} m</span>{" "}
                <span className="text-primary/70">(definida a Fontaneria)</span>
              </p>
              {!hasPoolDimensions ? (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>Introdueix les dimensions de la piscina a l'Estructura.</span>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Perímetre de la piscina:{" "}
                    <span className="font-medium text-foreground">{poolPerimeter.toFixed(1)} ml</span>
                    {draft.hasExteriorStairs && " (+ escala exterior inclosa)"}
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">Descripció</label>
                      <button
                        type="button"
                        onClick={() => updateDraft({ instalElectricaText: getElectricaAutoText() })}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        ↺ Restaurar text automàtic
                      </button>
                    </div>
                    <Textarea
                      value={draft.instalElectricaText || getElectricaAutoText()}
                      onChange={(e) => updateDraft({ instalElectricaText: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <p className="text-sm font-medium text-foreground">
                      Total elèctrica: <span className="text-primary">{electricaTotal.toFixed(2)} €</span>
                    </p>
                    {electricaExtraCost > 0 && (
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        <p>Base: {electricaBasePrice.toFixed(2)} €</p>
                        {electricaDistanciaExtra > 0 && (
                          <p>
                            + {electricaDistancia - 10} m extra distància × 20 €/m ={" "}
                            {electricaDistanciaExtra.toFixed(2)} €
                          </p>
                        )}
                        {electricaPerimetreExtra > 0 && (
                          <p>
                            + {(poolPerimeter - 25).toFixed(1)} ml extra perímetre × 20 €/ml ={" "}
                            {electricaPerimetreExtra.toFixed(2)} €
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Instal·lacions</h2>
        <p className="text-sm text-muted-foreground mt-1">Equipament tècnic de la piscina</p>
      </div>

      <EquipmentRecommendations
        useAfm={Boolean(draft.instalAfmEnabled)}
        quadreLinia={draft.instalQuadreLinia ?? "monofasica"}
        poolVolumeLiters={(() => {
          const l = Number(draft.poolLength) || 0;
          const w = Number(draft.poolWidth) || 0;
          const dMin = Number(draft.poolDepthMin) || 0;
          const dMax = Number(draft.poolDepthMax) || 0;
          const depthAvg = dMin && dMax ? (dMin + dMax) / 2 : dMax || dMin;
          return l && w && depthAvg ? l * w * depthAvg * 1000 : 0;
        })()}
        poolDimensionsReady={
          Boolean(draft.poolLength) &&
          Boolean(draft.poolWidth) &&
          Boolean(draft.poolDepthMin || draft.poolDepthMax)
        }
        onApply={async (rec: AppliedRecommendations) => {
          const updates: Record<string, any> = {};
          if (rec.filterId) {
            const art = await loadArticle(rec.filterId);
            if (art) setFiltrePolies(art);
            updates.instalFiltrePoliesId = rec.filterId;
          }
          if (rec.onoffId) {
            const art = await loadArticle(rec.onoffId);
            if (art) setBombaOnoff(art);
            updates.instalBombaOnoffId = rec.onoffId;
          }
          if (rec.variableId) {
            const art = await loadArticle(rec.variableId);
            if (art) setBombaVariable(art);
            updates.instalBombaVariableId = rec.variableId;
          }
          if (rec.dosifStdId) {
            const art = await loadArticle(rec.dosifStdId);
            if (art) setDosifStd(art);
            updates.instalDosificacioStdId = rec.dosifStdId;
          }
          if (Object.keys(updates).length > 0) updateDraft(updates);
        }}
      />

      {sections.map((section) => (
        <SectionAccordion
          key={section.id}
          section={section}
          isOpen={openSections[section.id] ?? true}
          onToggle={() => toggleSection(section.id)}
        />
      ))}

      {/* Summary bar - inline above navigation */}
      <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-sm flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-foreground">
          Principals: <strong className="text-primary">{principalCount}</strong>
          {opcionalCount > 0 && (
            <>
              {" "}
              · Opcionals: <strong className="text-amber-600">{opcionalCount}</strong>
            </>
          )}
        </span>
        <div className="hidden sm:flex gap-1.5 flex-wrap">
          {principalBadges.map((b) => (
            <span
              key={`p-${b}`}
              className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
            >
              {b}
            </span>
          ))}
          {opcionalBadges.map((b) => (
            <span
              key={`o-${b}`}
              className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium"
            >
              {b}
            </span>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pb-4">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Enrere
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md"
        >
          Següent <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
