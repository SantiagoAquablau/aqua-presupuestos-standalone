/**
 * Annex OPCIONAL — Revestiment alternatiu.
 * Renders only when the user added an alternative revestiment in the wizard
 * (StepAcabats → "Afegir opció alternativa al client"). Always appears in the
 * OPCIONALS block (orange pill, "+" amount). Layout mirrors the bottom half of
 * PageAcabats (revestiment section only).
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";

const ORANGE = "#ff751f99";

export function PageAnnexRevestiment({ data }: { data: PdfData }) {
  const amount = data.annexOpcionalRevestimentAmount || 0;
  const amountText = `${formatEuro(amount)}`;
  const isEpoxi = data.annexOpcionalRevestimentBeuradaLabel === "Beurada epoxi";
  const epoxiAmount = data.annexOpcionalRevestimentAmountEpoxi || 0;
  const epoxiDiff = Math.max(0, epoxiAmount - amount);
  const showEpoxiUpsell = !isEpoxi && epoxiAmount > 0 && epoxiDiff > 0;

  const actuacio = data.annexOpcionalRevestimentActuacioLabel || "Subministrament i col·locació";
  const surface = data.annexOpcionalRevestimentSurfaceText || "en tota la superfície interior de la piscina";
  const beuradaLabel = data.annexOpcionalRevestimentBeuradaLabel || "Beurada cimentosa";
  const beuradaColor =
    data.annexOpcionalRevestimentBeuradaColor && data.annexOpcionalRevestimentBeuradaColor.trim()
      ? data.annexOpcionalRevestimentBeuradaColor
      : "a determinar segons model";

  const isPorcelanic = data.annexOpcionalRevestimentTipusLabel === "PORCELÀNIC";
  const bgSrc = isPorcelanic ? "/pdf/porcelanico.webp" : "/pdf/acabats_gresite.webp";

  return (
    <section style={pdfPageStyle}>
      {/* Header — OPCIONALS style */}
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
            color: "#ff751f",
            letterSpacing: 4,
            margin: 0,
            lineHeight: 1,
          }}
        >
          OPCIONAL
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
        {/* Pill — REVESTIMENT INTERIOR with "+" amount */}
        <div
          style={{
            backgroundColor: ORANGE,
            color: "#ffffff",
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
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>REVESTIMENT INTERIOR</span>
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px", fontWeight: 700 }}>{amountText}</span>
        </div>

        <div
          style={{
            paddingLeft: 6,
            fontSize: "10.5pt",
            lineHeight: 1.4,
            marginBottom: "3mm",
            color: PDF_COLORS.textBody,
          }}
        >
          <ul style={{ margin: 0, paddingLeft: 14, lineHeight: 1.4, listStyle: "none" }}>
            <li style={{ marginBottom: 2 }}>
              <span style={{ marginRight: 6 }}>-</span>
              {actuacio} {surface}.
            </li>
            <li style={{ marginBottom: 2 }}>
              <span style={{ marginRight: 6 }}>-</span>
              {beuradaLabel} color:{" "}
              <span
                style={{
                  fontStyle: data.annexOpcionalRevestimentBeuradaColor ? "normal" : "italic",
                }}
              >
                {beuradaColor}
              </span>
            </li>
          </ul>
        </div>

        {/* Two-column block: Tipus + Model */}
        <div style={{ display: "flex", gap: "8mm", marginBottom: "4mm" }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: '"Tenor Sans", serif',
                color: "#2f4494",
                fontSize: "11.5pt",
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              TIPUS DE REVESTIMENT
            </div>
            <div style={{ fontSize: "11pt", fontWeight: 700, color: PDF_COLORS.textDark, lineHeight: 1.3 }}>
              {data.annexOpcionalRevestimentTipusLabel || "Per definir"}
            </div>
            {data.annexOpcionalRevestimentTipusFormat && (
              <div style={{ fontSize: "10pt", color: PDF_COLORS.textMuted, marginTop: 2 }}>
                {data.annexOpcionalRevestimentTipusFormat}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: '"Tenor Sans", serif',
                color: "#2f4494",
                fontSize: "11.5pt",
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              MODEL
            </div>
            {data.annexOpcionalRevestimentModelName ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {data.annexOpcionalRevestimentModelImageUrl && (
                  <img
                    src={data.annexOpcionalRevestimentModelImageUrl}
                    alt=""
                    crossOrigin="anonymous"
                    style={{
                      width: 56,
                      height: 56,
                      objectFit: "cover",
                      borderRadius: 6,
                      border: "1px solid #d8d2cc",
                      flexShrink: 0,
                    }}
                  />
                )}
                <div
                  style={{
                    fontSize: "11pt",
                    fontWeight: 700,
                    color: PDF_COLORS.textDark,
                    lineHeight: 1.3,
                  }}
                >
                  {data.annexOpcionalRevestimentModelName}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "11pt", fontStyle: "italic", color: PDF_COLORS.textMuted }}>A determinar</div>
            )}
          </div>
        </div>

        {/* Aclaració: import substitutiu */}
        <div
          style={{
            marginTop: "4mm",
            fontStyle: "italic",
            color: "#2f4494",
            fontSize: "9pt",
            lineHeight: 1.4,
          }}
        >
          *Aquest import és substitutiu del revestiment interior inclòs al pressupost.
        </div>
      </div>

      {/* TOTAL ACABATS — lower on the page, on the background photo */}
      <div
        style={{
          position: "absolute",
          top: showEpoxiUpsell ? "52%" : "55%",
          right: "14mm",
          transform: "translateY(-50%)",
          zIndex: 2,
          backgroundColor: ORANGE,
          color: "#FFFFFF",
          borderRadius: 999,
          padding: "10px 36px",
          textAlign: "center",
          border: "3px solid #FFFFFF",
          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          fontFamily: '"Tenor Sans", serif',
        }}
      >
        <div style={{ fontSize: "20pt", letterSpacing: 3, lineHeight: 1, marginTop: "-12px" }}>TOTAL</div>
        <div style={{ fontSize: "11pt", letterSpacing: 2, marginTop: 2, fontWeight: 600 }}>
          {isEpoxi ? "REVESTIMENT OPCIONAL AMB EPOXI" : "REVESTIMENT OPCIONAL"}
        </div>
        <div style={{ fontSize: "16pt", marginTop: -4, fontWeight: 900 }}>{amountText}</div>
      </div>

      {showEpoxiUpsell && (
        <div
          style={{
            position: "absolute",
            top: "56%",
            right: "14mm",
            zIndex: 2,
            color: "#2f4494",
            textAlign: "right",
            fontFamily: '"Tenor Sans", serif',
            fontSize: "11pt",
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          TOTAL REVESTIMENT OPCIONAL AMB EPOXI: + {formatEuro(epoxiDiff)}
        </div>
      )}

      {/* Background photo — same swap rule as PageAcabats */}
      <img
        src={bgSrc}
        alt=""
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: "78%",
          objectFit: "cover",
          objectPosition: "bottom",
          backgroundColor: "#efe9e5",
          zIndex: 0,
        }}
      />
    </section>
  );
}
