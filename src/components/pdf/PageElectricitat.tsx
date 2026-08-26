/**
 * Page 7 — INSTAL·LACIONS (Sections 4·5·6).
 * Mirrors Page 6 (PageDepuracio2) header/title/divider style. Three pill
 * sections: Instal·lació elèctrica (quadre + presa de terra), Instal·lació
 * fontaneria (with dynamic distance + conditional observation note), and
 * Escomesa (INCLÓS). Bottom photo intentionally removed.
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

const OBS_COLOR = "#254061";

/** Convert an ALL-CAPS string into "Title case (lowercase rest)". */
function smartCase(s: string): string {
  if (!s) return s;
  // Only transform when the input is mostly uppercase (>70% letters uppercase)
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (!letters) return s;
  const upper = letters.replace(/[^A-ZÀ-Ý]/g, "");
  if (upper.length / letters.length < 0.7) return s;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function PageElectricitat({ data }: { data: PdfData }) {
  // "Incloure aquesta secció en el pressupost" toggle for QUADRE ELÈCTRIC
  // specifically — this page also always shows Electricitat's OWN "Presa de
  // terra" row plus Fontaneria/Escomesa, all unrelated to this toggle, so
  // the whole page can't just be skipped from PdfDocument.tsx when this is
  // off; only the "Quadre elèctric de maniobra" row is hidden here instead.
  const quadreOn = data.quadreEnabled !== false;
  const quadreSale = quadreOn && typeof data.quadreSale === "number" ? data.quadreSale : 0;
  // Same toggle idea as quadreOn, for the "Presa de terra" row specifically
  // (Electricitat has its own separate "Incloure aquesta secció" toggle in
  // the wizard, independent of Quadre, even though both share this pill).
  const electricaOn = data.electricaEnabled !== false;
  const electricaSale = electricaOn && typeof data.electricaSale === "number" ? data.electricaSale : 0;
  const electricaSubtotal = quadreSale + electricaSale;
  // Fontaneria's own pill is self-contained (no unrelated content sharing
  // it, unlike Quadre/Electricitat above), so this gates the WHOLE pill
  // below rather than just one row.
  const fontaneriaOn = data.fontaneriaEnabled !== false;
  const fontaneriaSubtotal = fontaneriaOn && typeof data.fontaneriaTotal === "number" ? data.fontaneriaTotal : 0;
  const distancia = data.fontaneriaDistancia ?? 10;
  const showFontaneriaNote = !data.fontaneriaPerforacions;

  return (
    <section style={pageStyle}>
      <img
        src="/pdf/fondoElectricidadFontaneria.webp"
        crossOrigin="anonymous"
        alt=""
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: "210mm",
          height: "290mm", //297mm
          objectFit: "cover",
          zIndex: 0,
        }}
      />
      {/* Header — same style as Page 6 */}
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

      {/* Divider — same style as Page 6 */}
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
        {/* 4 — Instal·lació elèctrica — whole pill gated on either row having
            content, same pattern as Fontaneria's pill just below: with both
            quadreOn and electricaOn off, this used to still render an empty
            pill (0,00 €) with no rows underneath. */}
        {(quadreOn || electricaOn) && (
          <>
            <SectionPillTenor number="4" title="INSTAL·LACIÓ ELÈCTRICA" amount={electricaSubtotal} />
            <div style={{ padding: "0 4mm", fontSize: "10pt", lineHeight: 1.45, marginBottom: "8mm" }}>
              {quadreOn && (
                <Row
                  left={smartCase(data.quadreText || "Quadre elèctric de maniobra")}
                  right={formatEuro(quadreSale)}
                />
              )}
              {electricaOn && (
                <Row
                  left={"Presa de terra cable CU nu 35mm toma terra + piqueta coure + brida coure"}
                  right={formatEuro(electricaSale)}
                />
              )}
            </div>
          </>
        )}

        {/* 5 — Instal·lació fontaneria */}
        {fontaneriaOn && (
          <>
            <SectionPillTenor number="5" title="INSTAL·LACIÓ FONTANERIA" amount={fontaneriaSubtotal} />
            <div style={{ padding: "0 4mm", fontSize: "10pt", lineHeight: 1.5, marginBottom: "8mm" }}>
              <p style={{ margin: 0 }}>
                {data.fontaneriaText
                  ? `- ${data.fontaneriaText}`
                  : `- Instal·lació de canonades de 10 atm de pressió per a unió Depuradora - Piscina (inclòs tots els accessoris necessaris). Fins a ${Math.round(distancia)}m*.`}
              </p>
              {showFontaneriaNote && (
                <p
                  style={{
                    margin: "6px 0 0 0",
                    fontStyle: "italic",
                    color: OBS_COLOR,
                    fontSize: "8pt",
                  }}
                >
                  *En distàncies superiors o si cal travessar murs amb corona per fer arribar les canonades fins
                  al garatge o una altra ubicació similar, es comptabilitzarà a part.
                </p>
              )}
            </div>
          </>
        )}

        {/* 6 — Escomesa */}
        <SectionPillTenor number="6" title="ESCOMESA ELÈCTRICA, AIGUA I DESAIGUA" amountLabel="INCLÒS" />
        <div style={{ padding: "0 4mm", fontSize: "10pt", lineHeight: 1.5 }}>
          <div>
            <strong>1.-</strong> Instal·lació de fontaneria fins a 10 metres per fer arribar aigua a la piscina.
          </div>
          <div style={{ marginTop: 4 }}>
            <strong>2.-</strong> Instal·lació elèctrica fins a 10m. per fer arribar electricitat a la sala de màquines.
          </div>
          <p style={{ margin: "6px 0 0 0", fontStyle: "italic", color: OBS_COLOR, fontSize: "8pt" }}>
            *Es comptabilitzarà a part tant el material com la mà d'obra:
          </p>
          <ul style={{ margin: "2px 0 0 18px", padding: 0, fontStyle: "italic", color: OBS_COLOR, fontSize: "8pt" }}>
            <li>Si hem de destinar hores a la cerca de l'escomesa d'aigua o llum.</li>
            <li>Si alguna d'aquestes s'ha d'allargar o fer arribar fins a la zona de destí.</li>
            <li>Si hem de realitzar rases per trobar el desaigua i connectar a la instal·lació depuradora.</li>
          </ul>
        </div>
      </div>
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

function SectionPillTenor({
  number,
  title,
  amount,
  amountLabel,
}: {
  number: string;
  title: string;
  amount?: number;
  amountLabel?: string;
}) {
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
      <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>
        {amountLabel ?? (typeof amount === "number" ? formatEuro(amount) : "")}
      </span>
    </div>
  );
}
