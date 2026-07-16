import type { BudgetDraft } from '@/stores/budgetStore';

export interface ArticleLite {
  id: string;
  name: string;
  unit?: string | null;
  cost_price?: number | null;
  sale_price?: number | null;
}

/** Build a fast lookup by article id. Prices are stored in cents in DB. */
export function indexArticlesById(articles: any[]): Map<string, ArticleLite> {
  const map = new Map<string, ArticleLite>();
  for (const a of articles || []) {
    if (!a?.id) continue;
    map.set(String(a.id), {
      id: String(a.id),
      name: a.name ?? '',
      unit: a.unit ?? 'ud',
      cost_price: a.cost_price ?? 0,
      sale_price: a.sale_price ?? 0,
    });
  }
  return map;
}

function toEur(cents: number | null | undefined): number {
  return Number(cents ?? 0) / 100;
}

/** Resolve an article entry safely (returns zeros when missing). */
export function resolveArticle(
  index: Map<string, ArticleLite>,
  id: string | null | undefined
): { id: string | null; name: string; unit: string; sale: number; cost: number } {
  if (!id) return { id: null, name: '', unit: 'ud', sale: 0, cost: 0 };
  const article = index.get(String(id));
  if (!article) return { id: String(id), name: '', unit: 'ud', sale: 0, cost: 0 };
  return {
    id: article.id,
    name: article.name,
    unit: article.unit || 'ud',
    sale: toEur(article.sale_price),
    cost: toEur(article.cost_price),
  };
}

export interface InstallationItem {
  key: string;
  label: string;
  articleId: string | null;
  qty: number;
  unit: string;
  unitSale: number;
  unitCost: number;
  isOptional: boolean;
  enabled: boolean;
}

/**
 * Build the structured list of installation equipment selections from the wizard draft.
 * Each entry carries enough info to either expose as variables or to render as a line item.
 */
