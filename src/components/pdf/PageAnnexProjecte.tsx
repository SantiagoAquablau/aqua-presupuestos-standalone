/**
 * Annex — PROJECTE TÈCNIC D'OBRA.
 * Renders before the Resum page when estat = "inclos" (title ANNEX, navy pill),
 * and after the Resum when estat = "opcional" (title OPCIONALS, orange pill, "+" amount).
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";
import { annexEnumPrefix, AnnexGrandTotalBadge, type AnnexInclosProps } from "./PdfAnnexShared";

const NAVY = "#2f4494";
const ORANGE = "#ff751f99";

export function PageAnnexProjecte({
  data,
  variant,
  annexIndex,
  annexTotalCount,
  isLastAnnex,
  annexGrandTotal,
}: { data: PdfData; variant: "inclos" | "opcional" } & AnnexInclosProps) {
  const isOpcional = variant === "opcional";
  const titleColor = isOpcional ? "#ff751f" : NAVY;
  const pillBg = isOpcional ? ORANGE : PDF_COLORS.badgePill;
  const pillText = isOpcional ? "#ffffff" : NAVY;
  const amount = data.annexProjecteAmount || 0;
  const amountText = `${formatEuro(amount)}`;
  const enumPx = isOpcional ? "" : annexEnumPrefix(annexIndex, annexTotalCount);

  const bullets = [
    "Memòria",
    "Mesures",
    "Pressupost d'execució material",
    "Normativa aplicable",
    "Condicions generals, particulars, facultatives i econòmiques",
    "Programa de control de qualitat i de gestió de residus",
    "Estudi bàsic de seguretat i salut",
    "Documentació gràfica",
  ];

  return (
    <section style={pdfPageStyle}>
      {/* Header: title + logo */}
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
            color: titleColor,
            letterSpacing: 4,
            margin: 0,
            lineHeight: 1,
          }}
        >
          {isOpcional ? "OPCIONALS" : "ANNEX"}
        </h1>
        <PdfLogo size={85} />
      </div>

      {/* Divider */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: 6,
          background: "#2f4494",
          margin: "10mm 14mm 8mm 0",
          marginLeft: "0mm",
          width: "calc(100% - 36mm)",
        }}
      />

      <div style={{ padding: "0 14mm", position: "relative", zIndex: 1 }}>
        {/* Section pill */}
        <div
          style={{
            backgroundColor: pillBg,
            color: pillText,
            borderRadius: 999,
            padding: "0 32px",
            minHeight: "44px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: '"Tenor Sans", serif',
            fontSize: "14pt",
            letterSpacing: 1,
            margin: "0 0 8mm 0",
            fontWeight: 400,
          }}
        >
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>{enumPx}PROJECTE TÈCNIC D'OBRA</span>
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px", fontWeight: 700 }}>{amountText}</span>
        </div>

        <p
          style={{
            fontSize: "10.5pt",
            lineHeight: 1.5,
            color: PDF_COLORS.textBody,
            margin: "0 0 6mm 0",
            //textTransform: "uppercase",
          }}
        >
          Confecció i elaboració de document amb l'estudi tècnic de l'obra per a la construcció i instal·lació de la
          piscina sota supervisió d'arquitecte tècnic col·legiat.
        </p>

        <div
          style={{
            //fontFamily: '"Tenor Sans", serif',
            color: "#2f4494",
            fontSize: "12pt",
            letterSpacing: 1,
            margin: "0 0 3mm 0",
            fontWeight: 700,
          }}
        >
          INCLOU:
        </div>

        <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: "10.5pt", lineHeight: 1.7 }}>
          {bullets.map((t) => (
            <li key={t} style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#2f4494", fontWeight: 700 }}>·</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <img
        src="/pdf/fondo_proyectoObra.webp"
        alt=""
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: "88%",
          objectFit: "cover",
          objectPosition: "bottom",
          backgroundColor: "#efe9e5",
          zIndex: 0,
        }}
      />
      {!isOpcional && isLastAnnex && (annexTotalCount ?? 0) >= 1 && (
        <AnnexGrandTotalBadge total={annexGrandTotal || 0} />
      )}
    </section>
  );
}

void PDF_FONTS;
