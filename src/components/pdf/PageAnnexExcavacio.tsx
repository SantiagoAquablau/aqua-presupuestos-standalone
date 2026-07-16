/**
 * Annex — EXCAVACIÓ I RE-OMPLIMENT DE TERRES.
 * Mirrors PageAnnexProjecte: two section pills (Excavació + Re-ompliment),
 * descriptive text under each, and a TOTAL badge at the bottom-right.
 * Variant "inclos" → before Resum, navy. Variant "opcional" → after Resum,
 * orange, amounts prefixed with "+ " and an italic blue note.
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";
import { AnnexGrandTotalBadge, type AnnexInclosProps } from "./PdfAnnexShared";

const NAVY = "#2f4494";
const ORANGE = "#ff751f99";

export function PageAnnexExcavacio({
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
  const prefix = "";
  const mo = data.annexExcavacioManoObra || 0;
  const reomp = data.annexExcavacioReompliment || 0;
  const total = data.annexExcavacioTotal || mo + reomp;
  // Annex enumeration: when there are 2+ included annexes, prepend "{N}." to
  // the existing internal sub-numbering (e.g. "2.1.- EXCAVACIÓ").
  const annexPx = !isOpcional && annexIndex && (annexTotalCount ?? 0) >= 2 ? `${annexIndex}.` : "";

  const Pill = ({ title, amount }: { title: string; amount: number }) => (
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
        margin: "0 0 4mm 0",
        fontWeight: 400,
      }}
    >
      <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>{title}</span>
      <span style={{ display: "block", lineHeight: 1, marginBottom: "12px", fontWeight: 700 }}>
        {prefix}
        {formatEuro(amount)}
      </span>
    </div>
  );

  return (
    <section style={pdfPageStyle}>
      {/* Header */}
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

      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: 6,
          background: NAVY,
          margin: "10mm 14mm 8mm 0",
          marginLeft: "0mm",
          width: "calc(100% - 36mm)",
        }}
      />

      <div style={{ padding: "0 14mm", position: "relative", zIndex: 1 }}>
        <Pill title={data.annexExcavacioPill1Title?.trim() || `${annexPx}1.- EXCAVACIÓ`} amount={mo} />
        <p
          style={{
            fontSize: "10.5pt",
            lineHeight: 1.5,
            color: PDF_COLORS.textBody,
            margin: "0 0 8mm 0",
          }}
        >
          {data.annexExcavacioText1?.trim() ||
            "Excavació piscina, anivellament i transport de terres a l'abocador autoritzat, cànon inclòs."}
        </p>

        <Pill
          title={data.annexExcavacioPill2Title?.trim() || `${annexPx}2.- RE-OMPLIMENT PERIMETRAL DE TERRES`}
          amount={reomp}
        />
        <p
          style={{
            fontSize: "10.5pt",
            lineHeight: 1.5,
            color: PDF_COLORS.textBody,
            margin: "0 0 8mm 0",
          }}
        >
          {data.annexExcavacioText2?.trim() ||
            "Re-ompliment de forats laterals de la piscina amb graves després de la construcció del vas."}
        </p>

        {isOpcional && (
          <p
            style={{
              fontStyle: "italic",
              color: NAVY,
              fontSize: "10.5pt",
              margin: "6mm 0 0 0",
            }}
          >
            *No inclosa (Preu aproximat,a valorar in situ)
          </p>
        )}

        {/* Textos informatius */}
        <ul style={{ margin: "8mm 0 0 0", padding: "0 0 0 16px", listStyleType: "disc" }}>
          {[
            "En cas que durant l'excavació aparegui pedra i/o runa, aquests treballs es facturaran a part per administració, de la               mateixa manera que qualsevol altre treball no especificat.",
            "No s'inclou el pagament de cap taxa i/o permís que no indicat, ni la seva tramitació.",
            "Tampoc s'inclou la gestió de la documentació necessària.",
          ].map((text, i) => (
            <li
              key={i}
              style={{ fontSize: "9.5pt", lineHeight: 1.5, color: NAVY, marginBottom: "3mm", fontStyle: "italic" }}
            >
              {text}
            </li>
          ))}
        </ul>
      </div>

      {/* TOTAL badge */}
      <div
        style={{
          position: "absolute",
          top: "55%",
          //bottom: "18mm",
          right: "14mm",
          backgroundColor: isOpcional ? ORANGE : PDF_COLORS.badgePill,
          color: isOpcional ? "#FFFFFF" : NAVY,
          borderRadius: 999,
          padding: "12px 36px",
          textAlign: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          border: "3px solid #FFFFFF",
          //outline: `2px solid ${pillBg}`,
          zIndex: 2,
        }}
      >
        <div
          style={{
            fontFamily: '"Tenor Sans", serif',
            fontSize: "18pt",
            letterSpacing: 2,
            lineHeight: 1,
            marginTop: "-12px",
          }}
        >
          TOTAL
        </div>
        <div style={{ fontSize: "10pt", letterSpacing: 2, marginTop: 2, fontWeight: 600 }}>
          EXCAVACIÓ I
          <br />
          RE-OMPLIMENT DE TERRES
        </div>
        <div style={{ fontFamily: '"Tenor Sans", serif', fontSize: "15pt", marginTop: -4, fontWeight: 900 }}>
          {prefix}
          {formatEuro(total)}
        </div>
      </div>

      <img
        src="/pdf/excavacion_fondo.webp"
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
      {!isOpcional && isLastAnnex && <AnnexGrandTotalBadge total={annexGrandTotal || 0} />}
    </section>
  );
}

void PDF_FONTS;