export function getInstallationSelections(
  draft: Partial<BudgetDraft>,
  index: Map<string, ArticleLite>
): InstallationItem[] {
  const filtrePolies = resolveArticle(index, draft.instalFiltrePoliesId);
  const filtreEspecial = resolveArticle(index, draft.instalFiltreEspecialId);
  const afm = resolveArticle(index, draft.instalAfmArticleId);
  const canviMedi = resolveArticle(index, draft.instalCanviMediArticleId);
  const bombaOnoff = resolveArticle(index, draft.instalBombaOnoffId);
  const bombaVariable = resolveArticle(index, draft.instalBombaVariableId);
  const wifi = resolveArticle(index, draft.instalWifiArticleId);
  const prefiltre = resolveArticle(index, draft.instalPrefiltreArticleId);
  const dosificacioStd = resolveArticle(index, draft.instalDosificacioStdId);
  const hidrolisi = resolveArticle(index, draft.instalHidrolisiId);
  const quadre = resolveArticle(index, draft.instalQuadreId);

  const depuracioOn = draft.instalDepuracioEnabled !== false;
  const bombaOn = draft.instalBombaEnabled !== false;
  const dosificacioOn = draft.instalDosificacioEnabled !== false;
  const quadreOn = draft.instalQuadreEnabled !== false;

  return [
    {
      key: 'instal_filtre_polies',
      label: filtrePolies.name || 'Filtre de fibra (polies)',
      articleId: filtrePolies.id,
      qty: Number(draft.instalFiltrePoliesQty ?? 1),
      unit: filtrePolies.unit,
      unitSale: filtrePolies.sale,
      unitCost: filtrePolies.cost,
      isOptional: !!draft.instalFiltrePoliesOpcional,
      enabled: depuracioOn && !!filtrePolies.id,
    },
    {
      key: 'instal_filtre_especial',
      label: filtreEspecial.name || 'Filtre especial',
      articleId: filtreEspecial.id,
      qty: Number(draft.instalFiltreEspecialQty ?? 1),
      unit: filtreEspecial.unit,
      unitSale: filtreEspecial.sale,
      unitCost: filtreEspecial.cost,
      isOptional: !!draft.instalFiltreEspecialOpcional,
      enabled: depuracioOn && !!filtreEspecial.id,
    },
    {
      key: 'instal_afm',
      label: afm.name || 'AFM (vidre filtrant)',
      articleId: afm.id,
      qty: Number(draft.instalAfmQty ?? 0),
      unit: afm.unit || 'sacs',
      unitSale: afm.sale,
      unitCost: afm.cost,
      isOptional: false,
      enabled: depuracioOn && !!draft.instalAfmEnabled && !!afm.id,
    },
    {
      key: 'instal_canvi_medi',
      label: canviMedi.name || 'Canvi medi filtrant',
      articleId: canviMedi.id,
      qty: 1,
      unit: canviMedi.unit,
      unitSale: canviMedi.sale,
      unitCost: canviMedi.cost,
      isOptional: false,
      // Canvi de sorra/vidre is independent: it appears whenever the user
      // explicitly enabled "Incloure canvi de sorra o vidre" with an article,
      // regardless of whether the depuració/filter section is included.
      // Si l'usuari ha activat l'increment AFM, la fórmula del motor de càlcul
      // ja gestiona el canvi de medi (VIDRE AFM / ARENA SILICE), per tant aquí
      // no afegim cap línia automàtica per evitar duplicats o partides errònies
      // tipus "Canvi de sorra per AFM".
      enabled: !!draft.instalCanviSorraEnabled && !!canviMedi.id && !draft.instalAfmEnabled,
    },
    {
      key: 'instal_bomba_onoff',
      label: bombaOnoff.name || 'Bomba On/Off',
      articleId: bombaOnoff.id,
      qty: Number(draft.instalBombaOnoffQty ?? 1),
      unit: bombaOnoff.unit,
      unitSale: bombaOnoff.sale,
      unitCost: bombaOnoff.cost,
      isOptional: !!draft.instalBombaOnoffOpcional,
      enabled: bombaOn && !!bombaOnoff.id,
    },
    {
      key: 'instal_bomba_variable',
      label: bombaVariable.name || 'Bomba velocitat variable',
      articleId: bombaVariable.id,
      qty: Number(draft.instalBombaVariableQty ?? 1),
      unit: bombaVariable.unit,
      unitSale: bombaVariable.sale,
      unitCost: bombaVariable.cost,
      isOptional: !!draft.instalBombaVariableOpcional,
      enabled: bombaOn && !!bombaVariable.id,
    },
    {
      key: 'instal_wifi',
      label: wifi.name || 'Mòdul Wi-Fi',
      articleId: wifi.id,
      qty: 1,
      unit: wifi.unit,
      unitSale: wifi.sale,
      unitCost: wifi.cost,
      isOptional: false,
      enabled: !!draft.instalWifiEnabled && !!wifi.id,
    },
    {
      key: 'instal_prefiltre',
      label: prefiltre.name || 'Prefiltre HYDROSPIN COMPACT',
      articleId: prefiltre.id,
      qty: Number(draft.instalPrefiltreQty ?? 1),
      unit: prefiltre.unit,
      unitSale: prefiltre.sale,
      unitCost: prefiltre.cost,
      isOptional: false,
      enabled: !!draft.instalPrefiltreEnabled && !!prefiltre.id,
    },
    {
      key: 'instal_dosificacio_std',
      label: dosificacioStd.name || 'Dosificació estàndard',
      articleId: dosificacioStd.id,
      qty: Number(draft.instalDosificacioStdQty ?? 1),
      unit: dosificacioStd.unit,
      unitSale: dosificacioStd.sale,
      unitCost: dosificacioStd.cost,
      isOptional: !!draft.instalDosificacioStdOpcional,
      enabled: dosificacioOn && !!dosificacioStd.id,
    },
    {
      key: 'instal_hidrolisi',
      label: hidrolisi.name || 'Hidròlisi/UV',
      articleId: hidrolisi.id,
      qty: Number(draft.instalHidrolisiQty ?? 1),
      unit: hidrolisi.unit,
      unitSale: hidrolisi.sale,
      unitCost: hidrolisi.cost,
      isOptional: !!draft.instalHidrolisiOpcional,
      enabled: dosificacioOn && !!hidrolisi.id,
    },
    {
      key: 'instal_quadre',
      label: draft.instalQuadreDisplayText || quadre.name || 'Quadre elèctric',
      articleId: quadre.id,
      qty: 1,
      unit: quadre.unit,
      unitSale: typeof draft.instalQuadreFinalSale === 'number' ? draft.instalQuadreFinalSale : quadre.sale,
      unitCost: typeof draft.instalQuadreFinalCost === 'number' ? draft.instalQuadreFinalCost : quadre.cost,
      isOptional: false,
      enabled: quadreOn && !!quadre.id,
    },
  ];
}

