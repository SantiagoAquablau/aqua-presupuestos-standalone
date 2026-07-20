/**
 * Piscina Autoportant — Page 3: acabats (corona + revestiment interior).
 * Shows every finish available for the chosen Autoportant model, in two
 * horizontal strips (Coronació / Revestiment interior), marking the one
 * chosen in the wizard as "Seleccionat".
 * Header / divider style mirrors ESTRUCTURA / ACABATS (Tenor Sans navy 46pt).
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";
import { AUTOPORTANT_PORC_IMAGES, AUTOPORTANT_GRESITE_IMAGES, type AutoportantModelKey } from "@/lib/autoportantMeta";

const NAVY = "#2f4494";

interface FinishOption {
  key: string;
  name: string;
  image?: string;
}

const CORONA_PORCELANIC = ["AERIS", "ARGENTIUM", "NACRE", "SABBIA"] as const;

const CORONA_OPTIONS: FinishOption[] = CORONA_PORCELANIC.map((name) => ({
  key: `corona_${name}`,
  name,
  image: AUTOPORTANT_PORC_IMAGES[name],
}));

const REVESTIMENT_OPTIONS: Record<AutoportantModelKey, FinishOption[]> = {
  line_confort: ["3000", "3004", "3057", "3003", "3002"].map((n) => ({
    key: `rev_${n}`,
    name: n,
    image: AUTOPORTANT_GRESITE_IMAGES[n],
  })),
  line_luxe: ["NC7733", "NC7723", "NC7734", "3802", "3800", "3807"].map((n) => ({
    key: `rev_${n}`,
    name: n,
    image: AUTOPORTANT_GRESITE_IMAGES[n],
  })),
  line_luxe_plus: [
    ...CORONA_PORCELANIC.map((n) => ({ key: `rev_${n}`, name: n, image: AUTOPORTANT_PORC_IMAGES[n] })),
    { key: "rev_STELA_ARTIC", name: "STELA ARTIC", image: AUTOPORTANT_PORC_IMAGES.STELA_ARTIC },
    { key: "rev_VARADERO", name: "VARADERO", image: AUTOPORTANT_PORC_IMAGES.VARADERO },
    { key: "rev_MENORCA", name: "MENORCA", image: AUTOPORTANT_PORC_IMAGES.MENORCA },
  ],
};

export function PageAutoportantAcabats({ data }: { data: PdfData }) {
  const modelKey = data.autoportantModelKey as AutoportantModelKey | undefined;
  const revestimentOptions = modelKey ? REVESTIMENT_OPTIONS[modelKey] : [];

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
          ACABATS
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
          Acabats disponibles per a la {data.autoportantModelName || "piscina"}. S'indica en cada secció
          l'opció seleccionada.
        </p>

        <SectionPillTenor number="1" title="CORONACIÓ" />
        <FinishStrip options={CORONA_OPTIONS} selectedName={data.autoportantCoronaName} />

        <div style={{ height: "8mm" }} />

        <SectionPillTenor number="2" title="REVESTIMENT INTERIOR" />
        {revestimentOptions.length > 0 ? (
          <FinishStrip options={revestimentOptions} selectedName={data.autoportantRevestimentName} />
        ) : (
          <div style={{ fontSize: "9pt", fontStyle: "italic", color: PDF_COLORS.textMuted, padding: "4mm 0" }}>
            No hi ha opcions disponibles per aquest model.
          </div>
        )}

        {data.autoportantExteriorNote && (
          <div
            style={{
              marginTop: "8mm",
              padding: "14px 18px",
              background: `${NAVY}0d`,
              border: `1px solid ${NAVY}33`,
              borderRadius: 12,
              fontSize: "10.5pt",
              color: PDF_COLORS.textDark,
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontWeight: 700, color: NAVY }}>Revestiment exterior:</span>{" "}
            {data.autoportantExteriorNote}
          </div>
        )}
      </div>
    </section>
  );
}

/* ================== Finish strip (horizontal, all options) ================== */
function FinishStrip({ options, selectedName }: { options: FinishOption[]; selectedName?: string }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "5mm" }}>
      {options.map((opt) => {
        const isSelected = !!selectedName && opt.name === selectedName;
        return (
          <div
            key={opt.key}
            style={{ flex: "0 0 36mm", width: "36mm", display: "flex", flexDirection: "column", alignItems: "center" }}
          >
            <div
              style={{
                position: "relative",
                width: "36mm",
                height: "36mm",
                borderRadius: 10,
                overflow: "hidden",
                background: "#eeeeee",
                border: isSelected ? `3px solid ${NAVY}` : "1px solid #d8d2cc",
                boxShadow: isSelected ? "0 2px 8px rgba(47,68,148,0.35)" : "none",
              }}
            >
              {opt.image ? (
                <img
                  src={opt.image}
                  alt={opt.name}
                  crossOrigin="anonymous"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#999",
                    fontStyle: "italic",
                    fontSize: "7pt",
                  }}
                >
                  sense imatge
                </div>
              )}
              {isSelected && (
                <div
                  style={{
                    position: "absolute",
                    top: 4,
                    left: 4,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: NAVY,
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "9pt",
                    fontWeight: 900,
                  }}
                >
                  ✓
                </div>
              )}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: "7.5pt",
                fontWeight: isSelected ? 700 : 400,
                color: isSelected ? NAVY : PDF_COLORS.textBody,
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              {opt.name}
            </div>
            {isSelected && (
              <div
                style={{
                  fontSize: "6.5pt",
                  color: NAVY,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  marginTop: 1,
                }}
              >
                Seleccionat
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionPillTenor({ number, title }: { number: string; title: string }) {
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
