import { supabase } from "@/integrations/supabase/client";
import type { BudgetDraft, BudgetPhase } from "@/stores/budgetStore";
import { buildPdfHtml, type PdfPhase } from "@/lib/pdfTemplate";
import type { PdfData as NewPdfData } from "@/components/pdf/pdfTypes";
import { AUTOPORTANT_PAYMENT_CONDITIONS } from "@/lib/paymentConditions";

// Effective "visible wall" height: manual "altura vista" for semi-enterrada,
// or pool_depth_max minus an optional "rebaix" for elevada (mirrors
// getEffectiveHeight in formulaEngine.ts — keep both in sync).
function computeEffectiveHeight(draft: BudgetDraft): number {
  const disposition = draft.poolDisposition || "enterrada";
  if (disposition === "elevada") {
    const poolDepthMax = Number(draft.poolDepthMax || 0);
    const rebaixAmount = draft.hasRebaix ? Number(draft.rebaixAmount || 0) : 0;
    // Round to avoid floating-point artifacts (e.g. 1.4 - 0.10 = 1.2999999999999998).
    return Math.round(Math.max(0, poolDepthMax - rebaixAmount) * 100) / 100;
  }
  return Number(draft.alturaVista || 0);
}

// Escala i plataforma d'accés exterior: optional (user toggle) for
// semi-enterrada, always-on/mandatory for elevada.
function computeHasAccessStair(draft: BudgetDraft): boolean {
  const disposition = draft.poolDisposition || "enterrada";
  if (disposition === "elevada") return true;
  return disposition === "semi_enterrada" && !!draft.hasAccessStair;
}

