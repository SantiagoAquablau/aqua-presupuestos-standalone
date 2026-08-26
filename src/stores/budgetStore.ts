import { create } from 'zustand';

export type BudgetType = 'obra_nueva' | 'rehabilitacion' | 'mantenimiento' | 'piscina_autoportant';
export type BudgetStatus = 'borrador' | 'enviat' | 'acceptat' | 'rebutjat';
export type PoolType = 'particular' | 'comunitaria' | 'publica';
export type PoolShape = 'regular' | 'irregular';
export type InteriorStairsType = 'estandard' | 'plataforma' | 'banc' | 'tot_ample' | 'sense';
export type ConstructionSystem = 'gunite' | 'bloc_encofrat';
export type WaterproofingSystem = 'impertot' | 'hidrofix' | 'lamina_proof';
export type PoolDisposition = 'enterrada' | 'semi_enterrada' | 'elevada';
export type JacuzziType = 'interior' | 'independent';
export type JacuzziPosition = 'dins_estructura' | 'parcialment_fora';

import type { MaintenanceVisitFreq } from '@/lib/maintenanceVisits';

export interface MaintenancePlan {
  /** Visits per month, indexed 0 (Gener) → 11 (Desembre). */
  visitsPerMonth: number[];
  /** Visit frequency per month chosen by the user. Drives `visitsPerMonth`
   *  via real-week-count and the PDF natural-language grouping. */
  visitFrequency?: MaintenanceVisitFreq[];
  /** Duration of each visit in hours. */
  visitDurationHours: number;
  /** Hourly labour cost in €. Default 25. */
  hourlyCost: number;
  /** Parking cost per visit in €. */
  parkingCostPerVisit: number;
  /** Monthly van renting cost in €. Default 300. */
  vanMonthlyRenting: number;
  /** Fuel cost per hour in €. Default 1.50. */
  fuelCostPerHour: number;
  /** Per-material quantity overrides keyed by stable material key. */
  materialQty?: Record<string, number>;
  /** Per-material total (€) overrides keyed by stable material key. */
  materialTotal?: Record<string, number>;
  /** Structural percentage applied over the materials subtotal. Default 15. */
  structuralPct?: number;
  /** Benefit percentage applied over the materials subtotal. Default 55. */
  benefitPct?: number;
  /** Pool type for which the default visit frequency was last applied.
   *  Used to re-apply defaults when the user switches particular ↔ comunitària. */
  defaultsAppliedForPoolType?: string;
  /** Marks that the one-off 1 → 1.5h visitDurationHours bump for a second
   *  pool has already run, so it doesn't re-apply after the user edits the
   *  duration by hand. */
  secondPoolDurationApplied?: boolean;
}

