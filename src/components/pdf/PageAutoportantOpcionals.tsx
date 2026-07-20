/**
 * Piscina Autoportant — Opcionals pages.
 *
 *  - `PageAutoportantOpcionalsSel`: only the opcionals selected in the
 *    wizard (with qty + total). Rendered BEFORE the Resum, blue theme.
 *  - `PageAutoportantOpcionalsAll`: full catalog of opcionals for the
 *    chosen model, without totals. Rendered AFTER the Resum when the
 *    client has not selected any opcional (orange "OPCIONALS" theme,
 *    consistent with the general Opcionals pages).
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, pdfPageStyle, formatEuro } from "./pdfStyles";
import { PdfPageHeader, PdfHeaderRule } from "./PdfShared";

const NAVY = "#2f4494";
const ORANGE = "#e88a3a";

export function PageAutoportantOpcionalsSel({ data }: { data: PdfData }) {
  const items = data.autoportantSelectedOpcionals || [];
  const total = items.reduce((s, it) => s + (it.total || 0), 0);
  return (
    <section style={pdfPageStyle}>
      <PdfPageHeader title="OPCIONALS INCLOSOS" />
      <PdfHeaderRule />

      <div style={{ padding: "0 14mm" }}>
        <p
          style={{
            fontSize: "10pt",
            color: PDF_COLORS.textBody,
            margin: "0 0 6mm 0",
            lineHeight: 1.5,
          }}
        >
          Extres seleccionats per a la {data.autoportantModelName || "piscina"}. L'import està inclòs
          al Resum d'aquest pressupost.
        </p>

        <div
          style={{
            background: "#FFFFFF",
            borderRadius: 12,
            border: `1px solid ${NAVY}22`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 22mm 26mm 30mm",
              gap: 0,
              padding: "10px 16px",
              background: NAVY,
              color: "#FFFFFF",
              fontFamily: '"Tenor Sans", serif',
              fontSize: "10pt",
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            <div>Descripció</div>
            <div style={{ textAlign: "center" }}>Qtat.</div>
            <div style={{ textAlign: "right" }}>Preu / u.</div>
            <div style={{ textAlign: "right" }}>Total</div>
          </div>
          {items.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: PDF_COLORS.textMuted, fontStyle: "italic" }}>
              No hi ha opcionals inclosos.
            </div>
          ) : (
            items.map((it, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 22mm 26mm 30mm",
                  padding: "10px 16px",
                  borderTop: i === 0 ? "none" : `1px solid ${NAVY}18`,
                  fontSize: "10pt",
                  color: PDF_COLORS.textDark,
                  alignItems: "start",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: NAVY }}>{it.label}</div>
                  {it.description && (
                    <div style={{ fontSize: "8.5pt", color: PDF_COLORS.textMuted, marginTop: 2 }}>
                      {it.description}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "center" }}>
                  {it.qty.toLocaleString("ca-ES")} {it.unit}
                </div>
                <div style={{ textAlign: "right" }}>{formatEuro(it.unitSale)}</div>
                <div style={{ textAlign: "right", fontWeight: 700 }}>{formatEuro(it.total)}</div>
              </div>
            ))
          )}

          {items.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 30mm",
                padding: "10px 16px",
                borderTop: `2px solid ${NAVY}`,
                fontSize: "11pt",
                background: `${NAVY}0d`,
                color: NAVY,
                fontFamily: '"Tenor Sans", serif',
                letterSpacing: 1,
              }}
            >
              <div style={{ fontWeight: 700 }}>TOTAL OPCIONALS</div>
              <div style={{ textAlign: "right", fontWeight: 900 }}>{formatEuro(total)}</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function PageAutoportantOpcionalsAll({ data }: { data: PdfData }) {
  const items = data.autoportantAllOpcionals || [];
  return (
    <section style={{ ...pdfPageStyle, backgroundColor: "#fff8f1" }}>
      <PdfPageHeader title="OPCIONALS" />
      <div
        style={{
          height: 3,
          background: ORANGE,
          margin: "4mm 14mm 8mm 14mm",
        }}
      />

      <div style={{ padding: "0 14mm" }}>
        <div
          style={{
            display: "inline-block",
            background: PDF_COLORS.optionalGreen,
            color: PDF_COLORS.navy,
            borderRadius: 999,
            padding: "6px 22px",
            fontFamily: '"Tenor Sans", serif',
            fontSize: "12pt",
            letterSpacing: 2,
            marginBottom: "6mm",
            fontWeight: 700,
          }}
        >
          OPCIONALS PER AL CLIENT
        </div>

        <p
          style={{
            fontSize: "10pt",
            color: PDF_COLORS.textBody,
            margin: "0 0 6mm 0",
            lineHeight: 1.5,
          }}
        >
          Els següents extres estan disponibles per a la {data.autoportantModelName || "piscina"}. Consulta
          amb el teu comercial per afegir-los al pressupost.
        </p>

        <div
          style={{
            background: "#FFFFFF",
            borderRadius: 12,
            border: `1px solid ${ORANGE}55`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 22mm 30mm",
              padding: "10px 16px",
              background: ORANGE,
              color: "#FFFFFF",
              fontFamily: '"Tenor Sans", serif',
              fontSize: "10pt",
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            <div>Descripció</div>
            <div style={{ textAlign: "center" }}>Unitat</div>
            <div style={{ textAlign: "right" }}>Preu</div>
          </div>
          {items.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: PDF_COLORS.textMuted, fontStyle: "italic" }}>
              No hi ha opcionals disponibles.
            </div>
          ) : (
            items.map((it, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 22mm 30mm",
                  padding: "10px 16px",
                  borderTop: i === 0 ? "none" : `1px solid ${ORANGE}33`,
                  fontSize: "10pt",
                  color: PDF_COLORS.textDark,
                  alignItems: "start",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: PDF_COLORS.navy }}>{it.label}</div>
                  {it.description && (
                    <div style={{ fontSize: "8.5pt", color: PDF_COLORS.textMuted, marginTop: 2 }}>
                      {it.description}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "center" }}>{it.unit}</div>
                <div style={{ textAlign: "right", fontWeight: 700, color: PDF_COLORS.navy }}>
                  {formatEuro(it.unitSale)}
                  {it.unit === "ml" ? " / ml" : ""}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* keep font import referenced */}
      <span style={{ display: "none", fontFamily: PDF_FONTS.sans }} />
    </section>
  );
}