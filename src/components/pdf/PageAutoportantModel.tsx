/**
 * Piscina Autoportant — Page 2: model description.
 * Illustrative page (no amounts): model name, tagline, features list and
 * a large photo of the model on the right.
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, pdfPageStyle } from "./pdfStyles";
import { PdfPageHeader, PdfHeaderRule } from "./PdfShared";

const NAVY = "#2f4494";

export function PageAutoportantModel({ data }: { data: PdfData }) {
  const name = data.autoportantModelName || "—";
  const tagline = data.autoportantModelTagline || "";
  const features = data.autoportantModelFeatures || [];
  const image = data.autoportantModelImage;
  return (
    <section style={pdfPageStyle}>
      <PdfPageHeader title="MODEL" />
      <PdfHeaderRule />

      <div style={{ padding: "0 14mm", display: "flex", gap: "10mm", height: "calc(297mm - 55mm)" }}>
        <div style={{ flex: "0 0 92mm", display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: '"Tenor Sans", serif',
              fontSize: "26pt",
              color: NAVY,
              letterSpacing: 2,
              lineHeight: 1.05,
            }}
          >
            {name}
          </div>
          {tagline && (
            <div
              style={{
                fontFamily: PDF_FONTS.serif,
                fontStyle: "italic",
                fontSize: "12pt",
                color: PDF_COLORS.textMuted,
                marginTop: 4,
                marginBottom: 12,
              }}
            >
              {tagline}
            </div>
          )}
          <div
            style={{
              height: 3,
              background: NAVY,
              width: "40mm",
              margin: "4mm 0 6mm 0",
            }}
          />
          <div
            style={{
              fontSize: "10.5pt",
              fontWeight: 700,
              color: NAVY,
              marginBottom: 6,
              letterSpacing: 1,
            }}
          >
            CARACTERÍSTIQUES
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              fontSize: "10pt",
              lineHeight: 1.55,
              color: PDF_COLORS.textDark,
            }}
          >
            {features.map((f, i) => (
              <li key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    color: NAVY,
                    fontWeight: 900,
                    flex: "0 0 auto",
                    marginTop: 2,
                  }}
                >
                  ▸
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          {(data.autoportantAmple || data.autoportantLlarg || data.autoportantAlturaAigua) && (
            <div
              style={{
                marginTop: "auto",
                padding: "10px 14px",
                background: "#FFFFFF",
                borderRadius: 8,
                border: `1px solid ${NAVY}33`,
                fontSize: "10pt",
                color: NAVY,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4, letterSpacing: 1 }}>MIDES ESCOLLIDES</div>
              <div>Ample: {data.autoportantAmple || "—"}</div>
              <div>Llarg: {data.autoportantLlarg || "—"}</div>
              <div>Altura d'aigua: {data.autoportantAlturaAigua || "—"}</div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {image && (
            <img
              src={image}
              alt={name}
              crossOrigin="anonymous"
              style={{
                maxWidth: "100%",
                maxHeight: "220mm",
                objectFit: "contain",
                borderRadius: 8,
                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}