export interface BudgetDraft {
  id?: string;
  /** Current persisted status, loaded when editing an existing budget.
   *  Undefined for a brand-new draft (defaults to 'borrador' on save). */
  status?: BudgetStatus;
  type?: BudgetType;
  clientName?: string;
  clientNif?: string;
  clientAddress?: string;
  clientTown?: string;
  clientPhone?: string;
  clientEmail?: string;
  budgetDate?: string;
  budgetNumber?: string;
  comercialId?: string;
  internalNotes?: string;
  // Confirmació de Comanda
  contractantName?: string;
  contractantNif?: string;
  contractantAddress?: string;
  contractantTown?: string;
  obraLocation?: string;
  poolType?: PoolType;
  poolShape?: PoolShape;
  poolLength?: number;
  poolWidth?: number;
  poolDepthMin?: number;
  poolDepthMax?: number;
  /** Manual total vessel surface (floor + walls combined) for poolShape === 'irregular',
   *  where poolLength/poolWidth aren't collected and can't be used to derive surface. */
  poolSurfaceIrregular?: number;
  hasExteriorStairs?: boolean;
  extStairsLength?: number;
  extStairsWidth?: number;
  // Disposició de la piscina (Obra Nova). Per defecte 'enterrada' — cap canvi
  // de comportament respecte al que existia abans. 'semi_enterrada' i 'elevada'
  // habiliten camps addicionals per l'escala i plataforma d'accés exteriors.
  poolDisposition?: PoolDisposition;
  /** Manual "altura vista" — només aplicable a semi_enterrada. */
  alturaVista?: number;
  /** Elevada: rebaix opcional que redueix l'altura efectiva respecte a poolDepthMax. */
  hasRebaix?: boolean;
  rebaixAmount?: number;
  hasAccessStair?: boolean;
  accessStairWidth?: number;
  accessTotalLength?: number;
  interiorStairsType?: InteriorStairsType;
  stairsWidth?: number;
  stairsLength?: number;
  stairsHeight?: number;
  platformWidth?: number;
  platformLength?: number;
  platformHeight?: number;
  benchWidth?: number;
  benchLength?: number;
  benchHeight?: number;
  // Jacuzzi opcional (Obra Nova). Fase condicional al wizard: només es mostra
  // quan hasJacuzzi === true, entre Accessoris i Annex.
  hasJacuzzi?: boolean;
  jacuzziType?: JacuzziType;
  jacuzziPosition?: JacuzziPosition;
  jacuzziLength?: number;
  jacuzziWidth?: number;
  jacuzziDepth?: number;
  // Jacuzzi independent — bancs interiors (per defecte 4, mesures suggerides
  // a partir de les mesures del jacuzzi, però editables).
  jacuzziBenchCount?: number;
  jacuzziBenchDepth?: number;
  jacuzziBenchHeight?: number;
  // Jacuzzi independent — escalons (fixos a 2: un sobre banc, un sota banc).
  jacuzziStairsCount?: number;
  jacuzziStairsTread?: number;
  // Instal·lació jacuzzi — jets d'aire.
  jacuzziAirJetsCount?: number;
  jacuzziAirJetsIntakeCount?: number;
  jacuzziAirPumpQty?: number;
  jacuzziAirPumpArticleId?: string;
  // Instal·lació jacuzzi — jets d'aigua.
  jacuzziWaterJetsCount?: number;
  jacuzziWaterJetsIntakeCount?: number;
  jacuzziWaterPumpQty?: number;
  jacuzziWaterPumpArticleId?: string;
  // Instal·lació jacuzzi — polsadors piezoelèctrics.
  jacuzziPiezoButtonsCount?: number;
  // Instal·lació jacuzzi independent — equips addicionals propis (no compartits
  // amb la instal·lació de la piscina principal).
  jacuzziFiltrationPumpArticleId?: string;
  jacuzziFiltrationPumpQty?: number;
  jacuzziFilterArticleId?: string;
  jacuzziFilterQty?: number;
  jacuzziLedArticleId?: string;
  jacuzziLedCount?: number;
  jacuzziHeatPumpArticleId?: string;
  jacuzziHeatPumpQty?: number;
  jacuzziSalineElectrolysisArticleId?: string;
  jacuzziSalineElectrolysisQty?: number;
  constructionSystem?: ConstructionSystem;
  waterproofingSystem?: WaterproofingSystem;
  // Gunite-specific
  guniteMangueraMetres?: number;
  guniteDistanciaKm?: number;
  phases?: BudgetPhase[];
  paymentConditions?: string;
  observations?: string;
  /** When false, excludes the Plànol tècnic page from the PDF even if the
   *  automatic conditions (poolShape === 'regular') would otherwise include it. */
  planolInclos?: boolean;
  // Acabats — Coronament
  coronamentActuacio?: string;
  coronamentTipus?: string;
  coronamentInclos?: boolean;
  coronamentFormat?: string;
  coronamentMl?: number;
  coronamentEncofratMl?: number;
  coronamentModelId?: string;
  coronamentModelADeterminar?: boolean;
  coronamentBeurada?: string;
  coronamentBeuradaColor?: string;
  coronamentObservacions?: string;
  coronamentPeces?: number;
  // Acabats — Revestiment
  revestimentActuacio?: string;
  revestimentTipus?: string;
  revestimentInclos?: boolean;
  revestimentFormat?: string;
  revestimentQualitat?: string;
  revestimentModelId?: string;
  revestimentModelADeterminar?: boolean;
  revestimentBeurada?: string;
  revestimentBeuradaColor?: string;
  revestimentPecesEspecials?: boolean;
  revestimentMigCanya?: boolean;
  // Acabats — Opcional
  opcionalRevestimentTipus?: string;
  opcionalRevestimentFormat?: string;
  opcionalRevestimentModelId?: string;
  opcionalRevestimentBeurada?: string;
  opcionalRevestimentBeuradaColor?: string;
  // Acabats — Revestiment exterior (només per piscines semi-enterrades / elevades)
  // Reutilitza el motor de càlcul del revestiment interior però treballant amb
  // la superfície exterior visible del vas (perímetre × altura vista).
  revestimentExteriorInclos?: boolean;
  revestimentExteriorFormat?: string;
  revestimentExteriorModelId?: string;
  revestimentExteriorModelADeterminar?: boolean;
  revestimentExteriorBeurada?: string;
  revestimentExteriorBeuradaColor?: string;
  // Rehab fields
  currentCoating?: string;
  constructionYear?: number;
  generalCondition?: string;
  detectedProblems?: string[];
  rehabWorks?: string[];
  rehabNotes?: Record<string, string>;
  newCoating?: string;
  // Maintenance fields
  filtrationSystem?: string;
  hasRobot?: boolean;
  hasCover?: boolean;
  maintenanceServices?: string[];
  maintenancePeriodicity?: string;
  maintenancePrice?: number;
  // Manteniment — Pla de Manteniment
  maintenancePlan?: MaintenancePlan;
  // Manteniment — Dades piscina addicionals
  poolDepthAvg?: number;
  hasElectrolisi?: boolean;
  kitMangueraSize?: '8' | '10' | '12';
  kitPertigaSize?: 'petita' | 'mitjana' | 'gran';
  // Manteniment — Segona piscina (mateix contracte, mateixa visita)
  hasSecondPool?: boolean;
  poolLength2?: number;
  poolWidth2?: number;
  poolDepthAvg2?: number;
  hasElectrolisi2?: boolean;
  photoUrl?: string;
  // Instal·lacions
  instalFiltrePoliesId?: string;
  instalFiltreEspecialId?: string;
  instalAfmEnabled?: boolean;
  instalAfmArticleId?: string;
  instalCanviSorraEnabled?: boolean;
  instalCanviSorraArticleId?: string;
  instalBombaOnoffId?: string;
  instalBombaVariableId?: string;
  instalWifiEnabled?: boolean;
  instalWifiArticleId?: string;
  // Prefiltre (HYDROSPIN COMPACT)
  instalPrefiltreEnabled?: boolean;
  instalPrefiltreArticleId?: string;
  instalPrefiltreQty?: number;
  instalDosificacioStdId?: string;
  instalHidrolisiId?: string;
  instalQuadreId?: string;
  instalQuadreLinia?: 'monofasica' | 'trifasica'; // default 'monofasica'
  // Auto panel selection
  instalQuadreDisplayText?: string;
  instalQuadreBaseCost?: number;
  instalQuadreBaseSale?: number;
  instalQuadreAddonNfCost?: number;
  instalQuadreAddonNfSale?: number;
  instalQuadreAddonBcCost?: number;
  instalQuadreAddonBcSale?: number;
  instalQuadreFinalCost?: number;
  instalQuadreFinalSale?: number;
  instalQuadreManualOverride?: boolean;
  instalQuadreRecommendedId?: string;
  // Quantities
  instalFiltrePoliesQty?: number;
  instalFiltreEspecialQty?: number;
  instalBombaOnoffQty?: number;
  instalBombaVariableQty?: number;
  instalDosificacioStdQty?: number;
  instalHidrolisiQty?: number;
  // Opcional flags
  instalFiltrePoliesOpcional?: boolean;
  instalFiltreEspecialOpcional?: boolean;
  instalBombaOnoffOpcional?: boolean;
  instalBombaVariableOpcional?: boolean;
  instalDosificacioStdOpcional?: boolean;
  instalHidrolisiOpcional?: boolean;
  // Elecció entre OPTION REDOX i KIT CLOR LLIURE quan el model de dosificació
  // estàndard escollit és de la línia "HC". Es neteja automàticament quan el
  // model deixa de ser HC.
  instalDosificacioHcOption?: 'redox' | 'kit_clor';
  // AFM auto
  instalAfmQty?: number;
  instalAfmIncrement?: number; // +€ differential AFM vs sorra silícia (per-client)
  // Canvi medi
  instalCanviMediArticleId?: string;
  instalCanviMediFiltre?: string;
  // Section enables
  instalDepuracioEnabled?: boolean;
  instalBombaEnabled?: boolean;
  instalDosificacioEnabled?: boolean;
  instalQuadreEnabled?: boolean;
  // Fontaneria
  instalFontaneriaEnabled?: boolean;
  instalFontaneriaText?: string;
  instalFontaneriaBaseArticleId?: string;
  instalFontaneriaExtraCost?: number;
  instalFontaneriaTotal?: number;
  instalFontaneriaDistancia?: number;
  instalFontaneriaLocalTecnic?: string;
  instalFontaneriaCasetaTipus?: string;
  instalFontaneriaPerforacions?: boolean;
  instalFontaneriaPerforacionsArticleId?: string;
  instalFontaneriaRasas?: string;
  instalFontaneriaRasasEnabled?: boolean;
  instalFontaneriaRasasImport?: number;
  // Instal·lació elèctrica
  instalElectricaEnabled?: boolean;
  instalElectricaText?: string;
  instalElectricaBaseArticleId?: string;
  instalElectricaExtraCost?: number;
  instalElectricaTotal?: number;
  instalElectricaDistancia?: number;
  // Caseta
  instalCasetaUbicacio?: string;
  instalCasetaObservacions?: string;
  instalCasetaEnabled?: boolean;
  // Caseta d'Obra (mesures + portes)
  instalCasetaObraLlarg?: number;
  instalCasetaObraAmple?: number;
  instalCasetaObraAlt?: number;
  instalCasetaObraPortes?: string; // 'frontal' | 'frontal_superior'
  // Accessoris bàsics
  accBasicsColor?: 'blanc' | 'color'; // default 'blanc'
  accImpulsorsQty?: number;
  accImpulsorsModelId?: string;
  accSkimmersQty?: number;
  accSkimmersModelId?: string;
  accEmbornalQty?: number;
  accEmbornalModelId?: string;
  accFocusLedQty?: number;
  accFocusLedModelId?: string;
  accFocusLedVariant?: string;
  accFocusLedText?: string;
  accReguladorQty?: number;
  accReguladorModelId?: string;
  accNetejafonsQty?: number;
  accNetejafonsModelId?: string;
  // Projectors Mini LED
  accProjectorMiniLedQty?: number;
  accProjectorMiniLedModelId?: string;
  // Control RGB (conditional)
  accControlRgbQty?: number;
  accControlRgbModelId?: string;
  // Accessoris opcionals
  accEscalaEnabled?: boolean;
  accEscalaQty?: number;
  accEscalaModelId?: string;
  accDutxaEnabled?: boolean;
  accDutxaQty?: number;
  accDutxaModelId?: string;
  accPlatDutxaEnabled?: boolean;
  accPlatDutxaQty?: number;
  accPlatDutxaSale?: number;
  accPlatDutxaLlarg?: number;
  accPlatDutxaAmple?: number;
  accPlatDutxaManualOverride?: boolean;
  accPlatDutxaSaleManualOverride?: boolean;
  accCascadaEnabled?: boolean;
  accCascadaQty?: number;
  accCascadaModelId?: string;
  accCascadaBombaArticleId?: string;
  accCascadaPulsadorArticleId?: string;
  accCascadaPulsadorQty?: number;
  accSalvavidesEnabled?: boolean;
  accSalvavidesQty?: number;
  accSalvavidesModelId?: string;
  accBaranaEnabled?: boolean;
  accBaranaQty?: number;
  accBaranaModelId?: string;
  // Annex notes
  annexNotes?: string;
  marginPctAdjustment?: number;
  // Annex — Projecte d'obra
  annexProjecteEstat?: string;
  annexProjecteArticleId?: string;
  annexProjecteQty?: number;
  // Annex — Excavació
  annexExcavacioEstat?: string;
  annexExcavacioImport?: number;
  annexExcavacioReompliment?: number;
  // Annex — Excavació (PDF overrides editable from the wizard)
  annexExcavacioPill1Title?: string;
  annexExcavacioPill2Title?: string;
  annexExcavacioText1?: string;
  annexExcavacioText2?: string;
  annexExcavacioManoObraOverride?: number;
  annexExcavacioReomplimentOverride?: number;
  // Annex — Paviment perimetral
  annexPavimentEstat?: string;
  annexPavimentTipus?: string;
  annexPavimentReformaEnabled?: boolean;
  annexPavimentNouEnabled?: boolean;
  annexPavimentRetiradaEnabled?: boolean;
  annexPavimentRetiradaM2?: number;
  annexPavimentRegularitzacioEnabled?: boolean;
  annexPavimentRegularitzacioM2?: number;
  annexPavimentActuacio?: string;
  annexPavimentFormigoEnabled?: boolean;
  annexPavimentFormigoM2?: number;
  annexPavimentMaterial?: string;
  annexPavimentFormat?: string;
  annexPavimentM2?: number;
  annexPavimentModelId?: string;
  annexPavimentModelADeterminar?: boolean;
  // Annex — Gespa artificial
  annexGespaEstat?: string;
  annexGespaPreparacioEnabled?: boolean;
  annexGespaPreparacioM2?: number;
  annexGespaModel?: string;
  annexGespaM2?: number;
  annexGespaArticleId?: string;
  // Annex — Entrada de material a mà (manual, no article reference)
  hasManualMaterialEntry?: boolean;
  manualMaterialEntryCost?: number;
  manualMaterialEntrySale?: number;
  // Annex — Cobertor
  annexCobertorEstat?: string;
  annexCobertorTipus?: 'fora_aigua' | 'submergit';
  annexCobertorModelId?: string;
  annexCobertorLames?: 'pvc' | 'policarbonat';
  annexCobertorColorId?: string;
  /** Cached display name of the chosen cobertor model — used by the budget summary. */
  annexCobertorModelName?: string;
  /** Cached code of the chosen cobertor model — used by the formula engine for conditions. */
  annexCobertorModelCode?: string;
  /** Cached display name of the chosen lames color — used by the budget summary. */
  annexCobertorColorName?: string;
  /** Manual price override (when the customer already has a personalised quote). */
  annexCobertorManualOverride?: boolean;
  annexCobertorManualAmount?: number;
  /** Calculated cost/sale (auto-mode), persisted so the budget summary can reuse them. */
  annexCobertorCalcCost?: number;
  annexCobertorCalcSale?: number;
  annexCobertorCalcBreakdown?: any;
  /** s-Lux only: whether a new wall must be built (vs. reusing the existing interior stair). */
  annexCobertorMurNou?: boolean;
  /** Calculated wall surface for the new wall (pool_width × avg depth). */
  annexCobertorMurM2?: number;
  // Annex — Robot netejafons
  annexRobotEstat?: string;
  annexRobotArticleId?: string;
  annexRobotQty?: number;
  // Annex — Bomba de calor
  annexBombaCalorEstat?: string;
  annexBombaCalorCoberta?: boolean;
  annexBombaCalorDesde?: string;
  annexBombaCalorFinsA?: string;
  annexBombaCalorTemperatura?: number;
  annexBombaCalorArticleId?: string;
  annexBombaCalorKwRequired?: number;
  // Annex — Sistema netejafons
  annexNetejafonsEstat?: string;
  annexNetejafonsFons?: number;
  annexNetejafonsEscala?: number;
  annexNetejafonsPlataforma?: number;
  annexNetejafonsTotal?: number;
  annexNetejafonsExtraCost?: number;
  annexNetejafonsArticleId?: string;
  // Piscina Autoportant
  autoportantModel?: 'line_confort' | 'line_luxe' | 'line_luxe_plus';
  autoportantAmple?: string;
  autoportantLlarg?: string;
  autoportantAlturaAigua?: string;
  autoportantCoronaKey?: string;
  autoportantRevestimentKey?: string;
  autoportantRevestimentExteriorKey?: string;
  autoportantMorterColor?: 'blanc' | 'beige' | 'gris';
  // Piscina Autoportant — Opcionals
  autoportantOpcAsientoAcrilicoQty?: number; // metres lineals (LINE CONFORT)
  autoportantOpcColchoneta?: boolean; // tots els models
  autoportantOpcCubiertaElectrica?: boolean; // tots els models (auto-selecciona mida)
  autoportantOpcBancoGresiteQty?: number; // metres lineals (LINE CONFORT)
  autoportantOpcSpa?: boolean; // tots els models
  autoportantOpcCascada?: boolean; // tots els models
  autoportantOpcAsientoPorcelanicoQty?: number; // metres lineals (LUXE / LUXE PLUS)
  autoportantOpcCristal?: boolean; // LINE CONFORT
  // Piscina Autoportant — Transport (calculat automàticament)
  autoportantTransportKm?: number;
  autoportantTransportKmOverride?: boolean;
  autoportantTransportCost?: number;
  autoportantTransportSale?: number;
  autoportantTransportUserEdited?: boolean;
}

