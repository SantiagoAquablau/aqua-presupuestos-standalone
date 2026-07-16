/**
 * AquaBlau PDF Template — 9-page budget document
 *
 * This module exposes a single function `buildPdfHtml(data)` that returns
 * the complete HTML/CSS for the PDF. It is used by:
 *   - src/lib/budgetSave.ts → generatePDF() (real budgets from the wizard)
 *   - src/pages/PdfPreview.tsx (admin live preview with sample data)
 *
 * Design language: AquaBlau corporate template
 *   - Primary navy:    #1F3D6B
 *   - Aqua accent:     #2DA9DB
 *   - Beige page bg:   #F4EDE0
 *   - Cream highlight: #FBF7EE
 *   - Dark text:       #1A1A2E
 *
 * Each page is a fixed A4 portrait (210mm × 297mm) section with
 * `page-break-after: always` so html2pdf.js renders one page per <section>.
 */

export interface PdfArticleRow {
  description: string;
  unit?: string;
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
  poolDepthAvg?: number;
  poolVolumeLiters?: number;
  poolSurfaceM2?: number;
  constructionSystem?: string;
  waterproofingSystem?: string;
  // Acabats
  coronamentTipus?: string;
  coronamentFormat?: string;
  coronamentMl?: number;
  coronamentBeurada?: string;
  coronamentBeuradaColor?: string;
  coronamentModelName?: string;
  coronamentModelADeterminar?: boolean;
  revestimentTipus?: string;
  revestimentFormat?: string;
  revestimentQualitat?: string;
  revestimentBeurada?: string;
  revestimentBeuradaColor?: string;
  revestimentModelName?: string;
  revestimentModelADeterminar?: boolean;
  revestimentImageUrl?: string;
  // Filtración / depuración
  filtreName?: string;
  filtreImageUrl?: string;
  bombaName?: string;
  bombaImageUrl?: string;
  hidrolisiName?: string;
  hidrolisiImageUrl?: string;
  dosificacioName?: string;
  dosificacioImageUrl?: string;
  quadreName?: string;
  // Fontaneria/electricitat
  fontaneriaText?: string;
  fontaneriaTotal?: number;
  electricaText?: string;
  electricaTotal?: number;
  // Annex (extras)
  annexCobertorName?: string;
  annexRobotName?: string;
  annexBombaCalorName?: string;
  annexPaviment?: string;
  annexGespa?: string;
  // Phases / financial summary
  phases: PdfPhase[];
  totalSale: number;
  paymentConditions?: string;
  observations?: string;
  // Company
  companyName?: string;
  companyAddress?: string;
  companyTown?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWeb?: string;
}

const fmtEUR = (n: number) =>
  new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(n);
