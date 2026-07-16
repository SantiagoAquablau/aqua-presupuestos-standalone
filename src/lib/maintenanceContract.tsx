/**
 * Generates the "Contracte de Manteniment" PDF for maintenance budgets when
 * they transition to `acceptat`. Layout mirrors the Word template supplied
 * by AquaBlau, with three A4 pages:
 *   1. Cover — contract intro, totals, visit periods, first signature block.
 *   2. Terms — service description, notes, payment clauses.
 *   3. Dates + Data Protection + final signature block.
 *
 * Renders through the same html2canvas + jsPDF pipeline used by the budget
 * PDF so fonts and image loading behave consistently.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { supabase } from "@/integrations/supabase/client";
import { loadBudgetAsDraft } from "@/lib/budgetMapper";
import { buildVisitPeriodsText } from "@/lib/maintenanceVisits";
import { formatEuro, pdfPageStyle } from "@/components/pdf/pdfStyles";
import contractBgAsset from "@/assets/contract-bg.jpg.asset.json";
import signatureAsset from "@/assets/aquablau-signature.png.asset.json";

const IVA_PCT = 0.21;
const CALIBRI = 'Calibri, "Helvetica Neue", Helvetica, Arial, sans-serif';

/* ──────────────────────────────────────────────────────────────
 * Catalan number-to-words (for currency in the contract cover).
 * Handles integers 0..999_999_999 and formats an euro amount as
 *   "DOS MIL DOS-CENTS VUITANTA SIS EUROS AMB SET CÈNTIMS"
 * ────────────────────────────────────────────────────────────── */
const CA_UNITS = [
  "zero","un","dos","tres","quatre","cinc","sis","set","vuit","nou",
  "deu","onze","dotze","tretze","catorze","quinze","setze",
  "disset","divuit","dinou",
];
const CA_TENS: Record<number, string> = {
  2: "vint", 3: "trenta", 4: "quaranta", 5: "cinquanta",
  6: "seixanta", 7: "setanta", 8: "vuitanta", 9: "noranta",
};
const CA_HUNDREDS = [
  "", "cent", "dos-cents", "tres-cents", "quatre-cents", "cinc-cents",
  "sis-cents", "set-cents", "vuit-cents", "nou-cents",
];

function caUnder100(n: number): string {
  if (n < 20) return CA_UNITS[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (u === 0) return CA_TENS[t];
  if (t === 2) return `vint-i-${CA_UNITS[u]}`;
  return `${CA_TENS[t]}-${CA_UNITS[u]}`;
}

function caUnder1000(n: number): string {
  if (n < 100) return caUnder100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  const head = h === 1 ? (r === 0 ? "cent" : "cent") : CA_HUNDREDS[h];
  if (r === 0) return head;
  return `${head} ${caUnder100(r)}`;
}

function caIntToWords(n: number): string {
  if (n === 0) return "zero";
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  if (millions > 0) {
    parts.push(millions === 1 ? "un milió" : `${caUnder1000(millions)} milions`);
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? "mil" : `${caUnder1000(thousands)} mil`);
  }
  if (rest > 0) parts.push(caUnder1000(rest));
  return parts.join(" ");
}

/** Format an euro amount (e.g. 2286.07) as capitalised Catalan words:
 *  "DOS MIL DOS-CENTS VUITANTA SIS EUROS AMB SET CÈNTIMS". */
function euroToCatalanWords(amount: number): string {
  const rounded = Math.round(amount * 100);
  const euros = Math.floor(rounded / 100);
  const cents = rounded % 100;
  const eurosText = `${caIntToWords(euros)} ${euros === 1 ? "euro" : "euros"}`;
  const centsText =
    cents > 0
      ? ` amb ${caIntToWords(cents)} ${cents === 1 ? "cèntim" : "cèntims"}`
      : "";
  return (eurosText + centsText).toUpperCase();
}

export interface ContractPdfInput {
  budgetId: string;
  /** Data del contracte — ISO date; defaults to today. */
  contractDate?: string;
  /** Data d'inici del servei — ISO date; required. */
  serviceStartDate: string;
  contractantName: string;
  contractantNif: string;
  contractantAddress: string;
  contractantTown: string;
  /** Municipi de l'obra (ubicació de la piscina). */
  obraTown: string;
  /** Adreça / detall dins del municipi. */
  obraLocation: string;
}

