/**
 * Annex — SISTEMA NETEJA FONS INTEGRAT.
 * Same structure as PageAnnexProjecte / PageAnnexExcavacio.
 * Variant "inclos" → before Resum (navy pill, plain amount).
 * Variant "opcional" → after Resum (orange pill, "+ " prefix, italic note).
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";
import { annexEnumPrefix, AnnexGrandTotalBadge, type AnnexInclosProps } from "./PdfAnnexShared";

const NAVY = "#2f4494";
const ORANGE = "#ff751f99";

export function PageAnnexNetejafons({
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

  const fons = data.annexNetejafonsFons ?? 0;
  const escala = data.annexNetejafonsEscala ?? 0;
  const plataforma = data.annexNetejafonsPlataforma ?? 0;
  const platLabel = (data.annexNetejafonsPlataformaLabel || "Plataforma").toLowerCase();
  const capcal = data.annexNetejafonsCapcalLabel || "Capçal D.63";
  const bomba = data.annexNetejafonsBombaLabel || "Bomba";
  const bombaQty = data.annexNetejafonsBombaQty ?? 1;
  const amount = data.annexNetejafonsAmount ?? 0;

  const equipment: string[] = [];
  if (fons > 0) equipment.push(`${fons} impulsors de fons`);
  if (escala > 0) equipment.push(`${escala} impulsors d'escala`);
  if (plataforma > 0) equipment.push(`${plataforma} impulsors de ${platLabel}`);
  equipment.push(`1 ${capcal}`);
  equipment.push(`${bombaQty} ${bomba}`);
  equipment.push("Maniobra elèctrica");

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
            {enumPx}SISTEMA NETEJA FONS INTEGRAT
          </span>
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px", fontWeight: 700 }}>
            {prefix}
            {formatEuro(amount)}
          </span>
        </div>

        {/* Bold blue subtitle */}
        <p
          style={{
            color: NAVY,
            fontWeight: 700,
            fontSize: "11.5pt",
            margin: "0 0 4mm 0",
            lineHeight: 1.35,
          }}
        >
          COM FUNCIONEN EL NETEJA FONS AUTOMÀTICS INTEGRATS NET 'N' CLEAN?
        </p>

        <p
          style={{
            fontSize: "10.5pt",
            lineHeight: 1.5,
            color: PDF_COLORS.textBody,
            margin: "0 0 4mm 0",
          }}
        >
          Els sistemes automàtics de neteja integrats són una gran solució per a piscines de nova construcció. Estan
          composts per vàlvules distribuïdores que reben l'aigua d'una aspiració independent del sistema de filtració.
        </p>
        <p
          style={{
            fontSize: "10.5pt",
            lineHeight: 1.5,
            color: PDF_COLORS.textBody,
            margin: "0 0 8mm 0",
          }}
        >
          La distribueixen de manera seqüencial a filtres col·locats al fons de la piscina. La seva funció és mantenir
          les partícules de brutícia en suspensió. Així, el skimmer i l'embornal poden recollir-les per conduir-les al
          filtre.
        </p>

        {/* Image + equipment list */}
        <div style={{ display: "flex", alignItems: "center", gap: "10mm", margin: "0 0 6mm 0" }}>
          <div style={{ flex: "0 0 95mm", textAlign: "center" }}>
            <img
              src="/pdf/sistema_neteja_fons.webp"
              crossOrigin="anonymous"
              alt="Sistema Net 'N' Clean d'Astralpool"
              style={{ width: "95mm", height: "auto", objectFit: "contain", display: "block" }}
            />
            <div
              style={{
                marginTop: "3mm",
                fontStyle: "italic",
                color: NAVY,
                fontSize: "9.5pt",
                fontWeight: 600,
              }}
            >
              Sistema Net 'N' Clean d'Astralpool
            </div>
          </div>

          {/* Big curly brace + equipment list */}
          <div style={{ flex: 1, display: "flex", alignItems: "stretch", gap: "4mm" }}>
            <div
              style={{
                fontFamily: '"Cormorant Garamond", "Playfair Display", Georgia, serif',
                fontSize: "110pt", //160pt
                color: NAVY,
                lineHeight: 0.85,
                marginTop: "-108px",
                fontWeight: 200,
                transform: "scaleY(1.15)",
                transformOrigin: "center",
                display: "flex",
                alignItems: "center",
              }}
            >
              {"{"}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div
                style={{
                  color: NAVY,
                  fontWeight: 700,
                  fontSize: "11pt",
                  margin: "0 0 3mm 0",
                }}
              >
                Equipament necessari:
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: "10.5pt", lineHeight: 1.6 }}>
                {equipment.map((t) => (
                  <li key={t} style={{ display: "flex", gap: 8 }}>
                    <span style={{ color: NAVY, fontWeight: 700 }}>·</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
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

      <img
        src="/pdf/fondo_netejafons.webp"
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

void PDF_FONTS;
