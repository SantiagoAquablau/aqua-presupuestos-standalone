/**
 * Piscina Autoportant — Page 2: model description.
 * Illustrative page (no amounts): model name, tagline, features list and
 * a large photo of the model on the right.
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";

const NAVY = "#2f4494";

export function PageAutoportantModel({ data }: { data: PdfData }) {
  const name = data.autoportantModelName || "—";
  const tagline = data.autoportantModelTagline || "";
  const features = data.autoportantModelFeatures || [];
  const image = data.autoportantModelImage;
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
            color: NAVY,
            letterSpacing: 4,
            margin: 0,
            lineHeight: 1,
          }}
        >
          MODEL
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

      <div style={{ padding: "0 14mm", display: "flex", flexDirection: "column", height: "calc(297mm - 55mm)" }}>
        <div>
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
        </div>

        <div style={{ display: "flex", gap: "8mm", flex: 1 }}>
          <div style={{ flex: "0 0 80mm", display: "flex", flexDirection: "column" }}>
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
                    •
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {(data.autoportantAmple || data.autoportantLlarg || data.autoportantAlturaAigua) && (
              <div
                style={{
                  marginTop: "6mm",
                  background: "#FFFFFF",
                  borderRadius: 12,
                  border: `1px solid ${NAVY}22`,
                  overflow: "hidden",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  style={{
                    padding: "7px 14px",
                    background: NAVY,
                    color: "#FFFFFF",
                    fontFamily: '"Tenor Sans", serif',
                    fontSize: "11pt",
                    letterSpacing: 2,
                  }}
                >
                  MIDES ESCOLLIDES
                </div>
                <div style={{ padding: "8px 14px" }}>
                  <MidaRow label="Ample" value={data.autoportantAmple} />
                  <MidaRow label="Llarg" value={data.autoportantLlarg} />
                  <MidaRow label="Altura d'aigua" value={data.autoportantAlturaAigua} last />
                </div>
              </div>
            )}
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
            {image && (
              <img
                src={image}
                alt={name}
                crossOrigin="anonymous"
                style={{
                  maxWidth: "100%",
                  maxHeight: "236mm",
                  objectFit: "contain",
                  borderRadius: 8,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                }}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function MidaRow({ label, value, last }: { label: string; value?: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "4px 0",
        borderBottom: last ? "none" : `1px dotted ${NAVY}33`,
        fontSize: "10pt",
      }}
    >
      <span style={{ color: PDF_COLORS.textMuted }}>{label}</span>
      <span style={{ fontWeight: 700, color: NAVY }}>{value || "—"}</span>
    </div>
  );
}