function fmtDate(iso?: string): string {
  if (!iso) return new Date().toLocaleDateString("ca-ES");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ca-ES");
}

function Page({ children, showHeader = false }: { children: React.ReactNode; showHeader?: boolean }) {
  return (
    <section
      style={{
        ...pdfPageStyle,
        backgroundColor: "#ffffff",
        color: "#1a1a1a",
        fontFamily: CALIBRI,
        fontSize: "16px",
        lineHeight: 1.55,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundImage: `url(${contractBgAsset.url})`,
          backgroundSize: "210mm 297mm",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "top left",
          opacity: 0.5,
          zIndex: 0,
        }}
      />
      <div style={{ position: "relative", zIndex: 1, padding: "42mm 20mm 38mm 20mm" }}>
        {showHeader && <Header />}
        {children}
      </div>
    </section>
  );
}

function Header() {
  return (
    <div style={{ marginTop: "2mm", marginBottom: "8mm" }}>
      <h1
        style={{
          fontFamily: CALIBRI,
          fontSize: "16pt",
          color: "#000000",
          margin: 0,
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        CONTRACTE DE MANTENIMENT
      </h1>
    </div>
  );
}

function SignatureBlock({ contractantName }: { contractantName: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8mm", gap: "10mm" }}>
      <div style={{ flex: 1, textAlign: "center" }}>
        <div style={{ borderTop: "1px solid #1a1a1a", marginTop: "22mm", paddingTop: 4, fontWeight: 700 }}>
          {contractantName || "—"}
        </div>
      </div>
      <div style={{ flex: 1, textAlign: "center" }}>
        <div
          style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", height: "22mm", marginBottom: 0 }}
        >
          <img
            src={signatureAsset.url}
            alt="Signatura AquaBlau"
            crossOrigin="anonymous"
            style={{ height: "22mm", width: "auto", objectFit: "contain" }}
          />
        </div>
        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: 4, fontWeight: 700 }}>AQUABLAU SOLUCIONS S.L</div>
      </div>
    </div>
  );
}

