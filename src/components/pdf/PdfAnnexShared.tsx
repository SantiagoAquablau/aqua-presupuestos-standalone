/**
 * Shared helpers for "Annex inclos" pages:
 *   - annexEnumPrefix(): "{N}.- " when there are 2+ included annexes, otherwise "".
 *   - <AnnexGrandTotalBadge />: bottom-right pill rendered ONLY on the last
 *     included annex page, mirroring the TOTAL INSTAL·LACIONS look.
 */
import { PDF_COLORS, formatEuro } from "./pdfStyles";

export interface AnnexInclosProps {
  annexIndex?: number;
  annexTotalCount?: number;
  isLastAnnex?: boolean;
  annexGrandTotal?: number;
}

export function annexEnumPrefix(index?: number, count?: number): string {
  if (!index || !count || count < 2) return "";
  return `${index}.- `;
}

export function AnnexGrandTotalBadge({ total }: { total: number }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "18mm",
        right: "14mm",
        zIndex: 3,
        backgroundColor: PDF_COLORS.badgePill,
        color: "#2f4494",
        borderRadius: 999,
        padding: "10px 28px",
        textAlign: "center",
        border: "3px solid #FFFFFF",
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
        fontFamily: '"Tenor Sans", serif',
      }}
    >
      <div style={{ fontSize: "20pt", letterSpacing: 3, lineHeight: 1, marginTop: "-12px" }}>TOTAL</div>
      <div style={{ fontSize: "10pt", letterSpacing: 2, marginTop: 2, fontWeight: 600 }}>ANNEX</div>
      <div style={{ fontSize: "16pt", marginTop: -4, fontWeight: 900 }}>{formatEuro(Math.round(total))}</div>
    </div>
  );
}