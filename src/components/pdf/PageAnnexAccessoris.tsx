/**
 * Annex page for "Accessoris bàsics" / "Accessoris opcionals" — mirrors the
 * look of PageAccessoris (table-style rows + bottom background image + TOTAL
 * ANNEX badge), so assisted accessoris annexes match the original budget PDF.
 */
import { PDF_COLORS, PDF_FONTS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";
import { annexEnumPrefix, AnnexGrandTotalBadge, type AnnexInclosProps } from "./PdfAnnexShared";

const NAVY = "#2f4494";

export interface AnnexAccessoriLine {
  label: string;
  qty: number;
  total: number;
}

export interface PageAnnexAccessorisProps extends AnnexInclosProps {
  variant: "basics" | "opcionals";
  lines: AnnexAccessoriLine[];
  total: number;
  sectionNumber?: string;
}

export function PageAnnexAccessoris({
  variant,
  lines,
  total,
  annexIndex,
  annexTotalCount,
  isLastAnnex,
  annexGrandTotal,
}: PageAnnexAccessorisProps) {
  const title = variant === "basics" ? "ACCESSORIS BÀSICS" : "ACCESSORIS OPCIONALS";
  const enumPx = annexEnumPrefix(annexIndex, annexTotalCount);

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
          ANNEX
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
        {/* Section pill */}
        <div
          style={{
            backgroundColor: PDF_COLORS.badgePill,
            color: NAVY,
            borderRadius: 999,
            padding: "0 32px",
            minHeight: "44px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: '"Tenor Sans", serif',
            fontSize: "14pt",
            letterSpacing: 1,
            margin: "0 0 6mm 0",
            fontWeight: 400,
          }}
        >
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>
            {enumPx}
            {title}
          </span>
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px", fontWeight: 700 }}>
            {formatEuro(total)}
          </span>
        </div>

        <div
          style={{
            padding: "0 4mm",
            fontSize: "10pt",
            lineHeight: 1.45,
          }}
        >
          {lines.length === 0 ? (
            <div style={{ fontStyle: "italic", color: PDF_COLORS.textMuted }}>
              Cap accessori seleccionat.
            </div>
          ) : (
            lines.map((l, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  marginTop: 4,
                }}
              >
                <div style={{ flex: 1 }}>
                  - {l.qty} × {l.label}
                </div>
                <div
                  style={{
                    flex: "0 0 32mm",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#254061",
                  }}
                >
                  {formatEuro(l.total)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {isLastAnnex && <AnnexGrandTotalBadge total={annexGrandTotal || 0} />}

      <img
        src="/pdf/fondo_accesorios.webp"
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