/**
 * Annex — ROBOT NETEJA FONS AUTOMÀTIC.
 * Variants: "inclos" (navy) and "opcional" (orange + "+ " prefix).
 * Content varies by model (Beatbot Sora P3 vs P7).
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";
import { annexEnumPrefix, AnnexGrandTotalBadge, type AnnexInclosProps } from "./PdfAnnexShared";

const NAVY = "#2f4494";
const ORANGE = "#ff751f99";

const FEATURES_P3: { title: string; body: string }[] = [
  {
    title: "Control d'Àrea Total",
    body: "Neteja eficient de fons, parets i línia de flotació amb cobertura completa.",
  },
  {
    title: "Bomba de succió de 12.700 LPH",
    body: "Aspiració potent capaç d'absorbir sediments, fulles i partícules fines.",
  },
  {
    title: "Autonomia fins a 5 hores",
    body: "Bateria d'alta capacitat per cobrir piscines mitjanes en una sola càrrega.",
  },
  {
    title: "Disseny sense fils",
    body: "Funcionament 100% sense cables, lliure i segur de fer servir.",
  },
  {
    title: "Parking automàtic a la vora",
    body: "Quan finalitza la neteja, torna a la paret per a una recollida còmoda.",
  },
];

const FEATURES_P7: { title: string; body: string }[] = [
  {
    title: "Control 360° intel·ligent",
    body: "Navegació avançada amb sensors que mapegen la piscina en temps real.",
  },
  {
    title: "Bomba de succió de 25.700 LPH",
    body: "Doble potència respecte models estàndard per a una neteja profunda.",
  },
  {
    title: "Tecnologia JetPulse™",
    body: "Raigs d'aigua direccionals que despreneixen brutícia incrustada al fons.",
  },
  {
    title: "Neteja de línia de flotació amb ClearWater™",
    body: "Sistema de clarificació que elimina greixos i restes orgàniques flotants.",
  },
  {
    title: "App mòbil + control remot",
    body: "Programació intel·ligent, rutes personalitzades i diagnòstic des del mòbil.",
  },
];

export function PageAnnexRobot({
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
  const prefix = "";
  const enumPx = isOpcional ? "" : annexEnumPrefix(annexIndex, annexTotalCount);

  const model = data.annexRobotModel || (/P\s*7/i.test(data.annexRobotName || "") ? "P7" : "P3");
  const features = model === "P7" ? FEATURES_P7 : FEATURES_P3;
  const name = data.annexRobotName || (model === "P7" ? "BEATBOT Sora P7" : "BEATBOT Sora P3");
  const amount = data.annexRobotAmount ?? 0;

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
        {/* Section pill */}
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
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>
            {enumPx}ROBOT NETEJA FONS AUTOMÀTIC
          </span>
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
            margin: "0 0 4mm 0",
            lineHeight: 1.35,
          }}
        >
          NETEJA AUTOMÀTICA SENSE FILS — {name.toUpperCase()}
        </p>
        <p
          style={{
            fontSize: "10.5pt",
            lineHeight: 1.5,
            color: PDF_COLORS.textBody,
            margin: "0 0 6mm 0",
          }}
        >
          {model === "P7"
            ? "Robot autònom d'altes prestacions pensat per a piscines grans i d'ús intensiu. Combina potència, intel·ligència de navegació i control remot per oferir una neteja completa amb el mínim esforç."
            : "Robot autònom compacte ideal per a piscines residencials. Ofereix una neteja eficient sense necessitat de connexions ni mànegues, amb posada en marxa immediata."}
        </p>

        {/* Image + features */}
        <div style={{ display: "flex", alignItems: "stretch", gap: "10mm", margin: "0 0 6mm 0" }}>
          <div style={{ flex: "0 0 80mm", textAlign: "center" }}>
            {data.annexRobotImageUrl ? (
              <img
                src={data.annexRobotImageUrl}
                crossOrigin="anonymous"
                alt={name}
                style={{
                  width: "80mm",
                  height: "auto",
                  maxHeight: "95mm",
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
                margin: "0 0 3mm 0",
              }}
            >
              Característiques principals:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2.5mm" }}>
              {features.map((f) => (
                <div key={f.title} style={{ display: "flex", gap: 8, fontSize: "10pt", lineHeight: 1.4 }}>
                  <span style={{ color: NAVY, fontWeight: 700 }}>·</span>
                  <span>
                    <strong style={{ color: PDF_COLORS.textBody }}>{f.title}.</strong> {f.body}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isOpcional && (
          <p
            style={{
              fontStyle: "italic",
              color: NAVY,
              fontSize: "10.5pt",
              margin: "6mm 0 0 0",
            }}
          >
            *No inclòs (opcional per al client)
          </p>
        )}
      </div>
      {!isOpcional && isLastAnnex && <AnnexGrandTotalBadge total={annexGrandTotal || 0} />}

      <img
        src="/pdf/fondo_robot_VF.webp"
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
