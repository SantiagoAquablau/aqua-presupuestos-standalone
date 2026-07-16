/**
 * Last page of the PDF: contact / closing page ("PARLEM?").
 * Full-bleed background image with overlaid title, divider, pill and body text.
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";

const NAVY = "#2f4494";

export function PageContacte({ data }: { data: PdfData }) {
  const comercialName = data.comercialName || "—";
  const comercialEmail = data.comercialEmail || "";
  const contactPhone = data.contactPhone || "93 861 12 12";
  return (
    <section style={pdfPageStyle}>
      {/* Full-page background */}
      <img
        src="/pdf/fondo_contacto.webp"
        alt=""
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          backgroundColor: PDF_COLORS.beige,
          zIndex: 0,
        }}
      />

      {/* Header: title + logo */}
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
          PARLEM?
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
          marginLeft: 0,
          width: "calc(100% - 36mm)",
        }}
      />

      <div style={{ padding: "0 14mm", position: "relative", zIndex: 1 }}>
        {/* Section pill */}
        <div
          style={{
            backgroundColor: PDF_COLORS.badgePill,
            color: NAVY,
            borderRadius: 999,
            padding: "0 32px",
            minHeight: "44px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontFamily: '"Tenor Sans", serif',
            fontSize: "13pt",
            letterSpacing: 1,
            margin: "0 0 8mm 0",
            fontWeight: 400,
            textAlign: "center",
          }}
        >
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>
            T'ACOMPANYEM ABANS, DURANT I DESPRÉS DE CONSTRUIR LA TEVA PISCINA
          </span>
        </div>

        <p
          style={{
            fontSize: "9pt",
            lineHeight: 1.6,
            color: NAVY,
            margin: "-7mm 6mm 6mm 6mm",
          }}
        >
          A Piscines Aquablau no només construïm piscines: dissenyem, rehabilitem, mantenim i cuidem cada instal·lació
          perquè gaudeixis d'un espai elegant, eficient i durador.
        </p>

        {/* Contact block: "CONTACTE | Comercial / email / phone" */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            justifyContent: "center",
            // antes: margin: "105mm 6mm 0 6mm"
            marginTop: "110mm",
            // esto empuja el bloque hacia la derecha
            marginLeft: "8%",
            color: "#FFFFFF",
          }}
        >
          <div
            style={{
              fontFamily: PDF_FONTS.sans,
              fontSize: "22pt",
              letterSpacing: 3,
              lineHeight: 1,
              whiteSpace: "nowrap",
              fontWeight: 700,
            }}
          >
            CONTACTE
          </div>
          <div
            style={{
              width: 3,
              // línea más larga
              height: "85px",
              //alignSelf: "stretch",
              background: "#FFFFFF",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              style={{
                fontFamily: PDF_FONTS.sans,
                fontWeight: 700,
                fontSize: "15pt",
                color: NAVY,
                lineHeight: 1.1,
              }}
            >
              Comercial: {comercialName}
            </div>
            {comercialEmail && (
              <div
                style={{
                  fontFamily: PDF_FONTS.sans,
                  fontWeight: 700,
                  fontSize: "13pt",
                  color: "#FFFFFF",
                  lineHeight: 1.1,
                }}
              >
                {comercialEmail}
              </div>
            )}
            <div
              style={{
                fontFamily: PDF_FONTS.sans,
                fontWeight: 700,
                fontSize: "13pt",
                color: "#FFFFFF",
                lineHeight: 1.1,
              }}
            >
              Tel. {contactPhone}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

void PDF_FONTS;
