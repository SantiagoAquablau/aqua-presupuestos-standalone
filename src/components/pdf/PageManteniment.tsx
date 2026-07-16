/**
 * Maintenance budget — page 2 ("MANTENIMENT").
 * Shows the service pill, grouped visit periods, season totals and kit info.
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";

const NAVY = "#2f4494";

const POOL_TYPE_LABEL: Record<string, string> = {
  particular: "particular",
  comunitaria: "comunitària",
};

export function PageManteniment({ data }: { data: PdfData }) {
  const tipus = data.poolType ? POOL_TYPE_LABEL[data.poolType].toUpperCase() : "";
  const pillTitle = tipus ? `SERVEI MANTENIMENT ANUAL PISCINA ${tipus}` : "SERVEI MANTENIMENT ANUAL PISCINA";
  const lines = data.maintenanceVisitText || [];
  const isComunitaria = data.poolType === "comunitaria";
  const kitObligacio = isComunitaria ? "És obligatori" : "És necessari";
  const kitTotal = data.maintenanceKitTotal || 0;
  const totalAnual = data.maintenanceTotalAnual || 0;
  const totalMensual = data.maintenanceTotalMensual ?? (totalAnual / 12);

  return (
    <section style={{ ...pdfPageStyle, backgroundColor: PDF_COLORS.beige }}>
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
          MANTENIMENT
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
          marginLeft: 0,
          width: "calc(100% - 36mm)",
        }}
      />

      <div style={{ padding: "0 14mm", position: "relative", zIndex: 1 }}>
        {/* Service pill (no amount) */}
        <div
          style={{
            backgroundColor: PDF_COLORS.badgePill,
            color: NAVY,
            borderRadius: 999,
            padding: "0 32px",
            minHeight: "44px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontFamily: '"Tenor Sans", serif',
            fontSize: "13pt",
            letterSpacing: 1,
            margin: "0 0 8mm 0",
            fontWeight: 400,
            textAlign: "center",
          }}
        >
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>{pillTitle}</span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            color: NAVY,
            fontFamily: '"Tenor Sans", serif',
            fontSize: "13pt",
            letterSpacing: 2,
            marginBottom: "4mm",
            fontWeight: 600,
          }}
        >
          CONDICIONS DEL SERVEI:
        </div>

        <p
          style={{
            fontSize: "10.5pt",
            lineHeight: 1.55,
            color: "#2a2a2a",
            margin: "0 0 5mm 0",
          }}
        >
          La freqüència de visites ve condicionada per la temporada de bany i quedarà definida amb la següent
          regularitat:
        </p>

        {/* Visit periods */}
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 0 8mm 0",
            fontSize: "11pt",
            lineHeight: 1.7,
            color: "#1a1a1a",
          }}
        >
          {lines.length === 0 ? (
            <li style={{ fontStyle: "italic", color: "#666" }}>No s'han definit visites en el pla de manteniment.</li>
          ) : (
            lines.map((l, i) => (
              <li key={i} style={{ display: "flex", gap: 8 }}>
                <span style={{ color: NAVY, fontWeight: 900 }}>·</span>
                <span>{l}</span>
              </li>
            ))
          )}
        </ul>

        {/* Totals block */}
        <div
          style={{
            fontSize: "11pt",
            lineHeight: 1.7,
            color: "#1a1a1a",
            marginBottom: "8mm",
          }}
        >
          <div style={{ fontWeight: 300 }}>IMPORT TOTAL DE TEMPORADA: {formatEuro(totalAnual)}</div>
          <div style={{ fontWeight: 700 }}>TOTAL MENSUAL: {formatEuro(totalMensual)} (en dotze mensualitats)</div>
        </div>

        {/* Kit de neteja */}
        <div
          style={{
            fontSize: "10.5pt",
            lineHeight: 1.55,
            color: "#1a1a1a",
            marginBottom: "10mm",
          }}
        >
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 4, letterSpacing: 1 }}>KIT DE NETEJA:</div>
          <p style={{ margin: 0 }}>
            <strong>{kitObligacio}</strong> disposar d'un kit bàsic de neteja (mànega, perxa, raspall, recollidor de
            fulles, raspall de fons, etc.) per al manteniment de la piscina.
          </p>
          <p style={{ margin: "6px 0 0" }}>
            Si no disposeu del kit, l'hem de proporcionar per poder desenvolupar la nostra tasca i suposa{" "}
            <strong>un pagament únic de {formatEuro(kitTotal)}</strong> (no inclòs en la quota mensual). Si ja el teniu,
            no hi haurà cap cost addicional.
          </p>
        </div>

        {/* Total badge */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6mm" }}>
          <div
            style={{
              backgroundColor: PDF_COLORS.badgePill,
              color: NAVY,
              borderRadius: 999,
              padding: "10px 26px",
              textAlign: "center",
              border: "3px solid #314695",
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              fontFamily: '"Tenor Sans", serif',
              minWidth: "80mm",
            }}
          >
            <div style={{ fontSize: "12pt", letterSpacing: 2, lineHeight: 1, marginTop: "-6px" }}>
              IMPORT TOTAL MANTENIMENT
            </div>
            <div style={{ fontSize: "10pt", letterSpacing: 2, marginTop: 2, fontWeight: 600 }}>TEMPORADA</div>
            <div style={{ fontSize: "16pt", marginTop: 2, fontWeight: 900 }}>{formatEuro(totalAnual)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

void PDF_FONTS;
