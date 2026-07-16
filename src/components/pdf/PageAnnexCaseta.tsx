/**
 * Annex — CASETA DEPURADORA (Local tècnic nou).
 * Variants: "inclos" (navy) and "opcional" (orange + "+" prefix).
 * Three caseta tipus:
 *  - caseta_elevada   → KETER ELEVADA prefabricada
 *  - caseta_soterrada → RAMSES soterrada prefabricada
 *  - caseta_obra      → Construcció a mida (mides + portes dinàmiques)
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";
import { annexEnumPrefix, AnnexGrandTotalBadge, type AnnexInclosProps } from "./PdfAnnexShared";

const NAVY = "#2f4494";
const ORANGE = "#ff751f99";

function fmtDim(v?: number) {
  if (!v || !Number.isFinite(v)) return "—";
  return v.toFixed(2).replace(".", ",");
}

function portesLabel(p?: string): string {
  if (p === "frontal") return "Porta frontal metàl·lica.";
  if (p === "frontal_superior") return "Porta frontal i sostre abatible metàl·liques.";
  if (p === "sense_portes") return "Sense portes.";
  return "Portes frontals i sostre abatible metàl·liques.";
}

export function PageAnnexCaseta({
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

  // When the page is shown as "opcional" (a determinar) we always present
  // the elevada model — regardless of any tipus selection in the wizard.
  const tipus = isOpcional ? "caseta_elevada" : data.annexCasetaTipus || "caseta_elevada";
  const amount = data.annexCasetaAmount ?? 0;

  let pillTitle = "CASETA DEPURADORA";
  let subtitle = "";
  let bodyLines: { label?: string; text: string }[] = []; //let bodyLines: string[] = [];
  let imageUrl: string | undefined = data.annexCasetaImageUrl;
  let imageAlt = "Caseta depuradora";

  if (tipus === "caseta_elevada") {
    pillTitle = "CASETA DEPURADORA ELEVADA PREFABRICADA";
    subtitle = "KETER ELEVADA 141cm x 120cm x 82cm";
    bodyLines = [
      {
        text: "Caseta de elevada prefabricada per a l'exterior. Model compact amb tapa amb vorell reforçat, tancament de seguretat i moll hidràulic.",
      },
      { label: "Capacitat:", text: "1.150 litres." },
      { label: "Mides exteriors:", text: "141 x 82 x 120 cm." },
      { label: "Mides interiors:", text: "134 x 75 x 113 cm." },
      { label: "Material:", text: "Resina i metall, amb acabat tipus fusta." },
      {
        label: "Resistència:",
        text: "Apte per a exterior, resistent a la intempèrie i amb càrrega de neu de fins a 75 kg/m2.",
      },
      { label: "Seguretat:", text: "Tancament amb clau + tapa amb vorell reforçat." },
      {
        label: "Obertura còmoda:",
        text: "Maneta d’una sola mà + pistons/molls hidràulics per mantenir la tapa oberta amb seguretat.",
      },
      {
        label: "Color:",
        text: "Marró o Gris, es tria segons disponibilitat.",
      },
    ];
    imageAlt = "Caseta prefabricada elevada";
  } else if (tipus === "caseta_soterrada") {
    pillTitle = "CASETA DEPURADORA SOTERRADA PREFABRICADA";
    subtitle = "ENTERRADA RAMSES ASTRAL POOL";
    bodyLines = [
      {
        text: "Caseta soterrada prefabricada per a l'exterior. Model Ramses o equivalent amb tapa amb vorell reforçat i tancament de seguretat.",
      },
      {
        label: "Material:",
        text: "Fibra de vidre i polièster",
      },
      {
        label: "Instal·lació:",
        text: "Es recomana que la tapa quedi entre 4 i 8 cm per sobre del nivell del terreny per evitar l’entrada d’aigua per acumulació a l’entorn de la caseta.",
      },
      {
        label: "Acabat:",
        text: "Fabricada amb tapa de color verd o beige per integrar-se en entorns naturals o de gespa.",
      },
      {
        label: "Inclou:",
        text: "Passamurs inclosos, sense perforar.",
      },
    ];
    imageAlt = "Caseta prefabricada soterrada";
  } else if (tipus === "caseta_obra") {
    pillTitle = "CASETA D'OBRA";
    const ll = fmtDim(data.annexCasetaObraLlarg);
    const am = fmtDim(data.annexCasetaObraAmple);
    const al = fmtDim(data.annexCasetaObraAlt);
    subtitle = `Construcció de caseta depuradora de mides ${ll}m de llarg x ${am}m d'ample x ${al}m d'alçada*`;
    bodyLines = [
      { text: "Subministrament i muntatge d'estructura de blocs." },
      { text: "Armat dels blocs amb barres d'hacer corrugades i reomplert amb formigó." },
      { text: "Realització de llosa de formigó de 15cm de gruix." },
      { text: "Arrebossar murs." },
      { text: portesLabel(data.annexCasetaObraPortes) },
    ];
  }

  const showImage = tipus !== "caseta_obra";

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
        {/* Pill */}
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
            fontSize: pillTitle.length > 38 ? "11.8pt" : "13pt",
            letterSpacing: pillTitle.length > 38 ? 0.5 : 1,
            margin: "0 0 8mm 0",
            fontWeight: 400,
          }}
        >
          <span
            style={{
              display: "block",
              lineHeight: 1,
              flex: 1,
              whiteSpace: "nowrap",
              paddingRight: 10,
              marginBottom: "12px",
            }}
          >
            {enumPx}
            {pillTitle}
          </span>
          <span
            style={{
              display: "block",
              lineHeight: 1,
              fontWeight: 700,
              flex: "0 0 42mm",
              textAlign: "right",
              whiteSpace: "nowrap",
              marginBottom: "12px",
            }}
          >
            {prefix}
            {formatEuro(amount)}
          </span>
        </div>

        {/* Subtitle */}
        <p
          style={{
            color: NAVY,
            fontWeight: 700,
            fontSize: "11.5pt",
            margin: "0 0 6mm 0",
            lineHeight: 1.35,
            fontFamily: '"Tenor Sans", serif',
          }}
        >
          {subtitle}
        </p>

        {/* Body: text (left) + image (right) for prefabricades; only text for caseta_obra */}
        <div style={{ display: "flex", alignItems: "center", gap: "10mm" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "3mm" }}>
              {bodyLines.map((line, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 8,
                    fontSize: "10pt",
                    lineHeight: 1.5,
                    color: PDF_COLORS.textBody,
                  }}
                >
                  {tipus === "caseta_obra" ? (
                    <>
                      <span style={{ color: NAVY, fontWeight: 700 }}>·</span>
                      <span>{line.text}</span>
                    </>
                  ) : (
                    //<span>{line}</span>
                    <span>
                      {line.label && <span style={{ fontWeight: 700 }}>{line.label} </span>}
                      {line.text}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {tipus === "caseta_obra" && (
              <p
                style={{
                  fontStyle: "italic",
                  color: NAVY,
                  fontSize: "9.5pt",
                  margin: "6mm 0 0 0",
                }}
              >
                *Mides encara a concretar en la seva totalitat.
              </p>
            )}
          </div>

          {showImage && (
            <div style={{ flex: "0 0 80mm", textAlign: "center" }}>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  crossOrigin="anonymous"
                  alt={imageAlt}
                  style={{
                    maxWidth: "80mm",
                    maxHeight: "80mm",
                    width: "auto",
                    height: "auto",
                    objectFit: "contain",
                    display: "block",
                    margin: "0 auto",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "80mm",
                    height: "70mm",
                    background: "#f3f4f6",
                    borderRadius: 8,
                    margin: "0 auto",
                  }}
                />
              )}
            </div>
          )}
        </div>

        {isOpcional && (
          <p
            style={{
              fontStyle: "italic",
              color: NAVY,
              fontSize: "10.5pt",
              margin: "8mm 0 0 0",
            }}
          >
            *No inclòs (opcional per al client)
          </p>
        )}
      </div>
      {!isOpcional && isLastAnnex && <AnnexGrandTotalBadge total={annexGrandTotal || 0} />}

      <img
        src="/pdf/fondo_caseta.webp"
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