export interface BudgetPhase {
  id: string;
  name: string;
  order: number;
  items: BudgetItem[];
}

export interface BudgetItem {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number;
  unitSale: number;
  source?: 'formula' | 'manual' | 'wizard';
  formulaRuleId?: string;
  /** Stable key for wizard auto-generated lines (e.g. 'instal_filtre_polies'). */
  wizardKey?: string;
  subPhase?: string | null;
  /** True when the user manually edited quantity/unitCost/unitSale of an
   * auto-generated (formula/wizard) item. Prevents merge from overwriting
   * the edit on subsequent recomputations. */
  userEdited?: boolean;
}

// Step definitions per type
export const STEPS_BY_TYPE: Record<BudgetType, { num: number; label: string }[]> = {
  obra_nueva: [
    { num: 1, label: 'Tipus' },
    { num: 2, label: 'Client' },
    { num: 3, label: 'Estructura' },
    { num: 4, label: 'Acabats' },
    { num: 5, label: 'Instal·lacions' },
    { num: 6, label: 'Accessoris' },
    { num: 7, label: 'Annex' },
    { num: 8, label: 'Partides' },
    { num: 9, label: 'Revisió' },
  ],
  rehabilitacion: [
    { num: 1, label: 'Tipus' },
    { num: 2, label: 'Client' },
    { num: 3, label: 'Estat Actual' },
    { num: 4, label: 'Treballs' },
    { num: 5, label: 'Partides' },
    { num: 6, label: 'Revisió' },
  ],
  mantenimiento: [
    { num: 1, label: 'Tipus' },
    { num: 2, label: 'Client' },
    { num: 3, label: 'Piscina' },
    { num: 4, label: 'Pla de Manteniment' },
    { num: 5, label: 'Revisió' },
  ],
  piscina_autoportant: [
    { num: 1, label: 'Tipus' },
    { num: 2, label: 'Client' },
    { num: 3, label: 'Piscina' },
    { num: 4, label: 'Acabats' },
    { num: 5, label: 'Opcionals' },
    { num: 6, label: 'Partides' },
    { num: 7, label: 'Revisió' },
  ],
};

