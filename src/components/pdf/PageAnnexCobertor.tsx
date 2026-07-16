/**
 * Annex — COBERTA AUTOMÀTICA DE LAMEL·LES.
 * Variants: "inclos" (navy) and "opcional" (orange + "+" prefix).
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";
import { annexEnumPrefix, AnnexGrandTotalBadge, type AnnexInclosProps } from "./PdfAnnexShared";

const NAVY = "#2f4494";
const ORANGE = "#ff751f99";

type Feature = { title: string; desc: string };

const FEATURES: Record<string, Feature[]> = {
  "e-classic": [
    {
      title: "Motor Tubular 24V Desembragable",
      desc: "Apertura i tancament automàtic amb finals de carrera integrats.",
    },
    { title: "Commutador de Clau 3 Posicions", desc: "Control manual senzill i segur amb posicions mantingudes." },
    { title: "Eix d'Alumini Resistent", desc: "Estructura duradora adaptada a tot tipus de piscines." },
    { title: "Peus en 3 Colors", desc: "Disponible en blanc, gris clar i sorra per adaptar-se a l'entorn." },
    {
      title: "Sivelles Antielevació",
      desc: "Sistema de bloqueig que impedeix l'aixecament accidental de la persiana.",
    },
    {
      title: "Antilliscant per a Escales",
      desc: "Protecció específica per a escales amb base inferior al 50% de l'ample del got.",
    },
  ],
  "e-classic-lux": [
    {
      title: "Control per Smartphone",
      desc: "Motor 24V gestionable des del mòbil amb interruptor de clau d'emergència.",
    },
    { title: "Slow Mode Integrat", desc: "Caixa transformadora amb apertura i tancament suau de sèrie." },
    {
      title: "Estructura Alumini Qualitcoat",
      desc: "Peus termolacats en negre amb certificació de qualitat de recobriment.",
    },
    { title: "Llum Integrada amb Difusor", desc: "Il·luminació incorporada en els peus amb difusor translúcid." },
    { title: "4 Acabats Personalitzables", desc: "Adaptable estèticament a qualsevol disseny de piscina o jardí." },
    { title: "Fixació en Brocal Pla", desc: "Instal·lació sòlida i discreta directament sobre la vora de la piscina." },
    { title: "Persiana amb Doble Seguretat", desc: "Sivelles antielevació i antilliscant per a escales." },
  ],
  "e-spark": [
    { title: "Control per Smartphone", desc: "Motor 24V gestionable des del mòbil amb clau d'emergència al peu." },
    { title: "Slow Mode Integrat", desc: "Caixa transformadora amb moviment suau per a major vida útil." },
    {
      title: "Peus ABS Regulables en Alçada",
      desc: "Nivell ajustable per adaptar-se a qualsevol configuració de piscina.",
    },
    { title: "2 Opcions de Color", desc: "Tapa de peus en blanc estàndard o gris antracita a triar." },
    {
      title: "Sivelles Antielevació",
      desc: "Sistema de bloqueig que impedeix l'aixecament accidental de la persiana.",
    },
    {
      title: "Antilliscant per a Escales",
      desc: "Protecció específica per a escales amb base inferior al 50% de l'ample del got.",
    },
  ],
  "e-solar": [
    {
      title: "Alimentació 100% Solar",
      desc: "Panell fotovoltaic d'alt rendiment — sense connexió elèctrica necessària.",
    },
    {
      title: "2 Bateries Regulades Electrònicament",
      desc: "Autonomia assegurada fins i tot en dies de baixa irradiació solar.",
    },
    { title: "Motor 24V Desembragable", desc: "Apertura i tancament automàtic amb finals de carrera integrats." },
    { title: "Commutador de Clau 3 Posicions", desc: "Control manual senzill amb regulador inclòs." },
    { title: "Eix d'Alumini amb Peus Regulables", desc: "Fixació al brocal amb nivell ajustable en blanc i sorra." },
    { title: "Persiana amb Doble Seguretat", desc: "Sivelles antielevació i antilliscant per a escales." },
  ],
  "e-playa-classic": [
    {
      title: "Motor 24V amb Slow Mode",
      desc: "Apertura i tancament suau integrat per a major suavitat i durabilitat.",
    },
    { title: "Versió Solar Disponible", desc: "2 bateries alimentades per panell fotovoltaic d'alt rendiment." },
    { title: "Commutador de Clau 3 Posicions", desc: "Control manual senzill i segur per a totes dues versions." },
    {
      title: "Armadura d'Alumini Blanc",
      desc: "Estructura robusta i integrada estèticament en l'entorn de la piscina.",
    },
    {
      title: "Revestiment Blanc o Imitació Fusta",
      desc: "Dues opcions d'acabat per adaptar-se al disseny de l'espai.",
    },
    { title: "Persiana amb Doble Seguretat", desc: "Sivelles antielevació i antilliscant per a escales." },
  ],
  "e-playa-dsign": [
    {
      title: "Disseny Premium Qualitcoat®",
      desc: "Armadura d'alumini termolacat negre amb certificació antiratllades.",
    },
    { title: "Revestiment de Fusta IPE", desc: "Acabat natural d'alta gamma per a entorns exclusius." },
    { title: "Motor 24V Desembragable", desc: "Apertura i tancament automàtic amb finals de carrera integrats." },
    { title: "Slow Mode Integrat de Sèrie", desc: "Moviment suau inclòs sense necessitat d'accessoris addicionals." },
    {
      title: "Sivelles Antielevació",
      desc: "Sistema de bloqueig que impedeix l'aixecament accidental de la persiana.",
    },
    {
      title: "Antilliscant per a Escales",
      desc: "Protecció específica per a escales amb base inferior al 50% de l'ample del got.",
    },
  ],
  "s-premium": [
    {
      title: "Coberta Submergida Motoritzada",
      desc: "Mecànica integrada sota l'aigua per a màxima discreció i estètica.",
    },
    {
      title: "Motor 24V amb Kit d'Estanquitat Complet",
      desc: "Caixa de connexió, connexions i gel segellador per a ús subaquàtic segur.",
    },
    { title: "Eix Composite o Alumini", desc: "Seleccionable segons configuració i mida del got." },
    { title: "Coixinet Ajustable", desc: "Muntatge sobre suport regulable per a una instal·lació precisa i duradora." },
    { title: "Brides de Material Compost", desc: "Estructura resistent a l'aigua i als productes químics de piscina." },
    {
      title: "Persiana Llastrada amb Contrapesos",
      desc: "Corretja i sistema de llast per a fixació i estabilitat subaquàtica.",
    },
    { title: "Sivelles Antielevació", desc: "Seguretat activa en tota la superfície de la persiana submergida." },
  ],
  "s-lux": [
    {
      title: "Coberta Submergida d'Alt Nivell",
      desc: "Mecànica completament integrada al fons del got — instal·lació invisible.",
    },
    {
      title: "Motor 24V amb Kit d'Estanquitat",
      desc: "Segellat total amb caixa de connexió, connexions i gel protector.",
    },
    { title: "Eix Composite fins a 5 m", desc: "Lleuger i resistent per a vans de gran longitud sense deformacions." },
    { title: "Eix d'Alumini per a Grans Configuracions", desc: "Adaptable segons la mida i disseny del got." },
    { title: "Finals de Carrera Interns", desc: "Automatisme integrat sense elements visibles a l'exterior." },
    { title: "Persiana Antielevació", desc: "Sivelles de seguretat dissenyades específicament per a ús submergit." },
  ],
  "s-premium-cs": [
    {
      title: "Motor en Caixa Seca Exterior",
      desc: "Allotjat fora del got — sense elements elèctrics submergits per a major seguretat.",
    },
    { title: "Slow Mode Integrat", desc: "Apertura i tancament suau de sèrie amb finals de carrera automàtics." },
    { title: "Eix Dimensionat al Got", desc: "Adaptat a cada mida de piscina amb eix d'acoblament inclòs." },
    {
      title: "Suport amb Coixinet Regulable",
      desc: "Muntatge precís i ajustable per a una instal·lació estable i duradora.",
    },
    {
      title: "Passamurs Estanc",
      desc: "Conjunt de peces de segellat per al pas de l'eix a través de la paret del got.",
    },
    {
      title: "Persiana Llastrada amb Contrapesos",
      desc: "Corretja i sistema de llast per a fixació i estabilitat subaquàtica.",
    },
    { title: "Sivelles Antielevació", desc: "Seguretat activa en tota la superfície de la persiana submergida." },
  ],
  "e-basic": [
    { title: "Motor Tubular 24V", desc: "Apertura i tancament automàtic amb finals de carrera." },
    { title: "Commutador de Clau", desc: "Control manual senzill i segur." },
    { title: "Eix d'Alumini", desc: "Estructura duradora adaptada al got." },
    { title: "Sivelles Antielevació", desc: "Impedeix l'aixecament accidental de la persiana." },
    { title: "Antilliscant per a Escales", desc: "Protecció específica per a escales." },
  ],
};

function formatDim(v?: number) {
  if (!v || !Number.isFinite(v)) return "—";
  return v.toFixed(2).replace(".", ",") + "m";
}

export function PageAnnexCobertor({
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

  const isSubmerg = data.annexCobertorTipus === "submergit";
  const elevSubLabel = isSubmerg ? "SUBMERGIDA" : "ELEVADA";
  const isPoli = data.annexCobertorLames === "policarbonat";
  const lamesLabel = isPoli ? "POLICARBONAT" : "PVC";
  const dimensions = `${formatDim(data.poolLength)} x ${formatDim(data.poolWidth)}`;

  const amount = data.annexCobertorAmount ?? 0;
  const compactPill = isSubmerg && amount >= 10000;
  const modelName = data.annexCobertorModelName || "—";
  const modelCode = (data.annexCobertorModelCode || "").toLowerCase();
  const features = FEATURES[modelCode] || [];
  const modelImageUrl = data.annexCobertorModelImageUrl;
  const colorImageUrl = data.annexCobertorColorImageUrl;
  const colorName = data.annexCobertorColorName || "—";
  const availableColors = data.annexCobertorAvailableColors || [];
  // Ensure the selected color is included even if the relation table is incomplete.
  const hasSelected = availableColors.some((c) => c.selected);
  const colorsForGallery =
    !hasSelected && colorImageUrl
      ? [{ name: colorName, imageUrl: colorImageUrl, selected: true }, ...availableColors]
      : availableColors;

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
            fontSize: compactPill ? "11.8pt" : "13pt",
            letterSpacing: compactPill ? 0.5 : 1,
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
            {enumPx}COBERTA {elevSubLabel} DE LAMEL·LES AUTOMÀTICA
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

        {/* Title line */}
        <p
          style={{
            color: NAVY,
            fontWeight: 700,
            fontSize: "10.5pt",
            margin: "0 0 5mm 0",
            lineHeight: 1.35,
            fontFamily: '"Tenor Sans", serif',
          }}
        >
          <strong>
            COBERTA AUTOMÀTICA {elevSubLabel} AMB LAMEL·LES DE {lamesLabel} DE ({dimensions}):
          </strong>
        </p>

        {/* Top row: features (left) + model image vertically centered (right) */}
        <div style={{ display: "flex", gap: "8mm", alignItems: "center" }}>
          {/* LEFT: model name + features */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: NAVY,
                fontWeight: 700,
                fontFamily: '"Tenor Sans", serif',
                fontSize: "16pt",
                letterSpacing: 1,
                margin: "0 0 3mm 0",
              }}
            >
              {modelName.toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2.2mm" }}>
              {features.map((f, i) => (
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
                    <strong style={{ color: PDF_COLORS.textBody }}>{f.title}:</strong> {f.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: model image (vertically centered with features) */}
          <div style={{ flex: "0 0 70mm" }}>
            <div style={{ textAlign: "center", marginTop: "12mm" }}>
              {modelImageUrl ? (
                <img
                  src={modelImageUrl}
                  crossOrigin="anonymous"
                  alt={modelName}
                  style={{
                    maxWidth: "70mm",
                    maxHeight: "50mm",
                    width: "auto",
                    height: "auto",
                    objectFit: "contain",
                    display: "block",
                    margin: "0 auto",
                  }}
                />
              ) : (
                <div
                  style={{ width: "70mm", height: "50mm", background: "#f3f4f6", borderRadius: 6, margin: "0 auto" }}
                />
              )}
              <div
                style={{
                  marginTop: "2mm",
                  fontStyle: "italic",
                  color: NAVY,
                  fontSize: "9pt",
                  fontWeight: 600,
                }}
              >
                Model {modelName}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: full-width horizontal gallery of available lames colors */}
        {(colorsForGallery.length > 0 || colorImageUrl) && (
          <div
            style={{
              marginTop: "6mm",
              //background: "#ffffff",
              border: `1px solid ${NAVY}33`,
              borderRadius: 8,
              padding: "4mm 4mm 3mm 4mm",
            }}
          >
            <div
              style={{
                color: NAVY,
                fontWeight: 700,
                fontSize: "9.5pt",
                letterSpacing: 0.5,
                marginBottom: "3mm",
                textTransform: "uppercase",
                textAlign: "center",
              }}
            >
              Lamel·les {lamesLabel} — Acabats disponibles
            </div>
            {colorsForGallery.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  flexWrap: "nowrap",
                  gap: "3mm",
                  justifyContent: "center",
                }}
              >
                {colorsForGallery.map((c, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
                    <div
                      style={{
                        position: "relative",
                        border: c.selected ? `2px solid ${NAVY}` : `1px solid ${NAVY}22`,
                        borderRadius: 6,
                        overflow: "hidden",
                        background: "#f3f4f6",
                      }}
                    >
                      {c.imageUrl ? (
                        <img
                          src={c.imageUrl}
                          crossOrigin="anonymous"
                          alt={c.name}
                          style={{
                            width: "100%",
                            height: "18mm",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <div style={{ width: "100%", height: "18mm" }} />
                      )}
                      {c.selected && (
                        <div
                          style={{
                            position: "absolute",
                            top: 3,
                            right: 3,
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: NAVY,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 0 0 1.5px #ffffff",
                          }}
                        >
                          <svg
                            width="9"
                            height="9"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: "1.5mm",
                        fontSize: "8pt",
                        color: c.selected ? NAVY : PDF_COLORS.textBody,
                        fontWeight: c.selected ? 700 : 500,
                        lineHeight: 1.2,
                      }}
                    >
                      {c.name}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div
              style={{
                marginTop: "3mm",
                fontSize: "8.5pt",
                color: PDF_COLORS.textBody,
                fontWeight: 600,
                textAlign: "center",
                borderTop: `1px solid ${NAVY}22`,
                paddingTop: "2mm",
              }}
            >
              Color escollit: <span style={{ color: NAVY, fontWeight: 700 }}>{colorName}</span>
            </div>
          </div>
        )}

        {isOpcional && (
          <p
            style={{
              fontStyle: "italic",
              color: NAVY,
              fontSize: "10pt",
              margin: "6mm 0 0 0",
            }}
          >
            *No inclòs (opcional per al client)
          </p>
        )}
      </div>
      {!isOpcional && isLastAnnex && <AnnexGrandTotalBadge total={annexGrandTotal || 0} />}

      <img
        src="/pdf/fondo_cobertor.webp"
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
