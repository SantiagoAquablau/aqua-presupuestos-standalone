/**
 * Page 2.5 — ELEMENTS ESTRUCTURALS (interior stairs / bench / platform).
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";

const TYPE_LABEL: Record<string, string> = {
  estandard: "escala estàndard interior",
  plataforma: "escala + plataforma interior",
  banc: "escala + banc interior",
  tot_ample: "escala a tot l'ample",
};

export function PageElementsEstructurals({ data }: { data: PdfData }) {
  const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString("ca-ES", { minimumFractionDigits: 2 }) : "");
  const sectionAmount = typeof data.elementsEstructuralsTotal === "number" ? data.elementsEstructuralsTotal : 0;
  const t = data.interiorStairsType;
  const isPlatformOrBench = t === "plataforma" || t === "banc";
  const hasAccess = !!data.hasAccessStair;
  const interiorLabel = t ? (TYPE_LABEL[t] ?? t) : null;
  const stairsTitle = (() => {
    if (!interiorLabel && !hasAccess) return null;
    if (interiorLabel && hasAccess) {
      if (t === "plataforma") return `ESCALA + PLATAFORMA INTERIOR I EXTERIOR:`;
      if (t === "banc") return `ESCALA + BANC INTERIOR I ESCALA I PLATAFORMA D'ACCÉS:`;
      if (t === "tot_ample") return `ESCALA A TOT L'AMPLE + ESCALA I PLATAFORMA D'ACCÉS:`;
      return `${interiorLabel} + ESCALA I PLATAFORMA D'ACCÉS:`.toUpperCase();
    }
    if (hasAccess) return `ESCALA I PLATAFORMA D'ACCÉS EXTERIOR:`;
    return `${interiorLabel}:`.toUpperCase();
  })();
  const stairsLine = isPlatformOrBench
    ? `Formació d'escala d'obra de mides ${data.stairsDimensions ?? ""}*`
    : t
      ? `Formació d'escala d'obra${data.stairsDimensions ? ` de mides ${data.stairsDimensions}*` : ""}`
      : null;
  const platformLine =
    isPlatformOrBench && data.platformDimensions
      ? `Formació de ${t === "banc" ? "banc annexat" : "plataforma annexada"} a escala de mides ${data.platformDimensions}*`
      : null;
  const accessLine = (() => {
    if (!hasAccess) return null;
    const sw = data.accessStairWidth;
    const sl = data.accessStairLength;
    const alt = data.alturaVista;
    const pw = data.accessPlatformWidth;
    const pl = data.accessPlatformLength;
    const steps = alt && alt > 0 ? Math.max(0, Math.round(alt / 0.2 - 1)) : 0;
    const stairPart = `${fmt(sw)}m x ${fmt(sl)}m x ${fmt(alt)}m`;
    const platPart = pl && pl > 0 ? ` i plataforma de ${fmt(pw)}m x ${fmt(pl)}m` : "";
    const stepsPart = steps > 0 ? ` (${steps} esgraons)` : "";
    return `Formació d'escala d'accés exterior de mides ${stairPart}${platPart}${stepsPart}*`;
  })();

  const bullets = [
    "Subministrament i col·locació de blocs de formigó per a la seva execució.",
    "Reompliment de la estructura amb graves per garantir estabilitat i consistència.",
    "Acabat de la superficie amb formigó lliscat, deixant la superfície completament preparada per al posterior revestiment amb el        material seleccionat.",
  ];

  // Total estructura (rounded) — same value as resum financiero
  const totalEstructura = Math.round(data.phaseStructuralTotal);

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
            color: "#2f4494",
            letterSpacing: 4,
            margin: 0,
            lineHeight: 1,
          }}
        >
          ESTRUCTURA
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
            backgroundColor: PDF_COLORS.badgePill,
            color: "#2f4494",
            borderRadius: 999,
            padding: "0 32px",
            minHeight: "44px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: '"Tenor Sans", serif',
            fontSize: "14pt",
            letterSpacing: 1,
            margin: "0 0 6mm 0",
            fontWeight: 400,
          }}
        >
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>2.- ELEMENTS ESTRUCTURALS</span>
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>{formatEuro(sectionAmount)}</span>
        </div>

        <div
          style={{
            paddingLeft: 6,
            fontSize: "10.5pt",
            lineHeight: 1.6,
            marginBottom: "8mm",
            color: PDF_COLORS.textBody,
          }}
        >
          {stairsTitle && (
            <div
              style={{
                fontFamily: '"Tenor Sans", serif',
                color: "#2f4494",
                fontSize: "11.5pt",
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              {stairsTitle}
            </div>
          )}
          <ul style={{ margin: 0, paddingLeft: 14, lineHeight: 1.6, listStyle: "none" }}>
            {stairsLine && (
              <li style={{ marginBottom: 2 }}>
                <span style={{ marginRight: 6 }}>-</span>
                {stairsLine}
              </li>
            )}
            {platformLine && (
              <li style={{ marginBottom: 2 }}>
                <span style={{ marginRight: 6 }}>-</span>
                {platformLine}
              </li>
            )}
            {accessLine && (
              <li style={{ marginBottom: 2 }}>
                <span style={{ marginRight: 6 }}>-</span>
                {accessLine}
              </li>
            )}
            {bullets.map((b) => (
              <li key={b} style={{ marginBottom: 2 }}>
                <span style={{ marginRight: 6 }}>-</span>
                {b}
              </li>
            ))}
          </ul>
          <span style={{ fontStyle: "italic", marginTop: 8, color: "#2f4494", marginRight: 8 }}>
            *Mides encara a concretar en la seva totalitat.
          </span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: "50%",
          right: "14mm",
          transform: "translateY(-50%)",
          zIndex: 2,
          backgroundColor: PDF_COLORS.badgePill,
          color: "#2f4494",
          borderRadius: 999,
          padding: "10px 36px",
          textAlign: "center",
          border: "3px solid #FFFFFF",
          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          fontFamily: '"Tenor Sans", serif',
        }}
      >
        <div style={{ fontSize: "20pt", letterSpacing: 3, lineHeight: 1, marginTop: "-12px" }}>TOTAL</div>
        <div style={{ fontSize: "11pt", letterSpacing: 2, marginTop: 2, fontWeight: 600 }}>ESTRUCTURA</div>
        <div style={{ fontSize: "16pt", marginTop: -4, fontWeight: 900 }}>{formatEuro(totalEstructura)}</div>
      </div>

      {/* Background image full-height, beige */}
      <img
        src="/pdf/escala.webp"
        alt=""
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "bottom",
          backgroundColor: "#efe9e5",
          zIndex: 0,
        }}
      />
    </section>
  );
}
