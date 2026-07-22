/**
 * Page 2 — ESTRUCTURA.
 * 3 pill sections (Creació de vas, Impermeabilització, Elements estructurals)
 * with bullet text + checklist of stair types + decorative pool photo + total badge.
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";

export function PageEstructura({ data }: { data: PdfData }) {
  const sectionAmount = typeof data.vasTotal === "number" ? data.vasTotal : data.phaseStructuralTotal;
  const showImpertot = data.waterproofingSystem === "impertot";
  const showLaminaProof = data.waterproofingSystem === "lamina_proof";
  const isBloc = data.constructionSystem === "bloc_encofrat";
  // Làmina Proof block geometry (text + connector lines + white card). When the
  // pool is "semi_enterrada" or "elevada" an extra bullet above (paret vista)
  // pushes this whole block further down, closer to the decorative pool photo
  // anchored at the page bottom — so we shift it right and shrink the card a bit
  // to keep clearance. Every value below is derived from laminaShiftX/laminaScale
  // so the three pieces stay joined; for "enterrada" (laminaCompact=false) these
  // all resolve to the original constants, unchanged.
  const laminaCompact = data.poolDisposition === "semi_enterrada" || data.poolDisposition === "elevada";
  const laminaShiftX = laminaCompact ? 20 : 0; // px — pushes the "Inclou" text row right
  const laminaScale = laminaCompact ? 0.9 : 1; // shrinks the white card + its content
  const laminaContentWidthPx = 682; // approx. width inside page margins (210mm - 2×14mm - 6px)
  const laminaOverlapPx = 128; // how far the horizontal line reaches under the card (hidden behind it)
  const laminaHorizontalLineLeft = 142 + laminaShiftX;
  const laminaCardWidthPct = 52 * laminaScale;
  const laminaCardLeftPx = laminaContentWidthPx * (1 - laminaCardWidthPct / 100);
  const laminaHorizontalLineWidthPct = laminaCompact
    ? ((laminaCardLeftPx + laminaOverlapPx - laminaHorizontalLineLeft) / laminaContentWidthPx) * 100
    : 46;
  const laminaCardMinHeight = Math.round(200 * laminaScale);
  const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString("ca-ES", { minimumFractionDigits: 2 }) : "");
  const extStairsLine =
    data.hasExteriorStairs && data.extStairsLength && data.extStairsWidth
      ? `Amb escala exterior de ${fmt(data.extStairsLength)}m x ${fmt(data.extStairsWidth)}m`
      : null;
  const bullets = [
    ...(isBloc
      ? [
          "Realització de llosa de formigó de 15-20cm de gruix al terra.",
          "Construcció d'encofrat exterior amb bloc 20x40x20.",
          "Subministrament i muntatge d'armadures a la solera i murs, amb barres d'acer corrugat.",
          "Re-omplert dels blocs amb formigó.",
          "Col·locació de tots els elements encastats: retorns, desaigües, etc.",
        ]
      : [
          "Construcció d'encofrat exterior amb totxana de 10 cm.",
          "Subministrament i estès de capa de pedra matxucada de 10 a 15 cm. de gruix al terra.",
          "Subministrament i muntatge d'armadures a la solera i murs, amb barres d'acer corrugat i malla.",
          "Col·locació de tots els elements encastats: retorns, desaigües, etc.",
          "Projectat del vas amb formigó via humida amb gunita 400 reforçada amb fibres.",
        ]),
    ...(showImpertot
      ? ["Impermeabilització de tot el vas de la piscina amb morter flexibe Impertot de la casa Fixcer."]
      : []),
    ...(data.poolDisposition === "semi_enterrada" || data.poolDisposition === "elevada"
      ? ["Regularitzar/Arrebossar parets exteriors vistes."]
      : []),
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

      {/* Divider — extends to the left page edge, thicker, navy */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: 6,
          background: "#2f4494",
          margin: "10mm 14mm 8mm 0",
          marginLeft: "-0mm",
          width: "calc(100% - 36mm)",
        }}
      />

      <div style={{ padding: "0 14mm", position: "relative", zIndex: 1 }}>
        {/* Section 1 pill — vertically centered */}
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
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>1.- CREACIÓ DE VAS D'OBRA</span>
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>{formatEuro(sectionAmount)}</span>
        </div>

        <div style={{ paddingLeft: 6, fontSize: "10.5pt", lineHeight: 1.6, marginBottom: "8mm" }}>
          {typeof data.poolLength === "number" && typeof data.poolWidth === "number" && (
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: "#2f4494", fontWeight: 700 }}>MIDES : </span>
              <span>
                {fmt(data.poolLength)}m x {fmt(data.poolWidth)}m
              </span>
              {extStairsLine && <span style={{ color: "#2f4494", marginLeft: 8 }}>{extStairsLine}</span>}
            </div>
          )}
          {typeof data.poolDepthMin === "number" && typeof data.poolDepthMax === "number" && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: "#2f4494", fontWeight: 700 }}>PROFUNDITAT : </span>
              <span>
                {fmt(data.poolDepthMin)}m - {fmt(data.poolDepthMax)}m
              </span>
            </div>
          )}
          <ul style={{ margin: 0, paddingLeft: 14, lineHeight: 1.6, listStyle: "none" }}>
            {bullets.map((t) => (
              <li key={t} style={{ marginBottom: 2 }}>
                <span style={{ marginRight: 6 }}>-</span>
                {t}
              </li>
            ))}
          </ul>

          {showLaminaProof && (
            <div style={{ marginTop: "6mm", position: "relative" }}>
              {/* Inclou text with check */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  marginBottom: 4,
                  position: "relative",
                  marginLeft: laminaShiftX,
                }}
              >
                <span style={{ color: "#ff751f", fontSize: "14pt", lineHeight: 1.2, fontWeight: 700 }}>✓</span>
                <div
                  style={{
                    color: "#ff751f",
                    fontWeight: 700,
                    fontSize: "10.5pt",
                    lineHeight: 1.4,
                    position: "relative",
                  }}
                >
                  Inclou: Làmina flexible impermeable especial per a piscines Proof FIXCER.
                  <div style={{ position: "relative", display: "inline-block" }}>
                    Soldat tèrmic i segellat amb resina Epoxi.
                  </div>
                  {/* Vertical line — drops from below "resina" with spacing */}
                  <div
                    style={{
                      position: "absolute",
                      left: 118,
                      top: "100%",
                      marginTop: 8,
                      width: 2,
                      height: 65,
                      backgroundColor: "#ff751f",
                    }}
                  />
                </div>
              </div>

              {/* Connector + card area */}
              <div style={{ position: "relative", minHeight: laminaCardMinHeight }}>
                {/* Horizontal line — connects vertical line to mid of white card */}
                <div
                  style={{
                    position: "absolute",
                    left: laminaHorizontalLineLeft,
                    top: 68,
                    height: 2,
                    width: `${laminaHorizontalLineWidthPct}%`,
                    backgroundColor: "#ff751f",
                  }}
                />

                {/* Right card */}
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    width: `${laminaCardWidthPct}%`,
                    backgroundColor: "#ffffff",
                    border: "1px solid #f0e7df",
                    borderRadius: 22,
                    padding: laminaCompact
                      ? `${Math.round(18 * laminaScale)}px ${Math.round(18 * laminaScale)}px ${Math.round(18 * laminaScale)}px ${Math.round(22 * laminaScale)}px`
                      : "18px 18px 18px 22px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                    minHeight: laminaCardMinHeight,
                  }}
                >
                  {/* Large floating double-check badge — top-left corner of card */}
                  <img
                    src="/pdf/check-double.png"
                    alt=""
                    crossOrigin="anonymous"
                    style={{
                      position: "absolute",
                      top: laminaCompact ? Math.round(-10 * laminaScale) : -10,
                      left: laminaCompact ? Math.round(-28 * laminaScale) : -28,
                      width: Math.round(64 * laminaScale),
                      height: Math.round(64 * laminaScale),
                      zIndex: 3,
                    }}
                  />

                  <div
                    style={{
                      color: "#ff751f",
                      fontWeight: 700,
                      fontSize: `${13 * laminaScale}pt`,
                      marginBottom: 10,
                      paddingLeft: 14,
                      textAlign: "left",
                      lineHeight: 1.2,
                    }}
                  >
                    Per què impermeabilitzar amb Làmina Proof?
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 14,
                      paddingRight: Math.round(95 * laminaScale),
                      lineHeight: 1.45,
                      fontSize: `${9 * laminaScale}pt`,
                      color: PDF_COLORS.textBody,
                      listStyle: "none",
                    }}
                  >
                    {[
                      "Làmina tri-capa amb dues capes de polipropilè i una de polipropilè amb un tèxtil especial que permet la col·locació de ceràmica amb ciment cola sense capes intermèdies.",
                      "Homologació i certificació per a classes de càrrega A1, A2 i C i per a les classes especificades ZDB.",
                      "Màxima resistència a bases, a l'aigua salada, als àcids i als microorganismes.",
                    ].map((t) => (
                      <li key={t} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 5 }}>
                        <span style={{ color: "#1a1a1a", fontSize: "10pt", lineHeight: 1.2, marginTop: 1 }}>•</span>
                        <span style={{ flex: 1 }}>{t}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Lamina image — larger, on bottom-right edge of card, sits over border */}
                  <img
                    src="/pdf/laminaproof.webp"
                    alt=""
                    crossOrigin="anonymous"
                    style={{
                      position: "absolute",
                      right: laminaCompact ? Math.round(-8 * laminaScale) : -8,
                      bottom: Math.round(8 * laminaScale),
                      width: Math.round(110 * laminaScale),
                      height: Math.round(150 * laminaScale),
                      objectFit: "contain",
                      zIndex: 2,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Decorative pool photo - bottom (vas.png) */}
      <img
        src="/pdf/vas.webp"
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

// Keep PDF_FONTS import referenced
void PDF_FONTS;
