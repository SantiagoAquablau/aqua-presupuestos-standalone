/**
 * Page 8 — INSTAL·LACIONS (continuació): Accessoris encastats + addicionals.
 * Header / divider / pill style mirror Page 7. Vertically-centered TOTAL
 * INSTAL·LACIONS badge on the right (same look as TOTAL ACABATS).
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, formatEuro } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";

const pageStyle: React.CSSProperties = {
  position: "relative",
  width: "210mm",
  height: "297mm",
  background: "#efe9e5",
  fontFamily: PDF_FONTS.sans,
  color: PDF_COLORS.textBody,
  overflow: "hidden",
  boxSizing: "border-box",
};

export function PageAccessoris({ data }: { data: PdfData }) {
  const basics = data.accBasicLines || [];
  const opts = data.accOptionalLines || [];
  const basicsTotal = data.accBasicTotal || 0;
  const optsTotal = data.accOptionalTotal || 0;
  const totalInstal = data.instalacionsTotal || 0;
  const colorLabel = data.accBasicsColor === "color" ? "color" : "blancs";

  return (
    <section style={pageStyle}>
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
            color: "#2f4494",
            letterSpacing: 4,
            margin: 0,
            lineHeight: 1,
          }}
        >
          INSTAL·LACIONS
        </h1>
        <PdfLogo size={85} />
      </div>

      {/* Divider */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: 6,
          background: "#2f4494",
          margin: "10mm 14mm 8mm 0",
          marginLeft: "0mm",
          width: "calc(100% - 36mm)",
        }}
      />

      <div style={{ padding: "0 14mm", position: "relative", zIndex: 1 }}>
        {/* 7 — Accessoris encastats */}
        <SectionPillTenor number="7" title="ACCESSORIS ENCASTATS" amount={basicsTotal} />
        <div
          style={{
            padding: "0 4mm",
            fontSize: "10pt",
            lineHeight: 1.45,
            marginBottom: "3mm",
          }}
        >
          {basics.length === 0 ? (
            <div style={{ fontStyle: "italic", color: PDF_COLORS.textMuted }}>Cap accessori seleccionat.</div>
          ) : (
            basics.map((line, i) => <Row key={i} left={`${line.qty} × ${line.label}`} right={formatEuro(line.total)} />)
          )}
          <Row
            left="KIT DE NETEJA (NETEJA FONS MANUAL, MÀNEGA AUTO FLOTANT, RASPALL, RECOLLIDOR DE FULLES, PÈRTIGA TELESCÒPICA I KIT ANÀLISIS.)"
            right="S/C"
          />
          <div style={{ marginTop: 6, fontStyle: "italic", color: "#254061", fontSize: "9.5pt" }}>
            * Color dels accessoris bàsics: <strong style={{ textTransform: "capitalize" }}>{colorLabel}</strong>.
          </div>
        </div>

        {/* 8 — Accessoris addicionals (only when there's at least one) */}
        {opts.length > 0 && (
          <div style={{ marginTop: "8mm" }}>
            <SectionPillTenor number="8" title="ACCESSORIS ADDICIONALS" amount={optsTotal} />
            <div style={{ padding: "0 4mm", fontSize: "10pt", lineHeight: 1.45 }}>
              {opts.map((line, i) => (
                <Row key={i} left={`${line.qty} × ${line.label}`} right={formatEuro(line.total)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TOTAL INSTAL·LACIONS — same style as TOTAL ACABATS / TOTAL ESTRUCTURA */}
      <div
        style={{
          position: "absolute",
          top: "70%",
          right: "14mm",
          transform: "translateY(-50%)",
          zIndex: 2,
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
        <div style={{ fontSize: "10pt", letterSpacing: 2, marginTop: 2, fontWeight: 600 }}>INSTAL·LACIONS</div>
        <div style={{ fontSize: "16pt", marginTop: -4, fontWeight: 900 }}>{formatEuro(Math.round(totalInstal))}</div>
      </div>

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

function Row({ left, right }: { left: string; right: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 4 }}>
      <div style={{ flex: 1 }}>- {left}</div>
      <div style={{ flex: "0 0 32mm", textAlign: "right", fontWeight: 700, color: "#254061" }}>{right}</div>
    </div>
  );
}

function SectionPillTenor({ number, title, amount }: { number: string; title: string; amount: number }) {
  return (
    <div
      style={{
        backgroundColor: PDF_COLORS.badgePill,
        color: "#2f4494",
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
        {number}.- {title}
      </span>
      <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>{formatEuro(amount)}</span>
    </div>
  );
}
