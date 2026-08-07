/**
 * Instal·lacions — CASCADA (dedicated page, out of the generic "Accessoris
 * opcionals" page/list). Only rendered when accCascadaEnabled === true
 * (see PdfDocument.tsx), right after PageAccessoris — so it becomes the true
 * last page of the Instal·lacions section and carries the TOTAL
 * INSTAL·LACIONS badge instead of PageAccessoris (which hides its own copy
 * via showTotalBadge={!data.accCascadaEnabled}).
 *
 * Header/divider/logo/typography match the rest of the Instal·lacions pages
 * (PageDepuracio1, PageElectricitat, PageAccessoris): Tenor Sans navy
 * (#2f4494) title, 6px divider, PdfLogo size 85. Image layout (text left,
 * large image right, maxWidth/maxHeight + objectFit: contain, no fixed
 * width+height together) mirrors PageAutoportantModel.tsx.
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";

const NAVY = "#2f4494";

export function PageCascada({ data, pillNumber }: { data: PdfData; pillNumber: number }) {
  const encastada = !!data.cascadaEncastada;
  const modelName = data.cascadaModelName || "A determinar";
  const bombaName = data.cascadaBombaName || "A determinar";
  const total = data.cascadaTotal || 0;
  const totalInstal = data.instalacionsTotal || 0;

  const bullets: { pre: string; strong?: string }[] = [
    {
      pre: `Subministrament i col·locació de cascada${encastada ? " (encastada)" : ""} de 0,50 d'ample `,
      strong: modelName,
    },
    { pre: "Polsador piezoelèctric en acer inoxidable, protecció i maniobra." },
    { pre: "Bomba ", strong: bombaName },
    { pre: "Canonada i accessoris PVC D.50 per a connexió aspiració i retorn." },
    ...(encastada ? [{ pre: "Mà d'obra paleteria per a col·locació." }] : []),
  ];

  return (
    <section style={pdfPageStyle}>
      {/* Full-height background image — same as Depuracio/Electricitat */}
      <img
        src="/pdf/fondo_instalacion.webp"
        crossOrigin="anonymous"
        alt=""
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "210mm",
          height: "297mm",
          objectFit: "cover",
          zIndex: 0,
        }}
      />

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
            color: NAVY,
            letterSpacing: 4,
            margin: 0,
            lineHeight: 1,
          }}
        >
          INSTAL·LACIONS
        </h1>
        <PdfLogo size={85} />
      </div>

      {/* Divider */}
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
        <SectionPillTenor
          number={pillNumber}
          title={encastada ? "CASCADA ENCASTADA" : "CASCADA"}
          amount={total}
        />

        <p
          style={{
            color: NAVY,
            fontWeight: 700,
            fontSize: "11.5pt",
            margin: "0 0 6mm 0",
            lineHeight: 1.35,
          }}
        >
          Subministrament i col·locació de cascada, maniobra i protecció elèctrica.
        </p>

        <div style={{ display: "flex", gap: "8mm", alignItems: "flex-start" }}>
          {/* LEFT — bullets */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2.5mm" }}>
              {bullets.map((b, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: "10pt", lineHeight: 1.45 }}>
                  <span style={{ color: NAVY, fontWeight: 700 }}>·</span>
                  <span style={{ color: PDF_COLORS.textBody }}>
                    {b.pre}
                    {b.strong && <strong>{b.strong}</strong>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — model image, large, never stretched */}
          <div style={{ flex: "0 0 75mm", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
            {data.cascadaModelImageUrl && (
              <img
                src={data.cascadaModelImageUrl}
                alt={modelName}
                crossOrigin="anonymous"
                style={{
                  maxWidth: "100%",
                  maxHeight: "90mm",
                  objectFit: "contain",
                  borderRadius: 8,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* TOTAL INSTAL·LACIONS — same style as PageAccessoris. This page only
          renders when accCascadaEnabled === true, so it's always the true
          last page of Instal·lacions in that case. */}
      <div
        style={{
          position: "absolute",
          top: "70%",
          right: "14mm",
          transform: "translateY(-50%)",
          zIndex: 2,
          backgroundColor: PDF_COLORS.badgePill,
          color: NAVY,
          borderRadius: 999,
          padding: "10px 28px",
          textAlign: "center",
          border: "3px solid #FFFFFF",
          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          fontFamily: '"Tenor Sans", serif',
        }}
      >
        <div style={{ fontSize: "20pt", letterSpacing: 3, lineHeight: 1, marginTop: "-12px" }}>TOTAL</div>
        <div style={{ fontSize: "10pt", letterSpacing: 2, marginTop: 2, fontWeight: 600 }}>INSTAL·LACIONS</div>
        <div style={{ fontSize: "16pt", marginTop: -4, fontWeight: 900 }}>{formatEuro(Math.round(totalInstal))}</div>
      </div>
    </section>
  );
}

function SectionPillTenor({ number, title, amount }: { number: number; title: string; amount: number }) {
  return (
    <div
      style={{
        backgroundColor: PDF_COLORS.badgePill,
        color: NAVY,
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
      <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>
        {number}.- {title}
      </span>
      <span style={{ display: "block", lineHeight: 1, marginBottom: "12px", fontWeight: 700 }}>
        {formatEuro(amount)}
      </span>
    </div>
  );
}

void PDF_FONTS;