// Resolve the comercial (sales rep) name/email for the PDF contact page.
// Falls back to the current session user when the draft hasn't been
// persisted/reloaded yet (e.g. PDF generated for a brand-new budget before
// its first save round-trips comercial_id back into the draft), then to the
// SECURITY DEFINER RPC when RLS hides the `profiles` row directly (e.g. an
// admin generating the PDF for a budget assigned to a different comercial).
async function resolveComercialInfo(
  draft: BudgetDraft,
): Promise<{ comercialName?: string; comercialEmail?: string }> {
  let comercialName: string | undefined;
  let comercialEmail: string | undefined;
  let comercialId = draft.comercialId;
  if (!comercialId) {
    try {
      const { data: auth } = await supabase.auth.getUser();
      comercialId = auth?.user?.id;
    } catch { /* ignore */ }
  }
  if (comercialId) {
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", comercialId)
        .maybeSingle();
      if (prof) {
        comercialName = (prof as any).full_name || undefined;
        comercialEmail = (prof as any).email || undefined;
      }
    } catch {
      /* ignore */
    }
    // Fallback: if RLS hid the profile (e.g. current user is not the
    // comercial and not an admin), use the SECURITY DEFINER RPC that
    // safely lists comercials.
    if (!comercialName && !comercialEmail) {
      try {
        const { data: list } = await supabase.rpc("list_comercials");
        const match = (list || []).find((r: any) => r.id === comercialId);
        if (match) {
          comercialName = (match as any).full_name || undefined;
          comercialEmail = (match as any).email || undefined;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return { comercialName, comercialEmail };
}

export function draftToRow(draft: BudgetDraft, userId: string) {
  const depthAvgForSurface =
    draft.poolDepthMin && draft.poolDepthMax ? (draft.poolDepthMin + draft.poolDepthMax) / 2 : 0;
  const isIrregularShape = draft.poolShape === "irregular";
  return {
    type: draft.type || "obra_nueva",
    client_name: draft.clientName || "",
    client_nif: draft.clientNif || "",
    client_address: draft.clientAddress || "",
    client_town: draft.clientTown || "",
    client_phone: draft.clientPhone || "",
    client_email: draft.clientEmail || "",
    budget_date: draft.budgetDate || new Date().toISOString().split("T")[0],
    number: draft.budgetNumber || `TMP-${crypto.randomUUID()}`,
    comercial_id: draft.comercialId || userId,
    internal_notes: draft.internalNotes || "",
    pool_type: draft.poolType || "",
    pool_shape: draft.poolShape || "",
    pool_length: draft.poolLength || 0,
    pool_width: draft.poolWidth || 0,
    pool_depth_min: draft.poolDepthMin || 0,
    pool_depth_max: draft.poolDepthMax || 0,
    pool_surface_irregular: draft.poolSurfaceIrregular ?? null,
    pool_depth_avg:
      draft.poolDepthAvg && draft.poolDepthAvg > 0
        ? draft.poolDepthAvg
        : draft.poolDepthMin && draft.poolDepthMax
        ? (draft.poolDepthMin + draft.poolDepthMax) / 2
        : 0,
    has_electrolisi: draft.hasElectrolisi ?? null,
    // Manteniment — segona piscina (mateix contracte, mateixa visita)
    has_second_pool: draft.hasSecondPool ?? false,
    pool_length_2: draft.poolLength2 ?? null,
    pool_width_2: draft.poolWidth2 ?? null,
    pool_depth_avg_2: draft.poolDepthAvg2 ?? null,
    has_electrolisi_2: draft.hasElectrolisi2 ?? null,
    kit_manguera_size: draft.kitMangueraSize || null,
    kit_pertiga_size: draft.kitPertigaSize || null,
    // Irregular: no floor-only dimension is collected, so volume is
    // approximated as total vessel surface × avg depth (mirrors
    // StepEstructura.tsx's preview and formulaEngine.ts's poolVolume).
    pool_volume_liters: isIrregularShape
      ? (draft.poolSurfaceIrregular || 0) * depthAvgForSurface * 1000
      : draft.poolLength && draft.poolWidth && draft.poolDepthMin && draft.poolDepthMax
        ? draft.poolLength * draft.poolWidth * ((draft.poolDepthMin + draft.poolDepthMax) / 2) * 1000
        : 0,
    pool_surface_m2: isIrregularShape
      ? draft.poolSurfaceIrregular || 0
      : draft.poolLength && draft.poolWidth && draft.poolDepthMin && draft.poolDepthMax
        ? draft.poolLength * draft.poolWidth +
          2 * (draft.poolLength * ((draft.poolDepthMin + draft.poolDepthMax) / 2)) +
          2 * (draft.poolWidth * ((draft.poolDepthMin + draft.poolDepthMax) / 2))
        : 0,
    has_exterior_stairs: draft.hasExteriorStairs || false,
    ext_stairs_length: draft.extStairsLength || 0,
    ext_stairs_width: draft.extStairsWidth || 0,
    // Disposició piscina (Obra Nova) + escala d'accés exterior (semi-enterrada / elevada)
    ...(function() {
      const disposition = draft.poolDisposition || 'enterrada';
      const alt = computeEffectiveHeight(draft);
      const hasAcc = computeHasAccessStair(draft);
      const stairW = Number(draft.accessStairWidth ?? 0.70);
      const totalL = Number(draft.accessTotalLength ?? ((Number(draft.poolWidth || 0) || 0) + 0.60));
      const steps = alt > 0 ? Math.max(0, (alt / 0.20) - 1) : 0;
      const stairL = Math.round(steps * 0.30 * 100) / 100;
      const platL = Math.max(0, Math.round((totalL - stairL) * 100) / 100);
      return {
        pool_disposition: disposition,
        altura_vista: alt,
        has_rebaix: disposition === 'elevada' && !!draft.hasRebaix,
        rebaix_amount: disposition === 'elevada' ? Number(draft.rebaixAmount || 0) : 0,
        has_access_stair: hasAcc,
        access_stair_width: hasAcc ? stairW : 0,
        access_stair_length: hasAcc ? stairL : 0,
        access_stair_height: hasAcc ? alt : 0,
        access_platform_width: hasAcc ? stairW : 0,
        access_platform_length: hasAcc ? platL : 0,
        access_platform_height: hasAcc ? alt : 0,
      };
    })(),
    interior_stairs_type: draft.interiorStairsType || "",
    stairs_width: draft.stairsWidth || 0,
    stairs_length: draft.stairsLength || 0,
    stairs_height: draft.stairsHeight || 0,
    platform_width: draft.platformWidth || 0,
    platform_length: draft.platformLength || 0,
    platform_height: draft.platformHeight || 0,
    bench_width: draft.benchWidth || 0,
    bench_length: draft.benchLength || 0,
    bench_height: draft.benchHeight || 0,
    // Jacuzzi opcional (Obra Nova)
    has_jacuzzi: draft.hasJacuzzi ?? false,
    jacuzzi_type: draft.jacuzziType || null,
    jacuzzi_position: draft.jacuzziPosition || null,
    jacuzzi_length: draft.jacuzziLength ?? null,
    jacuzzi_width: draft.jacuzziWidth ?? null,
    jacuzzi_depth: draft.jacuzziDepth ?? null,
    jacuzzi_bench_count: draft.jacuzziBenchCount ?? null,
    jacuzzi_bench_depth: draft.jacuzziBenchDepth ?? null,
    jacuzzi_bench_height: draft.jacuzziBenchHeight ?? null,
    jacuzzi_stairs_count: draft.jacuzziStairsCount ?? null,
    jacuzzi_stairs_tread: draft.jacuzziStairsTread ?? null,
    jacuzzi_air_jets_count: draft.jacuzziAirJetsCount ?? null,
    jacuzzi_air_jets_intake_count: draft.jacuzziAirJetsIntakeCount ?? null,
    jacuzzi_air_pump_qty: draft.jacuzziAirPumpQty ?? null,
    jacuzzi_air_pump_article_id: draft.jacuzziAirPumpArticleId || null,
    jacuzzi_water_jets_count: draft.jacuzziWaterJetsCount ?? null,
    jacuzzi_water_jets_intake_count: draft.jacuzziWaterJetsIntakeCount ?? null,
    jacuzzi_water_pump_qty: draft.jacuzziWaterPumpQty ?? null,
    jacuzzi_water_pump_article_id: draft.jacuzziWaterPumpArticleId || null,
    jacuzzi_piezo_buttons_count: draft.jacuzziPiezoButtonsCount ?? null,
    jacuzzi_filtration_pump_article_id: draft.jacuzziFiltrationPumpArticleId || null,
    jacuzzi_filtration_pump_qty: draft.jacuzziFiltrationPumpQty ?? null,
    jacuzzi_filter_article_id: draft.jacuzziFilterArticleId || null,
    jacuzzi_filter_qty: draft.jacuzziFilterQty ?? null,
    jacuzzi_led_article_id: draft.jacuzziLedArticleId || null,
    jacuzzi_led_count: draft.jacuzziLedCount ?? null,
    jacuzzi_heat_pump_article_id: draft.jacuzziHeatPumpArticleId || null,
    jacuzzi_heat_pump_qty: draft.jacuzziHeatPumpQty ?? null,
    jacuzzi_saline_electrolysis_article_id: draft.jacuzziSalineElectrolysisArticleId || null,
    jacuzzi_saline_electrolysis_qty: draft.jacuzziSalineElectrolysisQty ?? null,
    construction_system: draft.constructionSystem || "",
    waterproofing_system: draft.waterproofingSystem || "",
    gunite_manguera_metres: draft.guniteMangueraMetres ?? 0,
    gunite_distancia_km: draft.guniteDistanciaKm ?? 0,
    payment_conditions:
      draft.type === "piscina_autoportant"
        ? AUTOPORTANT_PAYMENT_CONDITIONS
        : draft.paymentConditions || "",
    observations: draft.observations || "",
    // Prefiltre
    instal_prefiltre_enabled: draft.instalPrefiltreEnabled ?? false,
    instal_prefiltre_article_id: draft.instalPrefiltreArticleId || null,
    instal_prefiltre_qty: draft.instalPrefiltreQty ?? 1,
    // Price adjustment (Resum Financer → "Ajust de preu (%)")
    margin_pct_adjustment: draft.marginPctAdjustment ?? 0,
    // Acabats — Coronament
    coronament_actuacio: draft.coronamentActuacio || "",
    coronament_tipus: draft.coronamentTipus || "",
    coronament_format: draft.coronamentFormat || "",
    coronament_ml: draft.coronamentMl || 0,
    coronament_encofrat_ml: draft.coronamentEncofratMl || 0,
    coronament_model_id: draft.coronamentModelId || null,
    coronament_model_a_determinar: draft.coronamentModelADeterminar ?? true,
    coronament_beurada: draft.coronamentBeurada || "",
    coronament_beurada_color: draft.coronamentBeuradaColor || "",
    coronament_observacions: draft.coronamentObservacions || "",
    coronament_peces: draft.coronamentPeces || 0,
    coronament_inclos: draft.coronamentInclos ?? true,
    // Acabats — Revestiment
    revestiment_actuacio: draft.revestimentActuacio || "",
    revestiment_tipus: draft.revestimentTipus || "",
    revestiment_format: draft.revestimentFormat || "",
    revestiment_qualitat: draft.revestimentQualitat || "",
    revestiment_model_id: draft.revestimentModelId || null,
    revestiment_model_a_determinar: draft.revestimentModelADeterminar ?? true,
    revestiment_beurada: draft.revestimentBeurada || "",
    revestiment_beurada_color: draft.revestimentBeuradaColor || "",
    revestiment_peces_especials: draft.revestimentPecesEspecials || false,
    revestiment_mig_canya: draft.revestimentMigCanya || false,
    revestiment_inclos: draft.revestimentInclos ?? true,
    // Opcional
    opcional_revestiment_tipus: draft.opcionalRevestimentTipus || null,
    opcional_revestiment_format: draft.opcionalRevestimentFormat || null,
    opcional_revestiment_model_id: draft.opcionalRevestimentModelId || null,
    opcional_revestiment_beurada: draft.opcionalRevestimentBeurada || null,
    opcional_revestiment_beurada_color: draft.opcionalRevestimentBeuradaColor || null,
    // Revestiment exterior (piscines semi-enterrades / elevades)
    revestiment_exterior_inclos: draft.revestimentExteriorInclos ?? false,
    revestiment_exterior_format: draft.revestimentExteriorFormat || null,
    revestiment_exterior_model_id: draft.revestimentExteriorModelId || null,
    revestiment_exterior_model_a_determinar:
      draft.revestimentExteriorModelADeterminar ?? !draft.revestimentExteriorModelId,
    revestiment_exterior_beurada: draft.revestimentExteriorBeurada || null,
    revestiment_exterior_beurada_color: draft.revestimentExteriorBeuradaColor || null,
    current_coating: draft.currentCoating || "",
    construction_year: draft.constructionYear || null,
    general_condition: draft.generalCondition || "",
    detected_problems: draft.detectedProblems || [],
    rehab_works: draft.rehabWorks || [],
    rehab_notes: draft.rehabNotes || {},
    new_coating: draft.newCoating || "",
    filtration_system: draft.filtrationSystem || "",
    has_robot: draft.hasRobot || false,
    has_cover: draft.hasCover || false,
    maintenance_services: draft.maintenanceServices || [],
    maintenance_periodicity: draft.maintenancePeriodicity || "",
    maintenance_price: draft.maintenancePrice || 0,
    maintenance_plan: (draft.maintenancePlan as any) ?? null,
    photo_url: draft.photoUrl || "",
    // Instal·lacions
    instal_filtre_polies_id: draft.instalFiltrePoliesId || null,
    instal_filtre_especial_id: draft.instalFiltreEspecialId || null,
    instal_afm_enabled: draft.instalAfmEnabled || false,
    instal_afm_article_id: draft.instalAfmArticleId || null,
    instal_canvi_sorra_enabled: draft.instalCanviSorraEnabled || false,
    instal_canvi_sorra_article_id: draft.instalCanviSorraArticleId || null,
    instal_bomba_onoff_id: draft.instalBombaOnoffId || null,
    instal_bomba_variable_id: draft.instalBombaVariableId || null,
    instal_wifi_enabled: draft.instalWifiEnabled || false,
    instal_wifi_article_id: draft.instalWifiArticleId || null,
    instal_dosificacio_std_id: draft.instalDosificacioStdId || null,
    instal_hidrolisi_id: draft.instalHidrolisiId || null,
    instal_quadre_id: draft.instalQuadreId || null,
    instal_quadre_display_text: draft.instalQuadreDisplayText || null,
    instal_quadre_base_cost: draft.instalQuadreBaseCost ?? null,
    instal_quadre_base_sale: draft.instalQuadreBaseSale ?? null,
    instal_quadre_addon_nf_cost: draft.instalQuadreAddonNfCost ?? 0,
    instal_quadre_addon_nf_sale: draft.instalQuadreAddonNfSale ?? 0,
    instal_quadre_addon_bc_cost: draft.instalQuadreAddonBcCost ?? 0,
    instal_quadre_addon_bc_sale: draft.instalQuadreAddonBcSale ?? 0,
    instal_quadre_final_cost: draft.instalQuadreFinalCost ?? null,
    instal_quadre_final_sale: draft.instalQuadreFinalSale ?? null,
    instal_quadre_manual_override: draft.instalQuadreManualOverride ?? false,
    instal_quadre_recommended_id: draft.instalQuadreRecommendedId || null,
    // Quantities
    instal_filtre_polies_qty: draft.instalFiltrePoliesQty || 1,
    instal_filtre_especial_qty: draft.instalFiltreEspecialQty || 1,
    instal_bomba_onoff_qty: draft.instalBombaOnoffQty || 1,
    instal_bomba_variable_qty: draft.instalBombaVariableQty || 1,
    instal_dosificacio_std_qty: draft.instalDosificacioStdQty || 1,
    instal_hidrolisi_qty: draft.instalHidrolisiQty || 1,
    // Opcional flags
    // Polies (fibra) defaults to included (false) — mirrors the wizard's own
    // default convention (StepInstalacions.tsx), the counterpart to Especial
    // defaulting to opcional (true) below.
    instal_filtre_polies_opcional: draft.instalFiltrePoliesOpcional ?? false,
    instal_filtre_especial_opcional: draft.instalFiltreEspecialOpcional ?? true,
    instal_bomba_onoff_opcional: draft.instalBombaOnoffOpcional ?? false,
    instal_bomba_variable_opcional: draft.instalBombaVariableOpcional ?? true,
    instal_dosificacio_std_opcional: draft.instalDosificacioStdOpcional ?? false,
    instal_hidrolisi_opcional: draft.instalHidrolisiOpcional ?? false,
    // AFM auto
    instal_afm_qty: draft.instalAfmQty || null,
    // Canvi medi
    instal_canvi_medi_article_id: draft.instalCanviMediArticleId || null,
    instal_canvi_medi_filtre: "fibra",
    // Section enables
    instal_depuracio_enabled: draft.instalDepuracioEnabled ?? true,
    instal_bomba_enabled: draft.instalBombaEnabled ?? true,
    instal_dosificacio_enabled: draft.instalDosificacioEnabled ?? true,
    instal_quadre_enabled: draft.instalQuadreEnabled ?? true,
    // Fontaneria
    instal_fontaneria_enabled: draft.instalFontaneriaEnabled ?? true,
    instal_fontaneria_text: draft.instalFontaneriaText || null,
    instal_fontaneria_base_article_id: draft.instalFontaneriaBaseArticleId || null,
    instal_fontaneria_extra_cost: draft.instalFontaneriaExtraCost ?? 0,
    instal_fontaneria_total: draft.instalFontaneriaTotal ?? 0,
    instal_fontaneria_distancia: draft.instalFontaneriaDistancia ?? 10,
    instal_fontaneria_local_tecnic: draft.instalFontaneriaLocalTecnic || "determinar",
    instal_fontaneria_caseta_tipus: draft.instalFontaneriaCasetaTipus || null,
    instal_fontaneria_perforacions: draft.instalFontaneriaPerforacions ?? true,
    instal_fontaneria_perforacions_article_id: draft.instalFontaneriaPerforacionsArticleId || null,
    instal_fontaneria_rasas: draft.instalFontaneriaRasas || "determinar",
    // Instal·lació elèctrica
    instal_electrica_enabled: draft.instalElectricaEnabled ?? true,
    instal_electrica_text: draft.instalElectricaText || null,
    instal_electrica_base_article_id: draft.instalElectricaBaseArticleId || null,
    instal_electrica_extra_cost: draft.instalElectricaExtraCost ?? 0,
    instal_electrica_total: draft.instalElectricaTotal ?? 0,
    instal_electrica_distancia: draft.instalElectricaDistancia ?? 10,
    // Caseta
    instal_caseta_ubicacio: draft.instalCasetaUbicacio || null,
    instal_caseta_observacions: draft.instalCasetaObservacions || null,
    instal_caseta_enabled: draft.instalCasetaEnabled ?? true,
    instal_caseta_obra_llarg: draft.instalCasetaObraLlarg ?? null,
    instal_caseta_obra_ample: draft.instalCasetaObraAmple ?? null,
    instal_caseta_obra_alt: draft.instalCasetaObraAlt ?? null,
    instal_caseta_obra_portes: draft.instalCasetaObraPortes || null,
    // Accessoris bàsics
    acc_basics_color: draft.accBasicsColor || "blanc",
    acc_impulsors_qty: draft.accImpulsorsQty ?? 0,
    acc_impulsors_model_id: draft.accImpulsorsModelId || null,
    acc_skimmers_qty: draft.accSkimmersQty ?? 0,
    acc_skimmers_model_id: draft.accSkimmersModelId || null,
    acc_embornal_qty: draft.accEmbornalQty ?? 0,
    acc_embornal_model_id: draft.accEmbornalModelId || null,
    acc_focus_led_qty: draft.accFocusLedQty ?? 0,
    acc_focus_led_model_id: draft.accFocusLedModelId || null,
    acc_focus_led_variant: draft.accFocusLedVariant || "blanc",
    acc_focus_led_text: draft.accFocusLedText || null,
    acc_regulador_qty: draft.accReguladorQty ?? 0,
    acc_regulador_model_id: draft.accReguladorModelId || null,
    acc_netejafons_qty: draft.accNetejafonsQty ?? 0,
    acc_netejafons_model_id: draft.accNetejafonsModelId || null,
    // Projectors Mini LED
    acc_projector_mini_led_qty: draft.accProjectorMiniLedQty ?? 0,
    acc_projector_mini_led_model_id: draft.accProjectorMiniLedModelId || null,
    // Control RGB
    acc_control_rgb_qty: draft.accControlRgbQty ?? 0,
    acc_control_rgb_model_id: draft.accControlRgbModelId || null,
    // Accessoris opcionals
    acc_escala_enabled: draft.accEscalaEnabled ?? false,
    acc_escala_qty: draft.accEscalaQty ?? 1,
    acc_escala_model_id: draft.accEscalaModelId || null,
    acc_dutxa_enabled: draft.accDutxaEnabled ?? false,
    acc_dutxa_qty: draft.accDutxaQty ?? 1,
    acc_dutxa_model_id: draft.accDutxaModelId || null,
    acc_plat_dutxa_enabled: draft.accPlatDutxaEnabled ?? false,
    acc_plat_dutxa_qty: draft.accPlatDutxaQty ?? 1,
    acc_cascada_enabled: draft.accCascadaEnabled ?? false,
    acc_cascada_qty: draft.accCascadaQty ?? 1,
    acc_cascada_model_id: draft.accCascadaModelId || null,
    acc_cascada_bomba_article_id: draft.accCascadaBombaArticleId || null,
    acc_cascada_pulsador_article_id: draft.accCascadaPulsadorArticleId || null,
    acc_cascada_pulsador_qty: draft.accCascadaPulsadorQty ?? 1,
    acc_salvavides_enabled: draft.accSalvavidesEnabled ?? false,
    acc_salvavides_qty: draft.accSalvavidesQty ?? 1,
    acc_salvavides_model_id: draft.accSalvavidesModelId || null,
    acc_barana_enabled: draft.accBaranaEnabled ?? false,
    acc_barana_qty: draft.accBaranaQty ?? 1,
    acc_barana_model_id: draft.accBaranaModelId || null,
    // Annex
    annex_notes: draft.annexNotes || null,
    // Annex sections
    annex_projecte_estat: draft.annexProjecteEstat || "no",
    annex_projecte_article_id: draft.annexProjecteArticleId || null,
    annex_projecte_qty: draft.annexProjecteQty ?? 1,
    annex_excavacio_estat: draft.annexExcavacioEstat || "no",
    annex_excavacio_import: draft.annexExcavacioImport ?? null,
    annex_excavacio_reompliment: draft.annexExcavacioReompliment ?? null,
    annex_excavacio_pill1_title: draft.annexExcavacioPill1Title ?? null,
    annex_excavacio_pill2_title: draft.annexExcavacioPill2Title ?? null,
    annex_excavacio_text1: draft.annexExcavacioText1 ?? null,
    annex_excavacio_text2: draft.annexExcavacioText2 ?? null,
    annex_excavacio_mano_obra_override: draft.annexExcavacioManoObraOverride ?? null,
    annex_excavacio_reompliment_override: draft.annexExcavacioReomplimentOverride ?? null,
    annex_paviment_estat: draft.annexPavimentEstat || "no",
    annex_paviment_tipus: draft.annexPavimentTipus || null,
    annex_paviment_reforma_enabled: draft.annexPavimentReformaEnabled ?? false,
    annex_paviment_nou_enabled: draft.annexPavimentNouEnabled ?? false,
    annex_paviment_retirada_enabled: draft.annexPavimentRetiradaEnabled ?? false,
    annex_paviment_retirada_m2: draft.annexPavimentRetiradaM2 ?? null,
    annex_paviment_regularitzacio_enabled: draft.annexPavimentRegularitzacioEnabled ?? false,
    annex_paviment_regularitzacio_m2: draft.annexPavimentRegularitzacioM2 ?? null,
    annex_paviment_actuacio: draft.annexPavimentActuacio || null,
    annex_paviment_formigo_enabled: draft.annexPavimentFormigoEnabled ?? false,
    annex_paviment_formigo_m2: draft.annexPavimentFormigoM2 ?? null,
    annex_paviment_material: draft.annexPavimentMaterial || null,
    annex_paviment_format: draft.annexPavimentFormat || null,
    annex_paviment_m2: draft.annexPavimentM2 ?? null,
    annex_paviment_model_id: draft.annexPavimentModelId || null,
    annex_paviment_model_a_determinar: draft.annexPavimentModelADeterminar ?? !draft.annexPavimentModelId,
    annex_gespa_estat: draft.annexGespaEstat || "no",
    annex_gespa_preparacio_enabled: draft.annexGespaPreparacioEnabled ?? false,
    annex_gespa_preparacio_m2: draft.annexGespaPreparacioM2 ?? null,
    annex_gespa_model: draft.annexGespaModel || null,
    annex_gespa_m2: draft.annexGespaM2 ?? null,
    annex_gespa_article_id: draft.annexGespaArticleId || null,
    has_manual_material_entry: draft.hasManualMaterialEntry ?? false,
    manual_material_entry_cost: draft.manualMaterialEntryCost ?? null,
    manual_material_entry_sale: draft.manualMaterialEntrySale ?? null,
    annex_cobertor_estat: draft.annexCobertorEstat || "no",
    annex_cobertor_tipus: draft.annexCobertorTipus || null,
    annex_cobertor_model_id: draft.annexCobertorModelId || null,
    annex_cobertor_lames: draft.annexCobertorLames || null,
    annex_cobertor_color_id: draft.annexCobertorColorId || null,
    annex_cobertor_manual_override: draft.annexCobertorManualOverride ?? false,
    annex_cobertor_manual_amount: draft.annexCobertorManualAmount ?? null,
    annex_cobertor_calc_cost: draft.annexCobertorCalcCost ?? null,
    annex_cobertor_calc_sale: draft.annexCobertorCalcSale ?? null,
    annex_cobertor_calc_breakdown: draft.annexCobertorCalcBreakdown ?? null,
    annex_cobertor_mur_nou: draft.annexCobertorMurNou ?? false,
    annex_cobertor_mur_m2: draft.annexCobertorMurM2 ?? null,
    annex_cobertor_model_code: draft.annexCobertorModelCode ?? null,
    annex_robot_estat: draft.annexRobotEstat || "no",
    annex_robot_article_id: draft.annexRobotArticleId || null,
    annex_robot_qty: draft.annexRobotQty ?? 1,
    annex_bomba_calor_estat: draft.annexBombaCalorEstat || "no",
    annex_bomba_calor_coberta: draft.annexBombaCalorCoberta ?? null,
    annex_bomba_calor_des_de: draft.annexBombaCalorDesde || null,
    annex_bomba_calor_fins_a: draft.annexBombaCalorFinsA || null,
    annex_bomba_calor_temperatura: draft.annexBombaCalorTemperatura ?? 27,
    annex_bomba_calor_article_id: draft.annexBombaCalorArticleId || null,
    annex_bomba_calor_kw_required: draft.annexBombaCalorKwRequired ?? null,
    annex_netejafons_estat: draft.annexNetejafonsEstat || "no",
    annex_netejafons_fons: draft.annexNetejafonsFons ?? null,
    annex_netejafons_escala: draft.annexNetejafonsEscala ?? null,
    annex_netejafons_plataforma: draft.annexNetejafonsPlataforma ?? null,
    annex_netejafons_total: draft.annexNetejafonsTotal ?? null,
    annex_netejafons_extra_cost: draft.annexNetejafonsExtraCost ?? 0,
    annex_netejafons_article_id: draft.annexNetejafonsArticleId || null,
    // Piscina Autoportant
    autoportant_model: draft.autoportantModel || null,
    autoportant_ample: draft.autoportantAmple || null,
    autoportant_llarg: draft.autoportantLlarg || null,
    autoportant_altura_aigua: draft.autoportantAlturaAigua || null,
    autoportant_corona_key: draft.autoportantCoronaKey || null,
    autoportant_revestiment_key: draft.autoportantRevestimentKey || null,
    autoportant_revestiment_exterior_key: draft.autoportantRevestimentExteriorKey || null,
    autoportant_morter_color: draft.autoportantMorterColor || null,
    autoportant_opc_asiento_acrilico_qty: draft.autoportantOpcAsientoAcrilicoQty ?? 0,
    autoportant_opc_colchoneta: draft.autoportantOpcColchoneta ?? false,
    autoportant_opc_cubierta_electrica: draft.autoportantOpcCubiertaElectrica ?? false,
    autoportant_opc_banco_gresite_qty: draft.autoportantOpcBancoGresiteQty ?? 0,
    autoportant_opc_spa: draft.autoportantOpcSpa ?? false,
    autoportant_opc_cascada: draft.autoportantOpcCascada ?? false,
    autoportant_opc_asiento_porcelanico_qty: draft.autoportantOpcAsientoPorcelanicoQty ?? 0,
    autoportant_opc_cristal: draft.autoportantOpcCristal ?? false,
    autoportant_transport_km: draft.autoportantTransportKm ?? null,
    autoportant_transport_km_override: draft.autoportantTransportKmOverride ?? false,
    autoportant_transport_cost: draft.autoportantTransportCost ?? null,
    autoportant_transport_sale: draft.autoportantTransportSale ?? null,
    autoportant_transport_user_edited: draft.autoportantTransportUserEdited ?? false,
  };
}

export async function saveBudget(
  draft: BudgetDraft,
  userId: string,
  status: string = "borrador",
): Promise<{ id: string | null; error: string | null }> {
  if (!userId) {
    console.error("[saveBudget] No userId provided");
    return { id: null, error: "No autenticat" };
  }

  const row = draftToRow(draft, userId);

  // Calculate totals from phases
  let totalCost = 0;
  let totalSale = 0;
  if (draft.phases) {
    for (const phase of draft.phases) {
      for (const item of phase.items) {
        totalCost += item.quantity * item.unitCost * 100;
        // Sale rounded UP per partida → keeps totals decimal-free.
        totalSale += Math.ceil(item.quantity * item.unitSale) * 100;
      }
    }
  }

  // Maintenance budgets don't use phases — derive totals from the
  // maintenance plan + materials so the Pressupostos listing shows the
  // same annual total / margin as the wizard's Revisió step.
  if (draft.type === "mantenimiento") {
    try {
      const { computeMaintenanceMaterials } = await import("@/lib/maintenanceMaterials");
      let mArts: Array<{ name: string; cost_price: number | null }> = [];
      try {
        const { data } = await supabase
          .from("articles")
          .select("name, cost_price")
          .eq("category", "Manteniment");
        mArts = (data || []) as any;
      } catch { /* ignore */ }

      const plan = draft.maintenancePlan;
      const visits = (plan?.visitsPerMonth && plan.visitsPerMonth.length === 12)
        ? plan.visitsPerMonth
        : Array(12).fill(0);
      let opTotal = 0;
      if (plan) {
        const totalVisits = visits.reduce((a, b) => a + (b || 0), 0);
        const totalHours = totalVisits * (plan.visitDurationHours || 0);
        const totalLabour = totalHours * (plan.hourlyCost || 0);
        const totalParking = totalVisits * (plan.parkingCostPerVisit || 0);
        const vanCostPerHour = ((plan.vanMonthlyRenting || 0) * 12) / (40 * 48);
        const totalVan = totalHours * vanCostPerHour;
        const totalFuel = totalHours * (plan.fuelCostPerHour || 0);
        opTotal = totalLabour + totalParking + totalVan + totalFuel;
      }
      const materials = computeMaintenanceMaterials(draft, mArts as any, opTotal);
      const totalAnual = materials.totalAnual || 0;
      // Cost = base + structural overhead (everything except benefit margin).
      const costAnual = (materials.subtotal || 0) + opTotal + (materials.structuralAmount || 0);
      totalSale = totalAnual * 100;
      totalCost = costAnual * 100;
    } catch (err) {
      console.error("[saveBudget] maintenance totals calc failed", err);
    }
  }
  // Margen sobre coste: (venda - cost) / cost * 100 — coherente con StepPartides y StepRevisio
  const marginPct = totalSale > 0 ? ((totalSale - totalCost) / totalSale) * 100 : 0;

  // Apply price adjustment (positive = increment, negative = descompte) to the
  // persisted total_sale so the listing reflects the same figure shown in the
  // wizard / PDF. Cost is unchanged.
  const adjPct = Number(draft.marginPctAdjustment ?? 0) || 0;
  // Match wizard's display rounding: ceil to whole euros (totalSale is in cents).
  const totalSaleAdjusted = adjPct > 0 && draft.phases
    ? draft.phases.reduce(
        (sum, phase) => sum + phase.items.reduce((s, it) => s + Math.ceil(it.quantity * it.unitSale * (1 + adjPct / 100)) * 100, 0),
        0,
      )
    : adjPct !== 0
      ? Math.ceil((totalSale * (1 + adjPct / 100)) / 100) * 100
      : totalSale;
  const marginPctAdjusted = totalSaleAdjusted > 0 ? ((totalSaleAdjusted - totalCost) / totalSaleAdjusted) * 100 : 0;

  const budgetData = {
    ...row,
    status,
    total_cost: Math.round(totalCost),
    total_sale: Math.round(totalSaleAdjusted),
    margin_pct: Math.round(marginPctAdjusted * 100) / 100,
    updated_at: new Date().toISOString(),
  } as any;

  let budgetId = draft.id;

  try {
    if (budgetId) {
      console.log("[saveBudget] Updating budget:", budgetId);
      const { error } = await supabase.from("budgets").update(budgetData).eq("id", budgetId);
      if (error) {
        console.error("[saveBudget] Update error:", error);
        throw error;
      }
    } else {
      console.log("[saveBudget] Inserting new budget");
      const { data, error } = await supabase.from("budgets").insert(budgetData).select("id").single();
      if (error) {
        console.error("[saveBudget] Insert error:", error);
        throw error;
      }
      budgetId = data.id;
      console.log("[saveBudget] Created budget:", budgetId);
    }

    // Save phases if present
    if (draft.phases && budgetId) {
      const { data: existingPhases, error: existingPhasesError } = await supabase
        .from("budget_phases")
        .select("id")
        .eq("budget_id", budgetId);

      if (existingPhasesError) {
        console.error("[saveBudget] Existing phases query error:", existingPhasesError);
        throw existingPhasesError;
      }

      const existingPhaseIds = (existingPhases || []).map((phase: any) => phase.id);

      if (existingPhaseIds.length > 0) {
        const { error: deleteItemsError } = await supabase
          .from("budget_items")
          .delete()
          .in("phase_id", existingPhaseIds);

        if (deleteItemsError) {
          console.error("[saveBudget] Budget items delete error:", deleteItemsError);
          throw deleteItemsError;
        }
      }

      const { error: deletePhasesError } = await supabase.from("budget_phases").delete().eq("budget_id", budgetId);

      if (deletePhasesError) {
        console.error("[saveBudget] Budget phases delete error:", deletePhasesError);
        throw deletePhasesError;
      }

      for (const phase of draft.phases) {
        const phaseCost = phase.items.reduce((s, it) => s + it.quantity * it.unitCost * 100, 0);
        const phaseSale = phase.items.reduce((s, it) => s + Math.ceil(it.quantity * it.unitSale) * 100, 0);

        const { data: phaseData, error: phaseError } = await supabase
          .from("budget_phases")
          .insert({
            budget_id: budgetId,
            name: phase.name,
            order: phase.order,
            total_cost: Math.round(phaseCost),
            total_sale: Math.round(phaseSale),
          } as any)
          .select("id")
          .single();

        if (phaseError) {
          console.error("[saveBudget] Phase insert error:", phaseError);
          throw phaseError;
        }

        const manualItems = phase.items.filter((item) => item.source !== "formula");

        if (manualItems.length > 0 && phaseData) {
          const itemRows = manualItems.map((it, idx) => ({
            phase_id: phaseData.id,
            description: it.description,
            unit: it.unit,
            quantity: it.quantity,
            unit_cost: Math.round(it.unitCost * 100),
            unit_sale: Math.round(it.unitSale * 100),
            source: it.source || "manual",
            wizard_key: (it as any).wizardKey || null,
            sub_phase: (it as any).subPhase || null,
            user_edited: (it as any).userEdited === true,
            order: idx,
          }));
          const { error: itemError } = await supabase.from("budget_items").insert(itemRows as any);
          if (itemError) {
            console.error("[saveBudget] Item insert error:", itemError);
            throw itemError;
          }
        }
      }
    }

    return { id: budgetId!, error: null };
  } catch (err: any) {
    console.error("[saveBudget] Error:", err);
    return { id: null, error: err.message || "Error desant" };
  }
}

/** Build the budget PDF Blob + suggested filename, without saving. The
 *  caller is responsible for invoking `saveBlobWithPicker` first (inside
 *  the click handler) so the native "Save As" dialog can open. */
export async function buildBudgetPdf(draft: BudgetDraft): Promise<{ blob: Blob; filename: string }> {
  const { buildPdfBlob } = await import("@/lib/pdfRender");

  const typeLabels: Record<string, string> = {
    obra_nueva: "Obra Nova",
    rehabilitacion: "Rehabilitació",
    mantenimiento: "Manteniment",
    piscina_autoportant: "Piscina Autoportant",
  };

  // ─── Maintenance budget: render its own (much shorter) document. ───────
  if (draft.type === "mantenimiento") {
    return buildMaintenancePdf(draft);
  }

  // ─── Piscina Autoportant: dedicated short document (Portada + Model +
  //     Acabats + [Opcionals sel] + Resum + [Opcionals catàleg] + Contacte).
  if (draft.type === "piscina_autoportant") {
    return buildAutoportantPdf(draft);
  }

  // Resolve article names + image URLs needed by the PDF template.
  const articleIds = [
    draft.instalFiltrePoliesId,
    draft.instalFiltreEspecialId,
    draft.instalAfmArticleId,
    draft.instalPrefiltreArticleId,
    draft.instalBombaOnoffId,
    draft.instalBombaVariableId,
    draft.instalHidrolisiId,
    draft.instalDosificacioStdId,
    draft.instalQuadreId,
    draft.instalWifiArticleId,
    draft.instalFontaneriaBaseArticleId,
    draft.instalFontaneriaPerforacionsArticleId,
    draft.instalElectricaBaseArticleId,
    draft.revestimentModelId,
    draft.coronamentModelId,
    draft.annexRobotArticleId,
    draft.annexBombaCalorArticleId,
    draft.annexPavimentModelId,
    draft.annexGespaArticleId,
    draft.annexProjecteArticleId,
    draft.annexNetejafonsArticleId,
    // Accessoris — basic
    draft.accImpulsorsModelId,
    draft.accSkimmersModelId,
    draft.accEmbornalModelId,
    draft.accFocusLedModelId,
    draft.accProjectorMiniLedModelId,
    draft.accControlRgbModelId,
    draft.accReguladorModelId,
    draft.accNetejafonsModelId,
    // Accessoris — optional (model id only when applicable)
    draft.accEscalaModelId,
    draft.accDutxaModelId,
    draft.accCascadaModelId,
    draft.accCascadaBombaArticleId,
    draft.accSalvavidesModelId,
    draft.accBaranaModelId,
  ].filter(Boolean) as string[];

  const articlesMap: Record<string, { name: string; image_url?: string; sale?: number; technical_specs?: Record<string, unknown> }> = {};
  if (articleIds.length > 0) {
    const { data: arts } = await supabase
      .from("articles")
      .select("id, name, image_url, sale_price, technical_specs")
      .in("id", articleIds);
    (arts || []).forEach((a: any) => {
      articlesMap[a.id] = {
        name: a.name,
        image_url: a.image_url,
        sale: Number(a.sale_price || 0) / 100,
        technical_specs: (a.technical_specs && typeof a.technical_specs === "object") ? a.technical_specs : undefined,
      };
    });
  }
  const a = (id?: string) => (id ? articlesMap[id] : undefined);

  // Extra articles fetched by name (needed for the Sistema Neteja Fons
  // "opcional" amount fallback — replicates the formula-engine rules so
  // the opcional pill shows the same total it would if included).
  const normalizeArticleName = (name: string) =>
    String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  const byName: Record<string, number> = {};
  try {
    const { data: nArts } = await supabase
      .from("articles")
      .select("name, sale_price")
      .or(
        "name.ilike.%PASAMUROS%,name.ilike.%TOMA ASPIR%,name.ilike.%POOL VALLET%,name.ilike.%MANO DE OBRA INSTALADOR BOMBA DE CALOR%",
      );
    (nArts || []).forEach((r: any) => {
      byName[normalizeArticleName(r.name)] = Number(r.sale_price || 0) / 100;
    });
  } catch {
    /* ignore */
  }
  const priceOf = (n: string) => byName[normalizeArticleName(n)] || 0;

  // Resolve the comercial (sales rep) profile for the contact page.
  const { comercialName, comercialEmail } = await resolveComercialInfo(draft);

  // Pool stats
  const depthAvg = draft.poolDepthMin && draft.poolDepthMax ? (draft.poolDepthMin + draft.poolDepthMax) / 2 : 0;
  const isIrregularShapeForPdf = draft.poolShape === "irregular";
  const volume = isIrregularShapeForPdf
    ? Math.round((draft.poolSurfaceIrregular || 0) * depthAvg * 1000)
    : draft.poolLength && draft.poolWidth && depthAvg
      ? Math.round(draft.poolLength * draft.poolWidth * depthAvg * 1000)
      : 0;
  const surface = isIrregularShapeForPdf
    ? draft.poolSurfaceIrregular || 0
    : draft.poolLength && draft.poolWidth && depthAvg
      ? draft.poolLength * draft.poolWidth + 2 * (draft.poolLength * depthAvg) + 2 * (draft.poolWidth * depthAvg)
      : 0;

  // Phases for template
  const pdfPhases: PdfPhase[] = (draft.phases || []).map((ph) => {
    const items = ph.items.map((it) => ({
      description: it.description,
      unit: it.unit,
      quantity: it.quantity,
      unitSale: it.unitSale,
      subPhase: (it as any).subPhase ?? null,
      wizardKey: (it as any).wizardKey ?? null,
      total: Math.ceil(it.quantity * it.unitSale),
    }));
    const subtotal = items.reduce((s, it) => s + (it.total || 0), 0);
    return { name: ph.name, items, subtotal };
  });
  const totalSale = pdfPhases.reduce((s, p) => s + p.subtotal, 0);

  // "Incloure aquesta secció en el pressupost" toggles — same pattern
  // wizardEquipment.ts already uses correctly for Partides (depuracioOn/
  // dosificacioOn/quadreOn there, see its own const of the same names).
  // Mirrored here so the PDF's own separate data prep can't drift from what
  // Partides shows: previously, instalDosificacioStdId/instalQuadreId (and
  // the section amounts derived from them) were read regardless of these
  // toggles, so a persisted article id/price survived the user switching a
  // section off — the section still showed up in the PDF with its old
  // equip and price even though Partides/the Instal·lacions total had
  // already correctly dropped it. See dosificacio/quadre/*SectionAmount
  // below, all now gated on these.
  const depuracioOn = draft.instalDepuracioEnabled !== false;
  const dosificacioOn = draft.instalDosificacioEnabled !== false;
  const quadreOn = draft.instalQuadreEnabled !== false;
  // Same pattern, same bug, for the 3 remaining toggleable Instal·lacions
  // sections (Bomba/Fontaneria/Electricitat) — see bombaInclosTipus/
  // electricaSale/fontaneriaTotal below.
  const bombaOn = draft.instalBombaEnabled !== false;
  const fontaneriaOn = draft.instalFontaneriaEnabled !== false;
  const electricaOn = draft.instalElectricaEnabled !== false;

  // Filtration filtre = polies if set, otherwise especial
  const filtre = a(draft.instalFiltrePoliesId) || a(draft.instalFiltreEspecialId);
  const bomba = a(draft.instalBombaVariableId) || a(draft.instalBombaOnoffId);
  const hidrolisi = a(draft.instalHidrolisiId);
  // Gated on dosificacioOn: every hidrolisiName/hidrolisiTotal/hidrolisiFeatures/
  // etc. field below derives from this ONE variable, so gating it here at its
  // single source is enough to correctly blank all of them out when the
  // section is off — no need to separately re-check dosificacioOn at each
  // downstream field.
  const dosificacio = dosificacioOn ? a(draft.instalDosificacioStdId) : undefined;
  const hidrolisiFeatures = (() => {
    const specs = dosificacio?.technical_specs;
    if (!specs) return undefined;
    // Only feature1-3 are offered in the catalog UI now (WiFi is handled
    // separately). A lingering feature4 on an older article is simply
    // ignored here — no need to migrate/clean old data.
    const feats = ["feature1", "feature2", "feature3"]
      .map((k) => (typeof specs[k] === "string" ? (specs[k] as string).trim() : ""))
      .filter(Boolean);
    return feats.length ? feats : undefined;
  })();
  const hidrolisiCellHours = (() => {
    const n = Number(dosificacio?.technical_specs?.garantia_cellula_hores);
    return Number.isFinite(n) && n > 0 ? n : 8000;
  })();
  // When the chosen clorador already has WiFi built in, the separate WiFi
  // module add-on doesn't apply — the wizard also forces instalWifiEnabled
  // off in this case (see StepInstalacions.tsx), so this is mostly a
  // belt-and-braces read of the same catalog flag for the PDF.
  const hidrolisiWifiIncorporat = dosificacio?.technical_specs?.wifi_incorporat === true;
  // Independent from wifi_incorporat: some "incorporat" equips (e.g. Plus NG)
  // still require physically buying/installing the WiFi module internally,
  // even though nothing about it is shown to the client. When true, the
  // wizard auto-enables the module (no toggle) and its cost must still be
  // summed into the client-facing total below — unlike the plain
  // wifi_incorporat case, where the cost is already bundled into the equip's
  // own price and must NOT be added again.
  const hidrolisiWifiModulCompraInterna = dosificacio?.technical_specs?.wifi_modul_compra_interna === true;
  // Gated on quadreOn — same reasoning as dosificacio above. Also covers the
  // instalQuadreFinalSale fallback in quadreEquipSale below, which used to
  // bypass this variable entirely and could keep a manually-typed override
  // price alive even with the section switched off.
  const quadre = quadreOn ? a(draft.instalQuadreId) : undefined;
  const revestimentArt = a(draft.revestimentModelId);

  // ---- Mano de obra técnico instalador (preu unitari) +
  // subtotales de subfase "depuracio" / "dosificacio" dentro de Instal·lacions.
  const norm = (s: any) =>
    String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const instalPhase = (draft.phases || []).find((p) => /instal/i.test(p.name));
  let preuMo = 0;
  let depuracioSubTotal = 0;
  let dosificacioSubTotal = 0;
  if (instalPhase) {
    for (const it of instalPhase.items as any[]) {
      const sp = norm(it.subPhase);
      const desc = norm(it.description);
      if (sp.includes("general") && desc.includes("mano de obra") && desc.includes("tecnico instalador")) {
        // Use the highest unit sale found (defensive against duplicates).
        if (Number(it.unitSale || 0) > preuMo) preuMo = Number(it.unitSale || 0);
      }
      if (sp.includes("depurac")) {
        depuracioSubTotal += Math.ceil((Number(it.quantity) || 0) * (Number(it.unitSale) || 0));
      }
      if (sp.includes("dosificac")) {
        dosificacioSubTotal += Math.ceil((Number(it.quantity) || 0) * (Number(it.unitSale) || 0));
      }
    }
  }

  // Build a lookup of user-edited wizard lines by wizardKey so PDF section
  // pills reflect manual price changes made in the Partides step.
  const wizardEditedByKey = new Map<string, { quantity: number; unitSale: number }>();
  for (const ph of draft.phases || []) {
    for (const it of (ph.items || []) as any[]) {
      if (it && it.userEdited === true && it.wizardKey) {
        wizardEditedByKey.set(it.wizardKey, {
          quantity: Number(it.quantity) || 0,
          unitSale: Number(it.unitSale) || 0,
        });
      }
    }
  }
  // Returns the effective equip sale total for a wizardKey. When the user has
  // manually edited the line in Partides, use quantity * unitSale from the
  // edited item; otherwise fall back to the article-based default.
  const editedEquipSale = (key: string | undefined, fallback: number): number => {
    if (!key) return fallback;
    const edited = wizardEditedByKey.get(key);
    if (!edited) return fallback;
    return edited.quantity * edited.unitSale;
  };

  // Included filter sale (per qty)
  const filtreInclosArt = (() => {
    const sorraInclos = !!draft.instalFiltrePoliesId && !(draft as any).instalFiltrePoliesOpcional;
    const cartutxInclos = !!draft.instalFiltreEspecialId && !draft.instalFiltreEspecialOpcional;
    return cartutxInclos && !sorraInclos
      ? {
          art: a(draft.instalFiltreEspecialId),
          qty: Number(draft.instalFiltreEspecialQty ?? 1),
          tipus: "cartutx" as const,
        }
      : { art: a(draft.instalFiltrePoliesId), qty: Number(draft.instalFiltrePoliesQty ?? 1), tipus: "sorra" as const };
  })();
  const filtreInclosKey =
    filtreInclosArt.tipus === "cartutx" ? "instal_filtre_especial" : "instal_filtre_polies";
  const filtreInclosSale = editedEquipSale(
    filtreInclosArt.art ? filtreInclosKey : undefined,
    filtreInclosArt.art ? Number(filtreInclosArt.art.sale || 0) * filtreInclosArt.qty : 0,
  );
  const prefiltreOn = !!draft.instalPrefiltreEnabled;
  const prefiltreSaleVal = editedEquipSale("instal_prefiltre", (() => {
    const art = a(draft.instalPrefiltreArticleId);
    if (!art) return 0;
    return Number(art.sale || 0) * Number(draft.instalPrefiltreQty ?? 1);
  })());

  // ---- Section totals (override the pill amounts shown in PDF pages 5/6/7) ----
  // Note: AFM ("VIDRE AFM") is NOT added here as a separate term — it's a
  // DB-configured formula-engine rule (condition_field: instal_afm_enabled)
  // that already generates its own full-price line tagged sub_phase
  // "depuracio", which depuracioSubTotal below picks up automatically. Adding
  // it again here would double-count it.
  // Gated on depuracioOn as a whole expression (not just its individual
  // terms) — the 11h MO figure was previously added unconditionally even
  // with the section switched off.
  const depuracioSectionAmount = depuracioOn
    ? Math.ceil(filtreInclosSale) +
      (filtreInclosArt.tipus === "sorra" ? depuracioSubTotal : 0) +
      Math.ceil(11 * preuMo) +
      (prefiltreOn ? Math.ceil(prefiltreSaleVal) : 0)
    : 0;

  // Bomba (group autobomba) — equip sale + 12h MO
  const bombaSaleVal = (() => {
    const onoffInclos = !!draft.instalBombaOnoffId && !draft.instalBombaOnoffOpcional;
    // Requires !onoffInclos, same as filtreInclosArt's cartutxInclos &&
    // !sorraInclos guard — On/Off wins the tie when both flags are
    // ambiguously "inclòs" (e.g. undefined _Opcional fields), so Variable
    // never gets picked as included by default.
    const variableInclos = !!draft.instalBombaVariableId && !draft.instalBombaVariableOpcional && !onoffInclos;
    const art = variableInclos ? a(draft.instalBombaVariableId) : onoffInclos ? a(draft.instalBombaOnoffId) : undefined;
    const qty = variableInclos ? Number(draft.instalBombaVariableQty ?? 1) : Number(draft.instalBombaOnoffQty ?? 1);
    const key = variableInclos ? "instal_bomba_variable" : onoffInclos ? "instal_bomba_onoff" : undefined;
    const fallback = art ? Number(art.sale || 0) * qty : 0;
    return editedEquipSale(key, fallback);
  })();
  const bombaSectionAmount = Math.ceil(bombaSaleVal) + Math.ceil(8 * preuMo);

  // Electrolisi salina — equip + subfase dosificacio + 12h MO + WiFi add-on
  // (only when enabled AND not already bundled into the equip itself via
  // wifi_incorporat — in that case there's no separate module partida and
  // its price is already part of dosificacioEquipSale).
  const dosificacioEquipSale = editedEquipSale(
    "instal_dosificacio_std",
    dosificacio ? Number(dosificacio.sale || 0) * Number(draft.instalDosificacioStdQty ?? 1) : 0,
  );
  const wifiArt = a(draft.instalWifiArticleId);
  const wifiSaleAmount = wifiArt ? Number(wifiArt.sale || 0) : undefined;
  // Sum the module cost unless it's genuinely bundled at no extra cost
  // (wifi_incorporat with no internal purchase needed). When the equip is
  // "incorporat" but still requires buying the module internally
  // (wifi_modul_compra_interna), the cost is real and must still count.
  const wifiOn =
    !!draft.instalWifiEnabled && (!hidrolisiWifiIncorporat || hidrolisiWifiModulCompraInterna);
  // Gated on dosificacioOn as a whole expression, same reasoning as
  // depuracioSectionAmount above — the 18h MO figure was previously added
  // unconditionally even with the section switched off.
  const electrolisiSectionAmount = dosificacioOn
    ? Math.ceil(dosificacioEquipSale) +
      dosificacioSubTotal +
      Math.ceil(18 * preuMo) +
      (wifiOn && typeof wifiSaleAmount === "number" ? Math.ceil(wifiSaleAmount) : 0)
    : 0;

  // Quadre elèctric — equip sale + 4h MO. Both gated on quadreOn as a whole
  // expression: quadreEquipSale's own instalQuadreFinalSale fallback (a
  // manually-typed override price) bypasses the `quadre` variable entirely,
  // so it needed its own explicit check here rather than relying on `quadre`
  // already being undefined when the section is off.
  const quadreEquipSale = quadreOn
    ? editedEquipSale(
        "instal_quadre",
        typeof draft.instalQuadreFinalSale === "number"
          ? Number(draft.instalQuadreFinalSale)
          : quadre
            ? Number(quadre.sale || 0)
            : 0,
      )
    : 0;
  const quadreRowAmount = quadreOn ? Math.ceil(quadreEquipSale) + Math.ceil(4 * preuMo) : 0;

  // Company settings
  let company: any = {};
  try {
    const { data: cs } = await supabase.from("company_settings").select("*").limit(1).single();
    company = cs || {};
  } catch {
    /* ignore */
  }

  // Phase totals — the new template needs the 4 fixed buckets explicitly.
  const phaseAmount = (matcher: RegExp) =>
    pdfPhases.filter((p) => matcher.test(p.name)).reduce((s, p) => s + p.subtotal, 0);
  const phaseStructuralTotal = phaseAmount(/estructur/i) || pdfPhases[0]?.subtotal || 0;
  // Vas (pool shell) subtotal — items inside the Estructura phase with subPhase = 'vas'
  const estructuraPhaseRaw = (draft.phases || []).find((p) => /estructur/i.test(p.name));
  const vasTotal = estructuraPhaseRaw
    ? estructuraPhaseRaw.items
        .filter((it: any) => String(it.subPhase || "").toLowerCase() === "vas")
        .reduce((s: number, it: any) => s + Math.ceil((it.quantity || 0) * (it.unitSale || 0)), 0)
    : 0;
  const phaseAcabatsTotal = phaseAmount(/acabat/i) || 0;
  // Split Acabats by sub_phase ("coronament" / "revestiment")
  const acabatsPhaseRaw = (draft.phases || []).find((p) => /acabat/i.test(p.name));
  const sumBySubPhase = (sub: string) =>
    acabatsPhaseRaw
      ? acabatsPhaseRaw.items
          .filter((it: any) =>
            String(it.subPhase || "")
              .toLowerCase()
              .includes(sub),
          )
          .reduce((s: number, it: any) => s + Math.ceil((it.quantity || 0) * (it.unitSale || 0)), 0)
      : 0;
  const coronamentTotal = sumBySubPhase("coronament");
  // Split "revestiment" between INTERIOR (subPhase includes "revestiment" but
  // NOT "exterior") and EXTERIOR (subPhase includes "exterior").
  const sumBySubPhaseMatch = (fn: (sub: string) => boolean) =>
    acabatsPhaseRaw
      ? acabatsPhaseRaw.items
          .filter((it: any) => fn(String(it.subPhase || "").toLowerCase()))
          .reduce((s: number, it: any) => s + Math.ceil((it.quantity || 0) * (it.unitSale || 0)), 0)
      : 0;
  const revestimentTotal = sumBySubPhaseMatch(
    (sub) => sub.includes("revestiment") && !sub.includes("exterior"),
  );
  const revestimentExteriorTotal = sumBySubPhaseMatch((sub) => sub.includes("exterior"));

  // Compute coronament metres lineals (the wizard never stores it; recreate here).
  const PIECE_W: Record<string, number> = {
    gres_31x62: 0.3,
    gres_31x98: 0.3,
    gres_50x62: 0.5,
    gres_98x50: 0.5,
    pedra_blanca: 0.4,
    breinco: 0.4,
  };
  const wPieces = PIECE_W[draft.coronamentTipus || ""] ?? 0.3;
  const lg = draft.poolLength || 0;
  const an = draft.poolWidth || 0;
  let coronamentMlComputed = 0;
  if (lg > 0 || an > 0) {
    coronamentMlComputed = (lg + wPieces) * 2 + 2 + ((an + wPieces) * 2 + 2);
    if (draft.hasExteriorStairs && (draft.extStairsLength || 0) > 0) {
      coronamentMlComputed += (draft.extStairsLength as number) * 2 + 0.6 + 2;
    }
    coronamentMlComputed = Math.round(coronamentMlComputed * 100) / 100;
  }

  // Revestiment format display
  const REV_FORMAT_LABELS: Record<string, string> = {
    "2.5x2.5": "2,5 × 2,5 cm",
    "5x5": "5 × 5 cm",
    "31x31": "31 × 31 cm",
    "31x62": "31 × 62 cm",
    "49x98": "49 × 98 cm",
  };
  const phaseDepuracioTotal = phaseAmount(/depurac|filtrac/i) || 0;
  const phaseElectricitatTotal =
    phaseAmount(/electric|fontaner/i) ||
    Math.max(0, totalSale - phaseStructuralTotal - phaseAcabatsTotal - phaseDepuracioTotal);

  // ---- Accessoris (Page 8) ----
  const accBasicsColor: "blanc" | "color" = draft.accBasicsColor === "color" ? "color" : "blanc";
  const focusLedColorSurcharge = String(draft.accFocusLedVariant ?? "").split("|")[0] === "color" ? 14 : 0;

  const buildBasicLine = (
    label: string,
    qty: number | undefined,
    modelId: string | undefined | null,
    extraUnit = 0,
    overrideLabel?: string,
  ): { label: string; qty: number; total: number } | null => {
    const q = Number(qty ?? 0);
    if (q <= 0) return null;
    const art = a(modelId || undefined);
    const unit = (art?.sale ?? 0) + extraUnit;
    return { label: overrideLabel || art?.name || label, qty: q, total: Math.ceil(q * unit) };
  };

  const accBasicLines = [
    buildBasicLine("Impulsors", draft.accImpulsorsQty, draft.accImpulsorsModelId),
    buildBasicLine("Skimmers", draft.accSkimmersQty, draft.accSkimmersModelId),
    buildBasicLine("Embornal", draft.accEmbornalQty, draft.accEmbornalModelId),
    buildBasicLine(
      "Focus LED",
      draft.accFocusLedQty,
      draft.accFocusLedModelId,
      focusLedColorSurcharge,
      draft.accFocusLedText || undefined,
    ),
    buildBasicLine("Projector Mini LED", draft.accProjectorMiniLedQty, draft.accProjectorMiniLedModelId),
    buildBasicLine("Regulador de nivell + boquilla", draft.accReguladorQty, draft.accReguladorModelId),
    buildBasicLine("Presa netejafons", draft.accNetejafonsQty, draft.accNetejafonsModelId),
    draft.accControlRgbModelId
      ? buildBasicLine("Sistema de control RGB", draft.accControlRgbQty, draft.accControlRgbModelId)
      : null,
  ].filter(Boolean) as Array<{ label: string; qty: number; total: number }>;
  const accBasicTotal = accBasicLines.reduce((s, l) => s + l.total, 0);

  const buildOptLine = (
    enabled: boolean | undefined,
    fallbackLabel: string,
    qty: number | undefined,
    modelId: string | undefined | null,
    fixedPrice?: number,
  ) => {
    if (!enabled) return null;
    const q = Number(qty ?? 1);
    if (q <= 0) return null;
    if (typeof fixedPrice === "number") {
      return { label: fallbackLabel, qty: q, total: Math.ceil(q * fixedPrice) };
    }
    const art = a(modelId || undefined);
    return { label: art?.name || fallbackLabel, qty: q, total: Math.ceil(q * (art?.sale ?? 0)) };
  };

  // Cascada — now has its OWN dedicated PDF page (PageCascada), so it's no
  // longer part of the generic "Accessoris opcionals" page/list. Its 4 lines
  // (Cascada, Bomba, Pulsador, and the "Mà d'obra instal·lació cascada"
  // formula-engine rule) all land in draft.phases under subPhase "cascada"
  // (wizardLines.ts + the Motor de Càlcul rule use that same slug so they
  // group together — see mergeFormulaResultsIntoPhases). Scanning pdfPhases
  // for that subPhase, same pattern already used for bomba_calor/gespa/
  // paviment/caseta/netejafons below, means a future rule change needs no
  // code update here or in PageCascada.
  const cascadaLines = pdfPhases
    .flatMap((ph) => ph.items || [])
    .filter((it: any) => String(it.subPhase || "").toLowerCase() === "cascada" && Number(it.quantity || 0) > 0)
    .map((it: any) => ({ label: String(it.description || ""), qty: Number(it.quantity) || 0, total: Number(it.total) || 0 }));
  const cascadaTotal = cascadaLines.reduce((s, l) => s + l.total, 0);
  const cascadaArt = a(draft.accCascadaModelId || undefined);
  const cascadaBombaArt = a(draft.accCascadaBombaArticleId || undefined);
  const cascadaEncastada = cascadaArt?.technical_specs?.encastada === true;
  const cascadaDiametreMm = Number(cascadaArt?.technical_specs?.diametre_mm) || 50;

  const accOptionalLines = [
    buildOptLine(draft.accEscalaEnabled, "Escala inox", draft.accEscalaQty, draft.accEscalaModelId),
    buildOptLine(draft.accDutxaEnabled, "Dutxa exterior", draft.accDutxaQty, draft.accDutxaModelId),
    buildOptLine(draft.accPlatDutxaEnabled, "Plat de dutxa", draft.accPlatDutxaQty, undefined, 550),
    buildOptLine(
      draft.accSalvavidesEnabled,
      "Salvavides + suport paret",
      draft.accSalvavidesQty,
      draft.accSalvavidesModelId,
    ),
    buildOptLine(draft.accBaranaEnabled, "Barana ancorada exterior", draft.accBaranaQty, draft.accBaranaModelId),
  ].filter(Boolean) as Array<{ label: string; qty: number; total: number }>;
  const accOptionalTotal = accOptionalLines.reduce((s, l) => s + l.total, 0);

  // --- Annex OPCIONAL — Revestiment alternatiu ---
  // Re-evaluate the "revestiment" subphase formulas with the opcional fields
  // swapped into the main revestiment slots, so the pill displays the same
  // total the budget would have if the alternative were chosen instead.
  let annexOpcionalRevestimentAmount = 0;
  let annexOpcionalRevestimentAmountEpoxi = 0;
  let opcRevestimentArt: { name?: string; image_url?: string } | undefined;
  if (draft.opcionalRevestimentTipus) {
    try {
      const { evaluateFormulaRules } = await import("@/lib/formulaEngine");
      const { data: rules } = await supabase
        .from("formula_rules")
        .select("*")
        .eq("budget_type", "obra_nova")
        .eq("phase", "acabats")
        .eq("sub_phase", "revestiment")
        .eq("is_active", true);
      const { data: allArticles } = await supabase.from("articles").select("*");
      const swapped = {
        ...draft,
        revestimentTipus: draft.opcionalRevestimentTipus,
        revestimentFormat: draft.opcionalRevestimentFormat,
        revestimentModelId: draft.opcionalRevestimentModelId,
        revestimentBeurada: draft.opcionalRevestimentBeurada,
        revestimentBeuradaColor: draft.opcionalRevestimentBeuradaColor,
        revestimentModelADeterminar: !draft.opcionalRevestimentModelId,
        // mirror DB snake_case as well (formulaEngine reads both)
        revestiment_tipus: draft.opcionalRevestimentTipus,
        revestiment_format: draft.opcionalRevestimentFormat,
        revestiment_model_id: draft.opcionalRevestimentModelId,
        revestiment_beurada: draft.opcionalRevestimentBeurada,
        revestiment_model_a_determinar: !draft.opcionalRevestimentModelId,
      };
      const results = evaluateFormulaRules((rules || []) as any, swapped, (allArticles || []) as any);
      annexOpcionalRevestimentAmount = results.reduce((s, r) => s + Math.ceil(Number(r.sale) || 0), 0);
      // Re-evaluate forcing beurada = "epoxi" to compute the epoxi alternative total.
      const swappedEpoxi = {
        ...swapped,
        revestimentBeurada: "epoxi",
        revestiment_beurada: "epoxi",
      };
      const resultsEpoxi = evaluateFormulaRules((rules || []) as any, swappedEpoxi, (allArticles || []) as any);
      annexOpcionalRevestimentAmountEpoxi = resultsEpoxi.reduce((s, r) => s + Math.ceil(Number(r.sale) || 0), 0);
      if (draft.opcionalRevestimentModelId) {
        const found = (allArticles || []).find((x: any) => x.id === draft.opcionalRevestimentModelId);
        if (found) {
          opcRevestimentArt = { name: found.name, image_url: found.image_url };
        }
      }
    } catch (e) {
      console.warn("[opcional revestiment] formula re-eval failed", e);
    }
  }

  // --- Annex Sistema Neteja Fons: pre-compute boquilles so we can reuse the
  // result both as PDF fields and as a fallback when the annex is "opcional"
  // (no partides exist → article-based amount). Mirrors StepAnnex.netejafonsCalc.
  const nfBoq = (() => {
    const stairType = draft.interiorStairsType;
    const pl = Number(draft.poolLength || 0);
    const pw = Number(draft.poolWidth || 0);
    const depthMin = Number(draft.poolDepthMin || 0);
    const stairLen = Number(draft.stairsLength || 0);
    let autoFons = 0;
    if (pl > 0 && pw > 0) {
      if (stairType === "tot_ample" || stairType === "plataforma") {
        autoFons = Math.ceil((Math.max(0, pl - stairLen) * pw) / 3.25);
      } else if (stairType === "estandard" || stairType === "banc") {
        autoFons = Math.ceil((Math.max(0, pl - stairLen) * pw) / 3.25) + 1;
      } else {
        autoFons = Math.ceil((pl * pw) / 3.25) + 1;
      }
    }
    let autoEscala = 0;
    if (stairType && stairType !== "sense" && depthMin > 0) {
      const base = Math.max(0, Math.ceil(depthMin / 0.2) - 1);
      autoEscala = stairType === "tot_ample" && pw > 0 ? base * Math.max(1, Math.ceil(pw / 2.8)) : base;
    }
    let autoPlat = 0;
    if (stairType === "plataforma") {
      const w = Number(draft.platformWidth || draft.platformLength || 0);
      if (w > 0) autoPlat = Math.max(1, Math.ceil(w / 2.5));
    } else if (stairType === "banc") {
      const w = Number(draft.benchWidth || draft.benchLength || 0);
      if (w > 0) autoPlat = Math.max(1, Math.ceil(w / 2.5));
    }
    return {
      fons: draft.annexNetejafonsFons != null ? Number(draft.annexNetejafonsFons) : autoFons,
      escala: draft.annexNetejafonsEscala != null ? Number(draft.annexNetejafonsEscala) : autoEscala,
      plataforma: draft.annexNetejafonsPlataforma != null ? Number(draft.annexNetejafonsPlataforma) : autoPlat,
      thirdLabel: stairType === "banc" ? "Banc" : "Plataforma",
    };
  })();

  const _fmtDim = (n?: number | null) =>
    typeof n === "number" && !isNaN(n)
      ? `${n.toLocaleString("ca-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}m`
      : "";

  const data: NewPdfData = {
    budgetNumber: draft.budgetNumber || "-",
    budgetDate: draft.budgetDate || new Date().toISOString(),
    type: typeLabels[draft.type || "obra_nueva"],
    clientName: draft.clientName || "-",
    clientNif: draft.clientNif,
    clientAddress: draft.clientAddress,
    clientTown: draft.clientTown,
    clientPhone: draft.clientPhone,
    clientEmail: draft.clientEmail,
    comercialName,
    comercialEmail,
    poolLength: draft.poolLength,
    poolWidth: draft.poolWidth,
    poolDepthMin: draft.poolDepthMin,
    poolDepthMax: draft.poolDepthMax,
    poolVolumeM3: volume ? Math.round(volume / 1000) : undefined,
    poolSurfaceM2: surface,
    hasInteriorStairs: !!draft.interiorStairsType && draft.interiorStairsType !== "sense",
    interiorStairsType: draft.interiorStairsType,
    hasExteriorStairs: draft.hasExteriorStairs,
    extStairsLength: draft.extStairsLength,
    extStairsWidth: draft.extStairsWidth,
    poolDisposition: draft.poolDisposition,
    alturaVista: computeEffectiveHeight(draft) || undefined,
    hasAccessStair: computeHasAccessStair(draft),
    accessStairWidth: Number(draft.accessStairWidth ?? 0.70) || undefined,
    accessStairLength: (() => {
      const alt = computeEffectiveHeight(draft);
      const steps = alt > 0 ? Math.max(0, alt / 0.20 - 1) : 0;
      return Math.round(steps * 0.30 * 100) / 100 || undefined;
    })(),
    accessPlatformWidth: Number(draft.accessStairWidth ?? 0.70) || undefined,
    accessPlatformLength: (() => {
      const alt = computeEffectiveHeight(draft);
      const totalL = Number(
        draft.accessTotalLength ?? ((Number(draft.poolWidth || 0) || 0) + 0.60),
      );
      const steps = alt > 0 ? Math.max(0, alt / 0.20 - 1) : 0;
      const stairL = Math.round(steps * 0.30 * 100) / 100;
      return Math.max(0, Math.round((totalL - stairL) * 100) / 100) || undefined;
    })(),
    waterproofingSystem: draft.waterproofingSystem,
    constructionSystem: draft.constructionSystem,
    poolType: draft.poolType,
    poolShape: draft.poolShape,
    stairsDimensions: draft.stairsLength
      ? `${_fmtDim(draft.stairsWidth)} x ${_fmtDim(draft.stairsLength)} x ${_fmtDim(draft.stairsHeight)}`
      : undefined,
    hasPlatform: !!(draft.platformLength || draft.platformWidth || draft.benchLength || draft.benchWidth),
    platformDimensions:
      draft.interiorStairsType === "banc"
        ? draft.benchLength
          ? `${_fmtDim(draft.benchWidth)} x ${_fmtDim(draft.benchLength)} x ${_fmtDim(draft.benchHeight)}`
          : undefined
        : draft.platformLength
          ? `${_fmtDim(draft.platformWidth)} x ${_fmtDim(draft.platformLength)} x ${_fmtDim(draft.platformHeight)}`
          : undefined,
    coronamentDescription: a(draft.coronamentModelId)?.name,
    revestimentDescription: revestimentArt?.name,
    revestimentImageUrl: revestimentArt?.image_url || undefined,
    // ---- Coronament details for Page 4 ----
    coronamentActuacioLabel:
      (
        {
          suministre_col: "Subministrament i col·locació",
          suministre: "Subministrament",
          col: "Col·locació",
        } as Record<string, string>
      )[draft.coronamentActuacio || ""] || undefined,
    coronamentMl: draft.coronamentMl || coronamentMlComputed || undefined,
    coronamentBeuradaLabel:
      draft.coronamentBeurada === "epoxi" ? "Beurada epoxi" : draft.coronamentBeurada ? "Beurada cimentosa" : undefined,
    coronamentBeuradaColor: draft.coronamentBeuradaColor || undefined,
    coronamentTipusLabel:
      (
        {
          gres_31x62: "GRES PORCELÀNIC 31×62",
          gres_31x98: "GRES PORCELÀNIC 31×98",
          gres_50x62: "GRES PORCELÀNIC 50×62",
          gres_98x50: "GRES PORCELÀNIC 98×50",
          pedra_blanca: "PEDRA BLANCA ARTIFICIAL 40cm",
          breinco: "BREINCO 40×60",
        } as Record<string, string>
      )[draft.coronamentTipus || ""] || undefined,
    coronamentTipusFormat: draft.coronamentFormat || undefined,
    coronamentModelName: a(draft.coronamentModelId)?.name,
    coronamentModelImageUrl: a(draft.coronamentModelId)?.image_url || undefined,
    coronamentTotal: coronamentTotal || undefined,
    revestimentTotal: revestimentTotal || undefined,
    revestimentExteriorInclos: !!draft.revestimentExteriorInclos,
    revestimentExteriorTotal: revestimentExteriorTotal || undefined,
    coronamentInclos: draft.coronamentInclos !== false,
    revestimentInclos: draft.revestimentInclos !== false,
    // ---- Revestiment interior details for Page 4 ----
    revestimentActuacioLabel:
      (
        {
          suministre_col: "Subministrament i col·locació",
          suministre: "Subministrament",
          col: "Col·locació",
        } as Record<string, string>
      )[draft.revestimentActuacio || ""] || undefined,
    revestimentSurfaceText:
      draft.revestimentTipus === "gressite"
        ? "de mosaic vitri en tota la superfície interior de la piscina"
        : draft.revestimentTipus === "porcelanic"
          ? "de gres porcellànic antilliscant en tota la superfície interior de la piscina"
          : undefined,
    revestimentTipusLabel:
      draft.revestimentTipus === "gressite"
        ? "GRESSITE"
        : draft.revestimentTipus === "porcelanic"
          ? "PORCELÀNIC"
          : undefined,
    revestimentTipusFormat: REV_FORMAT_LABELS[draft.revestimentFormat || ""] || draft.revestimentFormat || undefined,
    revestimentBeuradaLabel:
      draft.revestimentBeurada === "epoxi"
        ? "Beurada epoxi"
        : draft.revestimentBeurada
          ? "Beurada cimentosa"
          : undefined,
    revestimentBeuradaColor: draft.revestimentBeuradaColor || undefined,
    revestimentModelName: revestimentArt?.name,
    revestimentModelImageUrl: revestimentArt?.image_url || undefined,
    // ---- Opcional revestiment alternatiu (Annex OPCIONAL page) ----
    annexOpcionalRevestimentEstat: draft.opcionalRevestimentTipus ? "opcional" : "no",
    annexOpcionalRevestimentTipusLabel:
      draft.opcionalRevestimentTipus === "gressite"
        ? "GRESSITE"
        : draft.opcionalRevestimentTipus === "porcelanic"
          ? "PORCELÀNIC"
          : undefined,
    annexOpcionalRevestimentTipusFormat:
      REV_FORMAT_LABELS[draft.opcionalRevestimentFormat || ""] || draft.opcionalRevestimentFormat || undefined,
    annexOpcionalRevestimentSurfaceText:
      draft.opcionalRevestimentTipus === "gressite"
        ? "de mosaic vitri en tota la superfície interior de la piscina"
        : draft.opcionalRevestimentTipus === "porcelanic"
          ? "de gres porcellànic antilliscant en tota la superfície interior de la piscina"
          : undefined,
    annexOpcionalRevestimentActuacioLabel:
      (
        {
          suministre_col: "Subministrament i col·locació",
          suministre: "Subministrament",
          col: "Col·locació",
        } as Record<string, string>
      )[draft.revestimentActuacio || ""] || undefined,
    annexOpcionalRevestimentBeuradaLabel:
      draft.opcionalRevestimentBeurada === "epoxi"
        ? "Beurada epoxi"
        : draft.opcionalRevestimentBeurada
          ? "Beurada cimentosa"
          : undefined,
    annexOpcionalRevestimentBeuradaColor: draft.opcionalRevestimentBeuradaColor || undefined,
    annexOpcionalRevestimentModelName: opcRevestimentArt?.name,
    annexOpcionalRevestimentModelImageUrl: opcRevestimentArt?.image_url || undefined,
    annexOpcionalRevestimentAmount: annexOpcionalRevestimentAmount || undefined,
    annexOpcionalRevestimentAmountEpoxi: annexOpcionalRevestimentAmountEpoxi || undefined,
    depuracioCapacityM3: volume ? Math.round(volume / 1000) : undefined,
    filtreSorraName: a(draft.instalFiltrePoliesId)?.name,
    filtreSorraImageUrl: a(draft.instalFiltrePoliesId)?.image_url || undefined,
    filtreCartutxName: a(draft.instalFiltreEspecialId)?.name,
    filtreCartutxImageUrl: a(draft.instalFiltreEspecialId)?.image_url || undefined,
    // Determine which filter is INCLUDED in the budget (the one not flagged
    // as opcional). Must key off the _Opcional flag explicitly — the old
    // fallback assumed "cartutx" was included just because
    // instalFiltreEspecialId had a value, with no regard for its opcional
    // flag. That was wrong: Especial gets auto-defaulted (Hayward) as
    // opcional=true on nearly every budget, so that fallback showed it as
    // the INCLUDED filter in the PDF even when the wizard itself displayed
    // it tagged "Opcional". sorra wins if both ended up marked inclòs
    // (mirrors filtreInclosArt's price calc above and the bomba pair's
    // convention below); default to "sorra" when neither is inclòs either.
    ...(function () {
      const sorraInclos = !!draft.instalFiltrePoliesId && !draft.instalFiltrePoliesOpcional;
      const cartutxInclos = !!draft.instalFiltreEspecialId && !draft.instalFiltreEspecialOpcional && !sorraInclos;
      const tipus: "sorra" | "cartutx" = cartutxInclos ? "cartutx" : "sorra";
      const art = tipus === "cartutx" ? a(draft.instalFiltreEspecialId) : a(draft.instalFiltrePoliesId);
      return {
        filtreInclosTipus: tipus,
        filtreInclosName: art?.name,
        filtreInclosImageUrl: art?.image_url || undefined,
      };
    })(),
    // AFM (vidre actiu) increment
    afmEnabled: !!draft.instalAfmEnabled,
    afmQty: draft.instalAfmQty,
    // Differential €: always available so PDF can display the alternative
    // "+xxx €" price even when AFM is NOT included in the budget.
    // Rounded to whole euros so the PDF bullet ("+165 €") agrees with
    // afmDiffAmount above (no lingering decimals like "+164,70 €").
    afmExtraSale:
      typeof draft.instalAfmIncrement === "number"
        ? Math.round(draft.instalAfmIncrement)
        : (() => {
            const art = a(draft.instalAfmArticleId);
            const qty = Number(draft.instalAfmQty ?? 0);
            if (!art || !qty) return undefined;
            return Math.round(Number(art.sale || 0) * qty);
          })(),
    // Prefiltre HYDROSPIN COMPACT
    prefiltreEnabled: !!draft.instalPrefiltreEnabled,
    prefiltreName: a(draft.instalPrefiltreArticleId)?.name,
    prefiltreImageUrl: a(draft.instalPrefiltreArticleId)?.image_url || undefined,
    prefiltreSale: (() => {
      const art = a(draft.instalPrefiltreArticleId);
      const qty = Number(draft.instalPrefiltreQty ?? 1);
      if (!art) return undefined;
      return Number(art.sale || 0) * qty;
    })(),
    bombaStandardName: a(draft.instalBombaOnoffId)?.name,
    bombaStandardImageUrl: a(draft.instalBombaOnoffId)?.image_url || undefined,
    bombaInverterName: a(draft.instalBombaVariableId)?.name,
    bombaInverterImageUrl: a(draft.instalBombaVariableId)?.image_url || undefined,
    // Drives just the "GRUP MOTOBOMBA AUTOASPIRANT" section inside Page 5
    // (PageDepuracio1) — NOT that whole page's inclusion (see
    // depuracioEnabled's own comment for why). bombaInclosTipus/Total below
    // already correctly come out unset when this is false; kept as an
    // explicit flag for the same reason as the other 3.
    bombaEnabled: bombaOn,
    ...(function () {
      // Gated on bombaOn — same bug/fix as Depuració/Dosificació/Quadre: a
      // persisted instalBombaOnoffId/instalBombaVariableId used to survive
      // the "Incloure aquesta secció" toggle being switched off, so this
      // whole block (and the "GRUP MOTOBOMBA AUTOASPIRANT" section it
      // feeds on Page 5) kept showing the old equip/price regardless.
      if (!bombaOn) return {};
      const onoffInclos = !!draft.instalBombaOnoffId && !draft.instalBombaOnoffOpcional;
      // Requires !onoffInclos — see bombaSaleVal above for why.
      const variableInclos = !!draft.instalBombaVariableId && !draft.instalBombaVariableOpcional && !onoffInclos;
      const tipus: "standard" | "inverter" | undefined = variableInclos
        ? "inverter"
        : onoffInclos
          ? "standard"
          : undefined;
      if (!tipus) return {};
      const art = tipus === "inverter" ? a(draft.instalBombaVariableId) : a(draft.instalBombaOnoffId);
      const name = (art?.name || "").toUpperCase();
      const qty =
        tipus === "inverter" ? Number(draft.instalBombaVariableQty ?? 1) : Number(draft.instalBombaOnoffQty ?? 1);
      // Section pill amount = equip + 12h mano de obra técnico instalador.
      // Respect user-edited unitSale from the Partides step.
      const key = tipus === "inverter" ? "instal_bomba_variable" : "instal_bomba_onoff";
      const equipSale = editedEquipSale(key, art ? Number(art.sale || 0) * qty : 0);
      const total = art ? Math.ceil(equipSale) + Math.ceil(8 * preuMo) : undefined;
      let flow: string | undefined;
      if (tipus === "inverter") {
        if (name.includes("IP 20") || name.includes("IP20")) flow = "5 a 20m3/h";
        else if (name.includes("IP 25") || name.includes("IP25")) flow = "5 a 25m3/h";
        else if (name.includes("IP 30") || name.includes("IP30")) flow = "5 a 31m3/h";
        else if (name.includes("IP 40") || name.includes("IP40")) flow = "8 a 38m3/h";
      } else {
        // Match "DOLFI 2 XXXM" before "DOLFI XXXM"
        if (name.includes("DOLFI 2 75M")) flow = "14m3/h";
        else if (name.includes("DOLFI 2 100M")) flow = "18m3/h";
        else if (name.includes("DOLFI 2 150M")) flow = "21m3/h";
        else if (name.includes("DOLFI 2 200M")) flow = "26m3/h";
        else if (name.includes("DOLFI 2 300M")) flow = "32m3/h";
        else if (name.includes("DOLFI 75M")) flow = "11,5m3/h";
        else if (name.includes("DOLFI 100M")) flow = "13,3m3/h";
        else if (name.includes("DOLFI 150M")) flow = "15m3/h";
      }
      // Combo de bomba variable (2 o 3 unitats del mateix model treballant en
      // paral·lel, recomanat per EquipmentRecommendations quan cap unitat
      // individual cobreix el caudal de rentat necessari) — el nom i el text
      // de cabal del PDF han de deixar clara la quantitat, no només el preu.
      const isVariableCombo = tipus === "inverter" && qty > 1;
      return {
        bombaInclosTipus: tipus,
        bombaInclosName: isVariableCombo && art ? `${qty}× ${art.name}` : art?.name,
        bombaInclosImageUrl: art?.image_url || undefined,
        bombaInclosFlowText:
          isVariableCombo && flow ? `${flow} per unitat (${qty} unitats en paral·lel per cobrir el rentat)` : flow,
        bombaInclosTotal: total,
      };
    })(),
    // -------- Opcional per al client: filtre i bomba --------
    ...(function () {
      const out: Record<string, unknown> = {};
      // Filtre opcional
      const sorraOpc = !!draft.instalFiltrePoliesId && !!(draft as any).instalFiltrePoliesOpcional;
      const cartutxOpc = !!draft.instalFiltreEspecialId && !!draft.instalFiltreEspecialOpcional;
      if (sorraOpc || cartutxOpc) {
        const tipus: "sorra" | "cartutx" = cartutxOpc ? "cartutx" : "sorra";
        const art = tipus === "cartutx" ? a(draft.instalFiltreEspecialId) : a(draft.instalFiltrePoliesId);
        const qty =
          tipus === "cartutx" ? Number(draft.instalFiltreEspecialQty ?? 1) : Number(draft.instalFiltrePoliesQty ?? 1);
        out.filtreOpcionalTipus = tipus;
        out.filtreOpcionalName = art?.name;
        out.filtreOpcionalImageUrl = art?.image_url || undefined;
        // Pill total mirrors the "included" pricing formula so the client
        // sees the same amount the budget would show if this filter were
        // included (equip + subfase depuració if sorra + 15h MO + prefiltre).
        const equipSale = art ? Math.ceil(Number(art.sale || 0) * qty) : 0;
        out.filtreOpcionalSale =
          equipSale +
          (tipus === "sorra" ? depuracioSubTotal : 0) +
          Math.ceil(11 * preuMo) +
          (prefiltreOn ? Math.ceil(prefiltreSaleVal) : 0);
      }
      // Bomba opcional
      const onoffOpc = !!draft.instalBombaOnoffId && !!draft.instalBombaOnoffOpcional;
      const variableOpc = !!draft.instalBombaVariableId && !!draft.instalBombaVariableOpcional;
      if (onoffOpc || variableOpc) {
        const tipus: "standard" | "inverter" = variableOpc ? "inverter" : "standard";
        const art = tipus === "inverter" ? a(draft.instalBombaVariableId) : a(draft.instalBombaOnoffId);
        const qty =
          tipus === "inverter" ? Number(draft.instalBombaVariableQty ?? 1) : Number(draft.instalBombaOnoffQty ?? 1);
        const name = (art?.name || "").toUpperCase();
        let flow: string | undefined;
        if (tipus === "inverter") {
          if (name.includes("IP 20") || name.includes("IP20")) flow = "5 a 20m3/h";
          else if (name.includes("IP 25") || name.includes("IP25")) flow = "5 a 25m3/h";
          else if (name.includes("IP 30") || name.includes("IP30")) flow = "5 a 31m3/h";
          else if (name.includes("IP 40") || name.includes("IP40")) flow = "8 a 38m3/h";
        } else {
          if (name.includes("DOLFI 2 75M")) flow = "14m3/h";
          else if (name.includes("DOLFI 2 100M")) flow = "18m3/h";
          else if (name.includes("DOLFI 2 150M")) flow = "21m3/h";
          else if (name.includes("DOLFI 2 200M")) flow = "26m3/h";
          else if (name.includes("DOLFI 2 300M")) flow = "32m3/h";
          else if (name.includes("DOLFI 75M")) flow = "11,5m3/h";
          else if (name.includes("DOLFI 100M")) flow = "13,3m3/h";
          else if (name.includes("DOLFI 150M")) flow = "15m3/h";
        }
        // Combo de bomba variable (2 o 3 unitats) — mateix criteri que el
        // bloc "inclosa" de dalt: el nom i el cabal han de reflectir la
        // quantitat.
        const isVariableCombo = tipus === "inverter" && qty > 1;
        out.bombaOpcionalTipus = tipus;
        out.bombaOpcionalName = isVariableCombo && art ? `${qty}× ${art.name}` : art?.name;
        out.bombaOpcionalImageUrl = art?.image_url || undefined;
        out.bombaOpcionalFlowText =
          isVariableCombo && flow ? `${flow} per unitat (${qty} unitats en paral·lel per cobrir el rentat)` : flow;
        // Same total as if the pump were included: equip + 8h MO.
        const equipSale = art ? Math.ceil(Number(art.sale || 0) * qty) : 0;
        out.bombaOpcionalSale = equipSale + Math.ceil(8 * preuMo);
      }
      return out;
    })(),
    accSkimmersQty: draft.accSkimmersQty,
    accImpulsorsQty: draft.accImpulsorsQty,
    accEmbornalQty: draft.accEmbornalQty,
    accNetejafonsQty: draft.accNetejafonsQty,
    accReguladorQty: draft.accReguladorQty,
    accFocusLedQty: draft.accFocusLedQty,
    // Page 8 — accessoris compiled
    accBasicsColor,
    accBasicLines,
    accBasicTotal,
    accOptionalLines,
    accOptionalTotal,
    // Cascada — dedicated page (PageCascada), out of the generic Accessoris
    // opcionals list/page.
    accCascadaEnabled: !!draft.accCascadaEnabled,
    cascadaLines,
    cascadaTotal,
    cascadaModelName: cascadaArt?.name,
    cascadaModelImageUrl: cascadaArt?.image_url || undefined,
    cascadaEncastada,
    cascadaDiametreMm,
    cascadaBombaName: cascadaBombaArt?.name,
    // Drives whether Page 6 (PageDepuracio2) is included at all, in
    // PdfDocument.tsx. hidrolisiName/hidrolisiTotal below already correctly
    // come out undefined when this is false (they derive from `dosificacio`,
    // itself gated on dosificacioOn above) — this flag is kept as an
    // explicit, separate signal for the page-inclusion check rather than
    // inferring it from those being unset.
    dosificacioEnabled: dosificacioOn,
    // Page 6 (Desinfecció amb electròlisi salina) is dedicated to the
    // standard dosification equipment (clorador salino), NOT the HIDROLISI/UV slot.
    hidrolisiName: dosificacio?.name,
    hidrolisiImageUrl: dosificacio?.image_url || undefined,
    // Section pill amount = equip + subfase "dosificacio" + 12h MO.
    hidrolisiTotal: dosificacio ? electrolisiSectionAmount : undefined,
    hidrolisiFeatures,
    hidrolisiCellHours,
    hidrolisiWifiIncorporat,
    // Mòdul Ethernet / WIFI add-on
    wifiEnabled: !!draft.instalWifiEnabled,
    wifiName: wifiArt?.name,
    wifiImageUrl: wifiArt?.image_url || undefined,
    wifiSale: wifiSaleAmount,
    // Drives just the "Quadre elèctric de maniobra" row inside Page 7
    // (PageElectricitat) — NOT that whole page's inclusion, since it also
    // always shows unrelated Electricitat/Fontaneria/Escomesa content.
    quadreEnabled: quadreOn,
    quadreText: quadre?.name,
    quadreTotal: undefined,
    // Row amount (Quadre elèctric) = equip sale + 4h MO.
    quadreSale: typeof draft.instalQuadreFinalSale === "number" || quadre ? quadreRowAmount : undefined,
    // Drives just the "Presa de terra" row inside Page 7 (PageElectricitat)
    // — NOT that whole page's inclusion (see quadreEnabled's own comment
    // for why: the page also shows the unrelated Quadre/Fontaneria/Escomesa
    // content). electricaSale below already correctly comes out 0 when
    // this is false; kept as an explicit flag for the same reason as the
    // other 4.
    electricaEnabled: electricaOn,
    electricaSale: (() => {
      // Gated on electricaOn — same bug/fix as Depuració/Dosificació/
      // Quadre/Bomba: this used to recompute regardless of the "Incloure
      // aquesta secció" toggle.
      if (!electricaOn) return 0;
      // Recompute live (mirrors src/lib/wizardLines.ts + StepInstalacions.tsx)
      // instead of trusting the cached draft.instalElectricaTotal — that field
      // is only kept in sync while the user is on StepInstalacions, so it goes
      // stale if pool dimensions/distance/article change afterwards and the
      // PDF is generated without revisiting that step. Same fix already
      // applied to fontaneriaTotal below; same root cause, sibling field.
      const base = a(draft.instalElectricaBaseArticleId);
      const baseSale = base?.sale ?? 0;
      const l = Number(draft.poolLength ?? 0);
      const w = Number(draft.poolWidth ?? 0);
      let perimeter = 0;
      if (l !== 0 || w !== 0) {
        perimeter = (l + 0.3) * 2 + 2 + ((w + 0.3) * 2 + 2);
        if (draft.hasExteriorStairs) {
          const le = Number(draft.extStairsLength ?? 0);
          if (le > 0) perimeter += le * 2 + 0.6 + 2;
        }
      }
      const distancia = Number(draft.instalFontaneriaDistancia ?? 10);
      const perimeterExtra = perimeter > 25 ? (perimeter - 25) * 20 : 0;
      const distanciaExtra = distancia > 10 ? (distancia - 10) * 20 : 0;
      const total = baseSale + perimeterExtra + distanciaExtra;
      return total > 0 ? total : (draft.instalElectricaTotal ?? 0);
    })(),
    presaTerraTotal: undefined,
    // Drives the whole "INSTAL·LACIÓ FONTANERIA" pill on Page 7
    // (PageElectricitat): unlike Quadre/Electricitat (which each share a
    // pill with unrelated content), Fontaneria's pill is self-contained —
    // safe to hide entirely, same as Depuració/Dosificació/Bomba's blocks.
    fontaneriaEnabled: fontaneriaOn,
    fontaneriaText: draft.instalFontaneriaText || undefined,
    fontaneriaTotal: (() => {
      // Gated on fontaneriaOn — same bug/fix as the other 4 sections above.
      if (!fontaneriaOn) return 0;
      // Recompute live (mirrors src/lib/wizardLines.ts) so toggling
      // perforacions in the wizard is always reflected in the PDF, even
      // if the user never clicked Next/Back to persist instalFontaneriaTotal.
      const base = a(draft.instalFontaneriaBaseArticleId);
      const baseSale = base?.sale ?? 0;
      const l = Number(draft.poolLength ?? 0);
      const w = Number(draft.poolWidth ?? 0);
      let perimeter = 0;
      if (l !== 0 || w !== 0) {
        perimeter = (l + 0.3) * 2 + 2 + ((w + 0.3) * 2 + 2);
        if (draft.hasExteriorStairs) {
          const le = Number(draft.extStairsLength ?? 0);
          if (le > 0) perimeter += le * 2 + 0.6 + 2;
        }
      }
      const distancia = Number(draft.instalFontaneriaDistancia ?? 10);
      const perimeterExtra = perimeter > 25 ? (perimeter - 25) * 55 : 0;
      const distanciaExtra = distancia > 10 ? (distancia - 10) * 55 : 0;
      const perforacionsArt = a(draft.instalFontaneriaPerforacionsArticleId);
      const perforacionsPrice =
        draft.instalFontaneriaPerforacions && draft.instalFontaneriaLocalTecnic === "existent"
          ? (perforacionsArt?.sale ?? 0)
          : 0;
      const rasasPrice = (draft as any).instalFontaneriaRasasEnabled
        ? Number((draft as any).instalFontaneriaRasasImport ?? 0)
        : 0;
      const total = baseSale + perimeterExtra + distanciaExtra + perforacionsPrice + rasasPrice;
      return total > 0 ? total : (draft.instalFontaneriaTotal ?? 0);
    })(),
    fontaneriaDistancia: draft.instalFontaneriaDistancia ?? 10,
    fontaneriaPerforacions: !!draft.instalFontaneriaPerforacions,
    escomesaIncluded: true,
    phaseStructuralTotal,
    vasTotal,
    elementsEstructuralsTotal: Math.max(0, phaseStructuralTotal - vasTotal),
    phaseAcabatsTotal,
    phaseDepuracioTotal,
    phaseElectricitatTotal,
    // Section pill amount used by Page 5 (DEPURACIÓ).
    depuracioSectionAmount,
    // Drives just the DEPURACIÓ pill + filter block inside Page 5
    // (PageDepuracio1) — NOT that whole page's inclusion, since it also
    // independently shows "GRUP MOTOBOMBA AUTOASPIRANT" when
    // data.bombaInclosTipus is set, unrelated to this toggle.
    depuracioEnabled: depuracioOn,
    // Annex — Projecte Tècnic d'Obra
    annexProjecteEstat: (draft.annexProjecteEstat as any) || "no",
    annexProjecteName: a(draft.annexProjecteArticleId)?.name,
    annexProjecteAmount: (() => {
      const art = a(draft.annexProjecteArticleId);
      if (!art) return 0;
      return Math.ceil(Number(art.sale || 0) * Number(draft.annexProjecteQty ?? 1));
    })(),
    // Annex — Excavació
    annexExcavacioEstat: (draft.annexExcavacioEstat as any) || "no",
    ...(() => {
      // First, look for user-edited values in the wizard's partides — these
      // take precedence over the automatic formula so that any manual change
      // made in Step "Partides" is reflected in the PDF.
      const norm = (s: string) => String(s ?? "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const excavItems: any[] = [];
      for (const ph of (draft.phases || [])) {
        for (const it of (ph.items || [])) {
          const sub = norm((it as any).subPhase || "");
          const desc = norm(it.description || "");
          if (sub.includes("excavac") || desc.includes("excavac") || desc.includes("re-ompliment") || desc.includes("re ompliment") || desc.includes("reompliment")) {
            excavItems.push(it);
          }
        }
      }
      const findItem = (predicate: (desc: string) => boolean) =>
        excavItems.find((it) => predicate(norm(it.description || "")));
      const moItem = findItem((d) => d.includes("mano de obra") && d.includes("excavac"));
      const reompItem = findItem((d) => d.includes("ompliment") || d.includes("re ompliment"));

      const l = Number(draft.poolLength ?? 0);
      const w = Number(draft.poolWidth ?? 0);
      const dMin = Number(draft.poolDepthMin ?? 0);
      const dMax = Number(draft.poolDepthMax ?? 0);
      const dAvg = dMin && dMax ? (dMin + dMax) / 2 : 0;
      let mo = 0;
      let reomp = 0;
      if (l > 0 && w > 0 && dAvg > 0) {
        const qty = Math.ceil(((l + 1) * (w + 1) * (dAvg + 0.3)) / 8.5);
        // Mà d'obra excavació: mínim de venda 3.300 € (igual que el mínim
        // de 930 € del re-ompliment) — vegeu applyExcavacioMinimums().
        mo = Math.max(3300, qty * 455);
        const sacos = Math.ceil(((l + w) * 2 * (dAvg + 0.3) * 0.2) / 0.67);
        const costMaterial = sacos * 33.88;
        const viatges = Math.ceil(sacos / 8);
        const costTransport = viatges * 175;
        const rawCost = (costMaterial + costTransport) * 1.55;
        reomp = Math.max(930, rawCost);
      }
      // Override with user-edited values when present.
      if (moItem && (moItem.userEdited || moItem.source === "manual")) {
        mo = Number(moItem.quantity || 0) * Number(moItem.unitSale || 0);
      }
      if (reompItem && (reompItem.userEdited || reompItem.source === "manual")) {
        reomp = Number(reompItem.quantity || 0) * Number(reompItem.unitSale || 0);
      }
      // Wizard-level manual overrides (highest priority): if the user typed a
      // value in the "Excavació" annex section, it wins over both the formula
      // and any partida-derived amount.
      if (typeof draft.annexExcavacioManoObraOverride === "number" && draft.annexExcavacioManoObraOverride > 0) {
        mo = draft.annexExcavacioManoObraOverride;
      }
      if (typeof draft.annexExcavacioReomplimentOverride === "number" && draft.annexExcavacioReomplimentOverride > 0) {
        reomp = draft.annexExcavacioReomplimentOverride;
      }
      const moCeil = Math.ceil(mo);
      const reompCeil = Math.ceil(reomp);
      return {
        annexExcavacioManoObra: moCeil,
        annexExcavacioReompliment: reompCeil,
        annexExcavacioTotal: moCeil + reompCeil,
        annexExcavacioPill1Title: draft.annexExcavacioPill1Title || undefined,
        annexExcavacioPill2Title: draft.annexExcavacioPill2Title || undefined,
        annexExcavacioText1: draft.annexExcavacioText1 || undefined,
        annexExcavacioText2: draft.annexExcavacioText2 || undefined,
      };
    })(),
    // Annex — Sistema Neteja Fons Integrat
    annexNetejafonsEstat: (draft.annexNetejafonsEstat as any) || "no",
    annexNetejafonsFons: nfBoq.fons,
    annexNetejafonsEscala: nfBoq.escala,
    annexNetejafonsPlataforma: nfBoq.plataforma,
    annexNetejafonsPlataformaLabel: nfBoq.thirdLabel,
    ...(() => {
      // Extract Capçal (D.50 / D.63) and Bomba model + amount from the
      // netejafons sub-phase items present in the budget partides.
      const items = (draft.phases || [])
        .flatMap((ph) => ph.items || [])
        .filter((it: any) => (it.subPhase || "").toLowerCase() === "netejafons" && Number(it.quantity || 0) > 0);
      let capcalLabel: string | undefined;
      let bombaLabel: string | undefined;
      let bombaQty: number | undefined;
      for (const it of items as any[]) {
        const desc = String(it.description || "");
        const up = desc.toUpperCase();
        if (!capcalLabel && /(CABEZA|CABEZAL|CAP[ÇC]AL).*POOL.*VALLET/.test(up)) {
          const m = up.match(/D\s*\.?\s*(\d{2,3})/);
          capcalLabel = m ? `Capçal D.${m[1]}` : "Capçal";
        }
        if (!bombaLabel && /BOMBA.*POOL.*VALLET/.test(up)) {
          const m = desc.match(/\(([^)]+CV)\)/i) || desc.match(/(\d+(?:[.,]\d+)?\s*CV)/i);
          const cv = m ? m[1].replace(".", ",") : "";
          bombaLabel = cv ? `Bomba ${cv}` : "Bomba";
          bombaQty = Number(it.quantity || 1);
        }
      }
      let amount = items.reduce((s, it: any) => s + Math.ceil(Number(it.quantity || 0) * Number(it.unitSale || 0)), 0);
      // When "opcional", no partides exist so amount = 0 → reconstruct the
      // full equipment cost mirroring the formula-engine rules for the
      // netejafons sub-phase (faithful 1:1 replica so the opcional pill
      // matches the included-equivalent amount).
      if (amount === 0) {
        const tot = nfBoq.fons + nfBoq.escala + nfBoq.plataforma;
        const fontDist = Number(draft.instalFontaneriaDistancia ?? 10);
        const r = tot / 6;
        const bigBomba = r > 4 || r === 4 || fontDist > 20;
        // CABEZAL D50 qty: 2 si r>4 · 0 si (r===4 || dist>20) · 1 altrament
        const capD50Qty = r > 4 ? 2 : r === 4 || fontDist > 20 ? 0 : 1;
        // CABEZA D63 qty: 0 si r>4 · 1 si (r===4 || dist>20) · 0 altrament
        const capD63Qty = r > 4 ? 0 : r === 4 || fontDist > 20 ? 1 : 0;
        const bomba1CvQty = bigBomba ? 0 : 1;
        const bomba15CvQty = bigBomba ? 1 : 0;

        // Replicate the formula engine: each rule uses article_ref's own
        // sale_price (NOT the formula_sale articlePrice() expression, which
        // is overridden by getReferenceArticleUnitPrices when article_ref +
        // formula_quantity are set). Per-line ceil mirrors line rounding in
        // the partidas so the opcional total matches the inclos total exactly.
        const pasaPrice = priceOf("PASAMUROS");
        const tomaPrice = priceOf("TOMA ASPIRACIÓN | 00302");
        const cap50Price = priceOf("CABEZAL DE POOL VALLET D50");
        const cap63Price = priceOf("CABEZA DE POOL VALLET D63");
        const bomba1Price = priceOf("BOMBA POOL VALLET DOLFI 100M (1CV)");
        const bomba15Price = priceOf("BOMBA POOL VALLET DOLFI 150M (1,5CV)");
        const boqPrice = priceOf("BOQUILLAS DE POOL VALLET");
        const moPrice = priceOf("MANO DE OBRA INSTALADOR BOMBA DE CALOR");

        const lines: Array<[number, number]> = [
          [tot, pasaPrice], // PASAMUROS
          [2, tomaPrice], // TOMA ASPIRACIÓN
          [capD50Qty, cap50Price], // CABEZAL D.50
          [bomba1CvQty, bomba1Price], // BOMBA 1CV
          [tot, boqPrice], // BOQUILLAS
          [44, moPrice], // MO instalador (rule: bomba calor)
          [capD63Qty, cap63Price], // CABEZA D.63
          [bomba15CvQty, bomba15Price], // BOMBA 1.5CV
        ];
        amount = lines.reduce((s, [q, p]) => s + (q > 0 ? Math.ceil(q * p) : 0), 0);

        // Labels mirroring the actual rule outcome
        if (capD50Qty > 0) {
          capcalLabel = capD50Qty > 1 ? `${capD50Qty} × Capçal D.50` : "Capçal D.50";
        } else if (capD63Qty > 0) {
          capcalLabel = "Capçal D.63";
        }
        if (bomba1CvQty > 0) {
          bombaLabel = "Bomba 1CV";
          bombaQty = 1;
        } else if (bomba15CvQty > 0) {
          bombaLabel = "Bomba 1,5CV";
          bombaQty = 1;
        }
      }
      return {
        annexNetejafonsCapcalLabel: capcalLabel,
        annexNetejafonsBombaLabel: bombaLabel,
        annexNetejafonsBombaQty: bombaQty ?? 1,
        annexNetejafonsAmount: amount,
      };
    })(),
    // Annex — Robot Neteja Fons Automàtic
    ...(() => {
      const estat = (draft.annexRobotEstat as any) || "no";
      if (estat === "no") return { annexRobotEstat: estat };
      const art = a(draft.annexRobotArticleId);
      const qty = Number(draft.annexRobotQty || 1);
      const amount = art ? Math.ceil(Number(art.sale || 0) * qty) : 0;
      const name = art?.name || "";
      const up = name.toUpperCase();
      const model: "P3" | "P7" | undefined = /P\s*7/.test(up) ? "P7" : /P\s*3/.test(up) ? "P3" : undefined;
      return {
        annexRobotEstat: estat,
        annexRobotName: name,
        annexRobotImageUrl: art?.image_url,
        annexRobotQty: qty,
        annexRobotAmount: amount,
        annexRobotModel: model,
      };
    })(),
    // Annex — Bomba de calor (Climatització)
    ...(() => {
      const estat = (draft.annexBombaCalorEstat as any) || "no";
      if (estat === "no") return { annexBombaCalorEstat: estat };
      const art = a(draft.annexBombaCalorArticleId);
      const equipSale = art ? Number(art.sale || 0) : 0;
      // When "inclos": equip line lives in subPhase "Equips annex" (wizardKey
      // annex_bomba_calor) and MO lives in subPhase "bomba_calor". Sum both
      // groups (per-line ceil). When "opcional" (no partidas), reconstruct:
      // equip + 8h MO instal·lador bomba calor.
      const allItems = (draft.phases || []).flatMap((ph) => ph.items || []);
      const bcSub = allItems.filter(
        (it: any) =>
          ((it.subPhase || "").toLowerCase() === "bomba_calor" || (it as any).wizardKey === "annex_bomba_calor") &&
          Number(it.quantity || 0) > 0,
      );
      let amount = bcSub.reduce((s, it: any) => s + Math.ceil(Number(it.quantity || 0) * Number(it.unitSale || 0)), 0);
      if (amount === 0) {
        const moPrice = priceOf("MANO DE OBRA INSTALADOR BOMBA DE CALOR");
        amount = Math.ceil(equipSale) + Math.ceil(8 * moPrice);
      }
      return {
        annexBombaCalorEstat: estat,
        annexBombaCalorName: art?.name,
        annexBombaCalorImageUrl: art?.image_url,
        annexBombaCalorAmount: amount,
        annexBombaCalorCoberta: draft.annexBombaCalorCoberta === true,
        annexBombaCalorDesde: draft.annexBombaCalorDesde,
        annexBombaCalorFinsA: draft.annexBombaCalorFinsA,
        annexBombaCalorTemperatura: draft.annexBombaCalorTemperatura ?? 27,
      };
    })(),
    // Annex — Cobertor (Coberta automàtica de lamel·les)
    ...(await (async () => {
      const estat = (draft.annexCobertorEstat as any) || "no";
      if (estat === "no") return { annexCobertorEstat: estat };
      let modelImageUrl: string | undefined;
      let colorImageUrl: string | undefined;
      let colorName: string | undefined = draft.annexCobertorColorName;
      let availableColors: { name: string; imageUrl?: string; selected?: boolean }[] = [];
      try {
        if (draft.annexCobertorModelId) {
          const { data: m } = await supabase
            .from("cover_models")
            .select("image_url")
            .eq("id", draft.annexCobertorModelId)
            .maybeSingle();
          modelImageUrl = (m as any)?.image_url || undefined;
        }
        if (draft.annexCobertorColorId) {
          const { data: c } = await supabase
            .from("cover_colors")
            .select("name, image_url")
            .eq("id", draft.annexCobertorColorId)
            .maybeSingle();
          colorImageUrl = (c as any)?.image_url || undefined;
          if (!colorName) colorName = (c as any)?.name;
        }
        // Fetch all colors compatible with the selected model + lames material.
        if (draft.annexCobertorModelId && draft.annexCobertorLames) {
          const { data: rels } = await supabase
            .from("cover_model_colors")
            .select("color_id")
            .eq("model_id", draft.annexCobertorModelId);
          const allowedIds = (rels || []).map((r: any) => r.color_id);
          if (allowedIds.length > 0) {
            const { data: cols } = await supabase
              .from("cover_colors")
              .select("id, name, image_url, material, order_index")
              .in("id", allowedIds)
              .eq("material", draft.annexCobertorLames)
              .order("order_index");
            availableColors = (cols || []).map((c: any) => ({
              name: c.name,
              imageUrl: c.image_url || undefined,
              selected: c.id === draft.annexCobertorColorId,
            }));
          }
        }
      } catch {
        /* ignore */
      }
      const amount = draft.annexCobertorManualOverride
        ? Number(draft.annexCobertorManualAmount || 0)
        : Math.ceil(Number(draft.annexCobertorCalcSale || 0));
      return {
        annexCobertorEstat: estat,
        annexCobertorTipus: draft.annexCobertorTipus,
        annexCobertorLames: draft.annexCobertorLames,
        annexCobertorModelName: draft.annexCobertorModelName,
        annexCobertorModelCode: draft.annexCobertorModelCode,
        annexCobertorModelImageUrl: modelImageUrl,
        annexCobertorColorName: colorName,
        annexCobertorColorImageUrl: colorImageUrl,
        annexCobertorAvailableColors: availableColors,
        annexCobertorAmount: amount,
      };
    })()),
    // Annex — Caseta depuradora (Local tècnic)
    ...(await (async () => {
      const localTecnic = (draft.instalFontaneriaLocalTecnic || "determinar").toLowerCase();
      let estat: "no" | "inclos" | "opcional" = "no";
      if (localTecnic === "nou") estat = "inclos";
      else if (localTecnic === "determinar" || localTecnic === "") estat = "opcional";
      if (estat === "no") return { annexCasetaEstat: "no" as const };

      // For "inclos" use the tipus the user selected; for "opcional" force elevada.
      const tipus = estat === "opcional" ? "caseta_elevada" : draft.instalFontaneriaCasetaTipus || "caseta_elevada";

      // Fetch the caseta article (image + price as fallback) by name.
      const articleName =
        tipus === "caseta_soterrada" ? "CASETA PREFABRICADA SOTERRADA" : "CASETA PREFABRICADA ELEVADA";
      let imageUrl: string | undefined;
      let elevadaArticleSale = 0;
      try {
        const { data: arts } = await supabase
          .from("articles")
          .select("name, sale_price, image_url")
          .or(
            "name.ilike.%CASETA PREFABRICADA ELEVADA%,name.ilike.%CASETA PREFABRICADA SOTERRADA%,name.ilike.%MADERAS REFUERZO%,name.ilike.%MANO DE OBRA INSTALACION CASETA%,name.ilike.%HORMIGON D-400 CON FIBRAS%,name.ilike.%MALLAZOS 15x15x6%",
          );
        (arts || []).forEach((r: any) => {
          const key = normalizeArticleName(r.name);
          byName[key] = Number(r.sale_price || 0) / 100;
          if (
            (tipus === "caseta_soterrada" && /CASETA PREFABRICADA SOTERRADA/i.test(r.name)) ||
            (tipus === "caseta_elevada" && /CASETA PREFABRICADA ELEVADA/i.test(r.name))
          ) {
            imageUrl = r.image_url || imageUrl;
          }
        });
      } catch {
        /* ignore */
      }

      // Amount calculation
      let amount = 0;
      if (estat === "inclos") {
        // Sum every item already in the budget under subPhase = 'caseta'.
        const allItems = (draft.phases || []).flatMap((ph) => ph.items || []);
        amount = allItems
          .filter((it: any) => String(it.subPhase || "").toLowerCase() === "caseta")
          .reduce((s, it: any) => s + Math.ceil(Number(it.quantity || 0) * Number(it.unitSale || 0)), 0);
      }
      if (amount === 0) {
        // Fallback (and the canonical path for "opcional"): reproduce the 5
        // formula_rules for caseta_elevada.
        elevadaArticleSale = priceOf("CASETA PREFABRICADA ELEVADA");
        const madera = priceOf("MADERAS REFUERZO");
        const moInst = priceOf("MANO DE OBRA INSTALACION CASETA");
        const hormigon = priceOf("HORMIGON D-400 CON FIBRAS");
        const mallazo = priceOf("MALLAZOS 15x15x6");
        amount =
          Math.ceil(elevadaArticleSale) +
          Math.ceil(madera) +
          Math.ceil(8 * moInst) +
          Math.ceil(hormigon) +
          Math.ceil(mallazo);
      }

      return {
        annexCasetaEstat: estat,
        annexCasetaTipus: tipus,
        annexCasetaAmount: amount,
        annexCasetaImageUrl: imageUrl,
        annexCasetaObraLlarg: draft.instalCasetaObraLlarg,
        annexCasetaObraAmple: draft.instalCasetaObraAmple,
        annexCasetaObraAlt: draft.instalCasetaObraAlt,
        annexCasetaObraPortes: draft.instalCasetaObraPortes,
      };
    })()),
    // Annex — Gespa artificial
    ...(await (async () => {
      const estat = (draft.annexGespaEstat as any) || "no";
      if (estat === "no") return { annexGespaEstat: estat };

      // Detect mm from the article/model name.
      const detectMm = (name?: string): 35 | 38 | 45 => {
        const s = String(name || "").toLowerCase();
        if (/45/.test(s)) return 45;
        if (/38/.test(s)) return 38;
        return 35;
      };

      let modelName = draft.annexGespaModel;
      let pricePerM2 = 0;
      let imageUrl: string | undefined;
      const selected = a(draft.annexGespaArticleId);
      if (selected) {
        modelName = modelName || selected.name;
        pricePerM2 = Number(selected.sale || 0);
        imageUrl = selected.image_url;
      }

      // For "opcional", always show 35 MM and use that article's sale_price.
      let mm: 35 | 38 | 45 = detectMm(modelName);
      if (estat === "opcional") {
        mm = 35;
        try {
          const { data: arts } = await supabase
            .from("articles")
            .select("name, sale_price")
            .eq("subtipus", "Gespa")
            .ilike("name", "%35%")
            .limit(1);
          if (arts && arts.length > 0) {
            modelName = arts[0].name;
            pricePerM2 = Number(arts[0].sale_price || 0) / 100;
          }
        } catch {
          /* ignore */
        }
      }

      // Amount: for "inclos" sum every item under subPhase = "gespa";
      // for "opcional" fall back to pricePerM2 (per m²).
      let amount = 0;
      if (estat === "inclos") {
        const allItems = (draft.phases || []).flatMap((ph) => ph.items || []);
        amount = allItems
          .filter((it: any) => String(it.subPhase || "").toLowerCase() === "gespa")
          .reduce((s, it: any) => s + Math.ceil(Number(it.quantity || 0) * Number(it.unitSale || 0)), 0);
        if (amount === 0) {
          const m2 = Number(draft.annexGespaM2 || 0);
          amount =
            Math.ceil(m2 * pricePerM2) +
            (draft.annexGespaPreparacioEnabled ? Math.ceil(Number(draft.annexGespaPreparacioM2 || 0)) : 0);
        }
      } else {
        amount = Math.ceil(pricePerM2);
      }

      return {
        annexGespaEstat: estat,
        annexGespaModelName: modelName,
        annexGespaModelMm: mm,
        annexGespaM2: Number(draft.annexGespaM2 || 0),
        annexGespaPreparacioIncluded: !!draft.annexGespaPreparacioEnabled && estat === "inclos",
        annexGespaPricePerM2: pricePerM2,
        annexGespaAmount: amount,
      };
    })()),
    // Annex — Paviment perimetral (estat passthrough)
    annexPavimentEstat: (draft.annexPavimentEstat as any) || "no",
    ...((): Partial<NewPdfData> => {
      const estat = (draft.annexPavimentEstat as any) || "no";
      if (estat !== "inclos" && estat !== "opcional") return {};
      // Paviment subphase total (sum of items with subPhase === 'paviment' in Annex phase)
      let pavimentAmount = 0;
      let retiradaTotal = 0;
      let regularTotal = 0;
      let formigoTotal = 0;
      let nouTotal = 0;
      for (const ph of draft.phases || []) {
        for (const it of ph.items || []) {
          if (((it as any).subPhase || "").toLowerCase() === "paviment") {
            const lineTotal = Math.ceil(Number(it.quantity || 0) * Number(it.unitSale || 0));
            pavimentAmount += lineTotal;
            const desc = String(it.description || "").toUpperCase();
            // Classify by article keywords
            if (
              desc.includes("RETIRAR CERAMICA") ||
              desc.includes("RETIRAR CERÀMICA") ||
              desc.includes("MOVER SACOS RUNA") ||
              desc.includes("TRANSPORTE RUNA")
            ) {
              retiradaTotal += lineTotal;
            } else if (desc.includes("REGULARITZAR LLOSA") || (desc.includes("MORTERO") && desc.includes("25"))) {
              regularTotal += lineTotal;
            } else if (
              desc.includes("PAVIMENTO HORMIGON") ||
              desc.includes("PAVIMENT HORMIGON") ||
              desc.includes("MALLAZO") ||
              desc.includes("MALLAZOS") ||
              (desc.includes("HORMIGON") && !desc.includes("PAVIMENT")) ||
              desc === "GRAVA" ||
              desc.startsWith("GRAVA ") ||
              desc.includes(" GRAVA")
            ) {
              formigoTotal += lineTotal;
            } else {
              // Everything else inside paviment subphase belongs to "Paviment nou"
              // (model, cemento cola, borada, fix, estropajo, esponja, cuñas, crucetas,
              //  transporte, mano de obra paviment perimetral porcelanico, etc.)
              nouTotal += lineTotal;
            }
          }
        }
      }
      const modelArt = a(draft.annexPavimentModelId);
      const modelName = !draft.annexPavimentModelADeterminar && modelArt ? modelArt.name : undefined;
      return {
        annexPavimentReformaEnabled: !!draft.annexPavimentReformaEnabled,
        annexPavimentRetiradaEnabled: !!draft.annexPavimentRetiradaEnabled,
        annexPavimentRetiradaM2: Number(draft.annexPavimentRetiradaM2 || 0),
        annexPavimentRegularitzacioEnabled: !!draft.annexPavimentRegularitzacioEnabled,
        annexPavimentRegularitzacioM2: Number(draft.annexPavimentRegularitzacioM2 || 0),
        annexPavimentNouEnabled: !!draft.annexPavimentNouEnabled,
        annexPavimentActuacio: draft.annexPavimentActuacio || undefined,
        annexPavimentFormigoEnabled: !!draft.annexPavimentFormigoEnabled,
        annexPavimentFormigoM2: Number(draft.annexPavimentFormigoM2 || 0),
        annexPavimentMaterial: draft.annexPavimentMaterial || undefined,
        annexPavimentFormat: draft.annexPavimentFormat || undefined,
        annexPavimentM2: Number(draft.annexPavimentM2 || 0),
        annexPavimentModelName: modelName,
        annexPavimentAmount: pavimentAmount,
        annexPavimentRetiradaTotal: retiradaTotal,
        annexPavimentRegularitzacioTotal: regularTotal,
        annexPavimentFormigoTotal: formigoTotal,
        annexPavimentNouTotal: nouTotal,
      };
    })(),
    // Annex — Entrada de material a mà (manual line, split out of the ANNEX pill in Resum)
    hasManualMaterialEntry: !!draft.hasManualMaterialEntry,
    manualMaterialEntrySale: draft.hasManualMaterialEntry
      ? Math.ceil(Number(draft.manualMaterialEntrySale || 0))
      : undefined,
    phases: pdfPhases as any,
    totalSale,
    paymentConditions: draft.paymentConditions,
    observations: draft.observations,
    contractantName: (draft as any).contractantName || undefined,
    contractantNif: (draft as any).contractantNif || undefined,
    contractantAddress: (draft as any).contractantAddress || undefined,
    contractantTown: (draft as any).contractantTown || undefined,
    obraLocation: (draft as any).obraLocation || undefined,
  };

  // Sum every Instal·lacions phase (equips de depuració, dosificació, elèctrica,
  // fontaneria, accessoris…) so the Resum total matches the financial summary.
  const phaseAnnexTotal = phaseAmount(/annex/i);
  data.phaseAnnexTotal = phaseAnnexTotal;
  data.instalacionsTotal = Math.max(0, totalSale - phaseStructuralTotal - phaseAcabatsTotal - phaseAnnexTotal);

  // ───────────────────────────────────────────────────────────────────────────
  // PRICE ADJUSTMENT (Resum Financer → "Ajust de preu (%)")
  // - Positive %: propagate the increase to every partida / amount so each
  //   line in the PDF already reflects the new price (coherent totals).
  // - Negative %: leave the partides intact and only show a "TOTAL AMB
  //   DESCOMPTE" line in the Resum page.
  // ───────────────────────────────────────────────────────────────────────────
  const adjustmentPct = Number(draft.marginPctAdjustment || 0);
  if (adjustmentPct > 0) {
    const factor = 1 + adjustmentPct / 100;
    const scaleAmount = (value: number) => Math.ceil(value * factor);
    const sumPhaseItems = (phaseMatcher: RegExp, itemMatcher?: (it: any) => boolean) =>
      (data.phases || [])
        .filter((ph: any) => phaseMatcher.test(String(ph.name || "")))
        .flatMap((ph: any) => ph.items || [])
        .filter((it: any) => !String(it.subPhase || "").toLowerCase().includes("opcionals informatius"))
        .filter((it: any) => !itemMatcher || itemMatcher(it))
        .reduce((sum: number, it: any) => sum + (Number(it.total) || 0), 0);
    const subPhaseIs = (target: string) => (it: any) => String(it.subPhase || "").toLowerCase() === target;
    const wizardKeyIs = (target: string) => (it: any) => String(it.wizardKey || "") === target;
    // Scale every phase item + subtotal
    if (Array.isArray(data.phases)) {
      data.phases = data.phases.map((ph: any) => {
        const items = (ph.items || []).map((it: any) => {
          const qty = Number(it.quantity) || 0;
          const origUnitSale = Number(it.unitSale) || 0;
          // Match wizard exactly: Math.ceil(qty * unitSale * factor) in one go
          // to avoid floating-point drift vs (unitSale*factor) then qty*.
          const total = Math.ceil(qty * origUnitSale * factor);
          const unitSale = origUnitSale * factor;
          return { ...it, unitSale, total };
        });
        const subtotal = items.reduce((s: number, it: any) => s + (it.total || 0), 0);
        return { ...ph, items, subtotal };
      });
    }
    // Whitelist of numeric amount/total fields to scale (avoids touching qty/percent fields)
    const SCALABLE_KEYS = [
      "totalSale",
      "vasTotal", "elementsEstructuralsTotal",
      "phaseStructuralTotal", "phaseAcabatsTotal", "phaseDepuracioTotal",
      "phaseElectricitatTotal", "phaseAnnexTotal", "instalacionsTotal",
      "coronamentTotal", "revestimentTotal",
      "depuracioSectionAmount", "bombaSectionAmount", "electrolisiSectionAmount",
      "quadreRowAmount", "quadreTotal", "quadreSale", "electricaSale",
      "presaTerraTotal", "fontaneriaTotal",
      "hidrolisiTotal", "bombaInclosTotal",
      "accSkimmersTotal", "accImpulsorsTotal", "accEmbornalTotal",
      "accNetejafonsTotal", "accReguladorTotal", "accFocusLedTotal",
      "accBasicTotal", "accOptionalTotal", "cascadaTotal",
      "annexProjecteAmount", "annexExcavacioTotal", "annexExcavacioAmount",
      "annexExcavacioManoObra", "annexExcavacioReompliment",
      "annexNetejafonsAmount", "annexNetejafonsTotal", "annexNetejafonsExtraCost",
      "annexRobotAmount", "annexBombaCalorAmount", "annexCobertorAmount",
      "annexCasetaAmount", "annexOpcionalRevestimentAmount", "annexOpcionalRevestimentAmountEpoxi",
      "annexPavimentAmount", "annexPavimentRetiradaTotal",
      "annexPavimentRegularitzacioTotal", "annexPavimentFormigoTotal",
      "annexPavimentNouTotal", "annexGespaAmount",
    ];
    const d = data as any;
    for (const k of SCALABLE_KEYS) {
      if (typeof d[k] === "number" && isFinite(d[k])) {
        d[k] = scaleAmount(d[k]);
      }
    }

    // Scale per-line arrays so each row in the PDF reflects the increment.
    // Then recompute the section totals as the SUM of rounded rows, so the
    // pill amount always matches the sum of the visible line items.
    const scaleLines = (lines: any[] | undefined) => {
      if (!Array.isArray(lines)) return lines;
      return lines.map((l) => ({
        ...l,
        total: scaleAmount(Number(l.total) || 0),
      }));
    };
    if (Array.isArray(d.accBasicLines)) {
      d.accBasicLines = scaleLines(d.accBasicLines);
      d.accBasicTotal = d.accBasicLines.reduce((s: number, l: any) => s + (Number(l.total) || 0), 0);
    }
    if (Array.isArray(d.accOptionalLines)) {
      d.accOptionalLines = scaleLines(d.accOptionalLines);
      d.accOptionalTotal = d.accOptionalLines.reduce((s: number, l: any) => s + (Number(l.total) || 0), 0);
    }
    if (Array.isArray(d.cascadaLines)) {
      d.cascadaLines = scaleLines(d.cascadaLines);
      d.cascadaTotal = d.cascadaLines.reduce((s: number, l: any) => s + (Number(l.total) || 0), 0);
    }

    // Recompute the big badges and their visible section pills from the same
    // rounded, incremented line totals. This avoids 1€ drift between pills and
    // totals when an increment creates decimals (e.g. 44,50€ × 1,05).
    if (Array.isArray(d.phases)) {
      d.totalSale = d.phases.reduce((sum: number, ph: any) => sum + (Number(ph.subtotal) || 0), 0);

      const structuralTotal = sumPhaseItems(/estructur/i);
      const vas = sumPhaseItems(/estructur/i, subPhaseIs("vas"));
      if (structuralTotal > 0) {
        d.phaseStructuralTotal = structuralTotal;
        d.vasTotal = vas;
        d.elementsEstructuralsTotal = Math.max(0, structuralTotal - vas);
      }

      const acabatsTotal = sumPhaseItems(/acabat/i);
      const corona = sumPhaseItems(/acabat/i, subPhaseIs("coronament"));
      const revestiment = sumPhaseItems(/acabat/i, subPhaseIs("revestiment"));
      if (acabatsTotal > 0) {
        d.phaseAcabatsTotal = acabatsTotal;
        d.coronamentTotal = corona;
        d.revestimentTotal = Math.max(0, acabatsTotal - corona);
      }

      d.phaseAnnexTotal = sumPhaseItems(/annex/i);
      d.instalacionsTotal = sumPhaseItems(/instal/i);

      if (d.hasManualMaterialEntry) {
        d.manualMaterialEntrySale = sumPhaseItems(/annex/i, wizardKeyIs("annex_manual_material_entry"));
      }

      const wifiIncludedTotal = sumPhaseItems(/instal/i, wizardKeyIs("instal_wifi"));
      if (d.wifiEnabled && wifiIncludedTotal > 0 && typeof d.hidrolisiTotal === "number") {
        d.hidrolisiTotal += wifiIncludedTotal;
      }

      const visibleInstalacionsTotal =
        (Number(d.depuracioSectionAmount) || 0) +
        (Number(d.bombaInclosTotal) || 0) +
        (Number(d.hidrolisiTotal) || 0) +
        (Number(d.quadreSale) || 0) +
        (Number(d.electricaSale) || 0) +
        (Number(d.fontaneriaTotal) || 0) +
        (Number(d.accBasicTotal) || 0) +
        (Number(d.accOptionalTotal) || 0) +
        (Number(d.cascadaTotal) || 0);
      const instalacionsDelta = d.instalacionsTotal - visibleInstalacionsTotal;
      if (instalacionsDelta !== 0 && typeof d.hidrolisiTotal === "number") {
        d.hidrolisiTotal += instalacionsDelta;
      }
    }
    // Excavació: ensure TOTAL badge = sum of the two pills after rounding.
    if (typeof d.annexExcavacioManoObra === "number" || typeof d.annexExcavacioReompliment === "number") {
      d.annexExcavacioTotal = (Number(d.annexExcavacioManoObra) || 0) + (Number(d.annexExcavacioReompliment) || 0);
    }
  } else if (adjustmentPct < 0) {
    // Discount only shown in Resum — partides remain at original price.
    const factor = 1 + adjustmentPct / 100; // < 1
    data.discountPct = Math.abs(adjustmentPct);
    data.totalSaleAfterDiscount = Math.round((data.totalSale || 0) * factor);
  }

  void buildPdfHtml; // legacy template kept for fallback only
  const stripAccents = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleanName = draft.clientName ? stripAccents(draft.clientName).replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim() : "";
  const cleanTown = draft.clientTown ? stripAccents(draft.clientTown).replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim() : "";
  const number = draft.budgetNumber || "";
  const parts: string[] = [];
  if (number) parts.push(number);
  if (cleanName) parts.push(` ${cleanName}`);
  const base = (parts.join("-") + (cleanTown ? ` (${cleanTown})` : "")).trim() || "pressupost";
  const filename = `${base}.pdf`;
  const blob = await buildPdfBlob(data);
  return { blob, filename };
}

/** Back-compat wrapper. Prefer `buildBudgetPdf` + `saveBlobWithPicker` in
 *  the click handler so the picker can open. */
export async function generatePDF(draft: BudgetDraft) {
  const { saveBlobWithPicker } = await import("@/lib/saveFile");
  // Best-effort: filename is computed inside `buildBudgetPdf`. We don't
  // know it before calling, so pre-compute a sensible default here.
  const fallback =
    [draft.budgetNumber, draft.clientName, draft.clientTown]
      .filter(Boolean)
      .join("-")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9\-]/g, "") || "pressupost";
  await saveBlobWithPicker(async () => (await buildBudgetPdf(draft)).blob, `${fallback}.pdf`);
}

// ──────────────────────────────────────────────────────────────────────────
// Maintenance budget PDF
// ──────────────────────────────────────────────────────────────────────────
async function buildMaintenancePdf(draft: BudgetDraft): Promise<{ blob: Blob; filename: string }> {
  const { buildPdfBlob } = await import("@/lib/pdfRender");
  const { computeMaintenanceKit } = await import("@/lib/maintenanceKit");
  const { computeMaintenanceMaterials } = await import("@/lib/maintenanceMaterials");
  const { buildVisitPeriodsText } = await import("@/lib/maintenanceVisits");

  // Fetch every "Manteniment" article (kit needs sale_price, materials need cost_price).
  let mArts: Array<{ name: string; sale_price: number | null; cost_price: number | null }> = [];
  try {
    const { data } = await supabase
      .from("articles")
      .select("name, sale_price, cost_price")
      .eq("category", "Manteniment");
    mArts = (data || []) as any;
  } catch {
    /* ignore */
  }
  const kit = computeMaintenanceKit(draft, mArts as any);

  // Maintenance operational cost (mirror of StepServeis).
  const plan = draft.maintenancePlan;
  const visits = (plan?.visitsPerMonth && plan.visitsPerMonth.length === 12)
    ? plan.visitsPerMonth
    : Array(12).fill(0);
  let opTotal = 0;
  if (plan) {
    const totalVisits = visits.reduce((a, b) => a + (b || 0), 0);
    const totalHours = totalVisits * (plan.visitDurationHours || 0);
    const totalLabour = totalHours * (plan.hourlyCost || 0);
    const totalParking = totalVisits * (plan.parkingCostPerVisit || 0);
    const vanCostPerHour = ((plan.vanMonthlyRenting || 0) * 12) / (40 * 48);
    const totalVan = totalHours * vanCostPerHour;
    const totalFuel = totalHours * (plan.fuelCostPerHour || 0);
    opTotal = totalLabour + totalParking + totalVan + totalFuel;
  }
  const materials = computeMaintenanceMaterials(draft, mArts as any, opTotal);
  // Keep real (non-rounded) values so the wizard, Revisió and PDF all agree.
  const totalAnual = materials.totalAnual || 0;
  const totalMensual = totalAnual / 12;

  // Comercial info (best-effort).
  const { comercialName, comercialEmail } = await resolveComercialInfo(draft);

  const depthAvg = Number(draft.poolDepthAvg || 0);
  const volume =
    draft.poolLength && draft.poolWidth && depthAvg
      ? Math.ceil(Number(draft.poolLength) * Number(draft.poolWidth) * depthAvg)
      : undefined;

  const data: NewPdfData = {
    budgetNumber: draft.budgetNumber || "-",
    budgetDate: draft.budgetDate || new Date().toISOString(),
    type: "Manteniment",
    clientName: draft.clientName || "-",
    clientNif: draft.clientNif,
    clientAddress: draft.clientAddress,
    clientTown: draft.clientTown,
    clientPhone: draft.clientPhone,
    clientEmail: draft.clientEmail,
    comercialName,
    comercialEmail,
    contactPhone: "621 12 14 50",
    poolLength: draft.poolLength,
    poolWidth: draft.poolWidth,
    poolDepthAvg: depthAvg || undefined,
    poolVolumeM3: volume,
    poolType: draft.poolType,
    poolShape: draft.poolShape,
    hasElectrolisi: !!draft.hasElectrolisi,
    hasSecondPool: !!draft.hasSecondPool,
    poolLength2: draft.poolLength2,
    poolWidth2: draft.poolWidth2,
    poolDepthAvg2: draft.poolDepthAvg2,
    hasElectrolisi2: !!draft.hasElectrolisi2,
    isMaintenance: true,
    maintenanceVisitsPerMonth: visits,
    maintenanceVisitText: buildVisitPeriodsText(visits, plan?.visitFrequency),
    maintenanceTotalAnual: totalAnual,
    maintenanceTotalMensual: totalMensual,
    maintenanceKitTotal: Math.ceil(kit.total || 0),
    phaseStructuralTotal: 0,
    phaseAcabatsTotal: 0,
    phaseDepuracioTotal: 0,
    phaseElectricitatTotal: 0,
    totalSale: totalAnual,
    paymentConditions: draft.paymentConditions || "Mensual",
    observations: draft.observations,
  };

  const blob = await buildPdfBlob(data);
  const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleanName = draft.clientName
    ? stripAccents(draft.clientName).replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim()
    : "";
  const cleanTown = draft.clientTown
    ? stripAccents(draft.clientTown).replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim()
    : "";
  const parts: string[] = [];
  if (draft.budgetNumber) parts.push(draft.budgetNumber);
  if (cleanName) parts.push(` ${cleanName}`);
  const base = (parts.join("-") + (cleanTown ? ` (${cleanTown})` : "")).trim() || "pressupost";
  return { blob, filename: `${base}.pdf` };
}

// ──────────────────────────────────────────────────────────────────────────
// Piscina Autoportant PDF
// ──────────────────────────────────────────────────────────────────────────
async function buildAutoportantPdf(draft: BudgetDraft): Promise<{ blob: Blob; filename: string }> {
  const { buildPdfBlob } = await import("@/lib/pdfRender");
  const { AUTOPORTANT_MODELS, resolveAutoportantFinish } = await import("@/lib/autoportantMeta");
  const {
    AUTOPORTANT_OPCIONALS,
    buildAutoportantPhases,
    findAutoportantPrice,
    resolveCubiertaSize,
  } = await import("@/lib/autoportantOptions");

  const modelKey = draft.autoportantModel as keyof typeof AUTOPORTANT_MODELS | undefined;
  const modelMeta = modelKey ? AUTOPORTANT_MODELS[modelKey] : undefined;

  // Load autoportant catalog + pricing tables (best-effort).
  const [artsRes, pricesRes, transportRes] = await Promise.all([
    supabase.from("articles").select("id, name, unit, cost_price, sale_price, category").ilike("category", "Autoportant"),
    (supabase as any).from("autoportant_prices").select("*"),
    (supabase as any).from("autoportant_transport_config").select("*").limit(1).maybeSingle(),
  ]);
  const articles = ((artsRes.data as any[]) || []).map((a) => ({
    id: a.id,
    name: a.name,
    unit: a.unit,
    cost_price: a.cost_price,
    sale_price: a.sale_price,
    category: a.category,
  }));
  const prices = (pricesRes as any).data || [];
  const transportCfg = (transportRes as any).data || undefined;

  const phases = buildAutoportantPhases(draft, articles as any, prices as any, transportCfg as any);
  const totalSale = phases.reduce(
    (s, p) => s + p.items.reduce((ps, it) => ps + (it.unitSale || 0) * (it.quantity || 0), 0),
    0,
  );

  // Selected opcionals (with amounts) — sourced from the phase we just built.
  const opcPhase = phases.find((p) => p.name === "Opcionals");
  const selectedOpcionals = (opcPhase?.items || []).map((it) => {
    const def = AUTOPORTANT_OPCIONALS.find((d) => `autoportant_opc_${d.key}` === it.wizardKey);
    return {
      label: def?.label || it.description,
      description: def?.description,
      unit: it.unit || def?.unit || "ud",
      qty: it.quantity || 0,
      unitSale: it.unitSale || 0,
      total: (it.unitSale || 0) * (it.quantity || 0),
    };
  });

  // Full catalog of opcionals compatible with the chosen model (no total).
  const normalize = (v: string) =>
    String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
  const matchArticle = (tokens: string[]) => {
    const upper = tokens.map(normalize);
    return articles.find((a) => {
      if ((a.category || "").toLowerCase() !== "autoportant") return false;
      const n = normalize(a.name || "");
      return upper.every((t) => n.includes(t));
    });
  };
  const allOpcionals = modelKey
    ? AUTOPORTANT_OPCIONALS.filter((def) => def.models.includes(modelKey as any)).map((def) => {
        let article: any;
        if (def.key === "cubierta_electrica") {
          const size = resolveCubiertaSize(draft);
          article = matchArticle(["CUBIERTA", "ELECTRICA", "ELEVADA", `${size}X3`]);
        } else {
          article = matchArticle(def.articleMatch);
        }
        const sale = article ? (Number(article.sale_price) || 0) / 100 : 0;
        return {
          label: def.label,
          description: def.description,
          unit: (article?.unit as string) || def.unit,
          unitSale: sale,
        };
      })
    : [];

  // Acabats: resolve the display metadata for the selected finish keys.
  const corona = resolveAutoportantFinish(draft.autoportantCoronaKey);
  const revestiment = resolveAutoportantFinish(draft.autoportantRevestimentKey);
  const exteriorNote = (() => {
    if (modelKey === "line_confort") {
      const c = draft.autoportantMorterColor;
      const label = c === "blanc" ? "Blanc" : c === "beige" ? "Beige" : c === "gris" ? "Gris" : undefined;
      return `morter acrílic texturat${label ? ` — ${label}` : ""}.`;
    }
    if (modelKey === "line_luxe" || modelKey === "line_luxe_plus") {
      if (corona) return `s'aplica el mateix acabat que la coronació — ${corona.name} (${corona.family}).`;
      return "s'aplica el mateix acabat que la coronació.";
    }
    return undefined;
  })();

  // Comercial info (best-effort).
  const { comercialName, comercialEmail } = await resolveComercialInfo(draft);

  void findAutoportantPrice; // referenced indirectly via buildAutoportantPhases

  const data: NewPdfData = {
    budgetNumber: draft.budgetNumber || "-",
    budgetDate: draft.budgetDate || new Date().toISOString(),
    type: "Piscina Autoportant",
    clientName: draft.clientName || "-",
    clientNif: draft.clientNif,
    clientAddress: draft.clientAddress,
    clientTown: draft.clientTown,
    clientPhone: draft.clientPhone,
    clientEmail: draft.clientEmail,
    comercialName,
    comercialEmail,
    isAutoportant: true,
    autoportantModelKey: modelKey,
    autoportantModelName: modelMeta?.name,
    autoportantModelTagline: modelMeta?.tagline,
    autoportantModelImage: modelMeta?.image,
    autoportantModelFeatures: modelMeta?.features,
    autoportantAmple: draft.autoportantAmple,
    autoportantLlarg: draft.autoportantLlarg,
    autoportantAlturaAigua: draft.autoportantAlturaAigua,
    autoportantCoronaName: corona?.name,
    autoportantCoronaFamily: corona?.family,
    autoportantCoronaImage: corona?.image,
    autoportantRevestimentName: revestiment?.name,
    autoportantRevestimentFamily: revestiment?.family,
    autoportantRevestimentImage: revestiment?.image,
    autoportantExteriorNote: exteriorNote,
    autoportantSelectedOpcionals: selectedOpcionals,
    autoportantAllOpcionals: allOpcionals,
    phaseStructuralTotal: 0,
    phaseAcabatsTotal: 0,
    phaseDepuracioTotal: 0,
    phaseElectricitatTotal: 0,
    totalSale: Math.ceil(totalSale),
    paymentConditions: AUTOPORTANT_PAYMENT_CONDITIONS,
    observations: draft.observations,
  };

  const blob = await buildPdfBlob(data);
  const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleanName = draft.clientName
    ? stripAccents(draft.clientName).replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim()
    : "";
  const cleanTown = draft.clientTown
    ? stripAccents(draft.clientTown).replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim()
    : "";
  const parts: string[] = [];
  if (draft.budgetNumber) parts.push(draft.budgetNumber);
  if (cleanName) parts.push(` ${cleanName}`);
  const base = (parts.join("-") + (cleanTown ? ` (${cleanTown})` : "")).trim() || "pressupost";
  return { blob, filename: `${base}.pdf` };
}