const fmtNum = (n?: number, dec = 2) =>
  n === undefined || n === null ? '-' : Number(n).toLocaleString('ca-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtInt = (n?: number) =>
  n === undefined || n === null ? '-' : Math.round(n).toLocaleString('ca-ES');

const COLORS = {
  navy: '#1F3D6B',
  navyDark: '#15294A',
  aqua: '#2DA9DB',
  beige: '#F4EDE0',
  cream: '#FBF7EE',
  text: '#1A1A2E',
  muted: '#6B7280',
  line: '#D9CFB8',
};

/** Inline CSS reused across all pages. */
function baseCss(): string {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: ${COLORS.text}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .pdf-root { width: 210mm; }
    .page {
      width: 210mm; height: 297mm;
      position: relative; overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    .page:last-child { page-break-after: auto; }
    .page-cream { background: ${COLORS.beige}; }
    .page-padded { padding: 22mm 18mm; }
    h1, h2, h3, h4 { font-weight: 700; color: ${COLORS.navy}; line-height: 1.15; }
    p { line-height: 1.5; }

    /* Title bars */
    .section-title {
      font-size: 22pt; font-weight: 800; color: ${COLORS.navy};
      letter-spacing: -0.5px; margin-bottom: 4mm;
    }
    .section-sub { font-size: 10pt; color: ${COLORS.muted}; margin-bottom: 8mm; }

    /* Total badge (used on summary pages) */
    .total-badge {
      display: inline-block;
      background: ${COLORS.navy}; color: #fff;
      padding: 6mm 10mm; border-radius: 4mm;
      font-size: 16pt; font-weight: 700;
    }

    /* Recommendation / info card */
    .rec-card {
      background: ${COLORS.cream};
      border-left: 1.5mm solid ${COLORS.aqua};
      padding: 5mm 6mm; margin: 4mm 0;
      font-size: 9.5pt;
    }
    .rec-card .rec-title {
      font-weight: 700; color: ${COLORS.navy};
      font-size: 10pt; margin-bottom: 1.5mm;
    }

    /* Tables */
    table.pdf-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    table.pdf-table th {
      background: ${COLORS.navy}; color: #fff;
      padding: 2.5mm 3mm; text-align: left; font-weight: 600;
    }
    table.pdf-table th.right, table.pdf-table td.right { text-align: right; }
    table.pdf-table th.center, table.pdf-table td.center { text-align: center; }
    table.pdf-table td {
      padding: 2.2mm 3mm; border-bottom: 0.2mm solid ${COLORS.line};
      vertical-align: middle;
    }
    table.pdf-table tr.subtotal-row td {
      background: ${COLORS.cream}; font-weight: 700; color: ${COLORS.navy};
      border-bottom: 0.4mm solid ${COLORS.navy};
    }

    /* Two-column equipment row (image + description) */
    .equip-row {
      display: flex; gap: 5mm;
      align-items: center;
      padding: 4mm 0;
      border-bottom: 0.2mm solid ${COLORS.line};
    }
    .equip-row:last-child { border-bottom: none; }
    .equip-img {
      width: 28mm; height: 28mm;
      background: #fff; border: 0.2mm solid ${COLORS.line};
      border-radius: 2mm; display: flex; align-items: center; justify-content: center;
      overflow: hidden; flex-shrink: 0;
    }
    .equip-img img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .equip-info { flex: 1; }
    .equip-info .equip-cat { font-size: 8pt; color: ${COLORS.aqua}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .equip-info .equip-name { font-size: 11pt; font-weight: 700; color: ${COLORS.navy}; margin: 1mm 0; }
    .equip-info .equip-desc { font-size: 9pt; color: ${COLORS.text}; }

    /* Page header strip with logo */
    .page-header {
      display: flex; justify-content: space-between; align-items: center;
      padding-bottom: 4mm; border-bottom: 0.4mm solid ${COLORS.navy};
      margin-bottom: 8mm;
    }
    .page-header .logo { height: 14mm; }
    .page-header .ref { text-align: right; font-size: 9pt; color: ${COLORS.muted}; }
    .page-header .ref strong { color: ${COLORS.navy}; font-size: 11pt; }

    /* Footer */
    .page-footer {
      position: absolute; bottom: 10mm; left: 18mm; right: 18mm;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 8pt; color: ${COLORS.muted};
      border-top: 0.2mm solid ${COLORS.line}; padding-top: 3mm;
    }
    .page-footer .pg { font-weight: 700; color: ${COLORS.navy}; }

    /* Pool spec grid (page 2) */
    .spec-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm;
      margin: 6mm 0;
    }
    .spec-cell {
      background: #fff; border: 0.2mm solid ${COLORS.line};
      border-radius: 2mm; padding: 4mm; text-align: center;
    }
    .spec-cell .lbl { font-size: 8pt; color: ${COLORS.muted}; text-transform: uppercase; letter-spacing: 0.5px; }
    .spec-cell .val { font-size: 14pt; font-weight: 800; color: ${COLORS.navy}; margin-top: 1mm; }
    .spec-cell .val small { font-size: 9pt; font-weight: 500; color: ${COLORS.muted}; }

    /* Cover */
    .cover { background: ${COLORS.navy}; color: #fff; padding: 0; }
    .cover-inner { position: absolute; inset: 0; display: flex; flex-direction: column; }
    .cover-top {
      flex: 0 0 auto; padding: 18mm 18mm 0;
      display: flex; justify-content: space-between; align-items: flex-start;
    }
    .cover-top .logo-white { height: 22mm; }
    .cover-top .ref-block { text-align: right; font-size: 10pt; color: rgba(255,255,255,0.85); }
    .cover-top .ref-block strong { display: block; font-size: 18pt; color: #fff; font-weight: 700; }
    .cover-photo {
      flex: 1; margin: 12mm 18mm 0;
      background-size: cover; background-position: center;
      border-radius: 4mm; overflow: hidden;
      position: relative;
    }
    .cover-bottom {
      flex: 0 0 auto; padding: 10mm 18mm 14mm;
      display: flex; justify-content: space-between; align-items: flex-end;
    }
    .cover-bottom .title-block h1 {
      color: #fff; font-size: 32pt; font-weight: 800; letter-spacing: -1px; line-height: 1;
    }
    .cover-bottom .title-block p { color: ${COLORS.aqua}; font-size: 13pt; margin-top: 2mm; }
    .cover-bottom .client-block { text-align: right; color: rgba(255,255,255,0.9); font-size: 10pt; }
    .cover-bottom .client-block strong { color: #fff; display: block; font-size: 13pt; margin-bottom: 1mm; }

    /* Decorative photo block */
    .photo-band {
      width: 100%; height: 70mm;
      background-size: cover; background-position: center;
      border-radius: 3mm; margin: 4mm 0 6mm;
    }

    /* Two-column finishing layout */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
    .col-card {
      background: #fff; border: 0.2mm solid ${COLORS.line}; border-radius: 3mm;
      padding: 5mm; font-size: 9.5pt;
    }
    .col-card .col-title {
      font-size: 12pt; font-weight: 700; color: ${COLORS.navy};
      border-bottom: 0.4mm solid ${COLORS.aqua}; padding-bottom: 2mm; margin-bottom: 3mm;
    }
    .col-card dl { display: grid; grid-template-columns: 35mm 1fr; row-gap: 1.5mm; column-gap: 3mm; }
    .col-card dt { color: ${COLORS.muted}; font-weight: 600; }
    .col-card dd { color: ${COLORS.text}; font-weight: 500; }

    /* Summary page totals */
    .totals-box {
      background: ${COLORS.navy}; color: #fff;
      border-radius: 4mm; padding: 8mm; margin-top: 6mm;
    }
    .totals-box .row {
      display: flex; justify-content: space-between;
      font-size: 11pt; padding: 2mm 0;
    }
    .totals-box .row.grand {
      border-top: 0.4mm solid rgba(255,255,255,0.4); margin-top: 3mm; padding-top: 4mm;
      font-size: 18pt; font-weight: 800;
    }

    /* Helpers */
    .mt-2 { margin-top: 2mm; } .mt-4 { margin-top: 4mm; } .mt-6 { margin-top: 6mm; }
    .mb-2 { margin-bottom: 2mm; } .mb-4 { margin-bottom: 4mm; }
    .text-aqua { color: ${COLORS.aqua}; }
    .text-muted { color: ${COLORS.muted}; }
    .small { font-size: 8.5pt; }
    .uppercase { text-transform: uppercase; letter-spacing: 0.5px; }
  `;
}

function pageHeader(data: PdfData): string {
  return `
    <div class="page-header">
      <img src="/pdf/logo-color.png" class="logo" alt="AquaBlau" />
      <div class="ref">
        <strong>${data.budgetNumber || '-'}</strong>
        <div>${data.budgetDate || ''} · ${data.type}</div>
      </div>
    </div>
  `;
}

function pageFooter(num: number, total: number, data: PdfData): string {
  const company = data.companyName || 'Piscines AquaBlau';
  return `
    <div class="page-footer">
      <span>${company} · Pressupost ${data.budgetNumber || ''}</span>
      <span class="pg">${num} / ${total}</span>
    </div>
  `;
}

/** Page 1 — Cover */
function page1Cover(data: PdfData): string {
  return `
    <section class="page cover">
      <div class="cover-inner">
        <div class="cover-top">
          <img src="/pdf/logo-white.png" class="logo-white" alt="AquaBlau" />
          <div class="ref-block">
            <strong>${data.budgetNumber || '-'}</strong>
            <div>${data.budgetDate || ''}</div>
            <div>${data.type}</div>
          </div>
        </div>
        <div class="cover-photo" style="background-image:url('/pdf/cover.jpg');"></div>
        <div class="cover-bottom">
          <div class="title-block">
            <h1>Pressupost</h1>
            <p>${data.type}</p>
          </div>
          <div class="client-block">
            <strong>${data.clientName || '-'}</strong>
            ${data.clientTown ? `<div>${data.clientTown}</div>` : ''}
            ${data.clientEmail ? `<div>${data.clientEmail}</div>` : ''}
          </div>
        </div>
      </div>
    </section>
  `;
}

/** Page 2 — Project introduction & pool data */
function page2Intro(data: PdfData, pageNum: number, total: number): string {
  return `
    <section class="page page-cream page-padded">
      ${pageHeader(data)}
      <h2 class="section-title">El vostre projecte</h2>
      <p class="section-sub">Resum de l'obra i característiques principals de la piscina.</p>

      <div class="photo-band" style="background-image:url('/pdf/page2-pool.png');"></div>

      <div class="rec-card">
        <div class="rec-title">Sobre Piscines AquaBlau</div>
        Construïm i reformem piscines amb la màxima qualitat de materials i acabats, garantint
        durabilitat, estètica i un manteniment senzill. Aquest pressupost detalla totes les fases
        i materials de la vostra piscina.
      </div>

      <h3 style="font-size:13pt; margin-top:6mm; margin-bottom:3mm;">Característiques de la piscina</h3>
      <div class="spec-grid">
        <div class="spec-cell"><div class="lbl">Llarg</div><div class="val">${fmtNum(data.poolLength)} <small>m</small></div></div>
        <div class="spec-cell"><div class="lbl">Ample</div><div class="val">${fmtNum(data.poolWidth)} <small>m</small></div></div>
        <div class="spec-cell"><div class="lbl">Profunditat</div><div class="val">${fmtNum(data.poolDepthMin, 1)}–${fmtNum(data.poolDepthMax, 1)} <small>m</small></div></div>
        <div class="spec-cell"><div class="lbl">Capacitat</div><div class="val">${fmtInt(data.poolVolumeLiters)} <small>L</small></div></div>
        <div class="spec-cell"><div class="lbl">Superfície</div><div class="val">${fmtNum(data.poolSurfaceM2)} <small>m²</small></div></div>
        <div class="spec-cell"><div class="lbl">Sistema</div><div class="val" style="font-size:11pt;">${data.constructionSystem || '-'}</div></div>
        <div class="spec-cell"><div class="lbl">Impermeab.</div><div class="val" style="font-size:11pt;">${data.waterproofingSystem || '-'}</div></div>
        <div class="spec-cell"><div class="lbl">Tipus</div><div class="val" style="font-size:11pt;">${data.type}</div></div>
      </div>

      ${pageFooter(pageNum, total, data)}
    </section>
  `;
}

/** Page 3 — Estructura (construction) */
function page3Structure(data: PdfData, pageNum: number, total: number): string {
  const structurePhase = data.phases.find((p) => /estructura|obra|construcc/i.test(p.name));
  const items = structurePhase?.items || [];
  const subtotal = structurePhase?.subtotal || 0;

  return `
    <section class="page page-cream page-padded">
      ${pageHeader(data)}
      <h2 class="section-title">Estructura i obra</h2>
      <p class="section-sub">Excavació, gunite o bloc, impermeabilització i estructura del got.</p>

      <div class="photo-band" style="background-image:url('/pdf/page3-pool.png');"></div>

      <table class="pdf-table">
        <thead>
          <tr>
            <th>Descripció</th>
            <th class="center" style="width:18mm;">Ut.</th>
            <th class="right" style="width:18mm;">Qty</th>
            <th class="right" style="width:25mm;">Preu</th>
            <th class="right" style="width:28mm;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it) => `
            <tr>
              <td>${escapeHtml(it.description)}</td>
              <td class="center">${it.unit || 'ud'}</td>
              <td class="right">${fmtNum(it.quantity, 2)}</td>
              <td class="right">${fmtEUR(it.unitSale || 0)}</td>
              <td class="right">${fmtEUR(it.total || 0)}</td>
            </tr>`).join('')}
          <tr class="subtotal-row">
            <td colspan="4" class="right">Subtotal estructura</td>
            <td class="right">${fmtEUR(subtotal)}</td>
          </tr>
        </tbody>
      </table>

      ${pageFooter(pageNum, total, data)}
    </section>
  `;
}

/** Page 4 — Acabats (with worker background image) */
function page4Finishing(data: PdfData, pageNum: number, total: number): string {
  const finPhase = data.phases.find((p) => /acabats|revest|coronament/i.test(p.name));
  const subtotal = finPhase?.subtotal || 0;
  return `
    <section class="page page-cream page-padded" style="position:relative;">
      <div style="position:absolute; inset:0; background:url('/pdf/page4-bg.png') center/cover; opacity:0.18;"></div>
      <div style="position:relative; z-index:1;">
        ${pageHeader(data)}
        <h2 class="section-title">Acabats</h2>
        <p class="section-sub">Revestiment interior i coronament perimetral de la piscina.</p>

        <div class="two-col mt-4">
          <div class="col-card">
            <div class="col-title">Coronament</div>
            <dl>
              <dt>Tipus</dt><dd>${data.coronamentTipus || '-'}</dd>
              <dt>Format</dt><dd>${data.coronamentFormat || '-'}</dd>
              <dt>Model</dt><dd>${data.coronamentModelADeterminar ? 'A determinar' : (data.coronamentModelName || '-')}</dd>
              <dt>Metres lineals</dt><dd>${fmtNum(data.coronamentMl)} ml</dd>
              <dt>Beurada</dt><dd>${data.coronamentBeurada || '-'}${data.coronamentBeuradaColor ? ` · ${data.coronamentBeuradaColor}` : ''}</dd>
            </dl>
          </div>
          <div class="col-card">
            <div class="col-title">Revestiment</div>
            ${data.revestimentImageUrl ? `<div style="text-align:center; margin-bottom:3mm;"><img src="${data.revestimentImageUrl}" style="max-height:30mm; border-radius:2mm;" /></div>` : ''}
            <dl>
              <dt>Tipus</dt><dd>${data.revestimentTipus || '-'}</dd>
              <dt>Format</dt><dd>${data.revestimentFormat || '-'}</dd>
              <dt>Qualitat</dt><dd>${data.revestimentQualitat || '-'}</dd>
              <dt>Model</dt><dd>${data.revestimentModelADeterminar ? 'A determinar' : (data.revestimentModelName || '-')}</dd>
              <dt>Beurada</dt><dd>${data.revestimentBeurada || '-'}${data.revestimentBeuradaColor ? ` · ${data.revestimentBeuradaColor}` : ''}</dd>
            </dl>
          </div>
        </div>

        <div class="rec-card mt-6">
          <div class="rec-title">Recomanació tècnica</div>
          Tots els materials d'acabat s'instal·len amb adhesius i beurades específiques per a piscines,
          garantint estanqueïtat i durabilitat davant el clor i la radiació UV.
        </div>

        <div style="margin-top:8mm; text-align:right;">
          <span class="total-badge">Subtotal acabats: ${fmtEUR(subtotal)}</span>
        </div>
      </div>
      ${pageFooter(pageNum, total, data)}
    </section>
  `;
}

/** Page 5 — Filtración / Depuración (no decorative photo) */
function page5Filtration(data: PdfData, pageNum: number, total: number): string {
  const equipment: Array<{ cat: string; name?: string; img?: string; desc: string }> = [
    { cat: 'Filtre', name: data.filtreName, img: data.filtreImageUrl, desc: 'Filtració principal de l\'aigua de la piscina.' },
    { cat: 'Bomba', name: data.bombaName, img: data.bombaImageUrl, desc: 'Recirculació de l\'aigua a través del filtre i sistema de tractament.' },
    { cat: 'Hidròlisi', name: data.hidrolisiName, img: data.hidrolisiImageUrl, desc: 'Sistema de desinfecció per electròlisi salina, redueix l\'ús de químics.' },
    { cat: 'Dosificació', name: data.dosificacioName, img: data.dosificacioImageUrl, desc: 'Control automàtic del pH i del nivell de clor.' },
  ].filter((e) => e.name);

  return `
    <section class="page page-cream page-padded">
      ${pageHeader(data)}
      <h2 class="section-title">Sistema de filtració i tractament</h2>
      <p class="section-sub">Equipament principal del cicle de depuració de l'aigua.</p>

      <div class="mt-4">
        ${equipment.map((e) => `
          <div class="equip-row">
            <div class="equip-img">${e.img ? `<img src="${e.img}" />` : '<span style="font-size:8pt; color:#999;">Sense imatge</span>'}</div>
            <div class="equip-info">
              <div class="equip-cat">${e.cat}</div>
              <div class="equip-name">${escapeHtml(e.name || '')}</div>
              <div class="equip-desc">${e.desc}</div>
            </div>
          </div>
        `).join('')}
        ${equipment.length === 0 ? '<p class="text-muted small">Sense equipament seleccionat.</p>' : ''}
      </div>

      ${data.quadreName ? `
        <div class="rec-card mt-6">
          <div class="rec-title">Quadre elèctric</div>
          ${escapeHtml(data.quadreName)}
        </div>` : ''}

      ${pageFooter(pageNum, total, data)}
    </section>
  `;
}

/** Page 6 — Sala de màquines (with photo) */
function page6Machinery(data: PdfData, pageNum: number, total: number): string {
  const instalPhase = data.phases.find((p) => /instal|equipament|filtraci|electric/i.test(p.name));
  const subtotal = instalPhase?.subtotal || 0;
  return `
    <section class="page page-cream page-padded">
      ${pageHeader(data)}
      <h2 class="section-title">Sala de màquines</h2>
      <p class="section-sub">Ubicació i agrupament de tot l'equipament tècnic de la piscina.</p>

      <div class="photo-band" style="background-image:url('/pdf/page6-machinery.png');"></div>

      <div class="rec-card">
        <div class="rec-title">Disseny de la sala</div>
        Tot l'equipament queda integrat en una sala de màquines accessible, ventilada i protegida,
        per facilitar el manteniment i allargar la vida útil dels equips.
      </div>

      <div style="margin-top:6mm; text-align:right;">
        <span class="total-badge">Subtotal instal·lacions: ${fmtEUR(subtotal)}</span>
      </div>

      ${pageFooter(pageNum, total, data)}
    </section>
  `;
}

/** Page 7 — Electricidad y fontanería */
function page7Electricity(data: PdfData, pageNum: number, total: number): string {
  return `
    <section class="page page-cream page-padded">
      ${pageHeader(data)}
      <h2 class="section-title">Electricitat i fontaneria</h2>
      <p class="section-sub">Connexió elèctrica i hidràulica entre la piscina i la sala de màquines.</p>

      <div class="photo-band" style="background-image:url('/pdf/page7-electricity.png');"></div>

      <div class="two-col mt-4">
        <div class="col-card">
          <div class="col-title">Fontaneria</div>
          <p class="small">${data.fontaneriaText || 'Distribució d\'aigua entre el got i la sala de màquines, amb els metres i ràcords corresponents.'}</p>
          ${data.fontaneriaTotal ? `<p class="mt-2" style="text-align:right; font-weight:700; color:${COLORS.navy};">${fmtEUR(data.fontaneriaTotal)}</p>` : ''}
        </div>
        <div class="col-card">
          <div class="col-title">Electricitat</div>
          <p class="small">${data.electricaText || 'Cablejat des del quadre fins a la sala de màquines i fins als focus de la piscina.'}</p>
          ${data.electricaTotal ? `<p class="mt-2" style="text-align:right; font-weight:700; color:${COLORS.navy};">${fmtEUR(data.electricaTotal)}</p>` : ''}
        </div>
      </div>

      ${pageFooter(pageNum, total, data)}
    </section>
  `;
}

/** Page 8 — Annex / extras */
function page8Annex(data: PdfData, pageNum: number, total: number): string {
  const items: Array<{ label: string; value: string }> = [];
  if (data.annexCobertorName) items.push({ label: 'Cobertor', value: data.annexCobertorName });
  if (data.annexRobotName) items.push({ label: 'Robot netejafons', value: data.annexRobotName });
  if (data.annexBombaCalorName) items.push({ label: 'Bomba de calor', value: data.annexBombaCalorName });
  if (data.annexPaviment) items.push({ label: 'Paviment perimetral', value: data.annexPaviment });
  if (data.annexGespa) items.push({ label: 'Gespa', value: data.annexGespa });

  return `
    <section class="page page-cream page-padded">
      ${pageHeader(data)}
      <h2 class="section-title">Annex i extres</h2>
      <p class="section-sub">Elements opcionals i complements seleccionats.</p>

      ${items.length === 0 ? `
        <div class="rec-card">
          <div class="rec-title">Sense extres</div>
          No s'ha seleccionat cap extra opcional en aquest pressupost.
        </div>
      ` : `
        <table class="pdf-table mt-4">
          <thead><tr><th>Concepte</th><th>Detall</th></tr></thead>
          <tbody>
            ${items.map((i) => `<tr><td><strong>${i.label}</strong></td><td>${escapeHtml(i.value)}</td></tr>`).join('')}
          </tbody>
        </table>
      `}

      <div class="rec-card mt-6">
        <div class="rec-title">Recomanació</div>
        Els extres es poden incorporar a posteriori, però el seu cost d'instal·lació pot variar
        si es realitzen un cop l'obra principal estigui acabada.
      </div>

      ${pageFooter(pageNum, total, data)}
    </section>
  `;
}

/** Page 9 — Resum financer */
function page9Summary(data: PdfData, pageNum: number, total: number): string {
  return `
    <section class="page page-cream page-padded">
      ${pageHeader(data)}
      <h2 class="section-title">Resum del pressupost</h2>
      <p class="section-sub">Desglossament per fases i import total.</p>

      <table class="pdf-table mt-4">
        <thead>
          <tr>
            <th>Fase</th>
            <th class="right" style="width:40mm;">Import</th>
          </tr>
        </thead>
        <tbody>
          ${data.phases.map((ph) => `
            <tr>
              <td><strong>${escapeHtml(ph.name)}</strong></td>
              <td class="right">${fmtEUR(ph.subtotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals-box">
        <div class="row grand">
          <span>TOTAL</span>
          <span>${fmtEUR(data.totalSale)}</span>
        </div>
        <div class="small" style="opacity:0.8; margin-top:2mm;">IVA inclòs</div>
      </div>

      ${data.paymentConditions ? `
        <div class="rec-card mt-6">
          <div class="rec-title">Condicions de pagament</div>
          ${escapeHtml(data.paymentConditions)}
        </div>` : ''}

      ${data.observations ? `
        <div class="rec-card mt-4">
          <div class="rec-title">Observacions</div>
          ${escapeHtml(data.observations)}
        </div>` : ''}

      <div style="margin-top:10mm; text-align:center; font-size:9pt; color:${COLORS.muted};">
        <p style="font-weight:700; color:${COLORS.navy};">${data.companyName || 'Piscines AquaBlau'}</p>
        ${data.companyAddress ? `<p>${data.companyAddress}${data.companyTown ? ` · ${data.companyTown}` : ''}</p>` : ''}
        ${data.companyPhone || data.companyEmail ? `<p>${[data.companyPhone, data.companyEmail].filter(Boolean).join(' · ')}</p>` : ''}
        <p class="mt-2 small">Pressupost vàlid durant 30 dies des de la data d'emissió.</p>
      </div>

      ${pageFooter(pageNum, total, data)}
    </section>
  `;
}

function escapeHtml(s: string | undefined | null): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Build the full HTML document for the PDF. */
export function buildPdfHtml(data: PdfData): string {
  const TOTAL_PAGES = 9;
  return `
    <style>${baseCss()}</style>
    <div class="pdf-root">
      ${page1Cover(data)}
      ${page2Intro(data, 2, TOTAL_PAGES)}
      ${page3Structure(data, 3, TOTAL_PAGES)}
      ${page4Finishing(data, 4, TOTAL_PAGES)}
      ${page5Filtration(data, 5, TOTAL_PAGES)}
      ${page6Machinery(data, 6, TOTAL_PAGES)}
      ${page7Electricity(data, 7, TOTAL_PAGES)}
      ${page8Annex(data, 8, TOTAL_PAGES)}
      ${page9Summary(data, 9, TOTAL_PAGES)}
    </div>
  `;
}

/** Build sample PDF data for the admin preview. */
export function buildSamplePdfData(): PdfData {
  return {
    budgetNumber: 'PRE-2026-001',
    budgetDate: new Date().toLocaleDateString('ca-ES'),
    type: 'Obra Nova',
    clientName: 'Família Garcia Martínez',
    clientNif: '12345678A',
    clientAddress: 'Carrer Major 12',
    clientTown: 'Sant Cugat del Vallès',
    clientPhone: '600 123 456',
    clientEmail: 'familia.garcia@example.com',
    poolLength: 8,
    poolWidth: 4,
    poolDepthMin: 1.2,
    poolDepthMax: 2.0,
    poolDepthAvg: 1.6,
    poolVolumeLiters: 51200,
    poolSurfaceM2: 70.4,
    constructionSystem: 'Gunite',
    waterproofingSystem: 'Impertot',
    coronamentTipus: 'Pedra natural',
    coronamentFormat: '30×60 cm',
    coronamentMl: 24,
    coronamentBeurada: 'Epoxi',
    coronamentBeuradaColor: 'Gris perla',
    coronamentModelADeterminar: false,
    coronamentModelName: 'Travertí Crema',
    revestimentTipus: 'Porcelànic',
    revestimentFormat: '25×50 cm',
    revestimentQualitat: 'Premium',
    revestimentBeurada: 'Epoxi',
    revestimentBeuradaColor: 'Blanc',
    revestimentModelADeterminar: false,
    revestimentModelName: 'Aquacolor Sand',
    filtreName: 'Filtre Polièster Astralpool 600',
    bombaName: 'Bomba Variable Astralpool 1.5HP',
    hidrolisiName: 'Hidròlisi salina BSV 30g/h',
    dosificacioName: 'Dosificadora pH automàtica',
    quadreName: 'Quadre elèctric estàndard amb temporitzador i protecció',
    fontaneriaText: 'Fontaneria estàndard 10m fins a sala de màquines, inclou tubs, ràcords i vàlvules.',
    fontaneriaTotal: 1850,
    electricaText: 'Cablejat 10m des del quadre, focus LED i preses de servei.',
    electricaTotal: 1450,
    annexCobertorName: 'Cobertor d\'hivern reforçat',
    annexRobotName: 'Robot Dolphin E25',
    annexPaviment: 'Porcelànic exterior 60×60 cm — 40 m²',
    phases: [
      { name: 'Estructura i obra', subtotal: 18500, items: [
        { description: 'Excavació i moviment de terres', unit: 'm³', quantity: 64, unitSale: 45, total: 2880 },
        { description: 'Bloc encofrat / gunite armat', unit: 'm²', quantity: 70, unitSale: 180, total: 12600 },
        { description: 'Impermeabilització Impertot', unit: 'm²', quantity: 70, unitSale: 43, total: 3020 },
      ]},
      { name: 'Acabats', subtotal: 9800, items: [] },
      { name: 'Instal·lacions i equipament', subtotal: 7600, items: [] },
      { name: 'Annex i extres', subtotal: 3200, items: [] },
    ],
    totalSale: 39100,
    paymentConditions: '50% a la signatura del contracte, 30% a meitat d\'obra, 20% a la finalització.',
    observations: 'Pressupost subjecte a inspecció prèvia del terreny. Inclou neteja final d\'obra.',
    companyName: 'Piscines AquaBlau',
    companyAddress: 'Polígon Industrial Mas Roger, nau 4',
    companyTown: 'Pineda de Mar',
    companyPhone: '93 123 45 67',
    companyEmail: 'info@piscinesaquablau.com',
    companyWeb: 'www.piscinesaquablau.com',
  };
}