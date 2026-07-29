/**
 * Shared types for the AquaBlau PDF template.
 *
 * The same `PdfData` shape is consumed by both the live preview
 * (`/configuracio/pdf-preview`) and the real generator in
 * `src/lib/budgetSave.ts → generatePDF()`.
 */

export interface PdfArticleRow {
  description: string;
  quantity?: number;
  unitSale?: number;
  total?: number;
  imageUrl?: string;
}

export interface PdfPhase {
  name: string;
  items: PdfArticleRow[];
  subtotal: number;
}

export interface PdfData {
  // Header / cover
  budgetNumber: string;
  budgetDate: string;
  type: string; // "Obra Nova" | "Rehabilitació" | "Manteniment"
  // Client
  clientName: string;
  clientNif?: string;
  clientAddress?: string;
  clientTown?: string;
  clientPhone?: string;
  clientEmail?: string;
  // Pool
  poolLength?: number;
  poolWidth?: number;
  poolDepthMin?: number;
  poolDepthMax?: number;
  poolVolumeM3?: number;
  poolSurfaceM2?: number;
  hasInteriorStairs?: boolean;
  interiorStairsType?: string; // 'estandard' | 'plataforma' | 'banc' | 'tot_ample' | 'sense'
  hasExteriorStairs?: boolean;
  extStairsLength?: number;
  extStairsWidth?: number;
  // Disposició piscina (Obra Nova)
  poolDisposition?: 'enterrada' | 'semi_enterrada' | 'elevada' | string;
  alturaVista?: number;
  hasAccessStair?: boolean;
  accessStairWidth?: number;
  accessStairLength?: number;
  accessPlatformWidth?: number;
  accessPlatformLength?: number;
  waterproofingSystem?: string; // 'impertot' | 'hidrofix' | 'lamina_proof'
  constructionSystem?: string; // 'gunite' | 'bloc_encofrat'
  poolType?: string; // 'particular' | 'comunitaria'
  poolShape?: string; // 'regular' | 'irregular'
  stairsDimensions?: string; // e.g. "1,20 x 1,50 x 1,20"
  hasPlatform?: boolean;
  platformDimensions?: string;
  // Acabats
  coronamentDescription?: string; // text under the section header
  revestimentDescription?: string;
  coronamentImageUrl?: string;
  coronamentImageCaption?: string;
  revestimentImageUrl?: string;
  revestimentImageCaption?: string;
  recommendBeuradaEpoxica?: boolean;
  // Coronament details (Page 4 — Acabats)
  coronamentActuacioLabel?: string;   // "Subministrament i col·locació" | "Només subministrament" | "Només col·locació"
  coronamentMl?: number;              // metres lineals calculated in wizard
  coronamentBeuradaLabel?: string;    // "Beurada cimentosa" | "Epoxi"
  coronamentBeuradaColor?: string;    // chosen color (may be empty → "a determinar")
  coronamentTipusLabel?: string;      // e.g. "GRES PORCELÀNIC 31×62"
  coronamentTipusFormat?: string;     // e.g. "ROSAGRES L62"
  coronamentModelName?: string;       // chosen article name
  coronamentModelImageUrl?: string;   // chosen article thumbnail
  coronamentTotal?: number;           // CORONA section amount (resum financer)
  revestimentTotal?: number;          // REVESTIMENT section amount
  /** When false, the CORONAMENT section + partides are excluded from the PDF. */
  coronamentInclos?: boolean;
  /** When false, the REVESTIMENT INTERIOR section + partides are excluded. */
  revestimentInclos?: boolean;
  // Revestiment interior details (Page 4 — Acabats)
  revestimentActuacioLabel?: string;  // "Subministrament i col·locació" | "Subministrament" | "Col·locació"
  revestimentSurfaceText?: string;    // "de mosaic vitri en tota la superfície interior de la piscina" | porcelànic variant
  revestimentTipusLabel?: string;     // "GRESSITE" | "PORCELÀNIC"
  revestimentTipusFormat?: string;    // "2,5 × 2,5 cm" etc.
  revestimentBeuradaLabel?: string;   // "Beurada cimentosa" | "Beurada epoxi"
  revestimentBeuradaColor?: string;   // chosen color (may be empty → "a determinar")
  revestimentModelName?: string;
  revestimentModelImageUrl?: string;
  /** When true, the exterior wall revestiment sub-phase is included. */
  revestimentExteriorInclos?: boolean;
  /** Sum of the "Revestiment exterior" sub-phase (used to split the pill). */
  revestimentExteriorTotal?: number;
  // Depuració
  depuracioCapacityM3?: number;
  filtreSorraName?: string;
  filtreSorraImageUrl?: string;
  filtreCartutxName?: string;
  filtreCartutxImageUrl?: string;
  // Included filter (computed in budgetSave)
  filtreInclosTipus?: 'sorra' | 'cartutx';
  filtreInclosName?: string;
  filtreInclosImageUrl?: string;
  // AFM (vidre actiu) increment
  afmEnabled?: boolean;
  afmQty?: number;
  afmExtraSale?: number;
  // Prefiltre HYDROSPIN COMPACT
  prefiltreEnabled?: boolean;
  prefiltreName?: string;
  prefiltreImageUrl?: string;
  prefiltreSale?: number;
  bombaStandardName?: string;
  bombaStandardImageUrl?: string;
  bombaInverterName?: string;
  bombaInverterImageUrl?: string;
  // Bomba INCLOSA in the budget (standard on/off OR variable inverter)
  bombaInclosTipus?: 'standard' | 'inverter';
  bombaInclosName?: string;
  bombaInclosImageUrl?: string;
  bombaInclosFlowText?: string; // e.g. "5 a 25m3/h" or "14m3/h"
  bombaInclosTotal?: number;
  // Opcional (per al client) — filtre / bomba marcats com a opcional al wizard
  filtreOpcionalTipus?: 'sorra' | 'cartutx';
  filtreOpcionalName?: string;
  filtreOpcionalImageUrl?: string;
  filtreOpcionalSale?: number;
  bombaOpcionalTipus?: 'standard' | 'inverter';
  bombaOpcionalName?: string;
  bombaOpcionalImageUrl?: string;
  bombaOpcionalFlowText?: string;
  bombaOpcionalSale?: number;
  // Accessoris encastats (page 5/Depuració)
  accSkimmersQty?: number;
  accSkimmersTotal?: number;
  accImpulsorsQty?: number;
  accImpulsorsTotal?: number;
  accEmbornalQty?: number;
  accEmbornalTotal?: number;
  accNetejafonsQty?: number;
  accNetejafonsTotal?: number;
  accReguladorQty?: number;
  accReguladorTotal?: number;
  accFocusLedQty?: number;
  accFocusLedTotal?: number;
  accFocusLedDescription?: string;
  // Page 8 (Accessoris) — final compiled lines
  accBasicsColor?: 'blanc' | 'color';
  accBasicLines?: Array<{ label: string; qty: number; total: number }>;
  accBasicTotal?: number;
  accOptionalLines?: Array<{ label: string; qty: number; total: number }>;
  accOptionalTotal?: number;
  // Sum of every Instal·lacions section (4+5+6+7+8) — shown on Page 8 badge
  instalacionsTotal?: number;
  // Electrolisi salina
  hidrolisiName?: string;
  hidrolisiImageUrl?: string;
  hidrolisiAltName?: string; // the non-recommended alternative
  hidrolisiAltImageUrl?: string;
  hidrolisiTotal?: number;
  // Mòdul Ethernet / WIFI (optional add-on)
  wifiEnabled?: boolean;
  wifiName?: string;
  wifiImageUrl?: string;
  wifiSale?: number;
  machineRoomImageUrl?: string;
  // Electricitat & fontaneria
  quadreText?: string;
  quadreTotal?: number;
  quadreSale?: number;            // total sale of the quadre elèctric (page 7)
  electricaSale?: number;         // total sale of the instal·lació elèctrica (cable + piqueta + brida)
  presaTerraTotal?: number;
  fontaneriaText?: string;
  fontaneriaTotal?: number;
  fontaneriaDistancia?: number;   // user-defined distance (m) shown in "Fins a Xm*"
  fontaneriaPerforacions?: boolean; // when true, hides the italic observation note
  escomesaIncluded?: boolean;
  electricityImageUrl?: string;
  // Phases / totals (used in Resum)
  phaseStructuralTotal: number;
  vasTotal?: number;
  elementsEstructuralsTotal?: number;
  phaseAcabatsTotal: number;
  phaseDepuracioTotal: number;
  phaseElectricitatTotal: number;
  /** Sum of every annex line included in the budget ("inclos" estat). */
  phaseAnnexTotal?: number;
  // Annex — Projecte Tècnic d'Obra
  annexProjecteEstat?: 'no' | 'inclos' | 'opcional' | string;
  annexProjecteName?: string;
  annexProjecteAmount?: number; // article sale * qty
  // Annex — Excavació i re-ompliment de terres
  annexExcavacioEstat?: 'no' | 'inclos' | 'opcional' | string;
  annexExcavacioManoObra?: number; // mà d'obra excavació (sale)
  annexExcavacioReompliment?: number; // re-ompliment perimetral (sale)
  annexExcavacioTotal?: number; // suma dels dos
  annexExcavacioPill1Title?: string;
  annexExcavacioPill2Title?: string;
  annexExcavacioText1?: string;
  annexExcavacioText2?: string;
  // Annex — Sistema Neteja Fons Integrat
  annexNetejafonsEstat?: 'no' | 'inclos' | 'opcional' | string;
  annexNetejafonsFons?: number;
  annexNetejafonsEscala?: number;
  annexNetejafonsPlataforma?: number;
  annexNetejafonsPlataformaLabel?: string; // "Plataforma" | "Banc"
  annexNetejafonsCapcalLabel?: string; // e.g. "Capçal D.63" / "Capçal D.50"
  annexNetejafonsBombaLabel?: string;  // e.g. "Bomba 1,5CV (Pool Vallet Dolfi 150M)"
  annexNetejafonsBombaQty?: number;
  annexNetejafonsAmount?: number;      // total of netejafons subphase (sale)
  // Annex — Robot Neteja Fons Automàtic
  annexRobotEstat?: 'no' | 'inclos' | 'opcional' | string;
  annexRobotName?: string;
  annexRobotImageUrl?: string;
  annexRobotQty?: number;
  annexRobotAmount?: number;     // article sale * qty
  annexRobotModel?: 'P3' | 'P7'; // detected from name
  // Annex — Bomba de calor (Climatització)
  annexBombaCalorEstat?: 'no' | 'inclos' | 'opcional' | string;
  annexBombaCalorName?: string;
  annexBombaCalorImageUrl?: string;
  annexBombaCalorAmount?: number;
  annexBombaCalorCoberta?: boolean;
  annexBombaCalorDesde?: string;  // ISO date
  annexBombaCalorFinsA?: string;  // ISO date
  annexBombaCalorTemperatura?: number; // °C
  // Annex — Cobertor (Coberta automàtica)
  annexCobertorEstat?: 'no' | 'inclos' | 'opcional' | string;
  annexCobertorTipus?: 'fora_aigua' | 'submergit';
  annexCobertorLames?: 'pvc' | 'policarbonat';
  annexCobertorModelName?: string;
  annexCobertorModelCode?: string;
  annexCobertorModelImageUrl?: string;
  annexCobertorColorName?: string;
  annexCobertorColorImageUrl?: string;
  /** All available colors for the selected model + lames material (for gallery display). */
  annexCobertorAvailableColors?: { name: string; imageUrl?: string; selected?: boolean }[];
  annexCobertorAmount?: number;
  // Annex — Caseta depuradora (Local tècnic nou / A determinar)
  annexCasetaEstat?: 'no' | 'inclos' | 'opcional' | string;
  annexCasetaTipus?: 'caseta_elevada' | 'caseta_soterrada' | 'caseta_obra' | string;
  annexCasetaAmount?: number;
  annexCasetaImageUrl?: string;
  annexCasetaObraLlarg?: number;
  annexCasetaObraAmple?: number;
  annexCasetaObraAlt?: number;
  annexCasetaObraPortes?: 'frontal' | 'frontal_superior' | 'sense_portes' | string;
  // Annex — Revestiment alternatiu (always OPCIONAL)
  annexOpcionalRevestimentEstat?: 'no' | 'opcional' | string;
  annexOpcionalRevestimentTipusLabel?: string;       // "GRESSITE" | "PORCELÀNIC"
  annexOpcionalRevestimentTipusFormat?: string;      // "2,5 × 2,5 cm" etc.
  annexOpcionalRevestimentSurfaceText?: string;
  annexOpcionalRevestimentActuacioLabel?: string;
  annexOpcionalRevestimentBeuradaLabel?: string;
  annexOpcionalRevestimentBeuradaColor?: string;
  annexOpcionalRevestimentModelName?: string;
  annexOpcionalRevestimentModelImageUrl?: string;
  annexOpcionalRevestimentAmount?: number;
  /** Total if the same opcional revestiment used "Beurada epoxi" (for upsell line). */
  annexOpcionalRevestimentAmountEpoxi?: number;
  // Annex — Paviment perimetral
  annexPavimentEstat?: 'no' | 'inclos' | 'opcional' | string;
  annexPavimentReformaEnabled?: boolean;
  annexPavimentRetiradaEnabled?: boolean;
  annexPavimentRetiradaM2?: number;
  annexPavimentRegularitzacioEnabled?: boolean;
  annexPavimentRegularitzacioM2?: number;
  annexPavimentNouEnabled?: boolean;
  annexPavimentActuacio?: string; // 'suministre_col' | 'col' | 'suministre'
  annexPavimentFormigoEnabled?: boolean;
  annexPavimentFormigoM2?: number;
  annexPavimentMaterial?: string; // 'aplacat' | 'fusta'
  annexPavimentFormat?: string; // "31 × 62 cm" | "48 × 98 cm" | "98 × 98 cm"
  annexPavimentM2?: number;
  annexPavimentModelName?: string; // article name, undefined → "a determinar"
  annexPavimentAmount?: number; // pill total (subphase paviment subtotal)
  // Per-row totals computed from paviment subphase items
  annexPavimentRetiradaTotal?: number;
  annexPavimentRegularitzacioTotal?: number;
  annexPavimentFormigoTotal?: number;
  annexPavimentNouTotal?: number;
  // Annex — Gespa artificial
  annexGespaEstat?: 'no' | 'inclos' | 'opcional' | string;
  annexGespaModelName?: string;
  annexGespaModelMm?: 35 | 38 | 45;
  annexGespaM2?: number;
  annexGespaPreparacioIncluded?: boolean;
  annexGespaPricePerM2?: number; // sale price €/m² of the selected (or default) article
  annexGespaAmount?: number;     // total to display in the pill
  /** Section pill amount for "DEPURACIÓ" on Page 5 (equip + subfase depuracio when sorra + 20h MO + prefiltre). */
  depuracioSectionAmount?: number;
  phases?: PdfPhase[]; // optional detailed breakdown (annex)
  totalSale: number;
  paymentConditions?: string;
  observations?: string;
  /** Discount percentage as a positive number (e.g. 5 for 5% off). Only set when adjustment is negative. */
  discountPct?: number;
  /** totalSale after applying the discount. Only set when discount is active. */
  totalSaleAfterDiscount?: number;
  // ── Confirmació de Comanda (optional extra page after Resum) ─────────────
  contractantName?: string;
  contractantNif?: string;
  contractantAddress?: string;
  contractantTown?: string;
  obraLocation?: string;
  // ── Contact (final page) ─────────────────────────────────────────────
  comercialName?: string;
  comercialEmail?: string;
  /** Optional override for the phone shown on PageContacte. Defaults to the
   *  Aquablau general line when absent. */
  contactPhone?: string;
  // ── Manteniment (alternate document layout) ─────────────────────────
  /** When true, PdfDocument renders the maintenance variant (Portada,
   *  Manteniment, Resum, Contacte). */
  isMaintenance?: boolean;
  poolDepthAvg?: number;
  hasElectrolisi?: boolean;
  /** Second pool sharing the same maintenance contract/visit. */
  hasSecondPool?: boolean;
  poolLength2?: number;
  poolWidth2?: number;
  poolDepthAvg2?: number;
  hasElectrolisi2?: boolean;
  maintenanceVisitsPerMonth?: number[];
  /** Pre-built human-readable visit period lines (e.g. "Del 01 de maig…"). */
  maintenanceVisitText?: string[];
  maintenanceTotalAnual?: number;
  maintenanceTotalMensual?: number;
  maintenanceKitTotal?: number;
  // ── Piscina Autoportant (alternate document layout) ─────────────────
  /** When true, PdfDocument renders the autoportant variant
   *  (Portada → Model → Acabats → [Opcionals sel] → Resum → [Opcionals catàleg] → Contacte). */
  isAutoportant?: boolean;
  autoportantModelKey?: string;
  autoportantModelName?: string;
  autoportantModelTagline?: string;
  autoportantModelImage?: string;
  autoportantModelFeatures?: string[];
  autoportantAmple?: string;         // e.g. "2,50 m"
  autoportantLlarg?: string;
  autoportantAlturaAigua?: string;
  autoportantCoronaName?: string;
  autoportantCoronaFamily?: string;
  autoportantCoronaImage?: string;
  autoportantRevestimentName?: string;
  autoportantRevestimentFamily?: string;
  autoportantRevestimentImage?: string;
  autoportantExteriorNote?: string;
  /** Opcionals inclosos al pressupost (amb import). */
  autoportantSelectedOpcionals?: Array<{
    label: string;
    description?: string;
    unit: string;
    qty: number;
    unitSale: number;
    total: number;
  }>;
  /** Catàleg complet d'opcionals compatibles amb el model (sense import total). */
  autoportantAllOpcionals?: Array<{
    label: string;
    description?: string;
    unit: string;
    unitSale: number;
  }>;
}
