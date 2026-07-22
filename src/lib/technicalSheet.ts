import { supabase } from '@/integrations/supabase/client';
import { loadBudgetAsDraft } from '@/lib/budgetMapper';
import { evaluateFormulaRules, type FormulaRule } from '@/lib/formulaEngine';
import { mergeFormulaResultsIntoPhases, filterAcabatsInclusion } from '@/lib/formulaPhases';
import { buildWizardLinesByPhase } from '@/lib/wizardLines';

/**
 * Generates a Technical Sheet (Fitxa Tècnica) PDF for an accepted budget.
 * Internal document for the site manager and warehouse: lists every
 * material/labor item per phase WITH the same calculation engine used by
 * the wizard (so Estructura/Acabats/Instal·lacions/Annex are always
 * complete, regardless of what got persisted in budget_items).
 *
 * Only sections that contain real data are rendered.
 */
export async function generateTechnicalSheet(budgetId: string): Promise<void> {
  // html2pdf.js was removed for security (vulnerable jspdf/dompurify
  // transitive deps). We render with html2canvas + jsPDF directly.

  // 1. Load budget as a wizard-style draft (camelCase) and recompute phases
  const { draft, raw } = await loadBudgetAsDraft(budgetId);
  const b: any = raw;

  // 2. Load formula rules + articles (to recompute calculated items)
  const [{ data: rulesRaw }, { data: articlesRaw }] = await Promise.all([
    supabase.from('formula_rules').select('*').eq('is_active', true).order('phase').order('order_index'),
    supabase.from('articles').select('*'),
  ]);
  const rules = (rulesRaw || []) as FormulaRule[];
  const articles = articlesRaw || [];

  // 3. Run the engine for the budget type and merge with persisted phases.
  // Note: budgets.type is 'obra_nueva' (Spanish), but formula_rules.budget_type
  // is 'obra_nova' (Catalan) — match both.
  let computedPhases = draft.phases || [];
  if ((draft.type === 'obra_nueva' || (draft.type as string) === 'obra_nova') && rules.length > 0) {
    const filteredRules = rules.filter(
      (r) => r.budget_type === 'obra_nova' || r.budget_type === 'obra_nueva'
    );
    try {
      const rawResults = evaluateFormulaRules(filteredRules, draft as any, articles as any);
      const results = filterAcabatsInclusion(rawResults, draft as any);
      const wizardLines = buildWizardLinesByPhase(draft as any, articles as any);
      computedPhases = mergeFormulaResultsIntoPhases(results, draft.phases || [], draft as any, wizardLines);
    } catch (err) {
      console.error('[TechnicalSheet] formula engine error', err);
    }
  }

  // Helper: filter out optional / informational items (we only want what is
  // truly included in the budget) and items with quantity <= 0.
  const isIncludedItem = (it: any): boolean => {
    if (!it) return false;
    if (Number(it.quantity ?? 0) <= 0) return false;
    const sp = String(it.subPhase || '').toLowerCase();
    if (sp.includes('opcional')) return false;
    return true;
  };

  // Same as isIncludedItem but ALSO accepts optional accessory rows.
  // Used for the global "Detall de partides per fase" table where the
  // user wants to see every line that ends up in the budget, including
  // optional accessories that have been activated by the user.
  const isIncludedOrOptionalItem = (it: any): boolean => {
    if (!it) return false;
    if (Number(it.quantity ?? 0) <= 0) return false;
    return true;
  };

  // Helper: build a description/quantity/unit table for a list of items
  const itemsTable = (items: any[]): string => {
    if (!items.length) return '';
    const rows = items.map((it) => `
      <tr>
        <td>${escapeHtml(it.description || '')}</td>
        <td class="qty">${Number(it.quantity ?? 0).toLocaleString('ca-ES', { maximumFractionDigits: 2 })}</td>
        <td>${escapeHtml(it.unit || 'ud')}</td>
      </tr>`).join('');
    return `<table class="data-table">
      <thead><tr><th style="width:70%">Descripció</th><th style="width:15%" class="qty">Quantitat</th><th style="width:15%">Unitat</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  };

  // Helper: get all included items of a phase (by name) optionally filtered by subPhase
  const phaseItems = (phaseName: string, subPhase?: string): any[] => {
    const phase = (computedPhases || []).find((p: any) =>
      String(p.name || '').toLowerCase() === phaseName.toLowerCase()
    );
    if (!phase) return [];
    return (phase.items || [])
      .filter(isIncludedItem)
      .filter((it: any) => !subPhase || String(it.subPhase || '').toLowerCase() === subPhase.toLowerCase())
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  };

  // Helper: group all included items of a phase by their subPhase (case-insensitive),
  // returning a map { displayLabel: items[] }. Items without subPhase are placed under "General".
  const groupPhaseItemsBySubPhase = (phaseName: string): Record<string, any[]> => {
    const phase = (computedPhases || []).find((p: any) =>
      String(p.name || '').toLowerCase() === phaseName.toLowerCase()
    );
    if (!phase) return {};
    const groups: Record<string, any[]> = {};
    for (const it of (phase.items || [])) {
      if (!isIncludedItem(it)) continue;
      const raw = String(it.subPhase || '').trim() || 'General';
      // Normalize known sub-phase keys so display capitalization is consistent
      const lower = raw.toLowerCase();
      const label =
        lower === 'vas' ? 'Vas' :
        lower === 'escala' ? 'Escala' :
        lower === 'coronament' ? 'Coronament' :
        lower === 'revestiment' ? 'Revestiment interior' :
        raw.charAt(0).toUpperCase() + raw.slice(1);
      if (!groups[label]) groups[label] = [];
      groups[label].push(it);
    }
    Object.keys(groups).forEach((k) =>
      groups[k].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    );
    return groups;
  };

  // 4. Resolve referenced article + cover names for the spec sections
  const articleIds = [
    b.instal_filtre_polies_id, b.instal_filtre_especial_id, b.instal_bomba_onoff_id, b.instal_bomba_variable_id,
    b.instal_hidrolisi_id, b.instal_dosificacio_std_id, b.instal_quadre_id, b.instal_wifi_article_id,
    b.instal_afm_article_id, b.instal_prefiltre_article_id, b.instal_fontaneria_base_article_id,
    b.instal_electrica_base_article_id, b.coronament_model_id, b.revestiment_model_id,
    b.acc_impulsors_model_id, b.acc_skimmers_model_id, b.acc_embornal_model_id, b.acc_focus_led_model_id,
    b.acc_regulador_model_id, b.acc_netejafons_model_id, b.acc_projector_mini_led_model_id,
    b.acc_control_rgb_model_id, b.acc_escala_model_id, b.acc_dutxa_model_id, b.acc_cascada_model_id,
    b.acc_salvavides_model_id, b.acc_barana_model_id, b.annex_projecte_article_id, b.annex_paviment_model_id,
    b.annex_gespa_article_id, b.annex_robot_article_id, b.annex_bomba_calor_article_id,
    b.annex_netejafons_article_id, b.revestiment_exterior_model_id,
  ].filter(Boolean) as string[];

  const articleNames: Record<string, string> = {};
  if (articleIds.length) {
    const { data: arts } = await supabase.from('articles').select('id, name').in('id', articleIds);
    (arts || []).forEach((a: any) => { articleNames[a.id] = a.name; });
  }
  const an = (id?: string | null) => (id && articleNames[id]) || null;

  let coverModel: string | null = null;
  let coverColor: string | null = null;
  if (b.annex_cobertor_model_id) {
    const { data } = await supabase.from('cover_models').select('name').eq('id', b.annex_cobertor_model_id).maybeSingle();
    coverModel = data?.name || null;
  }
  if (b.annex_cobertor_color_id) {
    const { data } = await supabase.from('cover_colors').select('name').eq('id', b.annex_cobertor_color_id).maybeSingle();
    coverColor = data?.name || null;
  }

  // 5. Pool stats
  const depthAvg = b.pool_depth_min && b.pool_depth_max
    ? ((Number(b.pool_depth_min) + Number(b.pool_depth_max)) / 2) : 0;
  const volumeM3 = b.pool_length && b.pool_width && depthAvg
    ? Math.round(Number(b.pool_length) * Number(b.pool_width) * depthAvg * 100) / 100 : 0;
  const surface = b.pool_length && b.pool_width && depthAvg
    ? Math.round((Number(b.pool_length) * Number(b.pool_width)
        + 2 * Number(b.pool_length) * depthAvg
        + 2 * Number(b.pool_width) * depthAvg) * 100) / 100 : 0;

  const typeLabels: Record<string, string> = {
    obra_nueva: 'Obra Nova', rehabilitacion: 'Rehabilitació', mantenimiento: 'Manteniment',
  };
  const statusLabels: Record<string, string> = {
    borrador: 'Esborrany', enviat: 'Enviat', acceptat: 'Acceptat', rebutjat: 'Rebutjat',
  };

  const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString('ca-ES') : '—';
  const num = (x: any, suffix = '') => (x === null || x === undefined || x === '' || Number(x) === 0)
    ? null : `${Number(x).toLocaleString('ca-ES', { maximumFractionDigits: 2 })}${suffix}`;

  // ── Helpers to build only non-empty rows ─────────────
  type Row = { lbl: string; val: string };
  const row = (lbl: string, val: any): Row | null => {
    if (val === null || val === undefined || val === '' || val === false) return null;
    return { lbl, val: String(val) };
  };
  const grid = (rows: (Row | null)[]) => {
    const r = rows.filter(Boolean) as Row[];
    if (r.length === 0) return '';
    return `<div class="grid">${r.map((it) => `
      <div class="grid-item"><span class="lbl">${escapeHtml(it.lbl)}</span><span class="val">${it.val}</span></div>
    `).join('')}</div>`;
  };
  const section = (title: string, body: string) => {
    if (!body || body.trim() === '') return '';
    return `<section class="section"><h2>${escapeHtml(title)}</h2>${body}</section>`;
  };
  const subsection = (title: string, body: string) => {
    if (!body || body.trim() === '') return '';
    return `<div class="subsection"><h3>${escapeHtml(title)}</h3>${body}</div>`;
  };

  // ── Build per-section content ────────────────────────
  const headerBody = grid([
    row('Pressupost', `<strong>${escapeHtml(b.number || '')}</strong>`),
    row('Data', fmtDate(b.budget_date)),
    row("Tipus d'obra", typeLabels[b.type] || b.type),
    { lbl: 'Estat', val: `<span class="badge">${escapeHtml(statusLabels[b.status] || b.status || '')}</span>` },
    row('Generat', new Date().toLocaleDateString('ca-ES')),
  ]);

  const clientBody = grid([
    row('Client', `<strong>${escapeHtml(b.client_name || '')}</strong>`),
    row('NIF/DNI', escapeHtml(b.client_nif)),
    row('Adreça obra', escapeHtml(b.client_address)),
    row('Municipi', escapeHtml(b.client_town)),
    row('Telèfon', escapeHtml(b.client_phone)),
    row('Email', escapeHtml(b.client_email)),
  ]);

  const poolBody = grid([
    row('Tipus piscina', escapeHtml(b.pool_type)),
    row('Forma', escapeHtml(b.pool_shape)),
    row('Llarg', num(b.pool_length, ' m')),
    row('Ample', num(b.pool_width, ' m')),
    row('Profunditat mín.', num(b.pool_depth_min, ' m')),
    row('Profunditat màx.', num(b.pool_depth_max, ' m')),
    row('Profunditat mitjana', depthAvg ? `${depthAvg.toFixed(2)} m` : null),
    row('Volum', num(volumeM3, ' m³')),
    row('Superfície interior', num(surface, ' m²')),
    row('Sistema construcció', escapeHtml(b.construction_system)),
    row('Impermeabilització', escapeHtml(b.waterproofing_system)),
    row('Distància gunite', num(b.gunite_distancia_km, ' km')),
  ]);

  const stairsBody = grid([
    b.has_exterior_stairs ? row('Escales exteriors', `Sí (${num(b.ext_stairs_length, ' m') || '—'} × ${num(b.ext_stairs_width, ' m') || '—'})`) : null,
    row('Escala interior', escapeHtml(b.interior_stairs_type)),
    b.stairs_length ? row('Mides escala', `${num(b.stairs_length, ' m')} × ${num(b.stairs_width, ' m')} × ${num(b.stairs_height, ' m')}`) : null,
    b.platform_length ? row('Plataforma', `${num(b.platform_length, ' m')} × ${num(b.platform_width, ' m')} × ${num(b.platform_height, ' m')}`) : null,
    b.bench_length ? row('Banc', `${num(b.bench_length, ' m')} × ${num(b.bench_width, ' m')} × ${num(b.bench_height, ' m')}`) : null,
  ]);

  // Disposició (enterrada / semi-enterrada / elevada) — mirrors
  // getEffectiveHeight() in formulaEngine.ts / computeEffectiveHeight() in
  // budgetSave.ts (keep the three in sync). Elevada: pool_depth_max − rebaix
  // (rounded to avoid floating-point artifacts, e.g. 1.4 − 0.10). Semi-enterrada:
  // manual "altura vista" input.
  const dispositionLabels: Record<string, string> = {
    enterrada: 'Enterrada', semi_enterrada: 'Semi enterrada', elevada: 'Elevada',
  };
  const disposition = String(b.pool_disposition || 'enterrada');
  const effectiveHeight = disposition === 'elevada'
    ? Math.round(Math.max(0, Number(b.pool_depth_max || 0) - (b.has_rebaix ? Number(b.rebaix_amount || 0) : 0)) * 100) / 100
    : disposition === 'semi_enterrada'
      ? Number(b.altura_vista || 0)
      : 0;

  const dispositionBody = grid([
    row('Disposició', dispositionLabels[disposition] || disposition),
    (disposition === 'elevada' || disposition === 'semi_enterrada')
      ? row('Altura vista (efectiva)', effectiveHeight > 0
          ? `${effectiveHeight.toFixed(2)} m${
              disposition === 'elevada' && b.has_rebaix
                ? ` (profunditat màx. ${num(b.pool_depth_max, ' m') || '—'} − rebaix ${num(b.rebaix_amount, ' m') || '—'})`
                : ''
            }`
          : null)
      : null,
    b.has_access_stair
      ? row("Escala d'accés exterior",
          `${num(b.access_stair_length, ' m') || '—'} × ${num(b.access_stair_width, ' m') || '—'} × ${num(b.access_stair_height, ' m') || '—'}` +
          (Number(b.access_platform_length) > 0
            ? ` + plataforma ${num(b.access_platform_length, ' m')} × ${num(b.access_platform_width, ' m')}`
            : ''))
      : null,
    b.revestiment_exterior_inclos
      ? row('Revestiment exterior',
          `Sí${b.revestiment_exterior_format ? ` — ${escapeHtml(b.revestiment_exterior_format)}` : ''}` +
          (b.revestiment_exterior_model_a_determinar
            ? ' (model a determinar)'
            : an(b.revestiment_exterior_model_id) ? ` — ${escapeHtml(an(b.revestiment_exterior_model_id))}` : '') +
          (b.revestiment_exterior_beurada
            ? ` · Beurada: ${escapeHtml(b.revestiment_exterior_beurada)}${b.revestiment_exterior_beurada_color ? ` (${escapeHtml(b.revestiment_exterior_beurada_color)})` : ''}`
            : ''))
      : null,
  ]);

  const coronamentBody = grid([
    row('Actuació', escapeHtml(b.coronament_actuacio)),
    row('Tipus', escapeHtml(b.coronament_tipus)),
    row('Format', escapeHtml(b.coronament_format)),
    row('Model', b.coronament_model_a_determinar ? '<em>A determinar</em>' : escapeHtml(an(b.coronament_model_id))),
    row('Metres lineals', num(b.coronament_ml, ' ml')),
    row('Encofrat', num(b.coronament_encofrat_ml, ' ml')),
    row('Peces', num(b.coronament_peces, ' u')),
    row('Beurada', b.coronament_beurada ? `${escapeHtml(b.coronament_beurada)}${b.coronament_beurada_color ? ` (${escapeHtml(b.coronament_beurada_color)})` : ''}` : null),
  ]);

  const revestimentBody = grid([
    row('Actuació', escapeHtml(b.revestiment_actuacio)),
    row('Tipus', escapeHtml(b.revestiment_tipus)),
    row('Format', escapeHtml(b.revestiment_format)),
    row('Qualitat', escapeHtml(b.revestiment_qualitat)),
    row('Model', b.revestiment_model_a_determinar ? '<em>A determinar</em>' : escapeHtml(an(b.revestiment_model_id))),
    row('Beurada', b.revestiment_beurada ? `${escapeHtml(b.revestiment_beurada)}${b.revestiment_beurada_color ? ` (${escapeHtml(b.revestiment_beurada_color)})` : ''}` : null),
    b.revestiment_peces_especials ? row('Peces especials', 'Sí') : null,
    b.revestiment_mig_canya ? row('Mig canya', 'Sí') : null,
  ]);

  const acabatsBody =
    subsection('Coronament', coronamentBody) +
    subsection('Revestiment interior', revestimentBody) +
    (b.coronament_observacions ? `<p class="note"><strong>Observacions coronament:</strong> ${escapeHtml(b.coronament_observacions)}</p>` : '');

  // Annex — render ONLY annexes truly included in the accepted budget.
  // AnnexEstat is "no" | "inclos" | "opcional" (see StepAnnex.tsx) — "opcional"
  // means offered to the client but explicitly NOT part of the budget, so it
  // must not appear here (unlike the old check, which treated anything != "no"
  // as active and rendered "opcional" annexes as if they were included).
  const isAnnexActive = (estat: any) => estat === 'inclos';
  const annexSubsections: string[] = [];

  if (isAnnexActive(b.annex_projecte_estat)) {
    annexSubsections.push(subsection('Projecte', grid([
      row('Estat', escapeHtml(b.annex_projecte_estat)),
      row('Article', escapeHtml(an(b.annex_projecte_article_id))),
      row('Quantitat', num(b.annex_projecte_qty)),
    ])));
  }
  if (isAnnexActive(b.annex_netejafons_estat)) {
    const totalBoq = Number(b.annex_netejafons_total ?? 0)
      || (Number(b.annex_netejafons_fons ?? 0) + Number(b.annex_netejafons_escala ?? 0) + Number(b.annex_netejafons_plataforma ?? 0));
    const basicsColor = (b.acc_basics_color === 'color') ? 'De color' : 'Blancs';
    annexSubsections.push(subsection('Sistema netejafons', grid([
      row('Estat', escapeHtml(b.annex_netejafons_estat)),
      row('Article', escapeHtml(an(b.annex_netejafons_article_id))),
      row('Color boquilles', basicsColor),
      row('Boquilles fons', num(b.annex_netejafons_fons)),
      row('Boquilles escala', num(b.annex_netejafons_escala)),
      row('Boquilles plataforma', num(b.annex_netejafons_plataforma)),
      totalBoq ? row('Total boquilles', `${totalBoq} u`) : null,
      Number(b.annex_netejafons_extra_cost) > 0 ? row('Cost extra (>11 boq.)', num(b.annex_netejafons_extra_cost, ' €')) : null,
    ])));
  }
  if (isAnnexActive(b.annex_excavacio_estat)) {
    annexSubsections.push(subsection('Excavació', grid([
      row('Estat', escapeHtml(b.annex_excavacio_estat)),
      row('Import', num(b.annex_excavacio_import, ' €')),
      row('Reompliment', num(b.annex_excavacio_reompliment, ' m³')),
    ])));
  }
  if (isAnnexActive(b.annex_paviment_estat)) {
    annexSubsections.push(subsection('Paviment', grid([
      row('Estat', escapeHtml(b.annex_paviment_estat)),
      row('Actuació', escapeHtml(b.annex_paviment_actuacio)),
      row('Material', escapeHtml(b.annex_paviment_material)),
      row('Format', escapeHtml(b.annex_paviment_format)),
      row('Superfície', num(b.annex_paviment_m2, ' m²')),
      (b.annex_paviment_model_id || b.annex_paviment_model_a_determinar)
        ? row('Model', b.annex_paviment_model_a_determinar ? '<em>A determinar</em>' : escapeHtml(an(b.annex_paviment_model_id)))
        : null,
    ])));
  }
  if (isAnnexActive(b.annex_gespa_estat)) {
    annexSubsections.push(subsection('Gespa', grid([
      row('Estat', escapeHtml(b.annex_gespa_estat)),
      row('Model', escapeHtml(b.annex_gespa_model)),
      row('Superfície', num(b.annex_gespa_m2, ' m²')),
      row('Article', escapeHtml(an(b.annex_gespa_article_id))),
    ])));
  }
  if (isAnnexActive(b.annex_robot_estat)) {
    annexSubsections.push(subsection('Robot', grid([
      row('Estat', escapeHtml(b.annex_robot_estat)),
      row('Article', escapeHtml(an(b.annex_robot_article_id))),
      row('Quantitat', num(b.annex_robot_qty)),
    ])));
  }
  if (isAnnexActive(b.annex_bomba_calor_estat)) {
    annexSubsections.push(subsection('Bomba de calor', grid([
      row('Estat', escapeHtml(b.annex_bomba_calor_estat)),
      row('Article', escapeHtml(an(b.annex_bomba_calor_article_id))),
      row('Coberta', b.annex_bomba_calor_coberta ? 'Sí' : null),
      row('Temporada', b.annex_bomba_calor_desde && b.annex_bomba_calor_fins_a ? `${b.annex_bomba_calor_desde} → ${b.annex_bomba_calor_fins_a}` : null),
      row('Temperatura', num(b.annex_bomba_calor_temperatura, ' ºC')),
      row('kW requerits', num(b.annex_bomba_calor_kw_required, ' kW')),
    ])));
  }
  if (isAnnexActive(b.annex_cobertor_estat)) {
    annexSubsections.push(subsection('Cobertor', grid([
      row('Estat', escapeHtml(b.annex_cobertor_estat)),
      row('Tipus', escapeHtml(b.annex_cobertor_tipus)),
      row('Model', coverModel ? `${escapeHtml(coverModel)}${b.annex_cobertor_model_code ? ` (${escapeHtml(b.annex_cobertor_model_code)})` : ''}` : null),
      row('Lames', escapeHtml(b.annex_cobertor_lames)),
      row('Color', escapeHtml(coverColor)),
      row('Mur nou', b.annex_cobertor_mur_nou ? `Sí${b.annex_cobertor_mur_m2 ? ` — ${num(b.annex_cobertor_mur_m2, ' m²')}` : ''}` : null),
    ])));
  }

  const annexBody = annexSubsections.join('') +
    (b.annex_notes ? `<p class="note"><strong>Notes annex:</strong> ${escapeHtml(b.annex_notes)}</p>` : '');

  // Accessoris bàsics — explicit color callout (blanc / de color)
  const basicsColorLabel = (b.acc_basics_color === 'color') ? 'De color' : 'Blancs';
  const accessoriesBody = grid([
    row('Color accessoris', `<strong>${escapeHtml(basicsColorLabel)}</strong>`),
    row('Impulsors', num(b.acc_impulsors_qty, ' u')),
    row('Skimmers', num(b.acc_skimmers_qty, ' u')),
    row('Embornal', num(b.acc_embornal_qty, ' u')),
    row('Focus LED', num(b.acc_focus_led_qty, ' u')),
    row('Regulador', num(b.acc_regulador_qty, ' u')),
    row('Presa netejafons', num(b.acc_netejafons_qty, ' u')),
    row('Projector mini LED', num(b.acc_projector_mini_led_qty, ' u')),
    row('Control RGB', num(b.acc_control_rgb_qty, ' u')),
  ]);

  // Accessoris opcionals — only the ones the user toggled ON
  const optionalAccRows = [
    b.acc_escala_enabled ? row('Escala inox', `${num(b.acc_escala_qty, ' u') || '1 u'}${an(b.acc_escala_model_id) ? ` — ${escapeHtml(an(b.acc_escala_model_id))}` : ''}`) : null,
    b.acc_dutxa_enabled ? row('Dutxa exterior', `${num(b.acc_dutxa_qty, ' u') || '1 u'}${an(b.acc_dutxa_model_id) ? ` — ${escapeHtml(an(b.acc_dutxa_model_id))}` : ''}`) : null,
    b.acc_plat_dutxa_enabled ? row('Plat de dutxa', num(b.acc_plat_dutxa_qty, ' u') || '1 u') : null,
    b.acc_cascada_enabled ? row('Cascada', `${num(b.acc_cascada_qty, ' u') || '1 u'}${an(b.acc_cascada_model_id) ? ` — ${escapeHtml(an(b.acc_cascada_model_id))}` : ''}`) : null,
    b.acc_salvavides_enabled ? row('Salvavides + suport', `${num(b.acc_salvavides_qty, ' u') || '1 u'}${an(b.acc_salvavides_model_id) ? ` — ${escapeHtml(an(b.acc_salvavides_model_id))}` : ''}`) : null,
    b.acc_barana_enabled ? row('Barana ancorada exterior', `${num(b.acc_barana_qty, ' u') || '1 u'}${an(b.acc_barana_model_id) ? ` — ${escapeHtml(an(b.acc_barana_model_id))}` : ''}`) : null,
  ];
  const optionalAccBody = optionalAccRows.some(Boolean)
    ? subsection('Accessoris opcionals', grid(optionalAccRows))
    : '';

  // ── Build sub-phase tables for Estructura and Acabats (group by ALL subPhases) ──
  const buildPhaseSubTables = (phaseName: string, preferredOrder: string[]): string => {
    const groups = groupPhaseItemsBySubPhase(phaseName);
    const keys = Object.keys(groups);
    if (keys.length === 0) return '';
    // Order: preferred first (in the given order), then any others alphabetically
    const ordered = [
      ...preferredOrder.filter((k) => keys.includes(k)),
      ...keys.filter((k) => !preferredOrder.includes(k)).sort(),
    ];
    return ordered.map((k) => subsection(`Partides – ${k}`, itemsTable(groups[k]))).join('');
  };
  const estructuraTablesBody = buildPhaseSubTables('estructura', ['Vas', 'Escala']);
  const acabatsTablesBody = buildPhaseSubTables('acabats', ['Coronament', 'Revestiment interior']);

  // Phases breakdown — only phases with included items, exclude estructura/acabats
  // (already shown above as sub-phase tables) and also drop optional rows.
  const phasesWithItems = (computedPhases || [])
    .filter((p: any) => {
      const n = String(p.name || '').toLowerCase();
      return n !== 'estructura' && n !== 'acabats';
    })
    .map((p: any) => ({ ...p, items: (p.items || []).filter(isIncludedOrOptionalItem) }))
    .filter((p: any) => p.items.length > 0);
  const phasesHtml = phasesWithItems.map((p: any) => {
    const items = (p.items || []).slice().sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    const rowsHtml = items.map((it: any) => {
      const sp = String(it.subPhase || '').toLowerCase();
      const isOpt = sp.includes('opcional');
      const tag = isOpt ? ' <span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:8pt;font-weight:700;padding:0.5mm 2mm;border-radius:3mm;margin-left:2mm;">OPCIONAL</span>' : '';
      return `<tr><td>${escapeHtml(it.description || '')}${tag}</td><td class="qty">${Number(it.quantity ?? 0).toLocaleString('ca-ES', { maximumFractionDigits: 2 })}</td><td>${escapeHtml(it.unit || 'ud')}</td></tr>`;
    }).join('');
    const tableHtml = items.length ? `<table class="data-table"><thead><tr><th style="width:70%">Descripció</th><th style="width:15%" class="qty">Quantitat</th><th style="width:15%">Unitat</th></tr></thead><tbody>${rowsHtml}</tbody></table>` : '';
    return `
      <div class="phase">
        <div class="phase-title">${escapeHtml(p.name)} <span class="phase-count">${items.length} partides</span></div>
        ${tableHtml}
      </div>`;
  }).join('');

  const styles = `
    .technical-sheet { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 10pt; line-height: 1.45; margin: 0; background: #ffffff; }
    .technical-sheet, .technical-sheet * { box-sizing: border-box; }
    .technical-sheet .page { padding: 0; }
    .technical-sheet h1 { font-size: 20pt; margin: 0 0 6mm 0; color: #0c2c4a; border-bottom: 3px solid #0c2c4a; padding-bottom: 3mm; font-weight: 700; letter-spacing: 0.5px; }
    .technical-sheet h2 { font-size: 12pt; margin: 0 0 3mm 0; color: #ffffff; background: #0c2c4a; padding: 2.5mm 4mm; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; border-radius: 1mm; }
    .technical-sheet h3 { font-size: 10.5pt; margin: 4mm 0 2mm 0; color: #0c2c4a; font-weight: 700; border-left: 3px solid #0c2c4a; padding: 1.5mm 0 1.5mm 3mm; line-height: 1.2; }
    .technical-sheet .section { margin-bottom: 6mm; page-break-inside: avoid; break-inside: avoid; }
    .technical-sheet .subsection { margin-bottom: 4mm; page-break-inside: avoid; break-inside: avoid; }
    .technical-sheet .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm 6mm; margin: 1mm 0; }
    .technical-sheet .grid-item { font-size: 9.5pt; padding: 1.2mm 0; border-bottom: 1px dotted #d8d8d8; display: flex; align-items: baseline; gap: 3mm; }
    .technical-sheet .grid-item .lbl { color: #555; font-weight: 600; min-width: 36mm; flex-shrink: 0; }
    .technical-sheet .grid-item .val { color: #1a1a1a; flex: 1; word-wrap: break-word; }
    .technical-sheet .badge { display: inline-flex; align-items: center; justify-content: center; background: #0c2c4a; color: #ffffff; padding: 0 5mm; border-radius: 10mm; font-size: 9pt; font-weight: 800; line-height: 1; letter-spacing: 0.4px; vertical-align: middle; height: 7mm; }
    .technical-sheet .data-table { width: 100%; border-collapse: collapse; margin: 2mm 0; font-size: 9pt; table-layout: fixed; }
    .technical-sheet .data-table th, .technical-sheet .data-table td { border: 1px solid #ccc; padding: 2mm 2.5mm; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: anywhere; }
    .technical-sheet .data-table th { background: #f0f4f8; font-weight: 700; color: #0c2c4a; }
    .technical-sheet .data-table tr { page-break-inside: avoid; break-inside: avoid; }
    .technical-sheet .qty { text-align: right; white-space: nowrap; }
    .technical-sheet .phase { page-break-inside: avoid; break-inside: avoid; margin-bottom: 5mm; }
    .technical-sheet .phase-title { background: #0c2c4a; color: #ffffff; padding: 2.5mm 4mm; font-weight: 700; font-size: 11pt; display: flex; justify-content: space-between; align-items: center; border-radius: 1mm 1mm 0 0; text-transform: uppercase; letter-spacing: 0.4px; }
    .technical-sheet .phase-count { font-weight: 400; font-size: 9pt; opacity: 0.9; }
    .technical-sheet .footer { margin-top: 8mm; padding-top: 3mm; border-top: 1px solid #ccc; font-size: 8pt; color: #666; text-align: center; page-break-inside: avoid; }
    .technical-sheet .note { font-size: 9pt; margin: 2mm 0; padding: 2mm 3mm; background: #f8f9fb; border-left: 2px solid #1a4870; }
    .technical-sheet .intro { font-size: 9pt; color: #666; margin: 0 0 3mm 0; font-style: italic; }
  `;

  const html = `
    <div class="technical-sheet">
    <style>${styles}</style>
    <div class="page">
      <h1>FITXA TÈCNICA D'OBRA</h1>
      ${headerBody}
      ${section('1. Dades del client i ubicació', clientBody)}
      ${section('2. Estructura i mides de la piscina', poolBody + (stairsBody ? subsection('Escales i plataformes', stairsBody) : '') + (dispositionBody ? subsection('Disposició de la piscina', dispositionBody) : '') + estructuraTablesBody)}
      ${section('3. Acabats', acabatsBody + acabatsTablesBody)}
      ${section('4. Accessoris bàsics', accessoriesBody + optionalAccBody)}
      ${section('5. Annex (treballs complementaris)', annexBody)}
      ${phasesHtml ? `<section class="section"><h2>6. Detall de partides per fase (instal·lacions, accessoris i annex)</h2><p class="intro">Llistat de tots els materials i mà d'obra inclosos al pressupost. Quantitats per a preparar a magatzem.</p>${phasesHtml}</section>` : ''}
      ${b.observations ? section('Observacions', `<p>${escapeHtml(b.observations)}</p>`) : ''}
      <div class="footer">
        Fitxa tècnica generada automàticament el ${new Date().toLocaleString('ca-ES')} — Pressupost ${escapeHtml(b.number || '')} — Document intern per a jefe d'obra i magatzem.
      </div>
    </div>
    </div>`;

  const el = document.createElement('div');
  // Match the printable area (A4 width 210mm minus 12mm L/R margins) so tables
  // don't overflow the right edge of the PDF.
  el.style.width = '186mm';
  el.style.background = '#ffffff';
  el.style.color = '#1a1a1a';
  el.style.boxSizing = 'border-box';
  el.innerHTML = html;

  const sanitized = [b.number, b.client_name, b.client_town]
    .filter(Boolean).join('-')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '') || 'fitxa-tecnica';

  const filename = `Fitxa-Tecnica-${sanitized}.pdf`;
  const { saveBlobWithPicker } = await import('@/lib/saveFile');
  await saveBlobWithPicker(async () => {
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    // Mount offscreen so html2canvas can measure layout.
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-10000px';
    host.style.top = '0';
    host.style.background = '#ffffff';
    host.appendChild(el);
    document.body.appendChild(host);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        windowWidth: 703,
        logging: false,
      });
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = 210;
      const pageH = 297;
      const marginL = 12, marginR = 12, marginT = 12, marginB = 14;
      const contentW = pageW - marginL - marginR;
      const contentH = pageH - marginT - marginB;
      const pxPerMm = canvas.width / contentW;
      const sliceHeightPx = Math.floor(contentH * pxPerMm);

      // The document is captured as a single continuous raster and then cut by
      // fixed pixel height — the CSS page-break-inside:avoid rules above have no
      // effect on that (they only matter for actual browser pagination). To stop
      // table rows/blocks from being sliced in half, measure the real DOM
      // boundaries of every row/subsection/phase/section that still fits within
      // one page's worth of height, map them into canvas-pixel space, and back
      // the cut point off to the nearest one whenever the natural cut would fall
      // inside it. Elements taller than a page (e.g. a table spanning several
      // pages) are excluded — they're still allowed to break between rows.
      const elRect = el.getBoundingClientRect();
      const domToCanvasScale = canvas.height / elRect.height;
      const noBreakBoundaries = Array
        .from(el.querySelectorAll('.section, .subsection, .phase, .footer, .data-table tr'))
        .map((node) => {
          const r = (node as HTMLElement).getBoundingClientRect();
          return {
            top: Math.round((r.top - elRect.top) * domToCanvasScale),
            bottom: Math.round((r.bottom - elRect.top) * domToCanvasScale),
          };
        })
        .filter((b) => b.bottom > b.top && (b.bottom - b.top) <= sliceHeightPx);

      let y = 0;
      let pageIndex = 0;
      while (y < canvas.height) {
        let sliceEnd = Math.min(y + sliceHeightPx, canvas.height);
        if (sliceEnd < canvas.height) {
          for (const b of noBreakBoundaries) {
            // The natural cut point falls strictly inside this element (and the
            // element started on the current page) — back off to its top edge
            // so the whole element moves to the next page instead of splitting.
            if (b.top > y && b.top < sliceEnd && sliceEnd < b.bottom) {
              sliceEnd = Math.min(sliceEnd, b.top);
            }
          }
        }
        const h = sliceEnd - y;
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = h;
        const ctx = pageCanvas.getContext('2d');
        if (!ctx) break;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        const img = pageCanvas.toDataURL('image/jpeg', 0.92);
        if (pageIndex > 0) pdf.addPage('a4', 'portrait');
        pdf.addImage(img, 'JPEG', marginL, marginT, contentW, h / pxPerMm);
        y += h;
        pageIndex++;
      }
      return pdf.output('blob') as Blob;
    } finally {
      document.body.removeChild(host);
    }
  }, filename);
}

function escapeHtml(s: any): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}