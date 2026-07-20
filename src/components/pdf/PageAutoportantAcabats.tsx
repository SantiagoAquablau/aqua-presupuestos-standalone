/**
 * Piscina Autoportant — Page 3: acabats (corona + revestiment interior).
 * Shows the chosen finish name + real photo for each, plus a note explaining
 * the exterior finish behaviour according to the model.
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, pdfPageStyle } from "./pdfStyles";
import { PdfPageHeader, PdfHeaderRule } from "./PdfShared";

const NAVY = "#2f4494";

function FinishCard({
  title,
  name,
  family,
  image,
}: {
  title: string;
  name?: string;
  family?: string;
  image?: string;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 14,
        border: `1px solid ${NAVY}22`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          background: NAVY,
          color: "#FFFFFF",
          fontFamily: '"Tenor Sans", serif',
          fontSize: "13pt",
          letterSpacing: 2,
          textAlign: "center",
        }}
      >
        {title.toUpperCase()}
      </div>
      <div
        style={{
          height: "95mm",
          background: "#eeeeee",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {image ? (
          <img
            src={image}
            alt={name || title}
            crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#999",
              fontStyle: "italic",
              fontSize: "10pt",
            }}
          >
            sense imatge
          </div>
        )}
      </div>
      <div style={{ padding: "12px 16px", textAlign: "center" }}>
        <div
          style={{
            fontFamily: PDF_FONTS.sans,
            fontSize: "9pt",
            letterSpacing: 2,
            color: PDF_COLORS.textMuted,
            textTransform: "uppercase",
          }}
        >
          {family || "\u00a0"}
        </div>
        <div
          style={{
            fontFamily: '"Tenor Sans", serif',
            fontSize: "16pt",
            color: NAVY,
            letterSpacing: 1.5,
            marginTop: 2,
          }}
        >
          {name || "—"}
        </div>
      </div>
    </div>
  );
}

export function PageAutoportantAcabats({ data }: { data: PdfData }) {
  return (
    <section style={pdfPageStyle}>
      <PdfPageHeader title="ACABATS" />
      <PdfHeaderRule />

      <div style={{ padding: "0 14mm" }}>
        <p
          style={{
            fontSize: "10pt",
            color: PDF_COLORS.textBody,
            margin: "0 0 8mm 0",
            lineHeight: 1.5,
          }}
        >
          Aquesta és la selecció d'acabats per a la {data.autoportantModelName || "piscina"}.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10mm" }}>
          <FinishCard
            title="Coronació"
            name={data.autoportantCoronaName}
            family={data.autoportantCoronaFamily}
            image={data.autoportantCoronaImage}
          />
          <FinishCard
            title="Revestiment interior"
            name={data.autoportantRevestimentName}
            family={data.autoportantRevestimentFamily}
            image={data.autoportantRevestimentImage}
          />
        </div>

        {data.autoportantExteriorNote && (
          <div
            style={{
              marginTop: "10mm",
              padding: "14px 18px",
              background: `${NAVY}0d`,
              border: `1px solid ${NAVY}33`,
              borderRadius: 12,
              fontSize: "10.5pt",
              color: PDF_COLORS.textDark,
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontWeight: 700, color: NAVY }}>Revestiment exterior:</span>{" "}
            {data.autoportantExteriorNote}
          </div>
        )}
      </div>
    </section>
  );
}