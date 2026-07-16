/**
 * Compact "RESUM" page for annex PDFs. Lists each block with its subtotal and
 * shows the annex grand total (which already includes `global_pct`).
 */
import { PDF_COLORS, PDF_FONTS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";

const NAVY = "#2f4494";

export interface AnnexResumRow {
  label: string;
  value: number;
}

export interface PageAnnexResumProps {
  annexNumber: string;
  budgetNumber?: string;
  rows: AnnexResumRow[];
  total: number;
  globalPct?: number;
  reason?: string;
}

export function PageAnnexResum({
  annexNumber,
  budgetNumber,
  rows,
  total,
  globalPct,
  reason,
}: PageAnnexResumProps) {
  return (
    <section style={{ ...pdfPageStyle, position: "relative", overflow: "hidden" }}>
      {/* Full-height background (pool photo + GDPR text) */}
      <img
        src="/pdf/resum-bg.webp"
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
        <div style={{ width: 85 }} />
        <h1
          style={{
            fontFamily: '"Tenor Sans", serif',
            fontWeight: 400,
            fontSize: "46pt",
            color: NAVY,
            letterSpacing: 4,
            margin: 0,
            lineHeight: 1,
            textAlign: "center",
            flex: 1,
          }}
        >
          RESUM
        </h1>
        <PdfLogo size={85} />
      </div>

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
            margin: "0 0 8mm 0",
            fontWeight: 400,
          }}
        >
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>
            ANNEX {annexNumber}
          </span>
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px", fontWeight: 700 }}>
            {formatEuro(total)}
          </span>
        </div>

        {reason && (
          <p
            style={{
              fontSize: "10.5pt",
              color: NAVY,
              fontStyle: "italic",
              margin: "0 0 6mm 0",
              lineHeight: 1.45,
            }}
          >
            {reason}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", marginTop: "6mm" }}>
          <div style={{ flex: "0 0 110mm" }}>
            {rows.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "6px 4px",
                  borderBottom: "1px dotted rgba(47,68,148,0.35)",
                  fontFamily: '"Tenor Sans", serif',
                  fontSize: "12pt",
                  color: NAVY,
                  letterSpacing: 1,
                }}
              >
                <span>{r.label.toUpperCase()}</span>
                <span style={{ fontFamily: '"Tenor Sans", serif', fontWeight: 700, color: "#1F3D6B" }}>
                  {formatEuro(r.value)}
                </span>
              </div>
            ))}
            {globalPct ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "6px 4px",
                  fontSize: "10pt",
                  color: "#5A5A5A",
                  fontStyle: "italic",
                }}
              >
                <span>
                  {globalPct > 0 ? "Increment global" : "Descompte global"} ({globalPct > 0 ? "+" : ""}
                  {globalPct.toLocaleString("ca-ES", { maximumFractionDigits: 2 })}%)
                </span>
                <span>aplicat al total</span>
              </div>
            ) : null}
          </div>

          <div style={{ flex: 1, height: 3, background: NAVY }} />

          <div
            style={{
              flex: "0 0 auto",
              marginLeft: -2,
              fontFamily: '"Tenor Sans", serif',
            }}
          >
            <div
              style={{
                backgroundColor: PDF_COLORS.badgePill,
                color: NAVY,
                borderRadius: 999,
                padding: "10px 26px",
                textAlign: "center",
                border: "3px solid #314695",
                boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              }}
            >
              <div style={{ fontSize: "18pt", letterSpacing: 3, lineHeight: 1, marginTop: "-12px" }}>TOTAL</div>
              <div style={{ fontSize: "10pt", letterSpacing: 2, marginTop: 2, fontWeight: 600 }}>ANNEX</div>
              <div style={{ fontSize: "15pt", marginTop: -4, fontWeight: 900 }}>
                {formatEuro(total)}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: "9pt",
            fontWeight: 700,
            lineHeight: 1.4,
            marginTop: "10mm",
            color: "#404040",
            fontStyle: "italic",
          }}
        >
          <div>Aquests preus no inclouen l'IVA. Es facturarà el vigent.</div>
          <div>L'acceptació d'aquest annex implica la incorporació al pressupost principal.</div>
        </div>

        <p style={{ fontSize: "9pt", fontStyle: "italic", lineHeight: 1.45, marginTop: "5mm", marginBottom: 6 }}>
          *La validesa d'aquest pressupost és de 30 dies amb excepció de possibles increments establerts per els
          proveïdors en cas d'augment de tarifes i seguint la tendència actual. Davant d'aquest escenari es
          re-calcularà la part corresponent.
        </p>
        <p style={{ fontSize: "9pt", fontStyle: "italic", lineHeight: 1.45, margin: 0 }}>
          Si els preus donats han estat calculats en base a la informació facilitada per el propietari, en cas de
          trobar qualsevol impediment, situacions que calgui adaptar o modificar, o diferències notòries a les
          mides calculades, aquest es tornarà a valorar un cop s'hagi comprovat tot in situ.
        </p>

        {/* CONDICIONS DE PAGAMENT */}
        <div style={{ marginTop: "7mm" }}>
          <div
            style={{
              backgroundColor: PDF_COLORS.badgePill,
              color: NAVY,
              borderRadius: 999,
              padding: "0 32px",
              minHeight: "44px",
              display: "flex",
              alignItems: "center",
              fontFamily: '"Tenor Sans", serif',
              fontSize: "14pt",
              letterSpacing: 1,
              fontWeight: 400,
            }}
          >
            <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>
              CONDICIONS DE PAGAMENT
            </span>
          </div>
          {budgetNumber && (
            <p
              style={{
                marginTop: "4mm",
                fontSize: "10pt",
                color: "#1a1a1a",
                fontWeight: 600,
              }}
            >
              Annexat a pressupost Ref. {budgetNumber}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

void PDF_FONTS;