/**
 * Confirmació de Comanda — extra page appended right after PageResum
 * whenever the budget has contractant data filled in.
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, formatEuro } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";

const pageStyle: React.CSSProperties = {
  position: "relative",
  width: "210mm",
  height: "297mm",
  background: PDF_COLORS.beige,
  fontFamily: PDF_FONTS.sans,
  color: PDF_COLORS.textBody,
  overflow: "hidden",
  boxSizing: "border-box",
};

// Catalan number-to-words for euro integer amounts (covers 0–999.999.999)
function unitsCa(n: number, feminine = false): string {
  const m = [
    "zero",
    "un",
    "dos",
    "tres",
    "quatre",
    "cinc",
    "sis",
    "set",
    "vuit",
    "nou",
    "deu",
    "onze",
    "dotze",
    "tretze",
    "catorze",
    "quinze",
    "setze",
    "disset",
    "divuit",
    "dinou",
  ];
  const f = [...m];
  f[1] = "una";
  f[2] = "dues";
  return (feminine ? f : m)[n];
}
function tensCa(n: number, feminine = false): string {
  if (n < 20) return unitsCa(n, feminine);
  const t = ["", "", "vint", "trenta", "quaranta", "cinquanta", "seixanta", "setanta", "vuitanta", "noranta"];
  const d = Math.floor(n / 10),
    u = n % 10;
  if (u === 0) return t[d];
  if (d === 2) return `vint-i-${unitsCa(u, feminine)}`;
  return `${t[d]}-${unitsCa(u, feminine)}`;
}
function hundredsCa(n: number, feminine = false): string {
  if (n < 100) return tensCa(n, feminine);
  if (n === 100) return "cent";
  const c = Math.floor(n / 100),
    r = n % 100;
  const cents = c === 1 ? "cent" : `${unitsCa(c, feminine)}-cents${feminine ? "" : ""}`;
  const centsFem = c === 1 ? "cent" : `${unitsCa(c, feminine)}-centes`;
  const head = feminine ? centsFem : cents;
  return r === 0 ? head : `${head} ${tensCa(r, feminine)}`;
}
function thousandsCa(n: number, feminine = false): string {
  if (n < 1000) return hundredsCa(n, feminine);
  const k = Math.floor(n / 1000),
    r = n % 1000;
  const kWord = k === 1 ? "mil" : `${hundredsCa(k, true)} mil`;
  return r === 0 ? kWord : `${kWord} ${hundredsCa(r, feminine)}`;
}
function millionsCa(n: number): string {
  if (n < 1_000_000) return thousandsCa(n);
  const m = Math.floor(n / 1_000_000),
    r = n % 1_000_000;
  const mWord = m === 1 ? "un milió" : `${thousandsCa(m)} milions`;
  return r === 0 ? mWord : `${mWord} ${thousandsCa(r)}`;
}
export function amountInWordsCa(amount: number): string {
  const intPart = Math.floor(Math.abs(amount));
  const cents = Math.round((Math.abs(amount) - intPart) * 100);
  const eurosTxt = `${millionsCa(intPart)} euros`;
  if (cents === 0) return eurosTxt;
  return `${eurosTxt} amb ${thousandsCa(cents)} cèntims`;
}

export function PageComanda({ data }: { data: PdfData }) {
  const contractantName = (data.contractantName || data.clientName || "").trim();
  const contractantNif = (data.contractantNif || data.clientNif || "").trim();
  const contractantAddress = (data.contractantAddress || data.clientAddress || "").trim();
  const contractantTown = (data.contractantTown || data.clientTown || "").trim();
  const obraLocation = (data.obraLocation || data.clientTown || "").trim();

  const total = data.totalSaleAfterDiscount ?? data.totalSale ?? 0;
  const ivaPct = 21;
  const dateStr = data.budgetDate
    ? new Date(data.budgetDate).toLocaleDateString("ca-ES", { day: "2-digit", month: "long", year: "numeric" })
    : "";

  return (
    <section style={pageStyle}>
      {/* Header: title + logo (same style as ESTRUCTURA / ACABATS) */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          padding: "14mm 14mm 0 14mm",
        }}
      >
        <h1
          style={{
            fontFamily: '"Tenor Sans", serif',
            fontWeight: 400,
            fontSize: "46pt",
            color: "#2f4494",
            letterSpacing: 4,
            margin: 0,
            lineHeight: 1,
          }}
        >
          COMANDA
        </h1>
        <PdfLogo size={85} />
      </div>

      {/* Divider — left-flush, thick navy bar like the other pages */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: 6,
          background: "#2f4494",
          margin: "10mm 14mm 8mm 0",
          width: "calc(100% - 36mm)",
        }}
      />

      <div style={{ padding: "0 18mm" }}>
        <h2
          style={{
            fontFamily: '"Tenor Sans", serif',
            fontWeight: 400,
            fontSize: "22pt",
            color: "#2f4494",
            letterSpacing: 2,
            textAlign: "center",
            margin: "8mm 0 10mm 0",
          }}
        >
          CONFIRMACIÓ DE COMANDA
        </h2>

        <p style={{ fontSize: "11pt", lineHeight: 1.7, textAlign: "justify", margin: "0 0 8mm 0" }}>
          <strong>{contractantName}</strong> amb NIF: <strong>{contractantNif}</strong> domiciliat en{" "}
          <strong>{contractantTown}</strong> <strong>{contractantAddress}</strong>, formalitza amb la societat{" "}
          <strong>AQUA BLAU SOLUCIONS S.L.</strong>, amb CIF <strong>B66219098</strong> i domicili en{" "}
          <strong>CTRA DEL MASNOU 227, GRANOLLERS (BARCELONA)</strong>, l'acceptació del pressupost Ref.{" "}
          <strong>{data.budgetNumber}</strong> amb data <strong>{dateStr}</strong>, la construcció d'una piscina a{" "}
          <strong>{obraLocation}</strong>.
        </p>

        <p style={{ fontSize: "11pt", lineHeight: 1.7, textAlign: "justify", margin: "0 0 6mm 0" }}>
          L'import total del pressupost amb Euros:{" "}
          <strong style={{ textTransform: "uppercase" }}>{amountInWordsCa(total)}</strong> (mes IVA) + {ivaPct}% IVA
        </p>

        <div
          style={{
            margin: "6mm 0 14mm 0",
            fontFamily: '"Tenor Sans", serif',
            fontSize: "22pt",
            fontWeight: 700,
            color: "#2f4494",
            letterSpacing: 1,
            textAlign: "left",
          }}
        >
          {formatEuro(total)}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: "30mm",
            gap: "12mm",
          }}
        >
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ height: 140 }} />
            <div
              style={{ borderTop: `1.5px solid ${PDF_COLORS.navy}`, paddingTop: 8, fontSize: "10pt", fontWeight: 600 }}
            >
              {contractantName || "—"}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", height: 140 }}>
              <img
                src="/pdf/firma-aquablau.png"
                crossOrigin="anonymous"
                alt=""
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
                style={{ maxHeight: 140, maxWidth: "95%", objectFit: "contain", display: "block", margin: "0 auto" }}
              />
            </div>
            <div
              style={{ borderTop: `1.5px solid ${PDF_COLORS.navy}`, paddingTop: 8, fontSize: "10pt", fontWeight: 600 }}
            >
              AQUA BLAU SOLUCIONS S.L
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
