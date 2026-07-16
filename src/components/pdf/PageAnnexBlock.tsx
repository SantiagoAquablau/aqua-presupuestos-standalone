/**
 * Generic, reusable A4 page for annex PDFs. Mirrors the look of the existing
 * PageAnnex* pages (header "ANNEX" + navy hairline + pill with section name
 * and total + bullets) but driven purely by data, so it works for both
 * assisted (bomba de calor, robot, cobertor…) and manual annexes.
 */
import type { CSSProperties } from "react";
import { PDF_COLORS, PDF_FONTS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";
import { annexEnumPrefix, AnnexGrandTotalBadge } from "./PdfAnnexShared";

const NAVY = "#2f4494";

export interface AnnexBlockBullet {
  description: string;
  quantity?: number;
  unit?: string;
  totalSale?: number;
  imageUrl?: string;
}

export interface PageAnnexBlockProps {
  sectionLabel: string;
  subtitle?: string;
  bullets: AnnexBlockBullet[];
  total: number;
  /** Position in the list of inclos blocks (1-indexed). */
  annexIndex?: number;
  annexTotalCount?: number;
  isLastAnnex?: boolean;
  annexGrandTotal?: number;
  backgroundImageUrl?: string;
  /** When set (manual annex), shown above the table instead of "Subministrament i col·locació de:". */
  reason?: string;
  /** Manual annexes render a simple "name left · amount right" table without qty/unit. */
  tableMode?: boolean;
}

const bulletStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  fontSize: "10pt",
  lineHeight: 1.45,
  alignItems: "baseline",
};

export function PageAnnexBlock({
  sectionLabel,
  subtitle,
  bullets,
  total,
  annexIndex,
  annexTotalCount,
  isLastAnnex,
  annexGrandTotal,
  backgroundImageUrl,
  reason,
  tableMode,
}: PageAnnexBlockProps) {
  const enumPx = annexEnumPrefix(annexIndex, annexTotalCount);
  const imageBullets = tableMode ? [] : bullets.filter((b) => b.imageUrl);

  return (
    <section style={pdfPageStyle}>
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
            margin: "0 0 8mm 0",
            fontWeight: 400,
          }}
        >
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>
            {enumPx}
            {sectionLabel.toUpperCase()}
          </span>
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px", fontWeight: 700 }}>
            {formatEuro(total)}
          </span>
        </div>

        {subtitle && (
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
        )}

        <div style={{ display: "flex", gap: "10mm", alignItems: "flex-start" }}>
          {imageBullets.length > 0 && (
            <div style={{ flex: "0 0 70mm", display: "flex", flexDirection: "column", gap: "6mm" }}>
              {imageBullets.slice(0, 2).map((b, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <img
                    src={b.imageUrl as string}
                    crossOrigin="anonymous"
                    alt={b.description}
                    style={{
                      width: "70mm",
                      height: "auto",
                      maxHeight: "70mm",
                      objectFit: "contain",
                      display: "block",
                      margin: "0 auto",
                    }}
                  />
                  <div
                    style={{
                      marginTop: "2mm",
                      fontStyle: "italic",
                      color: NAVY,
                      fontSize: "9pt",
                      fontWeight: 600,
                    }}
                  >
                    {b.description}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ flex: 1 }}>
            {reason ? (
              <p
                style={{
                  color: NAVY,
                  fontWeight: 700,
                  fontSize: "11pt",
                  margin: "0 0 4mm 0",
                  lineHeight: 1.4,
                  whiteSpace: "pre-wrap",
                }}
              >
                {reason}
              </p>
            ) : !tableMode ? (
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
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: "2.5mm" }}>
              {bullets.map((b, i) => {
                const totalText =
                  typeof b.totalSale === "number" && b.totalSale > 0
                    ? formatEuro(b.totalSale)
                    : "";
                if (tableMode) {
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        fontSize: "10pt",
                        lineHeight: 1.45,
                        padding: "3px 2px",
                      }}
                    >
                      <span style={{ flex: 1 }}>
                        <span style={{ color: NAVY, fontWeight: 700, marginRight: 6 }}>·</span>
                        <strong style={{ color: PDF_COLORS.textBody }}>{b.description}</strong>
                      </span>
                      <span
                        style={{
                          flex: "0 0 32mm",
                          textAlign: "right",
                          fontWeight: 700,
                          color: "#254061",
                        }}
                      >
                        {totalText}
                      </span>
                    </div>
                  );
                }
                const qtyPart =
                  typeof b.quantity === "number" && b.quantity > 0
                    ? ` (${b.quantity}${b.unit ? " " + b.unit : ""})`
                    : "";
                const totalPart = totalText ? ` — ${totalText}` : "";
                return (
                  <div key={i} style={bulletStyle}>
                    <span style={{ color: NAVY, fontWeight: 700 }}>·</span>
                    <span>
                      <strong style={{ color: PDF_COLORS.textBody }}>{b.description}</strong>
                      {qtyPart}
                      {totalPart}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {isLastAnnex && <AnnexGrandTotalBadge total={annexGrandTotal || 0} />}

      {backgroundImageUrl && (
        <img
          src={backgroundImageUrl}
          alt=""
          crossOrigin="anonymous"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: "55%",
            objectFit: "cover",
            objectPosition: "bottom",
            opacity: 0.55,
            zIndex: 0,
          }}
        />
      )}
    </section>
  );
}

void PDF_FONTS;