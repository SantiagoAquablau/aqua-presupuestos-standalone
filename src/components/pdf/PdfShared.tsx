/**
 * Reusable visual atoms used across PDF pages:
 *  - <PdfPageHeader> – top section title with corporate logo + horizontal rule
 *  - <SectionPill>   – numbered section badge (e.g. "1.- ESTRUCTURA  7.980,00 €")
 *  - <TotalBadge>    – rounded "TOTAL ESTRUCTURA" pill (bottom-right)
 *  - <RecommendCard> – cream "Recomanen ..." card with ribbon icon
 */
import type { CSSProperties } from "react";
import { PDF_COLORS, PDF_FONTS, formatEuro } from "./pdfStyles";

export function PdfLogo({ size = 80, variant = "color" }: { size?: number; variant?: "color" | "white" }) {
  // Real branded AquaBlau logo (PNG). White variant is used on the
  // dark cover photo (page 1); color variant on every other page.
  const src = variant === "white" ? "/pdf/logo-white.webp" : "/pdf/logo-color.png";
  return (
    <img
      src={src}
      alt="Piscines AquaBlau"
      crossOrigin="anonymous"
      style={{
        width: size,
        height: "auto",
        display: "block",
        //marginTop: "40px",
        marginBottom: "-46px",
      }}
    />
  );
}

export function PdfPageHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        padding: "14mm 14mm 0 14mm",
      }}
    >
      <h1
        style={{
          fontFamily: PDF_FONTS.serif,
          fontWeight: 400,
          fontSize: "42pt",
          color: PDF_COLORS.navy,
          letterSpacing: 4,
          margin: 0,
          lineHeight: 1,
        }}
      >
        {title}
      </h1>
      <PdfLogo size={70} />
    </div>
  );
}

export function PdfHeaderRule() {
  return (
    <div
      style={{
        height: 3,
        background: PDF_COLORS.navy,
        margin: "4mm 14mm 8mm 14mm",
      }}
    />
  );
}

export function SectionPill({
  number,
  title,
  amount,
  amountLabel,
}: {
  number: string;
  title: string;
  amount?: number;
  amountLabel?: string; // e.g. "S/C", "INCLÓS"
}) {
  return (
    <div
      style={{
        backgroundColor: PDF_COLORS.badgePill,
        color: PDF_COLORS.navy,
        borderRadius: 999,
        padding: "8px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: PDF_FONTS.sans,
        fontSize: "14pt",
        letterSpacing: 1,
        margin: "0 0 6mm 0",
        fontWeight: 700,
      }}
    >
      <span>
        {number}.- {title}
      </span>
      <span style={{ fontWeight: 700 }}>{amountLabel ?? (typeof amount === "number" ? formatEuro(amount) : "")}</span>
    </div>
  );
}

export function TotalBadge({ label, amount, style }: { label: string; amount: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "14mm",
        right: "14mm",
        backgroundColor: PDF_COLORS.badgePill,
        color: PDF_COLORS.navy,
        borderRadius: 24,
        padding: "12px 28px",
        textAlign: "center",
        boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
        border: "2px solid #FFFFFF",
        outline: `2px solid ${PDF_COLORS.badgePill}`,
        ...style,
      }}
    >
      <div style={{ fontFamily: PDF_FONTS.serif, fontSize: "18pt", letterSpacing: 2, lineHeight: 1 }}>TOTAL</div>
      <div style={{ fontSize: "10pt", letterSpacing: 2, marginTop: 2, fontWeight: 600 }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily: PDF_FONTS.serif, fontSize: "14pt", marginTop: 4 }}>{formatEuro(amount)}</div>
    </div>
  );
}

export function RecommendCard({
  title,
  bullets,
  width = "85mm",
}: {
  title: string;
  bullets: string[];
  width?: string;
}) {
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Ribbon / thumbs-up icon */}
      <div
        style={{
          position: "absolute",
          top: -14,
          left: -14,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#FFFFFF",
          border: `2px solid ${PDF_COLORS.navy}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: PDF_COLORS.navy,
          fontSize: 22,
          zIndex: 2,
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 10v12" />
          <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10l5-7c.36 0 1.45.21 1.86 1.06.41.85.41 2.07.14 2.82Z" />
        </svg>
      </div>
      <div
        style={{
          width,
          background: "#FFFFFF",
          borderRadius: 12,
          padding: "14px 16px 14px 38px",
          fontFamily: PDF_FONTS.sans,
          fontSize: "10pt",
          color: PDF_COLORS.textDark,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontWeight: 700, color: PDF_COLORS.navy, marginBottom: 6 }}>
          {title.split("\n").map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
        <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.5 }}>
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
