import { useBudgetStore } from "@/stores/budgetStore";
import { CobertorSelector } from "@/components/wizard/CobertorSelector";
import {
  ArrowLeft,
  ArrowRight,
  Info,
  FileText,
  Shovel,
  Square,
  Leaf,
  Shield,
  Bot,
  Thermometer,
  Droplets,
  Package,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { EquipmentSelector, SelectedArticle } from "@/components/wizard/EquipmentSelector";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Zap, Sparkles, AlertTriangle } from "lucide-react";

type AnnexEstat = "no" | "inclos" | "opcional";

const estatLabels: { value: AnnexEstat; label: string; color: string }[] = [
  { value: "no", label: "No s'inclou", color: "bg-muted text-muted-foreground" },
  { value: "inclos", label: "Inclòs al pressupost", color: "bg-primary/15 text-primary" },
  { value: "opcional", label: "Opcional per al client", color: "bg-warning/15 text-warning" },
];

function EstatPills({ value, onChange }: { value: AnnexEstat; onChange: (v: AnnexEstat) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {estatLabels.map((e) => (
        <button
          key={e.value}
          type="button"
          onClick={() => onChange(e.value)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
            value === e.value
              ? `${e.color} border-current`
              : "bg-card text-muted-foreground border-border hover:bg-muted",
          )}
        >
          {e.label}
        </button>
      ))}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, estat }: { icon: any; title: string; estat: AnnexEstat }) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="font-medium text-foreground">{title}</span>
      {estat === "opcional" && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning font-bold">OPCIONAL</span>
      )}
      {estat === "inclos" && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">INCLÒS</span>
      )}
    </div>
  );
}

function QtyControl({ value, onChange, min = 1 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted min-w-[44px] min-h-[44px]"
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-medium">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted min-w-[44px] min-h-[44px]"
      >
        +
      </button>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  placeholder = "0,00",
  note,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  note?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <input
        type="number"
        step="0.01"
        min="0"
        className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 min-h-[44px]"
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
      />
      {note && <p className="text-xs text-muted-foreground mt-1">{note}</p>}
    </div>
  );
}

function ToggleField({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-3 cursor-pointer">
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          className={cn("w-10 h-6 rounded-full transition-colors relative", enabled ? "bg-primary" : "bg-muted")}
        >
          <span
            className={cn(
              "absolute w-4 h-4 rounded-full bg-white top-1 transition-all shadow-sm",
              enabled ? "left-5" : "left-1",
            )}
          />
        </button>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </label>
      {enabled && children}
    </div>
  );
}

// Helper to load article by ID
async function loadArticle(id: string): Promise<SelectedArticle | null> {
  const { data } = await supabase
    .from("articles")
    .select("id, name, reference, image_url, supplier_id, suppliers:supplier_id(name)")
    .eq("id", id)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    reference: data.reference,
    image_url: data.image_url,
    supplierName: (data.suppliers as any)?.name,
  };
}

