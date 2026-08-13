/**
 * Annex — GESPA ARTIFICIAL.
 * Variants: "inclos" (navy) and "opcional" (orange + "+" prefix).
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";
import { annexEnumPrefix, AnnexGrandTotalBadge, type AnnexInclosProps } from "./PdfAnnexShared";
import gespaTop from "@/assets/gespa-top.png";
import gespaSide from "@/assets/gespa-side.png";

const NAVY = "#2f4494";
const ORANGE = "#ff751f99";

type ModelInfo = {
  fullName: string;
  altura: string;
  color: string;
  fibra: string;
  polimer: string;
  densitat?: string;
  composicio?: string;
  base: string;
  lastrat: string;
  propietats: string;
  garantia: string;
  destacats: string[];
};

const MODELS: Record<35 | 38 | 45 | "45b", ModelInfo> = {
  38: {
    fullName: "ECOGESPA ARTIFICIAL IC-MAGIC38",
    altura: "38 mm",
    color: "4 colors (última generació)",
    fibra: "Monofilament amb extrusió DIAMON SHAPE",
    polimer: "TENCATE d'alta qualitat + fibra arrissada",
    densitat: "23.100 puntades/m²",
    base: "LATEX TENCATE THIOBAC",
    lastrat: "Sorra de sílice 6 kg/m²",
    propietats: "Ignífug i imputrescible",
    garantia: "10 anys contra degradació per raigs UV i gelades",
    destacats: [
      "Alta densitat de puntades (molt tupit)",
      "Fibra premium amb tecnologia DIAMON SHAPE",
      "Molt bona resistència i durabilitat",
      "Acabat natural de 4 tons",
    ],
  },
  35: {
    fullName: "ECOGESPA ARTIFICIAL IC-EXTREME35",
    altura: "35 mm",
    color: "Quatricolor (4 colors, última generació)",
    fibra: "Monofilament amb extrusió S-SHAPE",
    polimer: "TENCATE d'alta qualitat + fibra arrissada",
    densitat: "18.900 puntades/m²",
    composicio: "16 fils per puntada",
    base: "LATEX TENCATE THIOBAC",
    lastrat: "Sorra de sílice 6 kg/m²",
    propietats: "Ignífug i imputrescible",
    garantia: "10 anys contra degradació per raigs UV i gelades",
    destacats: [
      "Fibra amb tecnologia S-SHAPE (millor recuperació de petjada)",
      "Bona densitat i resistència",
      "Relació qualitat/preu equilibrada",
      "Aspecte natural de 4 tons",
    ],
  },
  "45b": {
    fullName: "ECOGESPA ARTIFICIAL MULTIDIRECCIONAL 45MM",
    altura: "45 mm",
    color: "Fil multicolor (acabat multidireccional)",
    fibra: "78% PE & 22% PP",
    polimer: "TENCATE d'alta qualitat + fibra arrissada",
    composicio: "Galga 5/8\", ± 1,4 puntades/cm, Pes total 3.138 g/m²",
    base: "LATEX TENCATE THIOBAC",
    lastrat: "Sorra de sílice 6 kg/m²",
    propietats: "Ignífug i imputrescible",
    garantia: "10 anys contra degradació per raigs UV i gelades",
    destacats: [
      "Fil multicolor per a un acabat més natural",
      "Fibra arrissada (millor recuperació de petjada)",
      "Lliure de plom i cadmi",
    ],
  },
  45: {
    fullName: "ECOGESPA ARTIFICIAL IC-ODISEA45 MULTIDIRECCIONAL",
    altura: "45 mm",
    color: "6 tons de color (acabat multidireccional)",
    fibra: "Monofilament amb extrusió SNAKE SHAPE",
    polimer: "TENCATE d'alta qualitat + fibra arrissada",
    densitat: "12.600 puntades/m²",
    composicio: "26 fils per puntada",
    base: "LATEX amb doble backing de polipropilè estabilitzat",
    lastrat: "Sorra de sílice 6 kg/m²",
    propietats: "Ignífug i imputrescible",
    garantia: "10 anys contra degradació per raigs UV i gelades",
    destacats: [
      "Acabat multidireccional (aspecte més natural)",
      "6 tons de color (molt realista)",
      "Major alçada (45 mm) → sensació més encoixinada",
      "Fibra SNAKE SHAPE amb alta recuperació",
    ],
  },
};

const AVANTATGES = [
  "Sense influència del clima",
  "Estalvi d'aigua i menor manteniment",
  "Anti-bactèries i al·lergens",
  "Ecològic",
  "Adaptable",
  "Altament resistent",
];

export function PageAnnexGespa({
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

  // Force new "45b" (Multidireccional 45mm) model for "opcional" (per spec); use selected mm otherwise.
  const mm = (isOpcional ? "45b" : data.annexGespaModelMm || 35) as 35 | 38 | 45 | "45b";
  const model = MODELS[mm];

  const amount = data.annexGespaAmount ?? 0;
  const m2 = Number(data.annexGespaM2 || 0);
  const pricePerM2 = Number(data.annexGespaPricePerM2 || 0);
  const preparacioInclosa = !!data.annexGespaPreparacioIncluded;

  const pillAmountText = isOpcional ? `${prefix}${formatEuro(pricePerM2)}/m²` : `${formatEuro(amount)}`;

  const specRows: Array<[string, string | undefined]> = [
    ["Altura", model.altura],
    ["Color", model.color],
    ["Fibra", model.fibra],
    ["Polímer", model.polimer],
    ["Densitat", model.densitat],
    ["Composició", model.composicio],
    ["Base", model.base],
    ["Lastrat", model.lastrat],
    ["Propietats", model.propietats],
    ["Garantia", model.garantia],
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
          marginLeft: 0,
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
            minHeight: 44,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: '"Tenor Sans", serif',
            fontSize: "13pt",
            letterSpacing: 1,
            margin: "0 0 4mm 0",
          }}
        >
          <span style={{ display: "block", lineHeight: 1, marginBottom: 12 }}>{enumPx}GESPA ARTIFICIAL</span>
          <span style={{ display: "block", lineHeight: 1, fontWeight: 700, marginBottom: 12, whiteSpace: "nowrap" }}>
            {pillAmountText}
          </span>
        </div>

        {/* Subtitle */}
        <p
          style={{
            color: NAVY,
            fontWeight: 700,
            fontSize: "11pt",
            margin: "0 0 5mm 0",
            fontFamily: '"Tenor Sans", serif',
            letterSpacing: 0.5,
          }}
        >
          {isOpcional
            ? "Renovació dels espais exteriors amb gespa artificial"
            : `Renovació dels espais exteriors amb ${m2.toLocaleString("ca-ES")} m² de gespa artificial${
                preparacioInclosa ? " — preparació de terreny inclosa" : " — sense preparació de terreny"
              }`}
        </p>

        {/* Top row: text/specs left + product top image right */}
        <div style={{ display: "flex", gap: "8mm", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: NAVY,
                fontWeight: 700,
                fontFamily: '"Tenor Sans", serif',
                fontSize: "13.5pt",
                letterSpacing: 0.8,
                margin: "0 0 3mm 0",
              }}
            >
              {model.fullName}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.6mm" }}>
              {specRows
                .filter(([, v]) => !!v)
                .map(([k, v], i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 6,
                      fontSize: "8.8pt",
                      lineHeight: 1.35,
                      color: PDF_COLORS.textBody,
                    }}
                  >
                    <span style={{ color: NAVY, fontWeight: 700 }}>·</span>
                    <span>
                      <strong style={{ color: PDF_COLORS.textBody }}>{k}:</strong> {v}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* RIGHT: top-view product image */}
          <div style={{ flex: "0 0 60mm" }}>
            <div style={{ textAlign: "center" }}>
              <img
                src={gespaTop}
                crossOrigin="anonymous"
                alt="Gespa artificial"
                style={{
                  width: "35mm", //45mm
                  height: "35mm", //45mm
                  objectFit: "cover",
                  display: "block",
                  margin: "0 auto",
                  borderRadius: 6,
                  border: `1px solid ${NAVY}22`,
                }}
              />
              <div
                style={{
                  marginTop: "2mm",
                  fontStyle: "italic",
                  color: NAVY,
                  fontSize: "8.5pt",
                  fontWeight: 600,
                }}
              >
                Acabat superior — {model.altura}
              </div>
            </div>
          </div>
        </div>

        {/* Destacats (highlights) */}
        <div style={{ marginTop: "5mm" }}>
          <div
            style={{
              color: NAVY,
              fontWeight: 700,
              fontSize: "9.5pt",
              letterSpacing: 0.5,
              marginBottom: "2mm",
              textTransform: "uppercase",
            }}
          >
            Punts destacats
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5mm 6mm" }}>
            {model.destacats.map((d, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 6,
                  fontSize: "8.8pt",
                  lineHeight: 1.35,
                  color: PDF_COLORS.textBody,
                }}
              >
                <span style={{ color: NAVY, fontWeight: 700 }}>✓</span>
                <span>{d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom row: side image LEFT + avantatges card RIGHT */}
        <div style={{ display: "flex", gap: "6mm", marginTop: "5mm", alignItems: "center" }}>
          {/* LEFT: side image (perfil) */}
          <div style={{ flex: 1, textAlign: "center" }}>
            <img
              src={gespaSide}
              crossOrigin="anonymous"
              alt="Perfil gespa artificial"
              style={{
                maxWidth: "100%",
                maxHeight: "40mm",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                display: "block",
                margin: "0 auto",
              }}
            />
          </div>

          {/* RIGHT: avantatges card */}
          <div
            style={{
              flex: "0 0 80mm",
              border: `1px solid ${NAVY}33`,
              borderRadius: 8,
              padding: "2mm 4mm 3mm 4mm",
            }}
          >
            <div
              style={{
                color: NAVY,
                fontWeight: 700,
                fontSize: "9.5pt",
                letterSpacing: 0.5,
                margin: 0, // <-- reset
                marginBottom: "2mm",
                lineHeight: 1, // <-- evita aire extra
                textTransform: "uppercase",
              }}
            >
              Avantatges de la gespa artificial
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2mm 4mm" }}>
              {AVANTATGES.map((av, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 5,
                    fontSize: "8.5pt",
                    lineHeight: 1.3,
                    color: PDF_COLORS.textBody,
                  }}
                >
                  <span style={{ color: NAVY, fontWeight: 700 }}>✓</span>
                  <span>{av}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Opcional disclaimer */}
        {isOpcional && (
          <div
            style={{
              marginTop: "4mm",
              fontStyle: "italic",
              color: NAVY,
              fontSize: "9pt",
              lineHeight: 1.4,
            }}
          >
            *Preus subjectes a un mínim de m². Per a altres condicions caldrà estudiar cada cas. El preu indicat per m²
            no inclou la preparació del terreny.
          </div>
        )}
      </div>

      <img
        src="/pdf/fondo_cesped.webp"
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
      {!isOpcional && isLastAnnex && <AnnexGrandTotalBadge total={annexGrandTotal || 0} />}
    </section>
  );
}
