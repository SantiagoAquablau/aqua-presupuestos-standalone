/**
 * Annex — CLIMATITZACIÓ (Bomba de calor)..jpg
 * Variants: "inclos" (navy) and "opcional" (orange + "+" prefix).
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";
import { annexEnumPrefix, AnnexGrandTotalBadge, type AnnexInclosProps } from "./PdfAnnexShared";

const NAVY = "#2f4494";
const ORANGE = "#ff751f99";

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ca-ES", { day: "2-digit", month: "long" });
}

export function PageAnnexBombaCalor({
  data,
  variant,
  annexIndex,
  annexTotalCount,
  isLastAnnex,
  annexGrandTotal,
}: { data: PdfData; variant: "inclos" | "opcional" } & AnnexInclosProps) {
  const isOpcional = variant === "opcional";
  const titleColor = isOpcional ? "#ff751f" : NAVY;
  const pillBg = isOpcional ? ORANGE : PDF_COLORS.badgePill;
  const pillText = isOpcional ? "#ffffff" : NAVY;
  const prefix = isOpcional ? "+ " : "";
  const enumPx = isOpcional ? "" : annexEnumPrefix(annexIndex, annexTotalCount);

  const hasCover = data.annexBombaCalorCoberta === true;
  const name = data.annexBombaCalorName || "A determinar";
  const amount = data.annexBombaCalorAmount ?? 0;
  const temp = data.annexBombaCalorTemperatura ?? 27;
  const desde = formatDate(data.annexBombaCalorDesde);
  const finsA = formatDate(data.annexBombaCalorFinsA);

  const subtitle = hasCover
    ? "BOMBA DE CALOR PER ALLARGAR TEMPORADA (AMB COBERTA*)"
    : "BOMBA DE CALOR PER ALLARGAR TEMPORADA (SENSE COBERTA*)";

  const bullets: { strong?: string; rest: string }[] = [
    { strong: "BOMBA DE CALOR", rest: ` ${name}` },
    { rest: "Formació de llosa de formigó per a recolzar la bomba de calor." },
    { rest: "Protecció elèctrica i maniobra per a bomba de calor." },
    { rest: `Període d'utilització des de ${desde} fins a ${finsA}.` },
    { rest: `Temperatura desitjada de l'aigua de ${temp}°C.` },
    { rest: "Mòdul WIFI opcional per control remot." },
  ];

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
          {isOpcional ? "OPCIONALS" : "ANNEX"}
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

      <div style={{ padding: "0 14mm", position: "relative", zIndex: 1 }}>
        <div
          style={{
            backgroundColor: pillBg,
            color: pillText,
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
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>{enumPx}CLIMATITZACIÓ</span>
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px", fontWeight: 700 }}>
            {prefix}
            {formatEuro(amount)}
          </span>
        </div>

        <p
          style={{
            color: NAVY,
            fontWeight: 700,
            fontSize: "11.5pt",
            margin: "0 0 6mm 0",
            lineHeight: 1.35,
          }}
        >
          {subtitle}
        </p>

        <div style={{ display: "flex", alignItems: "stretch", gap: "10mm", margin: "0 0 6mm 0" }}>
          <div style={{ flex: "0 0 80mm", textAlign: "center" }}>
            {data.annexBombaCalorImageUrl ? (
              <img
                src={data.annexBombaCalorImageUrl}
                crossOrigin="anonymous"
                alt={name}
                style={{
                  width: "80mm",
                  height: "auto",
                  maxHeight: "100mm",
                  objectFit: "contain",
                  display: "block",
                  margin: "0 auto",
                }}
              />
            ) : (
              <div
                style={{
                  width: "80mm",
                  height: "80mm",
                  background: "#f3f4f6",
                  borderRadius: 8,
                  margin: "0 auto",
                }}
              />
            )}
            <div
              style={{
                marginTop: "3mm",
                fontStyle: "italic",
                color: NAVY,
                fontSize: "9.5pt",
                fontWeight: 600,
              }}
            >
              {name}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div
              style={{
                color: NAVY,
                fontWeight: 700,
                fontSize: "11pt",
                margin: "0 0 4mm 0",
              }}
            >
              Subministrament i col·locació de:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2.5mm" }}>
              {bullets.map((b, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: "10pt", lineHeight: 1.45 }}>
                  <span style={{ color: NAVY, fontWeight: 700 }}>·</span>
                  <span>
                    {b.strong && <strong style={{ color: PDF_COLORS.textBody }}>{b.strong}</strong>}
                    {b.rest}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p
          style={{
            fontStyle: "italic",
            color: NAVY,
            fontSize: "10pt",
            margin: "4mm 0 0 0",
          }}
        >
          *Coberta no inclosa.
        </p>

        {isOpcional && (
          <p
            style={{
              fontStyle: "italic",
              color: NAVY,
              fontSize: "10.5pt",
              margin: "4mm 0 0 0",
            }}
          >
            *No inclòs (opcional per al client)
          </p>
        )}
      </div>
      {!isOpcional && isLastAnnex && <AnnexGrandTotalBadge total={annexGrandTotal || 0} />}
      <img
        src="/pdf/fondo_climatizacion.webp"
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

void PDF_FONTS;
