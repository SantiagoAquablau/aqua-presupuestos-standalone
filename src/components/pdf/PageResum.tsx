/**
 * Page 9 — RESUM
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, formatEuro } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";
import { DEFAULT_OBRA_NUEVA_PAYMENT_CONDITIONS } from "@/lib/paymentConditions";

const NAVY = "#2f4494";

const pageStyle: React.CSSProperties = {
  position: "relative",
  width: "210mm",
  height: "297mm",
  background: "#efe9e5",
  fontFamily: PDF_FONTS.sans,
  color: PDF_COLORS.textBody,
  overflow: "hidden",
  boxSizing: "border-box",
};

export function PageResum({ data }: { data: PdfData }) {
  const isM = !!data.isMaintenance;
  if (isM) return <MaintenanceResum data={data} />;
  const isA = !!data.isAutoportant;
  const hasManualMaterialEntry = !!data.hasManualMaterialEntry;
  const manualMaterialEntrySale = hasManualMaterialEntry ? data.manualMaterialEntrySale || 0 : 0;
  const annexTotal = data.phaseAnnexTotal || 0;
  // The ANNEX pill excludes the manual material entry — it gets its own line below.
  const annexDisplayTotal = Math.max(0, annexTotal - manualMaterialEntrySale);
  const rawRows: Array<{ label: string; value: number }> = isA
    ? [{ label: "PISCINA AUTOPORTANT", value: data.totalSale || 0 }]
    : [
        { label: "ESTRUCTURA", value: data.phaseStructuralTotal || 0 },
        { label: "ACABATS", value: data.phaseAcabatsTotal || 0 },
        { label: "INSTAL·LACIONS", value: (data.instalacionsTotal ?? data.phaseElectricitatTotal) || 0 },
        ...(annexDisplayTotal > 0 ? [{ label: "ANNEX", value: annexDisplayTotal }] : []),
        ...(hasManualMaterialEntry && manualMaterialEntrySale > 0
          ? [{ label: "ENTRADA DE MATERIAL A MÀ", value: manualMaterialEntrySale }]
          : []),
      ];
  const rows = rawRows.filter((r) => r.value > 0);
  const total = data.totalSale || rows.reduce((s, r) => s + r.value, 0);

  const paymentLines = data.paymentConditions
    ? data.paymentConditions.split("\n")
    : DEFAULT_OBRA_NUEVA_PAYMENT_CONDITIONS.split("\n");

  return (
    <section style={pageStyle}>
      {/* Full-height background image (contains pool photo + GDPR text) */}
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
        {/* Top row: phase totals + TOTAL PISCINA badge */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "6mm" }}>
          <div style={{ flex: "0 0 95mm" }}>
            {rows.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "6px 4px",
                  borderBottom: `1px dotted rgba(47,68,148,0.35)`,
                  fontFamily: '"Tenor Sans", serif',
                  fontSize: "12pt",
                  color: NAVY,
                  letterSpacing: 1,
                }}
              >
                <span>{r.label}</span>
                <span style={{ fontFamily: '"Tenor Sans", serif', fontWeight: 700, color: "#1F3D6B" }}>
                  {formatEuro(r.value)}
                </span>
              </div>
            ))}
          </div>

          <div style={{ flex: 1, height: 3, background: NAVY }} />

          <div
            style={{
              flex: "0 0 auto",
              marginLeft: -2,
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              gap: 6,
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
              <div style={{ fontSize: "10pt", letterSpacing: 2, marginTop: 2, fontWeight: 600 }}>PISCINA</div>
              <div style={{ fontSize: "15pt", marginTop: -4, fontWeight: 900 }}>{formatEuro(Math.round(total))}</div>
            </div>

            {typeof data.totalSaleAfterDiscount === "number" && data.discountPct ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "2px 8px 0",
                  lineHeight: 1.15,
                  color: "#b03636",
                }}
              >
                <div style={{ fontSize: "11pt", letterSpacing: 2, fontWeight: 700 }}>TOTAL AMB DESCOMPTE</div>
                <div style={{ fontSize: "15pt", fontWeight: 900, marginTop: 3 }}>
                  {formatEuro(Math.round(data.totalSaleAfterDiscount))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Terms block */}
        <div
          style={{
            fontSize: "9pt",
            fontWeight: 700,
            lineHeight: 1.3,
            marginTop: "4mm",
            color: "#404040",
            fontStyle: "italic",
          }}
        >
          <div>Aquests preus no inclouen l'IVA. Es facturarà el vigent.</div>
          <div>La garantia en el vas és de 10 anys</div>
          <div>La garantia en la depuració (filtre, bomba…) és de 3 anys</div>
        </div>

        {/* Disclaimers */}
        <p style={{ fontSize: "9pt", fontStyle: "italic", lineHeight: 1.45, marginTop: "5mm", marginBottom: 6 }}>
          *La validesa d'aquest pressupost és de 30 dies amb excepció de possibles increments establerts per els
          proveïdors en cas d'augment de tarifes i seguint la tendència actual. Davant d'aquest escenari es re-calcularà
          la part corresponent.
        </p>
        <p style={{ fontSize: "9pt", fontStyle: "italic", lineHeight: 1.45, margin: 0 }}>
          Si els preus donats han estat calculats en base a la informació facilitada per el propietari, en cas de trobar
          qualsevol impediment, situacions que calgui adaptar o modificar, o diferències notòries a les mides
          calculades, aquest es tornarà a valorar un cop s'hagi comprovat tot in situ.
        </p>

        {/* CONDICIONS DE PAGAMENT — Tenor pill */}
        <div style={{ marginTop: "7mm" }}>
          <PillTenor title="CONDICIONS DE PAGAMENT" />
        </div>

        {/* Two columns: payments % (left) + exclusions + icon (right) */}
        <div style={{ display: "flex", gap: "8mm", marginTop: "4mm", alignItems: "flex-start" }}>
          {/* Left: percentages */}
          <div style={{ flex: "0 0 70mm" }}>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                fontSize: "9pt",
                lineHeight: 1.8,
                color: "#1a1a1a",
              }}
            >
              {paymentLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>

          {/* Right: exclusions */}
          {!isA && (
            <div style={{ flex: 1, display: "flex", alignItems: "flex-start", gap: "6mm" }}>
              <div
                style={{
                  flex: "0 0 320px",
                  marginLeft: "-8mm",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                    fontSize: "9pt",
                    fontWeight: 700,
                    color: "#1a1a1a",
                    width: "220px",
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      //borderRadius: 3,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      //background: "#bdbdbd",
                      color: "#bdbdbd",
                      fontSize: "9pt",
                      fontWeight: 900,
                      lineHeight: 1,
                      //marginTop: "10px",
                      marginLeft: "-10px",
                    }}
                  >
                    ×
                  </span>
                  <span>No s'inclou en aquesta oferta:</span>
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    fontSize: "9pt",
                    lineHeight: 1.5,
                    color: "#1a1a1a",
                    width: "200px",
                  }}
                >
                  {[
                    { strong: "Permisos d'obres i llicències", rest: " o taxes municipals." },
                    {
                      strong: "Despeses financeres",
                      rest: " derivades de mitjans de pagament confirming o serveis equivalent.",
                    },
                  ].map((it, i) => (
                    <li key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                      <span style={{ color: "#ff751f", fontWeight: 900 }}>·</span>
                      <span>
                        <strong style={{ color: "#ff751f" }}>{it.strong}</strong>
                        {it.rest}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div
                style={{
                  position: "absolute",
                  top: 428,
                  left: 550,
                  //left: "-248px",
                  width: 50,
                  height: 50,
                  background: "#f6c5af",
                  borderRadius: 12,
                  zIndex: -1,
                }}
              />

              {/* Papers icon */}
              <img
                src="/pdf/simbolo-papeles.webp"
                crossOrigin="anonymous"
                alt=""
                style={{
                  width: 70,
                  height: "auto",
                  flex: "0 0 auto",
                  marginTop: -4,
                  marginLeft: -120,
                  zIndex: 1,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PillTenor({ title }: { title: string }) {
  return (
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
      <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>{title}</span>
    </div>
  );
}

function MaintenanceResum({ data }: { data: PdfData }) {
  const totalAnual = data.maintenanceTotalAnual || 0;
  const totalMensual = data.maintenanceTotalMensual ?? (totalAnual / 12);
  return (
    <section style={pageStyle}>
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
          marginLeft: "0mm",
          width: "calc(100% - 36mm)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "8mm 24mm 0 24mm",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            padding: "10px 4px",
            borderBottom: `1px dotted rgba(47,68,148,0.35)`,
            fontFamily: '"Tenor Sans", serif',
            fontSize: "13pt",
            color: "#1a1a1a",
            letterSpacing: 1,
          }}
        >
          <strong>TOTAL SERVEI ANUAL</strong>
          <span style={{ fontWeight: 700 }}>{formatEuro(totalAnual)}</span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            padding: "14px 4px 6px",
            fontFamily: '"Tenor Sans", serif',
            fontSize: "15pt",
            color: NAVY,
            letterSpacing: 1,
          }}
        >
          <span style={{ fontWeight: 800 }}>
            TOTAL MENSUAL
            <div
              style={{
                fontSize: "8.5pt",
                fontStyle: "italic",
                fontWeight: 400,
                color: "#404040",
                marginTop: 2,
              }}
            >
              *en dotze mensualitats
            </div>
          </span>
          <span style={{ fontWeight: 900 }}>{formatEuro(totalMensual)}</span>
        </div>

        <div
          style={{
            marginTop: "12mm",
            textAlign: "left",
            fontSize: "9.5pt",
            fontStyle: "italic",
            lineHeight: 1.55,
            color: "#1a1a1a",
          }}
        >
          <p style={{ margin: "0 0 4mm 0" }}>
            * La validesa d'aquest pressupost és de 30 dies ençà la data indicada a la capçalera.
          </p>
          <p style={{ margin: "0 0 4mm 0" }}>
            * En cas de contractar el servei de manteniment, la durada mínima serà la establerta en les visites
            descrites, havent d'abonar tot l'import estipulat a la signatura del mateix en cas d'abandonar-lo abans per
            circumstàncies no justificades. En cas de voler continuar passada la temporada d'estiu caldrà re-calcular la
            oferta.
          </p>
          <p style={{ margin: "0 0 4mm 0" }}>
            * Si els preus donats han estat calculats en base a la informació facilitada per el propietari, en cas de
            trobar qualsevol impediment, situacions que calgui adaptar o modificar, o diferencies notòries a les mides
            calculades, aquest es tornarà a valorar un cop s'hagi comprovat tot in situ.
          </p>
          <p style={{ margin: 0, fontWeight: 700 }}>
            <em>Aquests preus no inclouen l'I.V.A., que es facturarà el vigent.</em>
          </p>
        </div>
      </div>
    </section>
  );
}