function ContractDocument({
  input,
  totalAnual,
  totalMensual,
  visitLines,
  budgetNumber,
  budgetDate,
}: {
  input: ContractPdfInput;
  totalAnual: number;
  totalMensual: number;
  visitLines: string[];
  budgetNumber: string;
  budgetDate: string;
}) {
  const totalAnualIva = totalAnual * (1 + IVA_PCT);
  const totalMensualIva = totalMensual * (1 + IVA_PCT);

  return (
    <div id="contract-document">
      {/* ─── Page 1 ─────────────────────────────────────────────── */}
      <Page showHeader>
        <p style={{ margin: "0 0 5mm" }}>
          <strong>{input.contractantName || "—"}</strong> amb NIF: <strong>{input.contractantNif || "—"}</strong> i
          domicili a <strong>{input.contractantTown || "—"}</strong>, <strong>{input.contractantAddress || "—"}</strong>
          , formalitza amb la societat <strong>AQUABLAU SOLUCIONS S.L</strong>, amb CIF: <strong>B66219098</strong> i
          domicili a <strong>CTRA DEL MASNOU 227 DE GRANOLLERS,</strong> l&apos;acceptació del pressupost{" "}
          <strong>Ref : {budgetNumber}</strong> amb data <strong>{fmtDate(budgetDate)}</strong> per al servei de
          manteniment anual de la piscina amb domicili a{" "}
          <strong>
            {input.obraTown || "—"}, {input.obraLocation || "—"}
          </strong>
          .
        </p>

        <p style={{ margin: "0 0 5mm" }}>
          L&apos;import total del manteniment anual:{" "}
          <strong>
            {euroToCatalanWords(totalAnual)} ( {formatEuro(totalAnual)} ) + IVA ( {formatEuro(totalMensual)} + IVA mensual)
          </strong>
        </p>

        <p style={{ margin: "0 0 1mm", fontSize: "11pt" }}>
          L&apos;import del manteniment anual es revisarà de forma automàtica cada any, en funció de la variació del IPC
          interanual.
        </p>
        <p style={{ margin: "0 0 1mm", fontSize: "11pt" }}>
          En tot moment l&apos;import del manteniment s&apos;adaptarà als impostos que siguin d&apos;aplicació, des de
          el mateix moment de l&apos;aprovació de la modificació o de la nova creació del mateix.
        </p>

        <p style={{ margin: "0 0 1mm", fontStyle: "italic", fontSize: "11pt" }}>
          La durada mínima serà de 1 any de servei prestat, havent d&apos;abonar tot l&apos;import estipulat a la
          signatura del mateix en cas d&apos;abandonar-lo abans per circumstàncies no justificades o força major. El
          contracte serà auto-renovable any a any si la propietat no notifica el contrari amb un màxim de 30 dies
          d&apos;antelació.
        </p>

        <div style={{ color: "#000000", fontWeight: 700, letterSpacing: 1, marginBottom: 2, fontSize: "14pt" }}>
          CONDICIONS DEL SERVEI:
        </div>
        <p style={{ margin: "0 0 3mm" }}>
          La freqüència de visites ve condicionada per la temporada de bany i quedarà definida amb la següent
          regularitat:
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 6mm" }}>
          {visitLines.length === 0 ? (
            <li style={{ fontStyle: "italic", color: "#666" }}>Sense visites definides.</li>
          ) : (
            visitLines.map((l, i) => (
              <li key={i} style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#000000", fontWeight: 900 }}>·</span>
                <span>{l}</span>
              </li>
            ))
          )}
        </ul>

        <p style={{ margin: "0 0 1mm" }}>
          El producte químic està inclòs en el preu, determinat per la necessitat que exigeix el sistema de desinfecció
          existent.
        </p>

        <SignatureBlock contractantName={input.contractantName} />
      </Page>

      {/* ─── Page 2 ─────────────────────────────────────────────── */}
      <Page>
        <div style={{ color: "#000000", fontWeight: 700, letterSpacing: 1, marginBottom: 2, fontSize: "14pt" }}>
          EL MANTENIMENT:
        </div>
        <p style={{ margin: "0 0 4mm" }}>
          Consta de la neteja de parets i terra de la piscina, neteja de l&apos;aigua de fulles i brutícia, revisió del
          sistema de filtració per assegurar-ne el perfecte funcionament, neteja del pre-filtre de la bomba i reposició
          de producte químic, per assegurar els nivells òptims de Clor i pH.
        </p>
        <p style={{ margin: "0 0 4mm" }}>
          En el pressupost està contemplat, a proporció, la mitjana necessària de producte químic (clor, anivelladors de
          PH i d&apos;altres) i de Sal (si s&apos;escau) per al manteniment i correcte funcionament del sistema de
          filtració i desinfecció.
        </p>
        <p style={{ margin: "0 0 6mm" }}>
          A l&apos;estiu pot ser necessària una aportació extra de clor en pastilles o bé d&apos;altres productes per
          recuperar l&apos;aigua ràpidament en cas de circumstàncies extremes on segons el cas és facturarà fora de la
          quota de manteniment.
        </p>

        <div style={{ color: "#000000", fontWeight: 700, letterSpacing: 1, marginBottom: 2, fontSize: "14pt" }}>
          NOTA:
        </div>
        <p style={{ margin: "0 0 6mm" }}>
          Qualsevol reparació o treball aliè a la descripció del manteniment tindrà un cost a part, l&apos;operari
          informarà de qualsevol incidència i es pressupostarà per solucionar-la tant aviat com sigui possible.
          Tanmateix, queden excloses les reparacions per propi desgast dels components elèctrics o mecànics i la
          manipulació o ús indegut de claus o maquines per part de persones alienes a la nostra empresa.
        </p>

        <div style={{ color: "#000000", fontWeight: 700, letterSpacing: 1, marginBottom: 2, fontSize: "14pt" }}>
          CLÀUSULA DE PAGAMENT I SUSPENSIÓ DE SERVEIS:
        </div>
        <p style={{ margin: "0 0 6mm" }}>
          El pagament de les factures corresponents al contracte de manteniment de piscines haurà de ser realitzat a tot
          tardar el dia 15 del mes següent a l&apos;emissió de la factura. En cas de no rebre el pagament en la data
          indicada, se suspendran les visites de manteniment del pròxim mes fins que es regularitzi la situació de
          pagament. La represa dels serveis estarà subjecta a la confirmació de l&apos;abonament de les factures
          pendents.
        </p>
      </Page>

      {/* ─── Page 3 ─────────────────────────────────────────────── */}
      <Page>
        <div style={{ color: "#000000", fontWeight: 700, letterSpacing: 1, marginBottom: 2, fontSize: "14pt" }}>
          CONDICIONS DE PAGAMENT:
        </div>
        <p style={{ margin: "0 0 2mm" }}>Domiciliació bancària, el 30 de cada mes.</p>
        <p style={{ margin: "0 0 6mm" }}>- L&apos;I.V.A. que es facturarà és el vigent.</p>

        <p style={{ margin: "0 0 3mm" }}>
          <strong>Data del contracte:</strong> {fmtDate(input.contractDate)}
        </p>
        <p style={{ margin: "0 0 8mm" }}>
          <strong>Data d&apos;inici del servei:</strong> {fmtDate(input.serviceStartDate)}
        </p>

        <div style={{ color: "#000000", fontWeight: 700, letterSpacing: 1, marginBottom: 2, fontSize: "14pt" }}>
          Protecció de Dades Personals
        </div>
        <p style={{ margin: "0 0 4mm" }}>
          Les dades personals aquí continguts, així com els derivats de la relació contractual seran tractades per les
          parts amb l&apos;única finalitat de fer complir el present contracte. Les dades es conservaran fins que
          prescriguin les responsabilitats derivades del seu tractament i no se cediran a tercers excepte obligació
          legal.
        </p>
        <p style={{ margin: "0 0 6mm" }}>
          La base legal per al tractament és l&apos;execució del present contracte. A qualsevol moment,
          l&apos;interessat pot exercir els drets d&apos;accés, rectificació, supressió, oposició, limitació i
          portabilitat. Tot això, mitjançant escrit, acompanyat de còpia de document oficial que li identifiqui, dirigit
          a l&apos;adreça identificada en l&apos;encapçalament del contracte. En cas de disconformitat amb el
          tractament, també té dret a presentar una reclamació davant l&apos;Agència Espanyola de Protecció de Dades.
        </p>

        <SignatureBlock contractantName={input.contractantName} />
      </Page>
    </div>
  );
}

