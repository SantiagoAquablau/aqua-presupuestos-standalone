/**
 * Page 4 — ACABATS.
 * Header + divider styled exactly like ESTRUCTURA (Tenor Sans, navy #2f4494).
 * Two pill sections (CORONA, REVESTIMENT INTERIOR), bullet description,
 * two-column block (Tipus de coronament + Model), large background photo
 * and a vertically-centered TOTAL ACABATS pill on the right.
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";

export function PageAcabats({ data }: { data: PdfData }) {
  const totalAcabats = Math.round(data.phaseAcabatsTotal);
  const coronaAmount = data.coronamentTotal ?? 0;
  const revestimentAmount = data.revestimentTotal ?? 0;
  const coronaOn = data.coronamentInclos !== false;
  const revestOn = data.revestimentInclos !== false;
  const revestExteriorAmount = data.revestimentExteriorTotal ?? 0;
  const showExteriorInCorona = !!data.revestimentExteriorInclos && revestExteriorAmount > 0;
  const coronaPillTitle = showExteriorInCorona ? "CORONAMENT I REVESTIMENT EXTERIOR" : "CORONAMENT";
  const coronaPillAmount = coronaAmount + (showExteriorInCorona ? revestExteriorAmount : 0);
  const totalLabel = coronaOn && revestOn ? "ACABATS" : coronaOn ? "CORONAMENT" : "REVESTIMENT";

  const fmtMl = (n?: number) =>
    typeof n === "number" && n > 0
      ? n.toLocaleString("ca-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "—";

  const actuacio = data.coronamentActuacioLabel || "Subministrament i col·locació";
  const beuradaLabel = data.coronamentBeuradaLabel || "Beurada cimentosa";
  const beuradaColor =
    data.coronamentBeuradaColor && data.coronamentBeuradaColor.trim()
      ? data.coronamentBeuradaColor
      : "a determinar segons model";

  const revActuacio = data.revestimentActuacioLabel || "Subministrament i col·locació";
  const revSurface = data.revestimentSurfaceText || "en tota la superfície interior de la piscina";
  const revBeuradaLabel = data.revestimentBeuradaLabel || "Beurada cimentosa";
  const revBeuradaColor =
    data.revestimentBeuradaColor && data.revestimentBeuradaColor.trim()
      ? data.revestimentBeuradaColor
      : "a determinar segons model";
  const revBeuradaIsEpoxi = (data.revestimentBeuradaLabel || "").toLowerCase().includes("epoxi");

  return (
    <section style={pdfPageStyle}>
      {/* Header — same style as ESTRUCTURA */}
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
          ACABATS
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
        {coronaOn && (
          <>
            {/* Section 1 pill — CORONAMENT */}
            <SectionPillTenor number="1" title={coronaPillTitle} amount={coronaPillAmount} />

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
                <li style={{ marginBottom: 2, display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>
                    <span style={{ marginRight: 6 }}>-</span>
                    {actuacio} de {fmtMl(data.coronamentMl)} metres lineals de coronament.
                  </span>
                  {showExteriorInCorona && (
                    <span
                      style={{ whiteSpace: "nowrap", color: "#2f4494", fontFamily: "PDF_FONTS.sans", fontWeight: 600 }}
                    >
                      {coronaAmount.toLocaleString("ca-ES")} €
                    </span>
                  )}
                </li>
                <li style={{ marginBottom: 2 }}>
                  <span style={{ marginRight: 6 }}></span>
                  {beuradaLabel} color:{" "}
                  <span style={{ fontStyle: data.coronamentBeuradaColor ? "normal" : "italic" }}>{beuradaColor}</span>
                </li>
                {showExteriorInCorona && (
                  <li style={{ marginBottom: 2, display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span>
                      <span style={{ marginRight: 6 }}>-</span>
                      Subministrament i col·locació de revestiment exterior a les cares vistes de la piscina.
                    </span>
                    <span
                      style={{
                        whiteSpace: "nowrap",
                        color: "#2f4494",
                        fontFamily: "PDF_FONTS.sans",
                        fontWeight: 600,
                      }}
                    >
                      {revestExteriorAmount.toLocaleString("ca-ES")} €
                    </span>
                  </li>
                )}
              </ul>
            </div>

            {/* Two-column block: Tipus + Model */}
            <div style={{ display: "flex", gap: "8mm", marginBottom: "5mm" }}>
              {/* Tipus de coronament */}
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
                  TIPUS DE CORONAMENT
                </div>
                <div style={{ fontSize: "11pt", fontWeight: 700, color: PDF_COLORS.textDark, lineHeight: 1.3 }}>
                  {data.coronamentTipusLabel || "Per definir"}
                </div>
                {data.coronamentTipusFormat && (
                  <div style={{ fontSize: "10pt", color: PDF_COLORS.textMuted, marginTop: 2 }}>
                    {data.coronamentTipusFormat}
                  </div>
                )}
              </div>

              {/* Model */}
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
                {data.coronamentModelName ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {data.coronamentModelImageUrl && (
                      <img
                        src={data.coronamentModelImageUrl}
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
                    <div style={{ fontSize: "11pt", fontWeight: 700, color: PDF_COLORS.textDark, lineHeight: 1.3 }}>
                      {data.coronamentModelName}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "11pt", fontStyle: "italic", color: PDF_COLORS.textMuted }}>A determinar</div>
                )}
              </div>
            </div>
          </>
        )}

        {revestOn && (
          <>
            {/* Section 2 pill — REVESTIMENT INTERIOR */}
            <SectionPillTenor number={coronaOn ? "2" : "1"} title="REVESTIMENT INTERIOR" amount={revestimentAmount} />

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
                  {revActuacio} {revSurface}.
                </li>
                <li style={{ marginBottom: 2 }}>
                  <span style={{ marginRight: 6 }}></span>
                  {revBeuradaLabel} color:{" "}
                  <span style={{ fontStyle: data.revestimentBeuradaColor ? "normal" : "italic" }}>
                    {revBeuradaColor}
                  </span>
                </li>
              </ul>
            </div>

            {/* Two/three-column block: Tipus de revestiment + Model (+ Epoxi advantages) */}
            <div style={{ display: "flex", gap: "8mm", marginBottom: "4mm", alignItems: "flex-start" }}>
              <div style={{ flex: revBeuradaIsEpoxi ? 0.8 : 1 }}>
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
                  {data.revestimentTipusLabel || "Per definir"}
                </div>
                {data.revestimentTipusFormat && (
                  <div style={{ fontSize: "10pt", color: PDF_COLORS.textMuted, marginTop: 2 }}>
                    {data.revestimentTipusFormat}
                  </div>
                )}
              </div>
              <div style={{ flex: revBeuradaIsEpoxi ? 0.8 : 1, marginLeft: revBeuradaIsEpoxi ? "4mm" : 0 }}>
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
                {data.revestimentModelName ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {data.revestimentModelImageUrl && (
                      <img
                        src={data.revestimentModelImageUrl}
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
                    <div style={{ fontSize: "11pt", fontWeight: 700, color: PDF_COLORS.textDark, lineHeight: 1.3 }}>
                      {data.revestimentModelName}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "11pt", fontStyle: "italic", color: PDF_COLORS.textMuted }}>A determinar</div>
                )}
              </div>
              {revBeuradaIsEpoxi && (
                <div style={{ flex: "0 0 52mm" }}>
                  <EpoxiAdvantagesCard />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* TOTAL ACABATS — lower on the page, on the background photo */}
      <div
        style={{
          position: "absolute",
          top: "70%",
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
        <div style={{ fontSize: "11pt", letterSpacing: 2, marginTop: 2, fontWeight: 600 }}>{totalLabel}</div>
        <div style={{ fontSize: "16pt", marginTop: -4, fontWeight: 900 }}>{formatEuro(totalAcabats)}</div>
      </div>

      {/* Background photo — reduced height so revestiment content stays on beige */}
      <img
        src={data.revestimentTipusLabel === "GRESSITE" ? "/pdf/acabats_gresite.webp" : "/pdf/porcelanico.webp"}
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
    </section>
  );
}

const EPOXI_BULLETS = [
  "Antiàcida i bactericida, pensada per a piscines.",
  "Elimina el risc de carbonatació de les juntes.",
  "Molt resistent, requereix menys manteniment.",
  "10 anys de garantia des de l'aplicació.",
];

function EpoxiAdvantagesCard() {
  return (
    <div
      style={{
        position: "relative",
        background: "#ffffff",
        borderRadius: 14,
        padding: "9px 10px 8px 10px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        border: "1px solid #f0e7df",
      }}
    >
      <img
        src="/pdf/check-double.png"
        alt=""
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          top: -10,
          left: -14,
          width: 26,
          height: 26,
          zIndex: 3,
        }}
      />
      <div
        style={{
          color: "#ff751f",
          fontWeight: 700,
          fontSize: "8.5pt",
          lineHeight: 1.2,
          marginLeft: 6,
          marginBottom: 5,
        }}
      >
        Avantatges Beurada Epoxi
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: "6.8pt", lineHeight: 1.25 }}>
        {EPOXI_BULLETS.map((b) => (
          <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: 3, marginBottom: 2 }}>
            <span style={{ color: "#1a1a1a", lineHeight: 1.2 }}>•</span>
            <span style={{ flex: 1 }}>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionPillTenor({ number, title, amount }: { number: string; title: string; amount: number }) {
  return (
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
        margin: "0 0 3mm 0",
        fontWeight: 400,
      }}
    >
      <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>
        {number}.- {title}
      </span>
      <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>{formatEuro(amount)}</span>
    </div>
  );
}
