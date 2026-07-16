/**
 * Annex — Paviment perimetral.
 * Opcional variant: shows the three pricing options (compactació, aplacat porcellànic,
 * tarima sintètica) as a static price list. Inclos variant TBD.
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";
import { annexEnumPrefix, AnnexGrandTotalBadge, type AnnexInclosProps } from "./PdfAnnexShared";

const ORANGE = "#ff751f";
const ORANGE_PILL = "#ff751f99";
const NAVY = "#2f4494";

function fmtEuro(n: number): string {
  return (
    new Intl.NumberFormat("ca-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n || 0) + " €"
  );
}

function formatMides(format?: string): string {
  if (!format) return "";
  // "31 × 62 cm" → "31 cm x 62 cm"
  const m = format.match(/(\d+)\s*[×x]\s*(\d+)/);
  if (!m) return format;
  return `${m[1]} cm x ${m[2]} cm`;
}

export function PageAnnexPaviment({
  data,
  variant,
  annexIndex,
  annexTotalCount,
  isLastAnnex,
  annexGrandTotal,
}: { data: PdfData; variant: "inclos" | "opcional" } & AnnexInclosProps) {
  const isOpcional = variant === "opcional";
  const titleColor = isOpcional ? ORANGE : NAVY;
  const pillBg = isOpcional ? ORANGE_PILL : PDF_COLORS.badgePill;
  const pillText = isOpcional ? "#ffffff" : NAVY;
  const enumPx = isOpcional ? "" : annexEnumPrefix(annexIndex, annexTotalCount);

  // OPCIONAL: static catalogue of 3 prices
  const opcionalRows: { label: string; price: string }[] = [
    {
      label: "Compactació i formació de llosa de formigó de 10 - 15 cm de gruix",
      price: "47,00 €/m²",
    },
    {
      label: "Subministrament i aplacat de paviment amb porcellànic de la casa Rosa Gres mides 31 cm x 62 cm.",
      price: "89,00 €/m²",
    },
    {
      label: "Subministrament i col·locació de tarima de fusta tecnològica sintètica.",
      price: "155,00 €/m²",
    },
  ];

  // INCLOS: build dynamic rows from wizard data
  type Row = { label: string; total: number };
  const inclosRows: Row[] = [];
  let inclosSubtitle = "Compactació, formació de llosa i aplacat amb porcellànic de zona perimetral de la piscina.";

  if (!isOpcional) {
    const reforma = !!data.annexPavimentReformaEnabled;
    const retirada = reforma && !!data.annexPavimentRetiradaEnabled;
    const regular = reforma && !!data.annexPavimentRegularitzacioEnabled;
    const nou = !!data.annexPavimentNouEnabled;
    const formigo = nou && !!data.annexPavimentFormigoEnabled && !reforma;
    const material = data.annexPavimentMaterial; // 'aplacat' | 'fusta'
    const actuacio = data.annexPavimentActuacio; // 'suministre_col' | 'col' | 'suministre'
    const mides = formatMides(data.annexPavimentFormat);
    const model = data.annexPavimentModelName || "a determinar";
    const m2Paviment = Number(data.annexPavimentM2 || 0);
    const m2Formigo = Number(data.annexPavimentFormigoM2 || 0);
    const m2Retirada = Number(data.annexPavimentRetiradaM2 || 0);
    const m2Regular = Number(data.annexPavimentRegularitzacioM2 || 0);

    // Build subtitle
    if (reforma && nou) {
      if (material === "fusta") {
        inclosSubtitle =
          "Regularització de llosa existent i realització de tarima de fusta tecnològica de zona perimetral de la piscina.";
      } else {
        inclosSubtitle = "Regularització de llosa existent i aplacat amb porcellànic de zona perimetral de la piscina.";
      }
    } else if (nou && formigo) {
      if (material === "fusta") {
        inclosSubtitle =
          "Compactació, formació de llosa i realització de tarima de fusta tecnològica de zona perimetral de la piscina.";
      } else {
        inclosSubtitle = "Compactació, formació de llosa i aplacat amb porcellànic de zona perimetral de la piscina.";
      }
    } else if (nou && !formigo && !reforma) {
      // Paviment nou directly over existing
      if (material === "fusta") {
        inclosSubtitle = "Realització de tarima de fusta tecnològica de zona perimetral de la piscina.";
      } else {
        inclosSubtitle = "Aplacat amb porcellànic de zona perimetral de la piscina.";
      }
    }

    // Build rows in order
    if (retirada) {
      inclosRows.push({
        label: `Picar per retirar ${m2Retirada}m² de ceràmica existent.`,
        total: Number(data.annexPavimentRetiradaTotal || 0),
      });
    }
    if (regular) {
      inclosRows.push({
        label: `Regularitzar superfície de ${m2Regular}m².`,
        total: Number(data.annexPavimentRegularitzacioTotal || 0),
      });
    }
    if (formigo) {
      inclosRows.push({
        label: `Compactació i formació ${m2Formigo}m² de llosa de formigó de 10 - 15 cm de gruix.`,
        total: Number(data.annexPavimentFormigoTotal || 0),
      });
    }
    if (nou) {
      let actLabel = "Subministrament i aplacat de";
      if (material === "fusta") {
        if (actuacio === "col") actLabel = "Col·locació de";
        else if (actuacio === "suministre") actLabel = "Subministrament de";
        else actLabel = "Subministrament i col·locació de";
        inclosRows.push({
          label: `${actLabel} ${m2Paviment}m² de tarima de fusta tecnològica sintètica.`,
          total: Number(data.annexPavimentNouTotal || 0),
        });
      } else {
        if (actuacio === "col") actLabel = "Col·locació de";
        else if (actuacio === "suministre") actLabel = "Subministrament de";
        else actLabel = "Subministrament i aplacat de";
        const modelPart = ` Model: ${model}.`;
        const is31 = /31\s*[×x]\s*31/i.test(data.annexPavimentFormat || "");
        const label = is31
          ? `${actLabel} ${m2Paviment}m² de paviment de gres extrusionat natural.${modelPart}`
          : `${actLabel} ${m2Paviment}m² de paviment amb porcellànic de la casa Rosa Gres mides ${mides || "—"}.${modelPart}`;
        inclosRows.push({
          label,
          total: Number(data.annexPavimentNouTotal || 0),
        });
      }
    }
  }

  const pillAmount = !isOpcional ? Number(data.annexPavimentAmount || 0) : null;

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
            color: titleColor,
            letterSpacing: 4,
            margin: 0,
            lineHeight: 1,
          }}
        >
          {isOpcional ? "OPCIONAL" : "ANNEX"}
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
        {/* Pill — PAVIMENT PERIMETRAL */}
        <div
          style={{
            backgroundColor: pillBg,
            color: pillText,
            borderRadius: 999,
            padding: "0 32px",
            minHeight: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: '"Tenor Sans", serif',
            fontSize: "14pt",
            letterSpacing: 1,
            margin: "0 0 6mm 0",
            fontWeight: 400,
          }}
        >
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>{enumPx}PAVIMENT PERIMETRAL</span>
          {pillAmount !== null && (
            <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>{fmtEuro(pillAmount)}</span>
          )}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: "10.5pt",
            lineHeight: 1.4,
            color: NAVY,
            marginBottom: "6mm",
            paddingLeft: 6,
            fontWeight: 700,
          }}
        >
          {isOpcional
            ? "Compactació, formació de llosa i aplacat amb porcellànic de zona perimetral de la piscina."
            : inclosSubtitle}
        </div>

        {/* Rows */}
        <div style={{ paddingLeft: 6, marginBottom: "6mm" }}>
          {isOpcional
            ? opcionalRows.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 16,
                    fontSize: "10.5pt",
                    lineHeight: 1.45,
                    color: PDF_COLORS.textBody,
                    marginBottom: 6,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ marginRight: 6 }}>·</span>
                    {r.label}
                  </div>
                  <div
                    style={{
                      fontWeight: 700,
                      color: PDF_COLORS.textDark,
                      whiteSpace: "nowrap",
                      minWidth: 90,
                      textAlign: "right",
                    }}
                  >
                    {r.price}
                  </div>
                </div>
              ))
            : inclosRows.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 16,
                    fontSize: "10.5pt",
                    lineHeight: 1.45,
                    color: PDF_COLORS.textBody,
                    marginBottom: 6,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ marginRight: 6 }}>·</span>
                    {r.label}
                  </div>
                  <div
                    style={{
                      fontWeight: 700,
                      color: PDF_COLORS.textDark,
                      whiteSpace: "nowrap",
                      minWidth: 90,
                      textAlign: "right",
                    }}
                  >
                    {fmtEuro(r.total)}
                  </div>
                </div>
              ))}
        </div>

        {/* Note (opcional only) */}
        {isOpcional && (
          <div
            style={{
              fontSize: "10pt",
              fontStyle: "italic",
              color: NAVY,
              paddingLeft: 6,
            }}
          >
            *Preus subjectes a un mínim de m2, per a altres condicions caldrà estudiar cada cas.
          </div>
        )}
      </div>
      {!isOpcional && isLastAnnex && <AnnexGrandTotalBadge total={annexGrandTotal || 0} />}

      <img
        src="/pdf/fondo_paviment.webp"
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