export function StepAnnex() {
  const { setStep, currentStep, draft, updateDraft } = useBudgetStore();

  // Local state for selected articles
  const [projecteArticle, setProjecteArticle] = useState<SelectedArticle | null>(null);
  const [pavimentArticle, setPavimentArticle] = useState<SelectedArticle | null>(null);
  const [pavimentSearchOpen, setPavimentSearchOpen] = useState(false);
  const [robotArticle, setRobotArticle] = useState<SelectedArticle | null>(null);
  const [bombaCalorArticle, setBombaCalorArticle] = useState<SelectedArticle | null>(null);
  const [gespaArticle, setGespaArticle] = useState<SelectedArticle | null>(null);
  const [netejafonsArticle, setNetejafonsArticle] = useState<SelectedArticle | null>(null);
  const [netejafonsPrice, setNetejafonsPrice] = useState<number | null>(null);

  // Load existing articles on mount
  useEffect(() => {
    const ids: { id: string; setter: (a: SelectedArticle | null) => void }[] = [
      { id: draft.annexProjecteArticleId || "", setter: setProjecteArticle },
      { id: draft.annexPavimentModelId || "", setter: setPavimentArticle },
      { id: draft.annexRobotArticleId || "", setter: setRobotArticle },
      { id: draft.annexBombaCalorArticleId || "", setter: setBombaCalorArticle },
      { id: draft.annexGespaArticleId || "", setter: setGespaArticle },
    ].filter((x) => x.id);
    ids.forEach(({ id, setter }) => {
      loadArticle(id).then(setter);
    });
  }, []);

  const poolLength = draft.poolLength || 0;
  const poolWidth = draft.poolWidth || 0;
  const poolDepthMin = draft.poolDepthMin || 0;
  const poolDepthMax = draft.poolDepthMax || 0;
  const poolDepthAvg = poolDepthMin && poolDepthMax ? (poolDepthMin + poolDepthMax) / 2 : 0;

  // === Excavació calculations ===
  const reomplimentCalc = useMemo(() => {
    if (!poolLength || !poolWidth || !poolDepthAvg) return null;
    const sacosBase = Math.ceil(((poolLength + poolWidth) * 2 * (poolDepthAvg + 0.3) * 0.2) / 0.67);
    const costMaterial = sacosBase * 33.88;
    const viatgesNeeded = Math.ceil(sacosBase / 8);
    const costTransport = viatgesNeeded * 175;
    const rawCost = (costMaterial + costTransport) * 1.55;
    const reompliment = Math.round(Math.max(930, rawCost) * 100) / 100;
    return { sacosBase, viatgesNeeded, reompliment };
  }, [poolLength, poolWidth, poolDepthAvg]);

  useEffect(() => {
    if (reomplimentCalc && draft.annexExcavacioEstat !== "no") {
      updateDraft({ annexExcavacioReompliment: reomplimentCalc.reompliment });
    }
  }, [reomplimentCalc?.reompliment, draft.annexExcavacioEstat]);

  // Mano de obra excavació (mirrors the formula engine rule "MANO DE OBRA EXCAVACION":
  // qty = roundUp(((L+1)*(W+1)*(depth_avg+0.3))/8.5), unit price 455€)
  const manoObraExcavacio = useMemo(() => {
    if (!poolLength || !poolWidth || !poolDepthAvg) return null;
    const qty = Math.ceil(((poolLength + 1) * (poolWidth + 1) * (poolDepthAvg + 0.3)) / 8.5);
    // Mínim de venda 3.300 € (igual que el mínim de 930 € del re-ompliment).
    const total = Math.max(3300, qty * 455);
    return { qty, total: Math.round(total * 100) / 100 };
  }, [poolLength, poolWidth, poolDepthAvg]);

  // === Sistema netejafons calculations ===
  const netejafonsCalc = useMemo(() => {
    const stairType = draft.interiorStairsType;
    const depthMin = poolDepthMin || 0;
    const stairLen = draft.stairsLength || 0;

    // --- FONS ---
    // Si escalera "tot_ample" o "plataforma": ceil((Llarg − Llarg_escala) × Ample / 3.25)
    // Si escalera "estandard" o "banc": ceil((Llarg − Llarg_escala) × Ample / 3.25) + 1
    // Sense escala: ceil(Llarg × Ample / 3.25) + 1
    let fons = 0;
    if (poolLength > 0 && poolWidth > 0) {
      if (stairType === "tot_ample" || stairType === "plataforma") {
        const usableLen = Math.max(0, poolLength - stairLen);
        fons = Math.ceil((usableLen * poolWidth) / 3.25);
      } else if (stairType === "estandard" || stairType === "banc") {
        const usableLen = Math.max(0, poolLength - stairLen);
        fons = Math.ceil((usableLen * poolWidth) / 3.25) + 1;
      } else {
        // sense escala → fórmula sobre tota la piscina + 1
        fons = Math.ceil((poolLength * poolWidth) / 3.25) + 1;
      }
    }

    // --- ESCALA ---
    // Base: ceil(depthMin / 0.2) - 1
    // Si escalera "tot_ample": multiplicar por ceil(ample / 2.80)
    let escala = 0;
    if (stairType && stairType !== "sense" && depthMin > 0) {
      const base = Math.max(0, Math.ceil(depthMin / 0.2) - 1);
      if (stairType === "tot_ample" && poolWidth > 0) {
        const factor = Math.max(1, Math.ceil(poolWidth / 2.8));
        escala = base * factor;
      } else {
        escala = base;
      }
    }

    // --- PLATAFORMA / BANC ---
    // 1 boquilla por cada 2.5m d'amplada (ceil), basat en el width del banc/plataforma.
    let plataforma = 0;
    if (stairType === "plataforma") {
      const platW = draft.platformWidth || draft.platformLength || 0;
      if (platW > 0) plataforma = Math.max(1, Math.ceil(platW / 2.5));
    } else if (stairType === "banc") {
      const bancW = draft.benchWidth || draft.benchLength || 0;
      if (bancW > 0) plataforma = Math.max(1, Math.ceil(bancW / 2.5));
    }

    return { fons, escala, plataforma };
  }, [
    poolLength,
    poolWidth,
    poolDepthMin,
    draft.interiorStairsType,
    draft.stairsLength,
    draft.platformWidth,
    draft.platformLength,
    draft.benchWidth,
    draft.benchLength,
  ]);

  // Auto-lookup sistema netejafons article and load its price
  useEffect(() => {
    const loadNetejafons = async () => {
      let articleId = draft.annexNetejafonsArticleId;
      if (!articleId) {
        const { data } = await supabase
          .from("articles")
          .select("id, sale_price")
          .or("name.ilike.%sistema%netejafons%,name.ilike.%sistema%limpiafondos%")
          .limit(1);
        if (data?.[0]) {
          articleId = data[0].id;
          updateDraft({ annexNetejafonsArticleId: articleId });
          setNetejafonsPrice(data[0].sale_price / 100);
          const art = await loadArticle(articleId);
          setNetejafonsArticle(art);
        }
      } else {
        const { data } = await supabase.from("articles").select("sale_price").eq("id", articleId).single();
        if (data) setNetejafonsPrice(data.sale_price / 100);
        const art = await loadArticle(articleId);
        setNetejafonsArticle(art);
      }
    };
    loadNetejafons();
  }, []);

  // Auto-assign "PROJECTE D'OBRA" article whenever section is included/optional
  useEffect(() => {
    if (!draft.annexProjecteEstat || draft.annexProjecteEstat === "no") return;
    const ensureProjecte = async () => {
      let articleId = draft.annexProjecteArticleId;
      if (!articleId) {
        const { data } = await supabase
          .from("articles")
          .select("id")
          .ilike("name", "PROJECTE D'OBRA")
          .limit(1);
        if (data?.[0]) articleId = data[0].id;
      }
      const updates: Record<string, unknown> = {};
      if (articleId && draft.annexProjecteArticleId !== articleId) {
        updates.annexProjecteArticleId = articleId;
      }
      if ((draft.annexProjecteQty || 0) !== 1) {
        updates.annexProjecteQty = 1;
      }
      if (Object.keys(updates).length) updateDraft(updates);
    };
    ensureProjecte();
  }, [draft.annexProjecteEstat]);

  // Auto-assign "BEATBOT Sora P3" robot when section is opcional/inclos and no article picked.
  // Also syncs the local `robotArticle` state so the selector shows it preselected.
  useEffect(() => {
    if (!draft.annexRobotEstat || draft.annexRobotEstat === "no") return;
    if (draft.annexRobotArticleId && robotArticle) return;
    const ensureRobot = async () => {
      if (draft.annexRobotArticleId && !robotArticle) {
        const art = await loadArticle(draft.annexRobotArticleId);
        if (art) setRobotArticle(art);
        return;
      }
      const { data } = await supabase
        .from("articles")
        .select("id, name, reference, image_url, supplier_id, suppliers:supplier_id(name)")
        .or("name.ilike.%sora%p3%,name.ilike.%beatbot%sora%,name.ilike.%beatbot%")
        .limit(1);
      const art = data?.[0];
      if (art) {
        setRobotArticle({
          id: art.id,
          name: art.name,
          reference: art.reference,
          image_url: art.image_url,
          supplierName: (art.suppliers as any)?.name,
        });
        updateDraft({
          annexRobotArticleId: art.id,
          annexRobotQty: draft.annexRobotQty || 1,
        });
      }
    };
    ensureRobot();
  }, [draft.annexRobotEstat, draft.annexRobotArticleId, robotArticle]);

  // Local-date helpers — avoid UTC drift (toISOString() shifts the day in
  // +01/+02 timezones, causing the "selects the previous day" bug).
  const toLocalISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fromLocalISO = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const currentYear = new Date().getFullYear();
  const DEFAULT_DESDE_ISO = `${currentYear}-03-01`;
  const DEFAULT_FINS_A_ISO = `${currentYear}-11-29`;
  const defaultDesde = draft.annexBombaCalorDesde
    ? fromLocalISO(draft.annexBombaCalorDesde)
    : fromLocalISO(DEFAULT_DESDE_ISO);
  const defaultFinsA = draft.annexBombaCalorFinsA
    ? fromLocalISO(draft.annexBombaCalorFinsA)
    : fromLocalISO(DEFAULT_FINS_A_ISO);

  // Persist the default dates as soon as the user opens this annex so the
  // PDF and downstream calcs always see real ISO values.
  useEffect(() => {
    if (draft.annexBombaCalorEstat && draft.annexBombaCalorEstat !== "no") {
      const updates: Partial<typeof draft> = {};
      if (!draft.annexBombaCalorDesde) updates.annexBombaCalorDesde = DEFAULT_DESDE_ISO;
      if (!draft.annexBombaCalorFinsA) updates.annexBombaCalorFinsA = DEFAULT_FINS_A_ISO;
      if (Object.keys(updates).length) updateDraft(updates);
    }
  }, [draft.annexBombaCalorEstat]);

  const netejafonsFons = draft.annexNetejafonsFons ?? netejafonsCalc.fons;
  const netejafonsEscala = draft.annexNetejafonsEscala ?? netejafonsCalc.escala;
  const netejafonsPlataforma = draft.annexNetejafonsPlataforma ?? netejafonsCalc.plataforma;
  const netejafonsTotal = netejafonsFons + netejafonsEscala + netejafonsPlataforma;
  const netejafonsExtraCost = netejafonsTotal > 11 ? (netejafonsTotal - 11) * 270 : 0;

  // Save total/extra on change
  useEffect(() => {
    if (draft.annexNetejafonsEstat && draft.annexNetejafonsEstat !== "no") {
      updateDraft({ annexNetejafonsTotal: netejafonsTotal, annexNetejafonsExtraCost: netejafonsExtraCost });
    }
  }, [netejafonsTotal, netejafonsExtraCost, draft.annexNetejafonsEstat]);

  // === Bomba de calor — kW recommendation ===
  const [heatPumps, setHeatPumps] = useState<Array<{ id: string; name: string; kw: number; sale_price: number }>>([]);

  useEffect(() => {
    const loadHeatPumps = async () => {
      const { data } = await supabase
        .from("articles")
        .select("id, name, sale_price")
        .eq("category", "Varis")
        .eq("subtipus", "Bombes de calor");
      if (!data) return;
      const parsed = data
        .map((a) => {
          const m = a.name.match(/(\d+[,.]?\d*)\s*KW/i);
          const kw = m ? parseFloat(m[1].replace(",", ".")) : NaN;
          return { id: a.id, name: a.name, kw, sale_price: a.sale_price };
        })
        .filter((a) => !isNaN(a.kw))
        .sort((a, b) => a.kw - b.kw);
      setHeatPumps(parsed);
    };
    loadHeatPumps();
  }, []);

  const bombaCalorCalc = useMemo(() => {
    const volumeLiters =
      poolLength && poolWidth && poolDepthAvg ? poolLength * poolWidth * poolDepthAvg * 1000 : 0;
    if (!volumeLiters) return null;
    const volumeM3 = volumeLiters / 1000;
    const targetTemp = draft.annexBombaCalorTemperatura ?? 27;
    const deltaT = targetTemp - 15;
    const hasCover = draft.annexBombaCalorCoberta === true;
    const coverFactor = hasCover ? 1.0 : 0.8;
    const baseKw = (volumeM3 * deltaT * 1.16) / (48 * coverFactor);

    // Winter buffer: if usage period covers Dec/Jan/Feb
    const desde = draft.annexBombaCalorDesde ? new Date(draft.annexBombaCalorDesde) : null;
    const finsA = draft.annexBombaCalorFinsA ? new Date(draft.annexBombaCalorFinsA) : null;
    let winterBuffer = false;
    if (desde && finsA) {
      const start = desde.getMonth();
      const end = finsA.getMonth();
      const months = new Set<number>();
      // Walk months inclusive (handle wrap-around)
      let m = start;
      for (let i = 0; i < 13; i++) {
        months.add(m);
        if (m === end) break;
        m = (m + 1) % 12;
      }
      winterBuffer = months.has(11) || months.has(0) || months.has(1);
    }
    const kwNeeded = winterBuffer ? baseKw * 1.2 : baseKw;
    return { volumeM3, deltaT, hasCover, coverFactor, baseKw, kwNeeded, winterBuffer };
  }, [
    poolLength,
    poolWidth,
    poolDepthAvg,
    draft.annexBombaCalorTemperatura,
    draft.annexBombaCalorCoberta,
    draft.annexBombaCalorDesde,
    draft.annexBombaCalorFinsA,
  ]);

  // Persist computed kW
  useEffect(() => {
    if (draft.annexBombaCalorEstat && draft.annexBombaCalorEstat !== "no" && bombaCalorCalc) {
      const rounded = Math.round(bombaCalorCalc.kwNeeded * 10) / 10;
      if (draft.annexBombaCalorKwRequired !== rounded) {
        updateDraft({ annexBombaCalorKwRequired: rounded });
      }
    }
  }, [bombaCalorCalc?.kwNeeded, draft.annexBombaCalorEstat]);

  const bombaCalorRecommendation = useMemo(() => {
    if (!bombaCalorCalc || heatPumps.length === 0) return null;
    const kwNeeded = bombaCalorCalc.kwNeeded;
    const recommended = heatPumps.find((h) => h.kw >= kwNeeded) || null;
    const recIndex = recommended ? heatPumps.indexOf(recommended) : -1;
    const next = recIndex >= 0 && recIndex < heatPumps.length - 1 ? heatPumps[recIndex + 1] : null;
    const exceedsMax = !recommended;
    return { recommended, next, exceedsMax };
  }, [bombaCalorCalc, heatPumps]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Annex</h2>
        <p className="text-sm text-muted-foreground mt-1">Serveis i opcions addicionals</p>
      </div>

      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/10 rounded-xl">
        <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-sm text-primary">
          Els apartats marcats com a 'Opcional' s'informaran al client però NO sumaran al total del pressupost.
        </p>
      </div>

      <Accordion type="multiple" className="space-y-3">
        {/* SECTION 1 — Sistema netejafons */}
        <AccordionItem
          value="sistema-netejafons"
          className="bg-card rounded-xl border border-border shadow-card overflow-hidden"
        >
          <AccordionTrigger className="px-5 py-4 hover:no-underline">
            <SectionHeader
              icon={Droplets}
              title="Sistema netejafons"
              estat={(draft.annexNetejafonsEstat as AnnexEstat) || "no"}
            />
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <EstatPills
              value={(draft.annexNetejafonsEstat as AnnexEstat) || "no"}
              onChange={(v) => updateDraft({ annexNetejafonsEstat: v })}
            />
            {draft.annexNetejafonsEstat && draft.annexNetejafonsEstat !== "no" && (
              <div className="space-y-4">
                {poolLength > 0 && poolWidth > 0 ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <span className="text-sm font-medium text-foreground">Fons</span>
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            auto
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            className="w-16 px-2 py-1.5 rounded-lg border border-input bg-background text-sm text-center min-h-[44px]"
                            value={netejafonsFons}
                            onChange={(e) => updateDraft({ annexNetejafonsFons: parseInt(e.target.value) || 0 })}
                          />
                          <span className="text-xs text-muted-foreground">auto: {netejafonsCalc.fons}</span>
                        </div>
                      </div>
                      {draft.interiorStairsType && draft.interiorStairsType !== "sense" && (
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <span className="text-sm font-medium text-foreground">Escala</span>
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              auto
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              className="w-16 px-2 py-1.5 rounded-lg border border-input bg-background text-sm text-center min-h-[44px]"
                              value={netejafonsEscala}
                              onChange={(e) => updateDraft({ annexNetejafonsEscala: parseInt(e.target.value) || 0 })}
                            />
                            <span className="text-xs text-muted-foreground">auto: {netejafonsCalc.escala}</span>
                          </div>
                        </div>
                      )}
                      {(draft.interiorStairsType === "plataforma" || draft.interiorStairsType === "banc") && (
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <span className="text-sm font-medium text-foreground">
                              {draft.interiorStairsType === "banc" ? "Banc" : "Plataforma"}
                            </span>
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              auto
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              className="w-16 px-2 py-1.5 rounded-lg border border-input bg-background text-sm text-center min-h-[44px]"
                              value={netejafonsPlataforma}
                              onChange={(e) =>
                                updateDraft({ annexNetejafonsPlataforma: parseInt(e.target.value) || 0 })
                              }
                            />
                            <span className="text-xs text-muted-foreground">auto: {netejafonsCalc.plataforma}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-muted/50 border border-border rounded-lg">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">Total boquilles: {netejafonsTotal}</p>
                        <span
                          className={cn(
                            "text-[11px] px-2 py-0.5 rounded-full font-medium",
                            (draft.accBasicsColor ?? "blanc") === "color"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-muted text-foreground border border-border",
                          )}
                          title="Hereta el color seleccionat als Accessoris bàsics"
                        >
                          Color: {(draft.accBasicsColor ?? "blanc") === "color" ? "De color" : "Blancs"}
                        </span>
                      </div>
                    </div>
                    {netejafonsArticle && (
                      <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg space-y-1">
                        <p className="text-sm font-medium text-foreground">{netejafonsArticle.name}</p>
                        <p className="text-sm text-foreground">
                          Preu base (fins a 11 boquilles):{" "}
                          <span className="font-bold text-primary">
                            {netejafonsPrice ? `${netejafonsPrice.toFixed(2)} €` : "—"}
                          </span>
                        </p>
                        {netejafonsExtraCost > 0 && (
                          <p className="text-sm text-foreground">
                            Extra ({netejafonsTotal - 11} boq. × 270€):{" "}
                            <span className="font-bold text-warning">+{netejafonsExtraCost.toFixed(2)} €</span>
                          </p>
                        )}
                        <p className="text-sm font-bold text-foreground border-t border-border pt-1 mt-1">
                          Total sistema:{" "}
                          <span className="text-primary">
                            {((netejafonsPrice || 0) + netejafonsExtraCost).toFixed(2)} €
                          </span>
                        </p>
                      </div>
                    )}
                    {netejafonsTotal > 11 ? (
                      <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                        <Info className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-warning">
                          Les {netejafonsTotal} boquilles superen les 11 incloses. Increment: +{netejafonsTotal - 11} ×
                          270€ = +{netejafonsExtraCost}€
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 p-3 bg-success/10 border border-success/20 rounded-lg">
                        <Info className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-success">{netejafonsTotal} boquilles incloses en el preu base</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <Info className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-warning">
                      Introdueix les dimensions de la piscina a l'Estructura per calcular les boquilles.
                    </p>
                  </div>
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 2 — Bomba de calor */}
        <AccordionItem
          value="bomba-calor"
          className="bg-card rounded-xl border border-border shadow-card overflow-hidden"
        >
          <AccordionTrigger className="px-5 py-4 hover:no-underline">
            <SectionHeader
              icon={Thermometer}
              title="Bomba de calor"
              estat={(draft.annexBombaCalorEstat as AnnexEstat) || "no"}
            />
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <EstatPills
              value={(draft.annexBombaCalorEstat as AnnexEstat) || "no"}
              onChange={(v) => updateDraft({ annexBombaCalorEstat: v })}
            />
            {draft.annexBombaCalorEstat && draft.annexBombaCalorEstat !== "no" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Té coberta?</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: true, label: "Sí, té coberta" },
                      { value: false, label: "No té coberta" },
                    ].map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => updateDraft({ annexBombaCalorCoberta: opt.value })}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                          draft.annexBombaCalorCoberta === opt.value
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "bg-card text-muted-foreground border-border hover:bg-muted",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Des de:</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal min-h-[44px]">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(defaultDesde, "dd/MM/yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={defaultDesde}
                          onSelect={(d) => d && updateDraft({ annexBombaCalorDesde: toLocalISO(d) })}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Fins a:</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal min-h-[44px]">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(defaultFinsA, "dd/MM/yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={defaultFinsA}
                          onSelect={(d) => d && updateDraft({ annexBombaCalorFinsA: toLocalISO(d) })}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Temperatura desitjada:{" "}
                    <span className="text-primary font-bold">{draft.annexBombaCalorTemperatura || 27}°C</span>
                  </label>
                  <Slider
                    min={20}
                    max={35}
                    step={0.5}
                    value={[draft.annexBombaCalorTemperatura || 27]}
                    onValueChange={([v]) =>
                      updateDraft({ annexBombaCalorTemperatura: Math.round(v) })
                    }
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>20°C</span>
                    <span>35°C</span>
                  </div>
                </div>
                {/* Càlcul automàtic de potència */}
                {!bombaCalorCalc ? (
                  <div className="flex items-start gap-2 p-3 bg-muted/50 border border-border rounded-lg">
                    <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Introdueix les dimensions de la piscina a l'Estructura per calcular la recomanació.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-4 bg-primary/5 border border-primary/15 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">Càlcul de potència</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Volum: <strong className="text-foreground">{bombaCalorCalc.volumeM3.toFixed(1)} m³</strong> · ΔT:{" "}
                        <strong className="text-foreground">{bombaCalorCalc.deltaT}°C</strong> · Coberta:{" "}
                        <strong className="text-foreground">
                          {bombaCalorCalc.hasCover ? "Sí" : "No"} (factor {bombaCalorCalc.coverFactor})
                        </strong>
                        {bombaCalorCalc.winterBuffer && (
                          <>
                            {" "}· <span className="text-warning font-semibold">+20% hivern</span>
                          </>
                        )}
                      </p>
                      <p className="text-base">
                        Potència necessària:{" "}
                        <span className="font-bold text-primary text-lg">
                          {bombaCalorCalc.kwNeeded.toFixed(1)} kW
                        </span>
                      </p>
                    </div>

                    {bombaCalorRecommendation && bombaCalorRecommendation.exceedsMax && (
                      <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-warning">
                          Potència necessària ({bombaCalorCalc.kwNeeded.toFixed(1)} kW) supera el model màxim disponible
                          ({heatPumps[heatPumps.length - 1]?.kw} kW). Considera dues unitats.
                        </p>
                      </div>
                    )}

                    {heatPumps.length === 0 && (
                      <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-warning">
                          No s'han trobat bombes de calor al catàleg. Afegeix articles amb subtipus 'Bombes de calor'.
                        </p>
                      </div>
                    )}

                    {bombaCalorRecommendation?.recommended && (
                      <div className="p-4 bg-success/10 border border-success/30 rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-success" />
                          <span className="text-xs font-bold text-success uppercase tracking-wide">Recomanat</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {bombaCalorRecommendation.recommended.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {bombaCalorRecommendation.recommended.kw} kW · marge: +
                          {(bombaCalorRecommendation.recommended.kw - bombaCalorCalc.kwNeeded).toFixed(1)} kW
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          onClick={async () => {
                            const id = bombaCalorRecommendation.recommended!.id;
                            updateDraft({ annexBombaCalorArticleId: id });
                            const art = await loadArticle(id);
                            setBombaCalorArticle(art);
                          }}
                          className="bg-success text-success-foreground hover:bg-success/90"
                        >
                          Seleccionar →
                        </Button>
                      </div>
                    )}

                    {bombaCalorRecommendation?.next && (
                      <div className="p-3 bg-muted/40 border border-border rounded-lg space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                          Alternativa (model superior)
                        </p>
                        <p className="text-sm text-foreground">{bombaCalorRecommendation.next.name}</p>
                        <p className="text-xs text-muted-foreground">{bombaCalorRecommendation.next.kw} kW</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const id = bombaCalorRecommendation.next!.id;
                            updateDraft({ annexBombaCalorArticleId: id });
                            const art = await loadArticle(id);
                            setBombaCalorArticle(art);
                          }}
                        >
                          Seleccionar alternativa
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                <EquipmentSelector
                  label="Seleccionar bomba de calor"
                  categoryFilter="Varis"
                  subtipusFilter="Bombes de calor"
                  value={bombaCalorArticle}
                  onChange={(a) => {
                    setBombaCalorArticle(a);
                    updateDraft({ annexBombaCalorArticleId: a?.id || undefined });
                  }}
                  noneLabel="A determinar"
                />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 3 — Robot netejafons */}
        <AccordionItem value="robot" className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <AccordionTrigger className="px-5 py-4 hover:no-underline">
            <SectionHeader icon={Bot} title="Robot netejafons" estat={(draft.annexRobotEstat as AnnexEstat) || "no"} />
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <EstatPills
              value={(draft.annexRobotEstat as AnnexEstat) || "no"}
              onChange={(v) => updateDraft({ annexRobotEstat: v })}
            />
            {draft.annexRobotEstat && draft.annexRobotEstat !== "no" && (
              <div className="space-y-4">
                <EquipmentSelector
                  label="Seleccionar robot"
                  categoryFilter="Varis"
                  subtipusFilter="Robots"
                  value={robotArticle}
                  onChange={(a) => {
                    setRobotArticle(a);
                    updateDraft({ annexRobotArticleId: a?.id || undefined });
                  }}
                  noneLabel="A determinar"
                />
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Quantitat:</span>
                  <QtyControl value={draft.annexRobotQty || 1} onChange={(v) => updateDraft({ annexRobotQty: v })} />
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 4 — Cobertor */}
        <AccordionItem value="cobertor" className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <AccordionTrigger className="px-5 py-4 hover:no-underline">
            <SectionHeader icon={Shield} title="Cobertor" estat={(draft.annexCobertorEstat as AnnexEstat) || "no"} />
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <EstatPills
              value={(draft.annexCobertorEstat as AnnexEstat) || "no"}
              onChange={(v) => {
                if (v === "no") {
                  // Reset all cobertor selections so the user starts fresh next time.
                  updateDraft({
                    annexCobertorEstat: v,
                    annexCobertorTipus: undefined,
                    annexCobertorModelId: undefined,
                    annexCobertorLames: undefined,
                    annexCobertorColorId: undefined,
                    annexCobertorModelName: undefined,
                    annexCobertorColorName: undefined,
                    annexCobertorManualOverride: false,
                    annexCobertorManualAmount: undefined,
                    annexCobertorCalcCost: undefined,
                    annexCobertorCalcSale: undefined,
                    annexCobertorCalcBreakdown: undefined,
                    annexCobertorMurNou: undefined,
                    annexCobertorMurM2: undefined,
                  });
                } else {
                  updateDraft({ annexCobertorEstat: v });
                }
              }}
            />
            {draft.annexCobertorEstat && draft.annexCobertorEstat !== "no" && (
              <CobertorSelector
                tipus={draft.annexCobertorTipus}
                modelId={draft.annexCobertorModelId}
                lames={draft.annexCobertorLames}
                colorId={draft.annexCobertorColorId}
                poolWidth={draft.poolWidth}
                poolLength={draft.poolLength}
                poolDepthMin={draft.poolDepthMin}
                poolDepthMax={draft.poolDepthMax}
                interiorStairsType={draft.interiorStairsType}
                murNou={draft.annexCobertorMurNou}
                manualOverride={draft.annexCobertorManualOverride}
                manualAmount={draft.annexCobertorManualAmount}
                onChange={(val) =>
                  updateDraft({
                    annexCobertorTipus: val.tipus,
                    annexCobertorModelId: val.modelId,
                    annexCobertorLames: val.lames,
                    annexCobertorColorId: val.colorId,
                    annexCobertorModelName: val.modelName,
                    annexCobertorModelCode: val.modelCode,
                    annexCobertorColorName: val.colorName,
                    annexCobertorManualOverride: val.manualOverride,
                    annexCobertorManualAmount: val.manualAmount,
                    annexCobertorCalcCost: val.calcCost ?? undefined,
                    annexCobertorCalcSale: val.calcSale ?? undefined,
                    annexCobertorCalcBreakdown: val.calcBreakdown,
                    annexCobertorMurNou: val.murNou,
                    annexCobertorMurM2: val.murM2,
                  })
                }
              />
            )}
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 5 — Projecte d'obra */}
        <AccordionItem value="projecte" className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <AccordionTrigger className="px-5 py-4 hover:no-underline">
            <SectionHeader
              icon={FileText}
              title="Projecte d'obra"
              estat={(draft.annexProjecteEstat as AnnexEstat) || "no"}
            />
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <EstatPills
              value={(draft.annexProjecteEstat as AnnexEstat) || "no"}
              onChange={(v) => updateDraft({ annexProjecteEstat: v })}
            />
            {draft.annexProjecteEstat && draft.annexProjecteEstat !== "no" && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                S'inclourà automàticament l'article{" "}
                <span className="font-medium text-foreground">PROJECTE D'OBRA</span> (quantitat: 1).
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 6 — Excavació */}
        <AccordionItem
          value="excavacio"
          className="bg-card rounded-xl border border-border shadow-card overflow-hidden"
        >
          <AccordionTrigger className="px-5 py-4 hover:no-underline">
            <SectionHeader icon={Shovel} title="Excavació" estat={(draft.annexExcavacioEstat as AnnexEstat) || "no"} />
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <EstatPills
              value={(draft.annexExcavacioEstat as AnnexEstat) || "no"}
              onChange={(v) => {
                updateDraft({ annexExcavacioEstat: v });
              }}
            />
            {draft.annexExcavacioEstat && draft.annexExcavacioEstat !== "no" && (
              <div className="space-y-4">
                {reomplimentCalc && manoObraExcavacio ? (
                  <div className="space-y-2">
                    {/* === Bloc 1 — Mà d'obra excavació === */}
                    <label className="block text-sm font-medium text-foreground">Mà d'obra excavació</label>
                    <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Títol del pill (PDF)</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                          placeholder="1.- EXCAVACIÓ"
                          value={draft.annexExcavacioPill1Title ?? ""}
                          onChange={(e) => updateDraft({ annexExcavacioPill1Title: e.target.value || undefined })}
                        />
                      </div>
                      <NumberInput
                        label="Import mà d'obra (€)"
                        value={draft.annexExcavacioManoObraOverride ?? Math.ceil(manoObraExcavacio.total)}
                        onChange={(v) => updateDraft({ annexExcavacioManoObraOverride: v })}
                        note={`Calculat: ${manoObraExcavacio.total.toFixed(2)} € · Quantitat: ${manoObraExcavacio.qty} · Preu unitari: 455 €`}
                      />
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Text descriptiu (PDF)</label>
                        <textarea
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                          placeholder="Excavació piscina, anivellament i transport de terres a l'abocador autoritzat, cànon inclòs."
                          value={draft.annexExcavacioText1 ?? ""}
                          onChange={(e) => updateDraft({ annexExcavacioText1: e.target.value || undefined })}
                        />
                      </div>
                      {draft.annexExcavacioManoObraOverride != null && (
                        <button
                          type="button"
                          className="text-[11px] text-primary hover:underline"
                          onClick={() => updateDraft({ annexExcavacioManoObraOverride: undefined })}
                        >
                          ↺ Restablir càlcul automàtic
                        </button>
                      )}
                    </div>

                    {/* === Bloc 2 — Re-ompliment de terres === */}
                    <label className="block text-sm font-medium text-foreground">Re-ompliment de terres</label>
                    <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Títol del pill (PDF)</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                          placeholder="2.- RE-OMPLIMENT PERIMETRAL DE TERRES"
                          value={draft.annexExcavacioPill2Title ?? ""}
                          onChange={(e) => updateDraft({ annexExcavacioPill2Title: e.target.value || undefined })}
                        />
                      </div>
                      <NumberInput
                        label="Import re-ompliment (€)"
                        value={draft.annexExcavacioReomplimentOverride ?? Math.ceil(reomplimentCalc.reompliment)}
                        onChange={(v) => updateDraft({ annexExcavacioReomplimentOverride: v })}
                        note={`Calculat: ${reomplimentCalc.reompliment.toFixed(2)} € · Sacs: ${reomplimentCalc.sacosBase} · Viatges: ${reomplimentCalc.viatgesNeeded}`}
                      />
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Text descriptiu (PDF)</label>
                        <textarea
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                          placeholder="Re-ompliment de forats laterals de la piscina amb graves després de la construcció del vas."
                          value={draft.annexExcavacioText2 ?? ""}
                          onChange={(e) => updateDraft({ annexExcavacioText2: e.target.value || undefined })}
                        />
                      </div>
                      {draft.annexExcavacioReomplimentOverride != null && (
                        <button
                          type="button"
                          className="text-[11px] text-primary hover:underline"
                          onClick={() => updateDraft({ annexExcavacioReomplimentOverride: undefined })}
                        >
                          ↺ Restablir càlcul automàtic
                        </button>
                      )}
                    </div>

                    {(() => {
                      const mo = draft.annexExcavacioManoObraOverride ?? Math.ceil(manoObraExcavacio.total);
                      const re = draft.annexExcavacioReomplimentOverride ?? Math.ceil(reomplimentCalc.reompliment);
                      return (
                        <div className="bg-muted/50 border border-border rounded-lg p-3">
                          <p className="text-sm font-semibold text-foreground">
                            Total excavació: {(mo + re).toFixed(2)} €
                          </p>
                          {draft.annexExcavacioEstat === "opcional" && (
                            <p className="text-[11px] text-warning mt-1">Opcional · informatiu, no suma al pressupost.</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <Info className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-warning">
                      Introdueix les dimensions de la piscina a l'Estructura per calcular l'excavació.
                    </p>
                  </div>
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 7 — Paviment perimetral */}
        <AccordionItem value="paviment" className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <AccordionTrigger className="px-5 py-4 hover:no-underline">
            <SectionHeader
              icon={Square}
              title="Paviment perimetral"
              estat={(draft.annexPavimentEstat as AnnexEstat) || "no"}
            />
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <EstatPills
              value={(draft.annexPavimentEstat as AnnexEstat) || "no"}
              onChange={(v) => {
                const patch: Record<string, unknown> = { annexPavimentEstat: v };
                // When user marks paviment as included for the first time, default "Paviment nou" to ON
                if (v === "inclos" && !draft.annexPavimentNouEnabled && !draft.annexPavimentReformaEnabled) {
                  patch.annexPavimentNouEnabled = true;
                  if (!draft.annexPavimentActuacio) {
                    patch.annexPavimentActuacio = "suministre_col";
                  }
                }
                // When switching to "opcional per al client" or "no s'inclou",
                // wipe all paviment data so nothing leaks into the financial summary.
                if (v === "opcional" || v === "no") {
                  Object.assign(patch, {
                    annexPavimentReformaEnabled: false,
                    annexPavimentNouEnabled: false,
                    annexPavimentRetiradaEnabled: false,
                    annexPavimentRetiradaM2: undefined,
                    annexPavimentRegularitzacioEnabled: false,
                    annexPavimentRegularitzacioM2: undefined,
                    annexPavimentActuacio: undefined,
                    annexPavimentFormigoEnabled: false,
                    annexPavimentFormigoM2: undefined,
                    annexPavimentMaterial: undefined,
                    annexPavimentTipus: undefined,
                    annexPavimentFormat: undefined,
                    annexPavimentM2: undefined,
                    annexPavimentModelId: undefined,
                    annexPavimentModelADeterminar: false,
                  });
                }
                updateDraft(patch);
              }}
            />
            {draft.annexPavimentEstat && draft.annexPavimentEstat !== "no" && (
              <div className="space-y-4">
                {/* Reforma de paviment existent */}
                <ToggleField
                  label="🔧 Reformar paviment existent"
                  enabled={draft.annexPavimentReformaEnabled || false}
                  onToggle={(v) => updateDraft({ annexPavimentReformaEnabled: v })}
                >
                  <div className="space-y-4">
                    <ToggleField
                      label="Retirada de ceràmica existent"
                      enabled={draft.annexPavimentRetiradaEnabled || false}
                      onToggle={(v) => {
                        // When user enables retirada, regularització becomes mandatory by law:
                        // auto-enable it and copy the m² so the user doesn't repeat data.
                        if (v) {
                          updateDraft({
                            annexPavimentRetiradaEnabled: true,
                            annexPavimentRegularitzacioEnabled: true,
                            annexPavimentRegularitzacioM2:
                              draft.annexPavimentRetiradaM2 ?? draft.annexPavimentRegularitzacioM2,
                          });
                        } else {
                          updateDraft({ annexPavimentRetiradaEnabled: false });
                        }
                      }}
                    >
                      <NumberInput
                        label="M² a retirar"
                        value={draft.annexPavimentRetiradaM2}
                        onChange={(v) =>
                          updateDraft({
                            annexPavimentRetiradaM2: v,
                            // Mirror m² into regularització (same surface by law)
                            annexPavimentRegularitzacioM2: v,
                            annexPavimentRegularitzacioEnabled: true,
                          })
                        }
                        placeholder="0"
                      />
                    </ToggleField>
                    <ToggleField
                      label="Regularització de llosa existent"
                      enabled={draft.annexPavimentRegularitzacioEnabled || false}
                      onToggle={(v) => updateDraft({ annexPavimentRegularitzacioEnabled: v })}
                    >
                      <NumberInput
                        label="M² a regularitzar"
                        value={draft.annexPavimentRegularitzacioM2}
                        onChange={(v) => updateDraft({ annexPavimentRegularitzacioM2: v })}
                        placeholder="0"
                      />
                    </ToggleField>
                  </div>
                </ToggleField>

                {/* Paviment nou (independent toggle, can coexist with reforma) */}
                <ToggleField
                  label="🔨 Paviment nou"
                  enabled={draft.annexPavimentNouEnabled || false}
                  onToggle={(v) => {
                    if (!v) {
                      setPavimentArticle(null);
                      updateDraft({
                        annexPavimentNouEnabled: false,
                        annexPavimentActuacio: undefined,
                        annexPavimentFormigoEnabled: false,
                        annexPavimentFormigoM2: undefined,
                        annexPavimentMaterial: undefined,
                        annexPavimentFormat: undefined,
                        annexPavimentM2: undefined,
                        annexPavimentModelId: undefined,
                        annexPavimentModelADeterminar: true,
                      });
                    } else {
                      updateDraft({ annexPavimentNouEnabled: true });
                    }
                  }}
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Actuació:</label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { value: "suministre_col", label: "Subministrament i col·locació" },
                          { value: "col", label: "Només col·locació" },
                          { value: "suministre", label: "Només subministrament" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateDraft({ annexPavimentActuacio: opt.value })}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                              draft.annexPavimentActuacio === opt.value
                                ? "bg-primary/15 text-primary border-primary/30"
                                : "bg-card text-muted-foreground border-border hover:bg-muted",
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <ToggleField
                      label="Inclou formigó de base"
                      enabled={draft.annexPavimentFormigoEnabled || false}
                      onToggle={(v) => updateDraft({ annexPavimentFormigoEnabled: v })}
                    >
                      <NumberInput
                        label="M² de formigó"
                        value={draft.annexPavimentFormigoM2}
                        onChange={(v) => updateDraft({ annexPavimentFormigoM2: v })}
                        placeholder="0"
                      />
                    </ToggleField>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Tipus de paviment:</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { value: "aplacat", label: "🪨 Aplacat (rajola)" },
                          { value: "fusta", label: "🌿 Fusta tecnològica" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              if (opt.value === "fusta") {
                                setPavimentArticle(null);
                                updateDraft({
                                  annexPavimentMaterial: opt.value,
                                  annexPavimentModelId: undefined,
                                  annexPavimentModelADeterminar: true,
                                });
                              } else {
                                updateDraft({ annexPavimentMaterial: opt.value });
                              }
                            }}
                            className={cn(
                              "p-4 rounded-xl border-2 text-sm font-medium text-center transition-all",
                              draft.annexPavimentMaterial === opt.value
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border bg-card text-muted-foreground hover:border-primary/30",
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {draft.annexPavimentMaterial === "aplacat" && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">Format:</label>
                          <div className="flex flex-wrap gap-1.5">
                            {["31 × 31 cm", "31 × 62 cm", "48 × 98 cm", "98 × 98 cm"].map((f) => (
                              <button
                                key={f}
                                type="button"
                                onClick={() => {
                                  // Changing format invalidates any previously chosen model
                                  // (each format has its own catalogue of articles + own placeholder).
                                  if (draft.annexPavimentFormat !== f) {
                                    setPavimentArticle(null);
                                    setPavimentSearchOpen(false);
                                    updateDraft({
                                      annexPavimentFormat: f,
                                      annexPavimentModelId: undefined,
                                      annexPavimentModelADeterminar: true,
                                    });
                                  }
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                  draft.annexPavimentFormat === f
                                    ? "bg-primary/15 text-primary border-primary/30"
                                    : "bg-card text-muted-foreground border-border hover:bg-muted",
                                )}
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>
                        <NumberInput
                          label="M² d'aplacat"
                          value={draft.annexPavimentM2}
                          onChange={(v) => updateDraft({ annexPavimentM2: v })}
                          placeholder="0"
                        />
                        {draft.annexPavimentFormat ? (
                          <>
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-muted-foreground">
                                Model de paviment ({draft.annexPavimentFormat})
                              </label>
                              {pavimentArticle && !pavimentSearchOpen ? (
                                <EquipmentSelector
                                  label=""
                                  categoryFilter="Porcelànic"
                                  formatFilter={
                                    draft.annexPavimentFormat === "31 × 31 cm" ? "31 x 31"
                                    : draft.annexPavimentFormat === "31 × 62 cm" ? "31 x 62"
                                    : draft.annexPavimentFormat === "48 × 98 cm" ? "49 x 98"
                                    : draft.annexPavimentFormat === "98 × 98 cm" ? "98 x 98"
                                    : undefined
                                  }
                                  excludeReferencePrefix="PAVIMENT_APLACAT_"
                                  value={pavimentArticle}
                                  onChange={(a) => {
                                    setPavimentArticle(a);
                                    updateDraft({
                                      annexPavimentModelId: a?.id || undefined,
                                      annexPavimentModelADeterminar: !a,
                                    });
                                  }}
                                  allowNone={false}
                                />
                              ) : !pavimentSearchOpen ? (
                                <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-primary/30 bg-primary/5">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">?</div>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-foreground">Model a determinar</p>
                                    <p className="text-xs text-muted-foreground">Es definirà posteriorment</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setPavimentSearchOpen(true)}
                                    className="text-xs text-primary font-medium hover:underline"
                                  >
                                    Canviar
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <EquipmentSelector
                                    label=""
                                    categoryFilter="Porcelànic"
                                    formatFilter={
                                      draft.annexPavimentFormat === "31 × 31 cm" ? "31 x 31"
                                      : draft.annexPavimentFormat === "31 × 62 cm" ? "31 x 62"
                                      : draft.annexPavimentFormat === "48 × 98 cm" ? "49 x 98"
                                      : draft.annexPavimentFormat === "98 × 98 cm" ? "98 x 98"
                                      : undefined
                                    }
                                    excludeReferencePrefix="PAVIMENT_APLACAT_"
                                    value={null}
                                    onChange={(a) => {
                                      setPavimentArticle(a);
                                      updateDraft({
                                        annexPavimentModelId: a?.id || undefined,
                                        annexPavimentModelADeterminar: !a,
                                      });
                                      setPavimentSearchOpen(false);
                                    }}
                                    allowNone={false}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setPavimentSearchOpen(false)}
                                    className="text-xs text-muted-foreground hover:text-foreground"
                                  >
                                    Cancel·lar i deixar “a determinar”
                                  </button>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Si no selecciones cap model, s'aplicarà el preu per defecte del format{' '}
                              <span className="font-medium">{draft.annexPavimentFormat}</span>.
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Selecciona un format per veure els models disponibles.
                          </p>
                        )}
                      </div>
                    )}
                    {draft.annexPavimentMaterial === "fusta" && (
                      <div className="space-y-4">
                        <NumberInput
                          label="M² de fusta tecnològica"
                          value={draft.annexPavimentM2}
                          onChange={(v) => updateDraft({ annexPavimentM2: v })}
                          placeholder="0"
                        />
                      </div>
                    )}
                  </div>
                </ToggleField>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 8 — Gespa artificial */}
        <AccordionItem value="gespa" className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <AccordionTrigger className="px-5 py-4 hover:no-underline">
            <SectionHeader icon={Leaf} title="Gespa artificial" estat={(draft.annexGespaEstat as AnnexEstat) || "no"} />
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <EstatPills
              value={(draft.annexGespaEstat as AnnexEstat) || "no"}
              onChange={(v) => updateDraft({ annexGespaEstat: v })}
            />
            {draft.annexGespaEstat && draft.annexGespaEstat !== "no" && (
              <div className="space-y-4">
                <ToggleField
                  label="Inclou preparació de terreny"
                  enabled={draft.annexGespaPreparacioEnabled || false}
                  onToggle={(v) => updateDraft({ annexGespaPreparacioEnabled: v })}
                >
                  <NumberInput
                    label="Import preparació de terreny (€)"
                    value={draft.annexGespaPreparacioM2}
                    onChange={(v) => updateDraft({ annexGespaPreparacioM2: v })}
                    placeholder="0,00"
                  />
                </ToggleField>
                <EquipmentSelector
                  label="Model de gespa"
                  categoryFilter="Varis"
                  subtipusFilter="Gespa"
                  value={gespaArticle}
                  onChange={(a) => {
                    setGespaArticle(a);
                    updateDraft({ annexGespaArticleId: a?.id || undefined, annexGespaModel: a?.name || undefined });
                  }}
                  noneLabel="A determinar"
                />
                <NumberInput
                  label="M² de gespa"
                  value={draft.annexGespaM2}
                  onChange={(v) => updateDraft({ annexGespaM2: v })}
                  placeholder="0"
                />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 9 — Entrada de material a mà */}
        <AccordionItem
          value="material-manual"
          className="bg-card rounded-xl border border-border shadow-card overflow-hidden"
        >
          <AccordionTrigger className="px-5 py-4 hover:no-underline">
            <div className="flex items-center gap-2 flex-1">
              <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-foreground">Entrada de material a mà</span>
              {draft.hasManualMaterialEntry && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">
                  INCLÒS
                </span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <ToggleField
              label="Entrada de material a mà"
              enabled={draft.hasManualMaterialEntry || false}
              onToggle={(v) => {
                if (v) {
                  updateDraft({ hasManualMaterialEntry: true });
                } else {
                  updateDraft({
                    hasManualMaterialEntry: false,
                    manualMaterialEntryCost: undefined,
                    manualMaterialEntrySale: undefined,
                  });
                }
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumberInput
                  label="Import de cost (€)"
                  value={draft.manualMaterialEntryCost}
                  onChange={(v) => updateDraft({ manualMaterialEntryCost: v })}
                />
                <NumberInput
                  label="Import de venda (€)"
                  value={draft.manualMaterialEntrySale}
                  onChange={(v) => updateDraft({ manualMaterialEntrySale: v })}
                />
              </div>
            </ToggleField>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={() => setStep(currentStep - 1)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Enrere
        </button>
        <button
          type="button"
          onClick={() => setStep(currentStep + 1)}
          className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md"
        >
          Següent <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
