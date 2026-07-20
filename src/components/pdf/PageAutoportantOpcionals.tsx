/**
 * Piscina Autoportant — Opcionals pages.
 *
 *  - `PageAutoportantOpcionalsSel`: only the opcionals selected in the
 *    wizard (with qty + total). Rendered BEFORE the Resum, blue theme —
 *    same header/pill/row pattern as PageAccessoris / PageDepuracio1.
 *  - `PageAutoportantOpcionalsAll`: full catalog of opcionals for the
 *    chosen model, without totals. Rendered AFTER the Resum when the
 *    client has not selected any opcional — orange theme identical to
 *    PageAnnexOpcionalsInstal (title #ff751f, navy divider, orange pill).
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, pdfPageStyle, formatEuro } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";

const NAVY = "#2f4494";
const ORANGE = "#ff751f";
const ORANGE_PILL = "#ff751f99";

export function PageAutoportantOpcionalsSel({ data }: { data: PdfData }) {
  const items = data.autoportantSelectedOpcionals || [];
  const total = items.reduce((s, it) => s + (it.total || 0), 0);
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
          OPCIONALS INCLOSOS
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
        <p
          style={{
            fontSize: "10pt",
            color: PDF_COLORS.textBody,
            margin: "0 0 6mm 0",
            lineHeight: 1.5,
          }}
        >
          Extres seleccionats per a la {data.autoportantModelName || "piscina"}. L'import està inclòs al
          Resum d'aquest pressupost.
        </p>

        <SectionPillTenor number="1" title="OPCIONALS INCLOSOS" amount={total} />

        {items.length === 0 ? (
          <div style={{ padding: "6mm 4mm", textAlign: "center", color: PDF_COLORS.textMuted, fontStyle: "italic" }}>
            No hi ha opcionals inclosos.
          </div>
        ) : (
          items.map((it, i) => (
            <OpcionalRow
              key={i}
              label={it.label}
              description={it.description}
              qty={it.qty}
              unit={it.unit}
              unitSale={it.unitSale}
              total={it.total}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function PageAutoportantOpcionalsAll({ data }: { data: PdfData }) {
  const items = data.autoportantAllOpcionals || [];
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
            color: ORANGE,
            letterSpacing: 4,
            margin: 0,
            lineHeight: 1,
          }}
        >
          OPCIONALS
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

        <SectionPillOrange number="1" title="OPCIONALS DISPONIBLES" />

        {items.length === 0 ? (
          <div style={{ padding: "6mm 4mm", textAlign: "center", color: PDF_COLORS.textMuted, fontStyle: "italic" }}>
            No hi ha opcionals disponibles.
          </div>
        ) : (
          items.map((it, i) => (
            <CatalegRow key={i} label={it.label} description={it.description} unit={it.unit} unitSale={it.unitSale} />
          ))
        )}
      </div>
    </section>
  );
}

/* ================== Rows ================== */
function OpcionalRow({
  label,
  description,
  qty,
  unit,
  unitSale,
  total,
}: {
  label: string;
  description?: string;
  qty: number;
  unit: string;
  unitSale: number;
  total: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 4mm",
        borderBottom: `1px dotted ${NAVY}33`,
        fontSize: "10pt",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: NAVY }}>{label}</div>
        {description && (
          <div style={{ fontSize: "8.5pt", color: PDF_COLORS.textMuted, marginTop: 2 }}>{description}</div>
        )}
        <div style={{ fontSize: "8.5pt", color: PDF_COLORS.textMuted, marginTop: 2 }}>
          {qty.toLocaleString("ca-ES")} {unit} × {formatEuro(unitSale)}
        </div>
      </div>
      <div style={{ flex: "0 0 30mm", textAlign: "right", fontWeight: 700, color: NAVY }}>{formatEuro(total)}</div>
    </div>
  );
}

function CatalegRow({
  label,
  description,
  unit,
  unitSale,
}: {
  label: string;
  description?: string;
  unit: string;
  unitSale: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 4mm",
        borderBottom: `1px dotted ${ORANGE}55`,
        fontSize: "10pt",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: NAVY }}>{label}</div>
        {description && (
          <div style={{ fontSize: "8.5pt", color: PDF_COLORS.textMuted, marginTop: 2 }}>{description}</div>
        )}
      </div>
      <div style={{ flex: "0 0 30mm", textAlign: "right", fontWeight: 700, color: ORANGE }}>
        {formatEuro(unitSale)}
        {unit === "ml" ? " / ml" : ""}
      </div>
    </div>
  );
}

/* ================== Pills ================== */
function SectionPillTenor({ number, title, amount }: { number: string; title: string; amount: number }) {
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
      <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>{formatEuro(amount)}</span>
    </div>
  );
}

function SectionPillOrange({ number, title }: { number: string; title: string }) {
  return (
    <div
      style={{
        backgroundColor: ORANGE_PILL,
        color: "#ffffff",
        borderRadius: 999,
        padding: "0 32px",
        minHeight: "44px",
        display: "flex",
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
    </div>
  );
}
