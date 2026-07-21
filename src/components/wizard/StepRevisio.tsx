import { useBudgetStore, type BudgetDraft } from "@/stores/budgetStore";
import { ArrowLeft, FileDown, Save, Loader2, AlertTriangle, Mail, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { saveBudget } from "@/lib/budgetSave";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatEUR } from "@/lib/formatters";
import { buildInstallationLines } from "@/lib/wizardLines";
import { useQuery } from "@tanstack/react-query";
import { saveBlobWithPicker } from "@/lib/saveFile";
import { buildBudgetPdf } from "@/lib/budgetSave";
import { buildWizardLinesByPhase } from "@/lib/wizardLines";
import { evaluateFormulaRules, type FormulaRule } from "@/lib/formulaEngine";
import { mergeFormulaResultsIntoPhases, serializeBudgetPhases, filterAcabatsInclusion } from "@/lib/formulaPhases";
import { PaymentConditionsEditor } from "@/components/wizard/PaymentConditionsEditor";
import { useShowMargins } from "@/hooks/useShowMargins";
import { useMaintenanceKit } from "@/lib/maintenanceKit";
import { useMaintenanceMaterials } from "@/lib/maintenanceMaterials";
import {
  AUTOPORTANT_MODEL_LABELS,
  buildAutoportantPhases,
  mergeAutoportantPhases,
  type AutoportantModel,
  type CatalogArticle,
  type AutoportantPriceRow,
} from "@/lib/autoportantOptions";
import { AUTOPORTANT_PAYMENT_CONDITIONS, DEFAULT_OBRA_NUEVA_PAYMENT_CONDITIONS } from "@/lib/paymentConditions";

/** Build a PDF filename matching the format used by buildBudgetPdf:
 *  e.g. "AD030626-5- Iris Rodriguez Costoya (Granollers)". */
function buildPdfFilename(draft: BudgetDraft): string {
  const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const clean = (s?: string) =>
    s ? stripAccents(s).replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim() : "";
  const number = draft.budgetNumber || "";
  const name = clean(draft.clientName);
  const town = clean(draft.clientTown);
  const parts: string[] = [];
  if (number) parts.push(number);
  if (name) parts.push(` ${name}`);
  return (parts.join("-") + (town ? ` (${town})` : "")).trim() || "pressupost";
}