interface BudgetStore {
  currentStep: number;
  draft: BudgetDraft;
  setStep: (step: number) => void;
  updateDraft: (data: Partial<BudgetDraft>) => void;
  resetDraft: () => void;
  loadDraft: (data: BudgetDraft) => void;
  getSteps: () => { num: number; label: string }[];
  getLastStep: () => number;
  isLastStep: () => boolean;
}

export const useBudgetStore = create<BudgetStore>((set, get) => ({
  currentStep: 1,
  draft: {},
  setStep: (step) => set({ currentStep: step }),
  updateDraft: (data) => set((state) => ({ draft: { ...state.draft, ...data } })),
  resetDraft: () =>
    set({
      currentStep: 1,
      draft: {
        guniteMangueraMetres: 0,
        // Default annex sections marked as "opcional per al client"
        annexNetejafonsEstat: "opcional",
        annexRobotEstat: "opcional",
        annexProjecteEstat: "opcional",
        annexExcavacioEstat: "opcional",
        annexPavimentEstat: "opcional",
        annexGespaEstat: "opcional",
      } as BudgetDraft,
    }),
  loadDraft: (data) => set({ draft: data, currentStep: 2 }),
  getSteps: () => {
    const { type, hasJacuzzi } = get().draft;
    if (!type) return STEPS_BY_TYPE.obra_nueva;
    const steps = STEPS_BY_TYPE[type];
    if (type === 'obra_nueva' && hasJacuzzi) {
      // Inserta el pas condicional "Jacuzzi" (num 7) després d'Accessoris i
      // renumera Annex/Partides/Revisió (8/9/10).
      return [
        ...steps.slice(0, 6),
        { num: 7, label: 'Jacuzzi' },
        ...steps.slice(6).map((s) => ({ ...s, num: s.num + 1 })),
      ];
    }
    return steps;
  },
  getLastStep: () => {
    return get().getSteps().length;
  },
  isLastStep: () => {
    return get().currentStep === get().getLastStep();
  },
}));