export interface AccessoryItem {
  key: string;
  label: string;
  articleId: string | null;
  qty: number;
  unit: string;
  unitSale: number;
  unitCost: number;
  isOptional: boolean;
  enabled: boolean;
  /** True if user activated the section but didn't pick a model yet. */
  pendingPrice: boolean;
}

export function getAccessorySelections(
  draft: Partial<BudgetDraft>,
  index: Map<string, ArticleLite>
): AccessoryItem[] {
  const mk = (
    key: string,
    fallbackLabel: string,
    articleId: string | null | undefined,
    qty: number,
    isOptional: boolean,
    enabled: boolean
  ): AccessoryItem => {
    const a = resolveArticle(index, articleId);
    return {
      key,
      label: a.name || fallbackLabel,
      articleId: a.id,
      qty,
      unit: a.unit,
      unitSale: a.sale,
      unitCost: a.cost,
      isOptional,
      enabled: enabled && qty > 0,
      pendingPrice: enabled && qty > 0 && !a.id,
    };
  };

  const focusLed = resolveArticle(index, draft.accFocusLedModelId);
  const focusLedQty = Number(draft.accFocusLedQty ?? 0);
  // If the embellidor variant is "color", add a 14€/u surcharge directly to
  // the Focus LED unit sale price so the total naturally scales with qty.
  const focusLedEmbellidorColor = String(draft.accFocusLedVariant ?? '').split('|')[0] === 'color';
  const focusLedColorSurcharge = focusLedEmbellidorColor ? 14 : 0;

  const projector = resolveArticle(index, draft.accProjectorMiniLedModelId);
  const projectorQty = Number(draft.accProjectorMiniLedQty ?? 0);

  const rgb = resolveArticle(index, draft.accControlRgbModelId);
  const rgbQty = Number(draft.accControlRgbQty ?? 0);

  return [
    mk('acc_impulsors', 'Impulsors · A determinar', draft.accImpulsorsModelId, Number(draft.accImpulsorsQty ?? 0), false, true),
    mk('acc_skimmers', 'Skimmers · A determinar', draft.accSkimmersModelId, Number(draft.accSkimmersQty ?? 0), false, true),
    mk('acc_embornal', 'Embornal · A determinar', draft.accEmbornalModelId, Number(draft.accEmbornalQty ?? 0), false, true),
    {
      key: 'acc_focus_led',
      label: draft.accFocusLedText || focusLed.name || 'Focus LED · A determinar',
      articleId: focusLed.id,
      qty: focusLedQty,
      unit: focusLed.unit || 'ud',
      unitSale: focusLed.sale + focusLedColorSurcharge,
      unitCost: focusLed.cost,
      isOptional: false,
      enabled: focusLedQty > 0,
      pendingPrice: focusLedQty > 0 && !focusLed.id,
    },
    {
      key: 'acc_projector_mini_led',
      label: projector.name || 'Projector Mini LED · A determinar',
      articleId: projector.id,
      qty: projectorQty,
      unit: projector.unit || 'ud',
      unitSale: projector.sale,
      unitCost: projector.cost,
      isOptional: false,
      enabled: projectorQty > 0 && !!projector.id,
      pendingPrice: projectorQty > 0 && !projector.id,
    },
    {
      key: 'acc_control_rgb',
      label: rgb.name || 'Control RGB · A determinar',
      articleId: rgb.id,
      qty: rgbQty,
      unit: rgb.unit || 'ud',
      unitSale: rgb.sale,
      unitCost: rgb.cost,
      isOptional: false,
      // Only show when both qty>0 AND an article is actually selected.
      // This prevents zero-priced ghost rows when the user clears the model.
      enabled: rgbQty > 0 && !!rgb.id,
      pendingPrice: rgbQty > 0 && !rgb.id,
    },
    mk('acc_regulador', 'Regulador de nivell · A determinar', draft.accReguladorModelId, Number(draft.accReguladorQty ?? 0), false, true),
    mk('acc_netejafons', 'Presa netejafons · A determinar', draft.accNetejafonsModelId, Number(draft.accNetejafonsQty ?? 0), false, true),
    // Optional accessories
    mk('acc_escala', 'Escala inox · A determinar', draft.accEscalaModelId, Number(draft.accEscalaQty ?? 1), true, !!draft.accEscalaEnabled),
    mk('acc_dutxa', 'Dutxa exterior · A determinar', draft.accDutxaModelId, Number(draft.accDutxaQty ?? 1), true, !!draft.accDutxaEnabled),
    {
      key: 'acc_plat_dutxa',
      label: 'Plat de dutxa',
      articleId: null,
      qty: Number(draft.accPlatDutxaQty ?? 1),
      unit: 'ud',
      unitSale: 550,
      unitCost: 0,
      isOptional: true,
      enabled: !!draft.accPlatDutxaEnabled,
      pendingPrice: false,
    },
    mk('acc_cascada', 'Cascada · A determinar', draft.accCascadaModelId, Number(draft.accCascadaQty ?? 1), true, !!draft.accCascadaEnabled),
    mk('acc_salvavides', 'Salvavides + suport · A determinar', draft.accSalvavidesModelId, Number(draft.accSalvavidesQty ?? 1), true, !!draft.accSalvavidesEnabled),
    mk('acc_barana', 'Barana ancorada exterior · A determinar', draft.accBaranaModelId, Number(draft.accBaranaQty ?? 1), true, !!draft.accBaranaEnabled),
  ];
}