export function StepRevisio() {
  const { setStep, draft, getLastStep, updateDraft } = useBudgetStore();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [instalNames, setInstalNames] = useState<Record<string, string>>({});
  const [showMargins, , toggleMargins] = useShowMargins();
  const prevStep = getLastStep() - 1;
  const maintenanceKit = useMaintenanceKit(draft);

  // Maintenance plan calculations (mirror of StepServeis)
  const maintenanceCalc = (() => {
    const plan = draft.maintenancePlan;
    if (!plan) return null;
    const totalVisits = (plan.visitsPerMonth || []).reduce((a, b) => a + (b || 0), 0);
    const totalHours = totalVisits * (plan.visitDurationHours || 0);
    const totalLabour = totalHours * (plan.hourlyCost || 0);
    const totalParking = totalVisits * (plan.parkingCostPerVisit || 0);
    const vanCostPerHour = ((plan.vanMonthlyRenting || 0) * 12) / (40 * 48);
    const totalVan = totalHours * vanCostPerHour;
    const totalFuel = totalHours * (plan.fuelCostPerHour || 0);
    const grandTotal = totalLabour + totalParking + totalVan + totalFuel;
    return { totalVisits, totalHours, grandTotal };
  })();
  const maintenanceMaterials = useMaintenanceMaterials(draft, maintenanceCalc?.grandTotal || 0);

  // Default payment conditions to "Mensual" for maintenance budgets.
  useEffect(() => {
    if (draft.type === "mantenimiento" && !draft.paymentConditions) {
      updateDraft({ paymentConditions: "Mensual" });
    }
    if (draft.type === "piscina_autoportant" && !draft.paymentConditions) {
      updateDraft({ paymentConditions: AUTOPORTANT_PAYMENT_CONDITIONS });
    }
    // Leftover default from mantenimiento/autoportant after switching type
    // mid-wizard (e.g. StepTipus without a page reload).
    const isContaminated =
      draft.type !== "mantenimiento" &&
      draft.type !== "piscina_autoportant" &&
      (draft.paymentConditions === "Mensual" || draft.paymentConditions === AUTOPORTANT_PAYMENT_CONDITIONS);
    if ((draft.type === "obra_nueva" || draft.type === "rehabilitacion") && (!draft.paymentConditions || isContaminated)) {
      updateDraft({ paymentConditions: DEFAULT_OBRA_NUEVA_PAYMENT_CONDITIONS });
    } else if (isContaminated) {
      updateDraft({ paymentConditions: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.type]);

  // Fetch articles so we can recompute fontaneria/electrica totals live,
  // mirroring exactly what StepInstalacions and Step 8 (Partides) show.
  const { data: articles = [] } = useQuery({
    queryKey: ["articles-revisio"],
    queryFn: async () => {
      const { data } = await supabase.from("articles").select("id,name,unit,cost_price,sale_price,category");
      return data || [];
    },
  });
  const { data: autoportantPrices = [] } = useQuery<AutoportantPriceRow[]>({
    queryKey: ["autoportant-prices"],
    enabled: draft.type === "piscina_autoportant",
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("autoportant_prices").select("*");
      if (error) throw error;
      return (data || []) as AutoportantPriceRow[];
    },
  });
  const { data: autoportantTransportConfig } = useQuery({
    queryKey: ["autoportant-transport-config"],
    enabled: draft.type === "piscina_autoportant",
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("autoportant_transport_config").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data || null;
    },
  });
  const liveInstallLines = buildInstallationLines(draft, articles);
  const liveFontaneriaLine = liveInstallLines.find((l) => l.wizardKey === "instal_fontaneria");
  const liveElectricaLine = liveInstallLines.find((l) => l.wizardKey === "instal_electrica");
  const liveFontaneriaTotal = liveFontaneriaLine
    ? Math.ceil(liveFontaneriaLine.unitSale * liveFontaneriaLine.quantity)
    : (draft.instalFontaneriaTotal ?? 0);
  const liveElectricaTotal = liveElectricaLine
    ? Math.ceil(liveElectricaLine.unitSale * liveElectricaLine.quantity)
    : (draft.instalElectricaTotal ?? 0);

  /**
   * Recompute phases on demand using the same pipeline that runs while the
   * user navigates the wizard (formula engine + wizard lines merger). This
   * guarantees the PDF reflects the current toggles even if the user
   * jumped straight here from an edited draft without revisiting prior
   * steps and waiting for the debounced auto-sync.
   */
  const recomputeDraftPhases = async (current: typeof draft) => {
    if (current.type === "piscina_autoportant") {
      try {
        const { data: autoportantArticles } = await supabase
          .from("articles")
          .select("id, name, unit, cost_price, sale_price, category")
          .ilike("category", "Autoportant");
        const { data: tCfg } = await (supabase as any)
          .from("autoportant_transport_config").select("*").limit(1).maybeSingle();
        const next = buildAutoportantPhases(current, (autoportantArticles || []) as CatalogArticle[], autoportantPrices, tCfg || undefined);
        const mergedPhases = mergeAutoportantPhases(next, current.phases);
        if (serializeBudgetPhases(mergedPhases) === serializeBudgetPhases(current.phases || [])) {
          return current;
        }
        return { ...current, phases: mergedPhases };
      } catch (e) {
        console.error("[StepRevisio] recompute autoportant phases failed", e);
        return current;
      }
    }

    if (current.type !== "obra_nueva") return current;
    try {
      const [{ data: arts }, { data: rules }] = await Promise.all([
        supabase.from("articles").select("*"),
        supabase
          .from("formula_rules")
          .select("*")
          .eq("budget_type", "obra_nova")
          .eq("is_active", true)
          .order("phase")
          .order("order_index"),
      ]);
      const articleRows = (arts || []) as Parameters<typeof evaluateFormulaRules>[2];
      const rawResults = evaluateFormulaRules((rules || []) as FormulaRule[], current, articleRows);
      const results = filterAcabatsInclusion(rawResults, current);
      const wizardLines = buildWizardLinesByPhase(current, articleRows as Parameters<typeof buildWizardLinesByPhase>[1]);
      const mergedPhases = mergeFormulaResultsIntoPhases(results, current.phases, current, wizardLines);
      if (serializeBudgetPhases(mergedPhases) === serializeBudgetPhases(current.phases || [])) {
        return current;
      }
      return { ...current, phases: mergedPhases };
    } catch (e) {
      console.error("[StepRevisio] recomputeDraftPhases failed", e);
      return current;
    }
  };

  const typeLabels: Record<string, string> = {
    obra_nueva: "Obra Nova",
    rehabilitacion: "Rehabilitació",
    mantenimiento: "Manteniment",
    piscina_autoportant: "Piscina Autoportant",
  };

  // Load installation article names
  useEffect(() => {
    const ids = [
      draft.instalFiltrePoliesId,
      draft.instalFiltreEspecialId,
      draft.instalAfmArticleId,
      draft.instalCanviSorraArticleId,
      draft.instalBombaOnoffId,
      draft.instalBombaVariableId,
      draft.instalWifiArticleId,
      draft.instalDosificacioStdId,
      draft.instalHidrolisiId,
      draft.instalQuadreId,
      // Accessoris
      draft.accImpulsorsModelId,
      draft.accSkimmersModelId,
      draft.accEmbornalModelId,
      draft.accFocusLedModelId,
      draft.accReguladorModelId,
      draft.accNetejafonsModelId,
      draft.accEscalaModelId,
      draft.accDutxaModelId,
      draft.accCascadaModelId,
      draft.accSalvavidesModelId,
      // Annex
      draft.annexProjecteArticleId,
      draft.annexRobotArticleId,
      draft.annexBombaCalorArticleId,
      draft.annexPavimentModelId,
      draft.annexNetejafonsArticleId,
      draft.annexGespaArticleId,
      // Revestiment (principal i opcional alternatiu)
      draft.revestimentModelId,
      draft.opcionalRevestimentModelId,
    ].filter(Boolean) as string[];
    if (ids.length === 0) return;
    supabase
      .from("articles")
      .select("id, name")
      .in("id", ids)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        data?.forEach((a) => {
          map[a.id] = a.name;
        });
        setInstalNames(map);
      });
  }, [draft]);

  const getInstalName = (id?: string) => (id ? instalNames[id] || "Seleccionat" : "No s'inclou");

  const handleSave = async (status = "borrador") => {
    if (!user) {
      toast.error("No autenticat. Torna a iniciar sessió.");
      navigate("/login");
      return false;
    }
    setSaving(true);
    const freshDraft = await recomputeDraftPhases(draft);
    const { id, error } = await saveBudget(freshDraft, user.id, status);
    setSaving(false);
    if (error) {
      console.error("[StepRevisio] Save error:", error);
      toast.error(`Error en desar: ${error}`);
      return false;
    }
    if (id) updateDraft({ id, phases: freshDraft.phases });
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
    queryClient.invalidateQueries({ queryKey: ["budgets-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["budget-stats"] });
    return true;
  };

  const saveDraftForPdf = async (freshDraft: typeof draft) => {
    if (!user) throw new Error("No autenticat");
    const { id, error } = await saveBudget(freshDraft, user.id, "borrador");
    if (error) throw new Error(error);
    if (id) updateDraft({ id, phases: freshDraft.phases });
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
    queryClient.invalidateQueries({ queryKey: ["budgets-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["budget-stats"] });
  };

  const handleSaveDraft = async () => {
    const ok = await handleSave("borrador");
    if (ok) {
      toast.success("Pressupost desat correctament");
      navigate("/pressupostos");
    }
  };

  const handleGeneratePDF = async () => {
    if (!user) return;
    setGeneratingPdf(true);
    try {
      const fallback = buildPdfFilename(draft);
      // Picker FIRST so the user-gesture is still alive.
      await saveBlobWithPicker(async () => {
        let freshDraft = draft;
        try {
          freshDraft = await recomputeDraftPhases(draft);
        } catch (e) {
          console.warn("[StepRevisio] recompute failed, using current draft", e);
        }
        try {
          await saveDraftForPdf(freshDraft);
        } catch (e) {
          // Don't block PDF generation if the persist step fails (e.g. RLS edge cases on iOS).
          console.warn("[StepRevisio] saveDraftForPdf failed, continuing with PDF only", e);
        }
        const { blob } = await buildBudgetPdf(freshDraft);
        return blob;
      }, `${fallback}.pdf`);
      toast.success("PDF generat correctament");
    } catch (err) {
      console.error("[StepRevisio] PDF error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error generant el PDF: ${msg}`);
    }
    setGeneratingPdf(false);
  };

  const handleSendToClient = async () => {
    if (!user) {
      toast.error("No autenticat. Torna a iniciar sessió.");
      return;
    }
    if (!draft.clientEmail) {
      toast.error("El client no té email registrat. Edita les dades del client per afegir-lo.");
      return;
    }
    setSendingEmail(true);
    try {
      // 1. Save and generate PDF first so the salesperson can attach it.
      //    Picker FIRST so the user-gesture is still alive.
      try {
        const fallback = buildPdfFilename(draft);
        await saveBlobWithPicker(async () => {
          let freshDraft = draft;
          try {
            freshDraft = await recomputeDraftPhases(draft);
          } catch (e) {
            console.warn("[StepRevisio] recompute failed (send), using current draft", e);
          }
          try {
            await saveDraftForPdf(freshDraft);
          } catch (e) {
            console.warn("[StepRevisio] saveDraftForPdf failed (send), continuing with PDF only", e);
          }
          const { blob } = await buildBudgetPdf(freshDraft);
          return blob;
        }, `${fallback}.pdf`);
      } catch (err) {
        console.error("[StepRevisio] PDF error before email:", err);
        toast.error("Error generant el PDF. Continuem obrint el correu igualment.");
      }

      // 2. Build mailto with subject + body in Catalan
      const tipusLabel = draft.type ? typeLabels[draft.type] : "piscina";
      const referencia = draft.budgetNumber || "";
      const fullClientName = draft.clientName || "client";
      const firstName = fullClientName.trim().split(/\s+/)[0] || fullClientName;
      void (profile?.full_name || "l'equip d'Aquablau");
      const isMaintenance = draft.type === "mantenimiento";

      const subject = isMaintenance
        ? `Pressupost de manteniment anual de la seva piscina${referencia ? ` · Ref. ${referencia}` : ""}`
        : `Pressupost ${tipusLabel}${referencia ? ` · Ref. ${referencia}` : ""} per a la Construcció de la nova Piscina`;

      const bodyLines = isMaintenance
        ? [
            `Bon dia ${firstName},`,
            "",
            `Tal com ens vau sol·licitar, els adjuntem el pressupost corresponent al manteniment anual de la vostra piscina${referencia ? ` (referència ${referencia})` : ""}.`,
            "",
            "Trobareu el document PDF adjunt amb el detall complet del servei, visites previstes, materials i condicions. Si teniu qualsevol dubte o voleu concertar una visita per comentar-lo personalment, restem a la vostra disposició.",
            "",
            "Aprofitem per agrair-vos la confiança dipositada en Piscines Aquablau.",
            "",
            "Ben cordialment,",
          ]
        : [
            `Bon dia ${firstName},`,
            "",
            `Tal com ens vau sol·licitar, els adjuntem el pressupost corresponent a la ${tipusLabel.toLowerCase()} de la vostra piscina${referencia ? ` (referència ${referencia})` : ""}.`,
            "",
            "Trobareu el document PDF adjunt amb el detall complet de partides, materials i condicions. Si teniu qualsevol dubte o voleu concertar una visita per comentar-lo personalment, restem a la vostra disposició.",
            "",
            "Aprofitem per agrair-vos la confiança dipositada en Piscines Aquablau.",
            "",
            "Ben cordialment,",
          ];
      const body = bodyLines.join("\r\n");

      const mailto = `mailto:${encodeURIComponent(draft.clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      // 3. Mark as sent in DB
      await handleSave("enviat");
      queryClient.invalidateQueries({ queryKey: ["budgets"] });

      // 4. Open mail client
      window.location.href = mailto;

      toast.success("PDF descarregat. Adjunta'l al correu que s'acaba d'obrir.");
    } catch (err) {
      console.error("[StepRevisio] Send to client error:", err);
      toast.error("Error preparant el correu");
    } finally {
      setSendingEmail(false);
    }
  };

  // Calculations
  const reviewPhases =
    draft.type === "piscina_autoportant"
      ? mergeAutoportantPhases(buildAutoportantPhases(draft, articles as CatalogArticle[], autoportantPrices, autoportantTransportConfig || undefined), draft.phases)
      : draft.phases;
  const totalCost = reviewPhases?.reduce((s, ph) => s + ph.items.reduce((ss, it) => ss + it.quantity * it.unitCost, 0), 0) || 0;
  const totalSaleBase = reviewPhases?.reduce((s, ph) => s + ph.items.reduce((ss, it) => ss + Math.ceil(it.quantity * it.unitSale), 0), 0) || 0;
  const adjustmentPct = draft.marginPctAdjustment || 0;
  const totalSale = totalSaleBase * (1 + adjustmentPct / 100);
  // Margen sobre coste — coherente con StepPartides y BudgetList
  const margin = totalSale > 0 ? ((totalSale - totalCost) / totalSale) * 100 : 0;
  const depthAvg = draft.poolDepthMin && draft.poolDepthMax ? (draft.poolDepthMin + draft.poolDepthMax) / 2 : 0;
  const volume =
    draft.poolLength && draft.poolWidth && depthAvg
      ? Math.round(draft.poolLength * draft.poolWidth * depthAvg * 1000)
      : 0;
  const surface =
    draft.poolLength && draft.poolWidth && depthAvg
      ? draft.poolLength * draft.poolWidth + 2 * (draft.poolLength * depthAvg) + 2 * (draft.poolWidth * depthAvg)
      : 0;
  const finishLabel = (key?: string) => {
    if (!key) return "-";
    const raw = key.split("_").slice(2).join("_") || key;
    return raw.replace(/_/g, " ").toUpperCase();
  };
  const morterLabel = draft.autoportantMorterColor
    ? draft.autoportantMorterColor.charAt(0).toUpperCase() + draft.autoportantMorterColor.slice(1)
    : "-";
  const autoportantOpcItems =
    reviewPhases
      ?.find((phase) => phase.name.toLowerCase().includes("opcional"))
      ?.items.filter((item) => String(item.wizardKey || "").startsWith("autoportant_opc_")) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Revisió i Generació de PDF</h2>
          <p className="text-sm text-muted-foreground mt-1">Revisa totes les dades abans de generar el document</p>
        </div>
        <button
          type="button"
          onClick={toggleMargins}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors min-h-[40px] flex-shrink-0',
            showMargins
              ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
              : 'border-border bg-muted text-muted-foreground hover:bg-muted/80',
          )}
          title={showMargins ? 'Ocultar costos i marges' : 'Mostrar costos i marges'}
        >
          {showMargins ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {showMargins ? 'Marges visibles' : 'Marges ocults'}
        </button>
      </div>

      {/* NIF warning */}
      {!draft.clientNif && (
        <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/20 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-sm text-warning">
            El NIF del client no s'ha introduït. Recorda'l per formalitzar el contracte.
          </p>
        </div>
      )}

      {/* Client summary */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-3">
        <h3 className="font-semibold text-foreground">Dades del Client</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Client:</span>{" "}
            <span className="font-medium text-foreground">{draft.clientName || "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">NIF:</span>{" "}
            <span className="font-medium text-foreground">{draft.clientNif || "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Municipi:</span>{" "}
            <span className="font-medium text-foreground">{draft.clientTown || "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Telèfon:</span>{" "}
            <span className="font-medium text-foreground">{draft.clientPhone || "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Email:</span>{" "}
            <span className="font-medium text-foreground">{draft.clientEmail || "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Tipus:</span>{" "}
            <span className="font-medium text-foreground">{draft.type ? typeLabels[draft.type] : "-"}</span>
          </div>
        </div>
      </div>

      {/* Pool characteristics */}
      {draft.type !== "mantenimiento" && draft.type !== "piscina_autoportant" && Boolean(draft.poolLength || draft.poolWidth) && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-3">
          <h3 className="font-semibold text-foreground">Característiques de la Piscina</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {draft.poolLength && (
              <div>
                <span className="text-muted-foreground">Llarg:</span>{" "}
                <span className="font-medium text-foreground">{draft.poolLength} m</span>
              </div>
            )}
            {draft.poolWidth && (
              <div>
                <span className="text-muted-foreground">Ample:</span>{" "}
                <span className="font-medium text-foreground">{draft.poolWidth} m</span>
              </div>
            )}
            {depthAvg > 0 && (
              <div>
                <span className="text-muted-foreground">Prof. mitjana:</span>{" "}
                <span className="font-medium text-foreground">{depthAvg.toFixed(2)} m</span>
              </div>
            )}
            {volume > 0 && (
              <div>
                <span className="text-muted-foreground">Capacitat:</span>{" "}
                <span className="font-medium text-foreground">{volume.toLocaleString("ca-ES")} L</span>
              </div>
            )}
            {surface > 0 && (
              <div>
                <span className="text-muted-foreground">Superfície:</span>{" "}
                <span className="font-medium text-foreground">{surface.toFixed(2)} m²</span>
              </div>
            )}
            {draft.constructionSystem && (
              <div>
                <span className="text-muted-foreground">Sistema:</span>{" "}
                <span className="font-medium text-foreground">
                  {draft.constructionSystem === "gunite" ? "Gunite" : "Bloc Encofrat"}
                </span>
              </div>
            )}
            {draft.waterproofingSystem && (
              <div>
                <span className="text-muted-foreground">Impermeab.:</span>{" "}
                <span className="font-medium text-foreground">{draft.waterproofingSystem}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Autoportant summary */}
      {draft.type === "piscina_autoportant" && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-4">
          <h3 className="font-semibold text-foreground">Piscina Autoportant</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Tipus:</span>{" "}
              <span className="font-medium text-foreground">
                {draft.autoportantModel ? AUTOPORTANT_MODEL_LABELS[draft.autoportantModel as AutoportantModel] : "-"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Ample:</span>{" "}
              <span className="font-medium text-foreground">{draft.autoportantAmple || "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Llarg:</span>{" "}
              <span className="font-medium text-foreground">{draft.autoportantLlarg || "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Altura aigua:</span>{" "}
              <span className="font-medium text-foreground">{draft.autoportantAlturaAigua || "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Coronació:</span>{" "}
              <span className="font-medium text-foreground">{finishLabel(draft.autoportantCoronaKey)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Rev. interior:</span>{" "}
              <span className="font-medium text-foreground">{finishLabel(draft.autoportantRevestimentKey)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Rev. exterior:</span>{" "}
              <span className="font-medium text-foreground">
                {draft.autoportantModel === "line_confort" ? morterLabel : "Igual que coronació"}
              </span>
            </div>
          </div>
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-sm font-medium text-primary">Opcionals inclosos</p>
            {autoportantOpcItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {autoportantOpcItems.map((item) => (
                  <div key={item.wizardKey || item.id}>
                    <span className="text-muted-foreground">{item.description}:</span>{" "}
                    <span className="font-medium text-foreground">
                      ×{item.quantity} {item.unit} · {formatEUR(Math.ceil(item.quantity * item.unitSale))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Cap opcional inclòs</p>
            )}
          </div>
        </div>
      )}

      {/* Maintenance kit summary */}
      {draft.type === "mantenimiento" && maintenanceKit.items.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Kit de neteja (informatiu)</h3>
            <span className="text-lg font-bold text-primary">{formatEUR(maintenanceKit.total)}</span>
          </div>
          <ul className="space-y-1 text-sm">
            {maintenanceKit.items.map((it) => (
              <li key={it.name} className="flex justify-between text-foreground">
                <span className="text-muted-foreground">{it.name}</span>
                <span className="font-medium tabular-nums">{formatEUR(it.unitSale)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground italic">
            Aquest import no se suma al total del pressupost; és informatiu per al client.
          </p>
        </div>
      )}

      {/* Maintenance — Pool data summary */}
      {draft.type === "mantenimiento" && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-3">
          <h3 className="font-semibold text-foreground">Dades de la Piscina</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Tipus:</span>{" "}
              <span className="font-medium text-foreground capitalize">{draft.poolType || "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Llarg:</span>{" "}
              <span className="font-medium text-foreground">{draft.poolLength ? `${draft.poolLength} m` : "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Ample:</span>{" "}
              <span className="font-medium text-foreground">{draft.poolWidth ? `${draft.poolWidth} m` : "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Prof. mitjana:</span>{" "}
              <span className="font-medium text-foreground">{draft.poolDepthAvg ? `${draft.poolDepthAvg} m` : "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Volum estimat:</span>{" "}
              <span className="font-medium text-foreground">
                {draft.poolLength && draft.poolWidth && draft.poolDepthAvg
                  ? `${Math.ceil(draft.poolLength * draft.poolWidth * draft.poolDepthAvg)} m³`
                  : "-"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Electròlisi:</span>{" "}
              <span className="font-medium text-foreground">{draft.hasElectrolisi ? "Sí" : "No"}</span>
            </div>
            {draft.kitMangueraSize && (
              <div>
                <span className="text-muted-foreground">Mànega:</span>{" "}
                <span className="font-medium text-foreground">{draft.kitMangueraSize} m</span>
              </div>
            )}
            {draft.kitPertigaSize && (
              <div>
                <span className="text-muted-foreground">Pèrtiga:</span>{" "}
                <span className="font-medium text-foreground capitalize">{draft.kitPertigaSize}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Maintenance — Plan totals */}
      {draft.type === "mantenimiento" && maintenanceCalc && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-3">
          <h3 className="font-semibold text-foreground">Pla de Manteniment</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Visites/any:</span>{" "}
              <span className="font-medium text-foreground">{maintenanceCalc.totalVisits}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Hores/any:</span>{" "}
              <span className="font-medium text-foreground">{maintenanceCalc.totalHours.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Cost operatiu:</span>{" "}
              <span className="font-medium text-foreground">{formatEUR(maintenanceCalc.grandTotal)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Subtotal materials:</span>{" "}
              <span className="font-medium text-foreground">{formatEUR(maintenanceMaterials.subtotal)}</span>
            </div>
          </div>
          <div className="border-t border-border pt-3 grid grid-cols-2 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Total anual</div>
              <div className="text-xl font-bold text-primary">{formatEUR(maintenanceMaterials.totalAnual, { round: 'none' })}</div>
            </div>
            <div className="rounded-lg border border-primary/30 p-3 bg-primary/5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Total mensual</div>
              <div className="text-xl font-bold text-primary">{formatEUR(maintenanceMaterials.totalMensual, { round: 'none' })}</div>
            </div>
          </div>
        </div>
      )}

      {/* Acabats summary */}
      {draft.type === "obra_nueva" && (draft.coronamentTipus || draft.revestimentTipus) && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-4">
          <h3 className="font-semibold text-foreground">Acabats</h3>
          {draft.coronamentTipus && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-primary">Coronament</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipus:</span>{" "}
                  <span className="font-medium text-foreground">
                    {draft.coronamentTipus?.replace(/_/g, " ").toUpperCase()}
                  </span>
                  {draft.coronamentFormat && (
                    <span className="text-xs text-muted-foreground ml-1">({draft.coronamentFormat})</span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground">Actuació:</span>{" "}
                  <span className="font-medium text-foreground">
                    {draft.coronamentActuacio === "suministre_col"
                      ? "Subm. i col·locació"
                      : draft.coronamentActuacio === "suministre"
                        ? "Només subm."
                        : "Només col·locació"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Model:</span>{" "}
                  <span className="font-medium text-foreground">
                    {draft.coronamentModelADeterminar ? "A determinar" : draft.coronamentModelId ? "Seleccionat" : "-"}
                  </span>
                </div>
                {draft.coronamentMl ? (
                  <div>
                    <span className="text-muted-foreground">ML:</span>{" "}
                    <span className="font-medium text-foreground">{draft.coronamentMl?.toFixed(2)} ml</span>
                  </div>
                ) : null}
                {draft.coronamentBeurada && (
                  <div>
                    <span className="text-muted-foreground">Beurada:</span>{" "}
                    <span className="font-medium text-foreground">
                      {draft.coronamentBeurada === "normal" ? "Normal" : "Epoxi"}
                      {draft.coronamentBeuradaColor ? ` · ${draft.coronamentBeuradaColor}` : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          {draft.revestimentTipus && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-primary">Revestiment</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipus:</span>{" "}
                  <span className="font-medium text-foreground">
                    {draft.revestimentTipus === "gressite" ? "Gressite" : "Porcelànic"} {draft.revestimentFormat}
                    {draft.revestimentQualitat ? ` ${draft.revestimentQualitat}` : ""}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Actuació:</span>{" "}
                  <span className="font-medium text-foreground">
                    {draft.revestimentActuacio === "suministre_col"
                      ? "Subm. i col·locació"
                      : draft.revestimentActuacio === "suministre"
                        ? "Només subm."
                        : "Només col·locació"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Model:</span>{" "}
                  <span className="font-medium text-foreground">
                    {draft.revestimentModelADeterminar
                      ? "A determinar"
                      : draft.revestimentModelId
                        ? (instalNames[draft.revestimentModelId] || "Seleccionat")
                        : "-"}
                  </span>
                </div>
                {draft.revestimentBeurada && (
                  <div>
                    <span className="text-muted-foreground">Beurada:</span>{" "}
                    <span className="font-medium text-foreground">
                      {draft.revestimentBeurada === "normal" ? "Normal" : "Epoxi"}
                      {draft.revestimentBeuradaColor ? ` · ${draft.revestimentBeuradaColor}` : ""}
                    </span>
                  </div>
                )}
                {draft.revestimentMigCanya && (
                  <div>
                    <span className="text-muted-foreground">Peces:</span>{" "}
                    <span className="font-medium text-foreground">Mitja canya inclosa</span>
                  </div>
                )}
                {draft.revestimentPecesEspecials && (
                  <div>
                    <span className="text-muted-foreground">Peces esp.:</span>{" "}
                    <span className="font-medium text-foreground">Incloses</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {draft.opcionalRevestimentTipus && (
            <div className="space-y-2 border-t border-dashed border-border pt-3">
              <p className="text-xs font-medium text-warning">── Opcional alternatiu ──</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipus:</span>{" "}
                  <span className="font-medium text-foreground">
                    {draft.opcionalRevestimentTipus === "gressite" ? "Gressite" : "Porcelànic"}{" "}
                    {draft.opcionalRevestimentFormat}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Model:</span>{" "}
                  <span className="font-medium text-foreground">
                    {draft.opcionalRevestimentModelId
                      ? (instalNames[draft.opcionalRevestimentModelId] || "Seleccionat")
                      : "A determinar"}
                  </span>
                </div>
                {draft.opcionalRevestimentBeurada && (
                  <div>
                    <span className="text-muted-foreground">Beurada:</span>{" "}
                    <span className="font-medium text-foreground">
                      {draft.opcionalRevestimentBeurada === "normal" ? "Normal" : "Epoxi"}
                      {draft.opcionalRevestimentBeuradaColor ? ` · ${draft.opcionalRevestimentBeuradaColor}` : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instal·lacions summary */}
      {draft.type === "obra_nueva" &&
        (draft.instalFiltrePoliesId ||
          draft.instalFiltreEspecialId ||
          draft.instalBombaOnoffId ||
          draft.instalBombaVariableId ||
          draft.instalDosificacioStdId ||
          draft.instalHidrolisiId ||
          draft.instalQuadreId) && (
          <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-4">
            <h3 className="font-semibold text-foreground">Instal·lacions</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-primary">Depuració</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Filtre fibra:</span>{" "}
                    <span className="font-medium text-foreground">
                      {getInstalName(draft.instalFiltrePoliesId)}
                      {(draft.instalFiltrePoliesQty || 1) > 1 ? ` (×${draft.instalFiltrePoliesQty})` : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Filtre especial:</span>{" "}
                    <span className="font-medium text-foreground">
                      {getInstalName(draft.instalFiltreEspecialId)}
                      {(draft.instalFiltreEspecialQty || 1) > 1 ? ` (×${draft.instalFiltreEspecialQty})` : ""}
                    </span>
                    {draft.instalFiltreEspecialOpcional && draft.instalFiltreEspecialId && (
                      <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        Opcional
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">AFM:</span>{" "}
                    <span className="font-medium text-foreground">
                      {draft.instalAfmEnabled ? getInstalName(draft.instalAfmArticleId) : "No"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Canvi sorra/vidre:</span>{" "}
                    <span className="font-medium text-foreground">
                      {draft.instalCanviSorraEnabled ? getInstalName(draft.instalCanviSorraArticleId) : "No"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-primary">Bomba</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">On/Off:</span>{" "}
                    <span className="font-medium text-foreground">
                      {getInstalName(draft.instalBombaOnoffId)}
                      {(draft.instalBombaOnoffQty || 1) > 1 ? ` (×${draft.instalBombaOnoffQty})` : ""}
                    </span>
                    {draft.instalBombaOnoffOpcional && draft.instalBombaOnoffId && (
                      <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        Opcional
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vel. variable:</span>{" "}
                    <span className="font-medium text-foreground">
                      {getInstalName(draft.instalBombaVariableId)}
                      {(draft.instalBombaVariableQty || 1) > 1 ? ` (×${draft.instalBombaVariableQty})` : ""}
                    </span>
                    {draft.instalBombaVariableOpcional && draft.instalBombaVariableId && (
                      <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        Opcional
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-primary">Dosificació</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Estàndard:</span>{" "}
                    <span className="font-medium text-foreground">
                      {getInstalName(draft.instalDosificacioStdId)}
                      {(draft.instalDosificacioStdQty || 1) > 1 ? ` (×${draft.instalDosificacioStdQty})` : ""}
                    </span>
                    {draft.instalDosificacioStdOpcional && draft.instalDosificacioStdId && (
                      <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        Opcional
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Hidròlisi / UV:</span>{" "}
                    <span className="font-medium text-foreground">
                      {getInstalName(draft.instalHidrolisiId)}
                      {(draft.instalHidrolisiQty || 1) > 1 ? ` (×${draft.instalHidrolisiQty})` : ""}
                    </span>
                    {draft.instalHidrolisiOpcional && draft.instalHidrolisiId && (
                      <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        Opcional
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mòdul Wi-Fi:</span>{" "}
                    <span className="font-medium text-foreground">
                      {draft.instalWifiEnabled ? getInstalName(draft.instalWifiArticleId) : "No"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Quadre elèctric:</span>{" "}
                <span className="font-medium text-foreground">{getInstalName(draft.instalQuadreId)}</span>
                <span className="ml-2 text-muted-foreground">·</span>
                <span className="ml-2 text-muted-foreground">Línia:</span>{" "}
                <span className="font-medium text-foreground">
                  {(draft.instalQuadreLinia ?? "monofasica") === "trifasica" ? "Trifàsica" : "Monofàsica"}
                </span>
              </div>
              {/* Fontaneria */}
              {(draft.instalFontaneriaEnabled ?? true) && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-primary">Fontaneria</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total:</span>{" "}
                      <span className="font-medium text-foreground">{liveFontaneriaTotal.toFixed(2)} €</span>
                    </div>
                  </div>
                  {draft.instalFontaneriaText && (
                    <p className="text-xs text-muted-foreground mt-1">{draft.instalFontaneriaText}</p>
                  )}
                </div>
              )}
              {/* Elèctrica */}
              {(draft.instalElectricaEnabled ?? true) && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-primary">Instal·lació elèctrica</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total:</span>{" "}
                      <span className="font-medium text-foreground">{liveElectricaTotal.toFixed(2)} €</span>
                    </div>
                  </div>
                  {draft.instalElectricaText && (
                    <p className="text-xs text-muted-foreground mt-1">{draft.instalElectricaText}</p>
                  )}
                </div>
              )}
              {/* Caseta */}
              {(draft.instalCasetaEnabled ?? true) && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-primary">Caseta de depuració</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Ubicació:</span>{" "}
                      <span className="font-medium text-foreground">
                        {draft.instalCasetaUbicacio === "garatge"
                          ? "Garatge o espai cobert"
                          : draft.instalCasetaUbicacio === "exterior"
                            ? "Espai exterior / nova caseta"
                            : "A determinar"}
                      </span>
                    </div>
                    {draft.instalCasetaObservacions && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Obs.:</span>{" "}
                        <span className="font-medium text-foreground">{draft.instalCasetaObservacions}</span>
                      </div>
                    )}
                  </div>
                  {draft.instalFontaneriaCasetaTipus === "caseta_obra" && draft.instalCasetaObraPortes && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Portes caseta d'obra:{" "}
                      <span className="font-medium text-foreground">
                        {draft.instalCasetaObraPortes === "frontal"
                          ? "Només porta frontal"
                          : draft.instalCasetaObraPortes === "frontal_superior"
                            ? "Porta frontal i superior"
                            : draft.instalCasetaObraPortes === "sense_portes"
                              ? "Sense portes"
                              : draft.instalCasetaObraPortes}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      {/* Accessoris summary */}
      {draft.type === "obra_nueva" && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-4">
          <h3 className="font-semibold text-foreground">Accessoris</h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-primary">Accessoris bàsics</p>
                <span
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full font-medium",
                    (draft.accBasicsColor ?? "blanc") === "color"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-muted text-foreground",
                  )}
                >
                  {(draft.accBasicsColor ?? "blanc") === "color" ? "De color" : "Blancs"}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                {[
                  { label: "Impulsors", qty: draft.accImpulsorsQty, modelId: draft.accImpulsorsModelId },
                  { label: "Skimmers", qty: draft.accSkimmersQty, modelId: draft.accSkimmersModelId },
                  { label: "Embornal", qty: draft.accEmbornalQty, modelId: draft.accEmbornalModelId },
                  { label: "Focus LED", qty: draft.accFocusLedQty, modelId: draft.accFocusLedModelId },
                  { label: "Regulador", qty: draft.accReguladorQty, modelId: draft.accReguladorModelId },
                  { label: "Netejafons", qty: draft.accNetejafonsQty, modelId: draft.accNetejafonsModelId },
                ]
                  .filter((a) => (a.qty || 0) > 0)
                  .map((a) => (
                    <div key={a.label}>
                      <span className="text-muted-foreground">{a.label}:</span>{" "}
                      <span className="font-medium text-foreground">
                        ×{a.qty} · {a.modelId ? instalNames[a.modelId] || "Seleccionat" : "A determinar"}
                      </span>
                    </div>
                  ))}
              </div>
              {draft.accFocusLedText && (draft.accFocusLedQty || 0) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">LED: {draft.accFocusLedText}</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-primary">Accessoris opcionals</p>
              {(() => {
                const opts = [
                  {
                    label: "Escala inox",
                    enabled: draft.accEscalaEnabled,
                    qty: draft.accEscalaQty,
                    modelId: draft.accEscalaModelId,
                  },
                  {
                    label: "Dutxa exterior",
                    enabled: draft.accDutxaEnabled,
                    qty: draft.accDutxaQty,
                    modelId: draft.accDutxaModelId,
                  },
                  {
                    label: "Plat de dutxa",
                    enabled: draft.accPlatDutxaEnabled,
                    qty: draft.accPlatDutxaQty,
                    modelId: null,
                    fixedPrice: 550,
                  },
                  {
                    label: "Cascada",
                    enabled: draft.accCascadaEnabled,
                    qty: draft.accCascadaQty,
                    modelId: draft.accCascadaModelId,
                  },
                  {
                    label: "Salvavides",
                    enabled: draft.accSalvavidesEnabled,
                    qty: draft.accSalvavidesQty,
                    modelId: draft.accSalvavidesModelId,
                  },
                ].filter((a) => a.enabled);
                if (opts.length === 0)
                  return <p className="text-sm text-muted-foreground">Cap accessori opcional inclòs</p>;
                return (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    {opts.map((a) => (
                      <div key={a.label}>
                        <span className="text-muted-foreground">{a.label}:</span>{" "}
                        <span className="font-medium text-foreground">
                          ×{a.qty || 1} ·{" "}
                          {a.fixedPrice
                            ? `${a.fixedPrice.toFixed(2)} €`
                            : a.modelId
                              ? instalNames[a.modelId] || "Seleccionat"
                              : "A determinar"}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Annex summary */}
      {draft.type === "obra_nueva" &&
        (() => {
          // Build a rich content string for "Paviment perimetral" using the current schema
          // (toggles annexPavimentReformaEnabled / annexPavimentNouEnabled, material, format,
          // m², model name) instead of the old single annexPavimentTipus field.
          const pavimentParts: string[] = [];
          if (draft.annexPavimentReformaEnabled) {
            const reformaBits: string[] = [];
            if (draft.annexPavimentRetiradaEnabled && draft.annexPavimentRetiradaM2) {
              reformaBits.push(`retirada ceràmica ${draft.annexPavimentRetiradaM2} m²`);
            }
            if (draft.annexPavimentRegularitzacioEnabled && draft.annexPavimentRegularitzacioM2) {
              reformaBits.push(`regularització llosa ${draft.annexPavimentRegularitzacioM2} m²`);
            }
            pavimentParts.push("Reforma existent" + (reformaBits.length ? ` (${reformaBits.join(", ")})` : ""));
          }
          if (draft.annexPavimentNouEnabled) {
            const nouBits: string[] = [];
            if (draft.annexPavimentMaterial) {
              nouBits.push(draft.annexPavimentMaterial === "aplacat" ? "Aplacat" : "Fusta");
            }
            if (draft.annexPavimentFormat) nouBits.push(draft.annexPavimentFormat);
            if (draft.annexPavimentM2) nouBits.push(`${draft.annexPavimentM2} m²`);
            const modelLabel = draft.annexPavimentModelADeterminar
              ? "model a determinar"
              : draft.annexPavimentModelId
                ? `model: ${getInstalName(draft.annexPavimentModelId)}`
                : null;
            if (modelLabel) nouBits.push(modelLabel);
            if (draft.annexPavimentFormigoEnabled && draft.annexPavimentFormigoM2) {
              nouBits.push(`base formigó ${draft.annexPavimentFormigoM2} m²`);
            }
            pavimentParts.push("Paviment nou" + (nouBits.length ? ` · ${nouBits.join(" · ")}` : ""));
          }
          const pavimentContent = pavimentParts.length ? pavimentParts.join(" | ") : null;

          const annexSections = [
            {
              key: "projecte",
              label: "Projecte d'obra",
              estat: draft.annexProjecteEstat,
              content: draft.annexProjecteArticleId
                ? `${getInstalName(draft.annexProjecteArticleId)} · ×${draft.annexProjecteQty || 1}`
                : null,
            },
            {
              key: "excavacio",
              label: "Excavació",
              estat: draft.annexExcavacioEstat,
              content:
                draft.annexExcavacioImport || draft.annexExcavacioReompliment
                  ? `Excavació: ${(draft.annexExcavacioImport || 0).toFixed(2)}€ · Reompliment: ${(draft.annexExcavacioReompliment || 0).toFixed(2)}€`
                  : null,
            },
            {
              key: "paviment",
              label: "Paviment perimetral",
              estat: draft.annexPavimentEstat,
              content: pavimentContent,
            },
            {
              key: "gespa",
              label: "Gespa artificial",
              estat: draft.annexGespaEstat,
              content: draft.annexGespaM2
                ? `${draft.annexGespaArticleId ? getInstalName(draft.annexGespaArticleId) : draft.annexGespaModel || "-"} · ${draft.annexGespaM2} m²`
                : null,
            },
            {
              key: "cobertor",
              label: "Cobertor",
              estat: draft.annexCobertorEstat,
              content: draft.annexCobertorModelId
                ? [
                    draft.annexCobertorTipus === 'submergit' ? 'Submergit' : 'Fora aigua',
                    draft.annexCobertorLames === 'pvc'
                      ? 'PVC 83 mm'
                      : draft.annexCobertorLames === 'policarbonat'
                        ? 'Policarbonat 83 mm'
                        : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : "A determinar",
            },
            {
              key: "robot",
              label: "Robot netejafons",
              estat: draft.annexRobotEstat,
              content: draft.annexRobotArticleId
                ? `${getInstalName(draft.annexRobotArticleId)} · ×${draft.annexRobotQty || 1}`
                : "A determinar",
            },
            {
              key: "bomba",
              label: "Bomba de calor",
              estat: draft.annexBombaCalorEstat,
              content: draft.annexBombaCalorArticleId
                ? getInstalName(draft.annexBombaCalorArticleId)
                : `${draft.annexBombaCalorTemperatura || 27}°C · A determinar`,
            },
            {
              key: "netejafons",
              label: "Sistema netejafons",
              estat: draft.annexNetejafonsEstat,
              content: draft.annexNetejafonsTotal
                ? `${draft.annexNetejafonsTotal} boquilles${(draft.annexNetejafonsExtraCost || 0) > 0 ? ` · +${draft.annexNetejafonsExtraCost}€` : ""}`
                : null,
            },
          ].filter((s) => s.estat && s.estat !== "no");

          if (annexSections.length === 0) return null;
          return (
            <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-3">
              <h3 className="font-semibold text-foreground">Annex</h3>
              <div className="space-y-2">
                {annexSections.map((s) => (
                  <div key={s.key} className="flex items-start gap-2 text-sm">
                    <span
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 mt-0.5",
                        s.estat === "inclos" ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning",
                      )}
                    >
                      {s.estat === "inclos" ? "Inclòs" : "Opcional"}
                    </span>
                    <div>
                      <span className="font-medium text-foreground">{s.label}</span>
                      {s.content && <span className="text-muted-foreground ml-1">· {s.content}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

      {totalSale > 0 && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-3">
          <h3 className="font-semibold text-foreground">Resum Financer</h3>
          {reviewPhases
            ?.filter((p) => p.items.length > 0)
            .map((phase) => {
              const pSale = phase.items.reduce((s, it) => s + Math.ceil(it.quantity * it.unitSale), 0);
              const pCost = phase.items.reduce((s, it) => s + it.quantity * it.unitCost, 0);
              const pMargin = pSale > 0 ? ((pSale - pCost) / pSale) * 100 : 0;
              return (
                <div key={phase.name} className="flex justify-between items-baseline text-sm gap-3">
                  <span className="text-muted-foreground flex-1 truncate">{phase.name}</span>
                  {showMargins && (
                    <>
                      <span className="text-xs text-muted-foreground tabular-nums">cost {formatEUR(pCost)}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">marge {pMargin.toFixed(2)}%</span>
                    </>
                  )}
                  <span className="font-medium text-foreground tabular-nums min-w-[110px] text-right">
                    {formatEUR(pSale)}
                  </span>
                </div>
              );
            })}
          <div className="border-t border-border pt-3 space-y-2">
            {showMargins && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total cost (intern)</span>
                <span>{formatEUR(totalCost)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total venda (base)</span>
              <span className="font-medium">{formatEUR(totalSaleBase)}</span>
            </div>
            {adjustmentPct !== 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Ajust {adjustmentPct > 0 ? `+${adjustmentPct}` : adjustmentPct}%
                </span>
                <span className={adjustmentPct > 0 ? "text-warning" : "text-primary"}>
                  {formatEUR(totalSale - totalSaleBase)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total venda</span>
              <span className="font-bold">{formatEUR(totalSale)}</span>
            </div>
            {showMargins && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Marge (s/venda)</span>
                  <span
                    className={cn(
                      "font-bold",
                      margin >= 30 ? "text-success" : margin >= 20 ? "text-warning" : "text-destructive",
                    )}
                  >
                    {margin.toFixed(2)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      margin >= 30 ? "bg-success" : margin >= 20 ? "bg-warning" : "bg-destructive",
                    )}
                    style={{ width: `${Math.min(margin, 60) * 1.66}%` }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Payment conditions */}
      {draft.type === "mantenimiento" ? (
        <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-3">
          <h3 className="font-semibold text-foreground">Condicions de Pagament</h3>
          <div className="flex flex-wrap gap-2">
            {(["Mensual", "Trimestral", "Semestral", "Anual"] as const).map((opt) => {
              const active = draft.paymentConditions === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => updateDraft({ paymentConditions: opt })}
                  className={cn(
                    "px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ) : draft.type === "piscina_autoportant" ? (
        <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Condicions de Pagament</h3>
            <span className="text-sm tabular-nums text-success">Total: 100%</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="font-medium text-foreground">60 % acceptació de l'obra</span>
              <span className="text-muted-foreground">Primer pagament</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="font-medium text-foreground">40 % finalització de l'obra</span>
              <span className="text-muted-foreground">Segon pagament</span>
            </div>
          </div>
        </div>
      ) : (
        <PaymentConditionsEditor
          value={draft.paymentConditions || ""}
          onChange={(v) => updateDraft({ paymentConditions: v })}
        />
      )}

      {/* Observations */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-3">
        <h3 className="font-semibold text-foreground">Observacions</h3>
        <textarea
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 min-h-[80px]"
          placeholder="Observacions addicionals pel pressupost..."
          value={draft.observations || ""}
          onChange={(e) => updateDraft({ observations: e.target.value })}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep(prevStep)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Enrere
        </button>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar Esborrany
          </button>
          <button
            onClick={handleGeneratePDF}
            disabled={generatingPdf}
            className="gradient-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md disabled:opacity-50"
          >
            {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Generar
            PDF
          </button>
          <button
            onClick={handleSendToClient}
            disabled={sendingEmail || !draft.clientEmail}
            title={!draft.clientEmail ? "El client no té email registrat" : "Genera el PDF i obre el correu"}
            className="bg-success text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md disabled:opacity-50"
          >
            {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Enviar al
            Client
          </button>
        </div>
      </div>
    </div>
  );
}