/** Load the maintenance budget, compute totals + visit lines, then render
 *  the contract to a PDF blob. */
export async function buildMaintenanceContractPdf(input: ContractPdfInput): Promise<Blob> {
  const { data: row, error } = await supabase
    .from("budgets")
    .select("id, number, budget_date, total_sale, type")
    .eq("id", input.budgetId)
    .single();
  if (error || !row) throw new Error("No s'ha pogut carregar el pressupost.");

  // Rehydrate draft to access the maintenance plan (visits + frequency).
  const { draft } = await loadBudgetAsDraft(input.budgetId);
  const plan = (draft as any).maintenancePlan;
  const visits: number[] = plan?.visitsPerMonth || Array(12).fill(0);
  const visitLines = buildVisitPeriodsText(visits, plan?.visitFrequency);

  const totalAnual = ((row as any).total_sale || 0) / 100;
  const totalMensual = totalAnual / 12;

  const html = renderToStaticMarkup(
    <ContractDocument
      input={input}
      totalAnual={totalAnual}
      totalMensual={totalMensual}
      visitLines={visitLines}
      budgetNumber={(row as any).number || "-"}
      budgetDate={(row as any).budget_date || new Date().toISOString()}
    />,
  );

  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  // Font preload (best-effort).
  try {
    const fontSet: any = (document as any).fonts;
    if (fontSet) {
      await Promise.all([fontSet.load("700 16pt Calibri"), fontSet.load("400 14px Calibri")]).catch(() => undefined);
      if (fontSet.ready) await fontSet.ready;
    }
  } catch {
    /* ignore */
  }

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.background = "#ffffff";
  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    const root = host.querySelector("#contract-document") as HTMLElement | null;
    if (!root) throw new Error("Contract root not found");
    const pageNodes = Array.from(root.children) as HTMLElement[];

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = 210;
    const pageH = 297;

    for (let i = 0; i < pageNodes.length; i++) {
      const node = pageNodes[i];
      const canvas = await html2canvas(node, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        windowWidth: node.scrollWidth,
        windowHeight: node.scrollHeight,
        logging: false,
        imageTimeout: 0,
        removeContainer: true,
      });
      const image = canvas.toDataURL("image/jpeg", 0.9);
      if (i > 0) pdf.addPage("a4", "portrait");
      pdf.addImage(image, "JPEG", 0, 0, pageW, pageH);
      canvas.width = 0;
      canvas.height = 0;
    }

    return pdf.output("blob") as Blob;
  } finally {
    document.body.removeChild(host);
  }
}