/** Flatten installation/accessory selections into the formula context as variables. */
export function injectWizardSelectionsIntoContext(
  context: Record<string, any>,
  draft: Partial<BudgetDraft>,
  articles: any[]
): Record<string, any> {
  const index = indexArticlesById(articles);
  const installations = getInstallationSelections(draft, index);
  const accessories = getAccessorySelections(draft, index);

  for (const item of installations) {
    context[`${item.key}_id`] = item.articleId;
    context[`${item.key}_qty`] = item.qty;
    context[`${item.key}_sale`] = item.unitSale;
    context[`${item.key}_cost`] = item.unitCost;
    context[`${item.key}_name`] = item.label;
    context[`${item.key}_opcional`] = item.isOptional;
    context[`${item.key}_enabled`] = item.enabled;
  }

  for (const item of accessories) {
    context[`${item.key}_qty`] = item.qty;
    context[`${item.key}_sale`] = item.unitSale;
    context[`${item.key}_cost`] = item.unitCost;
    context[`${item.key}_name`] = item.label;
    if (item.key !== 'acc_impulsors' && item.key !== 'acc_skimmers' && item.key !== 'acc_embornal' && item.key !== 'acc_regulador' && item.key !== 'acc_netejafons' && item.key !== 'acc_focus_led') {
      context[`${item.key}_enabled`] = item.enabled;
    }
  }

  // Fixed price for plat_dutxa
  context['acc_plat_dutxa_price'] = 550;

  // Section enables (non-id booleans)
  context.instal_depuracio_enabled = draft.instalDepuracioEnabled !== false;
  context.instal_bomba_enabled = draft.instalBombaEnabled !== false;
  context.instal_dosificacio_enabled = draft.instalDosificacioEnabled !== false;
  context.instal_quadre_enabled = draft.instalQuadreEnabled !== false;
  context.instal_fontaneria_enabled = draft.instalFontaneriaEnabled !== false;
  context.instal_electrica_enabled = draft.instalElectricaEnabled !== false;
  context.instal_caseta_enabled = draft.instalCasetaEnabled !== false;
  context.instal_fontaneria_local_tecnic = draft.instalFontaneriaLocalTecnic ?? '';
  context.instal_fontaneria_caseta_tipus = draft.instalFontaneriaCasetaTipus ?? '';
  context.instal_caseta_obra_llarg = Number(draft.instalCasetaObraLlarg ?? 0);
  context.instal_caseta_obra_ample = Number(draft.instalCasetaObraAmple ?? 0);
  context.instal_caseta_obra_alt = Number(draft.instalCasetaObraAlt ?? 0);
  context.instal_caseta_obra_portes = draft.instalCasetaObraPortes ?? '';
  context.instal_afm_enabled = !!draft.instalAfmEnabled;
  context.instal_wifi_enabled = !!draft.instalWifiEnabled;
  context.instal_prefiltre_enabled = !!draft.instalPrefiltreEnabled;
  context.instal_canvi_medi_enabled = !!draft.instalCanviMediArticleId;
  context.instal_filtre_especial_name = installations.find((i) => i.key === 'instal_filtre_especial')?.label ?? '';
  context.instal_filtre_polies_name = installations.find((i) => i.key === 'instal_filtre_polies')?.label ?? '';
  context.instal_bomba_onoff_name = installations.find((i) => i.key === 'instal_bomba_onoff')?.label ?? '';
  context.instal_bomba_variable_name = installations.find((i) => i.key === 'instal_bomba_variable')?.label ?? '';
  context.instal_dosificacio_std_name = installations.find((i) => i.key === 'instal_dosificacio_std')?.label ?? '';
  context.instal_hidrolisi_name = installations.find((i) => i.key === 'instal_hidrolisi')?.label ?? '';
  context.instal_quadre_name = installations.find((i) => i.key === 'instal_quadre')?.label ?? '';

  // Fontaneria + Elèctrica totals (already calculated in StepInstalacions)
  const fontaneriaBase = resolveArticle(index, draft.instalFontaneriaBaseArticleId);
  const electricaBase = resolveArticle(index, draft.instalElectricaBaseArticleId);
  context.instal_fontaneria_total = Number(draft.instalFontaneriaTotal ?? 0);
  context.instal_fontaneria_base_sale = fontaneriaBase.sale;
  context.instal_fontaneria_extra_cost = Number(draft.instalFontaneriaExtraCost ?? 0);
  context.instal_fontaneria_distancia = Number(draft.instalFontaneriaDistancia ?? 10);
  context.instal_electrica_total = Number(draft.instalElectricaTotal ?? 0);
  context.instal_electrica_base_sale = electricaBase.sale;
  context.instal_electrica_extra_cost = Number(draft.instalElectricaExtraCost ?? 0);

  // Accessory enabled flags (basic accessories use qty>0 as proxy)
  context.acc_focus_led_text = draft.accFocusLedText ?? '';
  context.acc_focus_led_variant = draft.accFocusLedVariant ?? '';

  // Annex cross-phase variables
  const robot = resolveArticle(index, draft.annexRobotArticleId);
  const bombaCalor = resolveArticle(index, draft.annexBombaCalorArticleId);
  const annexNetejafons = resolveArticle(index, draft.annexNetejafonsArticleId);
  context.annex_netejafons_estat = draft.annexNetejafonsEstat ?? '';
  // annex_netejafons_total stores the TOTAL NUMBER OF BOQUILLES (count),
  // not a price in cents. Expose it as a plain integer for formulas.
  const netejafonsBoquillesTotal = Number(draft.annexNetejafonsTotal ?? 0);
  context.annex_netejafons_total = netejafonsBoquillesTotal;
  context.annex_netejafons_boquilles_total = netejafonsBoquillesTotal;
  context.annex_netejafons_fons = Number(draft.annexNetejafonsFons ?? 0);
  context.annex_netejafons_escala = Number(draft.annexNetejafonsEscala ?? 0);
  context.annex_netejafons_plataforma = Number(draft.annexNetejafonsPlataforma ?? 0);
  context.annex_netejafons_extra_cost = Number(draft.annexNetejafonsExtraCost ?? 0);
  context.annex_netejafons_sale = annexNetejafons.sale;
  context.annex_netejafons_cost = annexNetejafons.cost;
  context.annex_cobertor_estat = draft.annexCobertorEstat ?? '';
  context.annex_cobertor_tipus = draft.annexCobertorTipus ?? '';
  context.annex_cobertor_lames = draft.annexCobertorLames ?? '';
  context.annex_cobertor_model_id = draft.annexCobertorModelId ?? '';
  context.annex_cobertor_color_id = draft.annexCobertorColorId ?? '';
  context.annex_cobertor_model_code = (draft as any).annexCobertorModelCode ?? (draft as any).annex_cobertor_model_code ?? '';
  context.annex_cobertor_mur_nou = !!((draft as any).annexCobertorMurNou ?? (draft as any).annex_cobertor_mur_nou);
  context.annex_cobertor_mur_m2 = Number((draft as any).annexCobertorMurM2 ?? (draft as any).annex_cobertor_mur_m2 ?? 0);
  // Pricing not implemented yet — surface zero so existing formulas keep working.
  context.annex_cobertor_qty = 0;
  context.annex_cobertor_sale = 0;
  context.annex_robot_estat = draft.annexRobotEstat ?? '';
  context.annex_robot_qty = Number(draft.annexRobotQty ?? 0);
  context.annex_robot_sale = robot.sale;
  context.annex_bomba_calor_estat = draft.annexBombaCalorEstat ?? '';
  context.annex_bomba_calor_sale = bombaCalor.sale;
  context.annex_bomba_calor_coberta = !!draft.annexBombaCalorCoberta;
  context.annex_excavacio_estat = draft.annexExcavacioEstat ?? '';
  context.annex_paviment_estat = draft.annexPavimentEstat ?? '';
  context.annex_paviment_material = draft.annexPavimentMaterial ?? '';
  // Paviment perimetral — full set of variables for formula engine
  context.annex_paviment_reforma_enabled = !!draft.annexPavimentReformaEnabled;
  context.annex_paviment_nou_enabled = !!draft.annexPavimentNouEnabled;
  context.annex_paviment_retirada_enabled = !!draft.annexPavimentRetiradaEnabled;
  context.annex_paviment_retirada_m2 = Number(draft.annexPavimentRetiradaM2 ?? 0);
  context.annex_paviment_regularitzacio_enabled = !!draft.annexPavimentRegularitzacioEnabled;
  context.annex_paviment_regularitzacio_m2 = Number(draft.annexPavimentRegularitzacioM2 ?? 0);
  context.annex_paviment_actuacio = draft.annexPavimentActuacio ?? '';
  context.annex_paviment_formigo_enabled = !!draft.annexPavimentFormigoEnabled;
  context.annex_paviment_formigo_m2 = Number(draft.annexPavimentFormigoM2 ?? 0);
  context.annex_paviment_format = draft.annexPavimentFormat ?? '';
  context.annex_paviment_m2 = Number(draft.annexPavimentM2 ?? 0);
  const pavimentModel = resolveArticle(index, draft.annexPavimentModelId);
  context.annex_paviment_model_sale = pavimentModel.sale;
  context.annex_paviment_model_cost = pavimentModel.cost;
  // Expose model id + "a determinar" flag so modelPrice('annex_paviment') can resolve
  // either the chosen article or the placeholder PAVIMENT_*_TBD reference.
  context.annex_paviment_model_id = draft.annexPavimentModelId ?? null;
  context.annex_paviment_model_a_determinar =
    draft.annexPavimentModelADeterminar ?? !draft.annexPavimentModelId;
  context.annex_gespa_estat = draft.annexGespaEstat ?? '';
  context.annex_projecte_estat = draft.annexProjecteEstat ?? '';

  return context;
}