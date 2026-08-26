/**
 * Page 6 — INSTAL·LACIONS (Section 3: Desinfecció amb electròlisi salina).
 * Same header style as Page 5. Right card uses bomba-variable icon. Bottom
 * full-width image (electrolisis.jpg). Mòdul Ethernet / WIFI displayed as
 * Inclou / No inclou with differential price (mirrors prefiltre HYDROSPIN).
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

// Generic fallback shown only when the selected article has no catalog
// characteristics defined (older budgets, or articles not yet filled in).
const FALLBACK_FEATURES = [
  "Pantalla tàctil extraïble.",
  "Control de salinitat de l'aigua.",
  "Control de producció i bomba de filtració.",
];

export function PageDepuracio2({ data }: { data: PdfData }) {
  const wifiOn = !!data.wifiEnabled;
  // Equip-level flag (technical_specs.wifi_incorporat): the clorador already
  // has WiFi built in, so the separate module block/bullet below is handled
  // entirely apart from `hidrolisiFeatures` (the 4 manual characteristics) —
  // if an admin also mentions WiFi manually in feature1-4, that's on them to
  // avoid duplicating; this component does no de-dup between the two.
  const wifiIncorporat = !!data.hidrolisiWifiIncorporat;
  // Equip doesn't support WiFi at all — no bullet, no module block, same
  // treatment as wifiIncorporat but without the "inclosa" wording (there's
  // nothing to include or offer as an add-on).
  const noPermetWifi = !!data.hidrolisiNoPermetWifi;
  const equipName = data.hidrolisiName || "AQUARITE NEO";
  const equipImg = data.hidrolisiImageUrl || "/pdf/electrolisis-ltneo.webp";
  const wifiName = data.wifiName || "Mòdul Ethernet Hayward Aquarite";
  const wifiImg = data.wifiImageUrl || "/pdf/modulo-wifi-ethernet.webp";
  const featureBullets =
    data.hidrolisiFeatures && data.hidrolisiFeatures.length > 0 ? data.hidrolisiFeatures : FALLBACK_FEATURES;
  const cellHours = data.hidrolisiCellHours || 8000;
  // No bullet at all when the equip doesn't support WiFi.
  const wifiBullet = noPermetWifi
    ? undefined
    : wifiIncorporat
      ? "Connexió WI-FI inclosa."
      : wifiOn
        ? "Connexió WI-FI."
        : "Connexió WI-FI {{ORANGE:opcional*}}.";

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
        <SectionPillTenor number="3" title="DESINFECCIÓ AMB ELECTRÒLISI SALINA" amount={data.hidrolisiTotal || 0} />

        {/* Avantatges */}
        <div style={{ fontWeight: 700, color: "#2f4494", fontSize: "12pt", marginBottom: 4 }}>Avantatges</div>
        <div style={{ margin: "0 0 5mm 0", fontSize: "10pt", lineHeight: 1.45, color: PDF_COLORS.textBody }}>
          <div>
            · <strong>Desinfecció estable:</strong> genera clor lliure automàticament a partir de sal amb dosificació
            constant.
          </div>
          <div>
            · <strong>Més confort:</strong> menys olor de "clor" i menys irritacions per desajustos.
          </div>
          <div>
            · <strong>Més seguretat:</strong> menys manipulació i emmagatzematge de productes químics.
          </div>
          <div>
            · <strong>Control i eficiència:</strong> ajust segons ús i temperatura; fàcil d'automatitzar.
          </div>
          <div>
            · <strong>Estalvi a mitjà termini:</strong> menys consum de desinfectant i reposicions (segons ús).
          </div>
          <div>
            · <strong>Més sostenible:</strong> menys envasos i transport; ús més racional de recursos.
          </div>
        </div>

        {/* Equipament + image + recommend card */}
        <div style={{ display: "flex", gap: "4mm", alignItems: "flex-start", position: "relative" }}>
          <div style={{ flex: 0.85 }}>
            <div style={{ fontWeight: 700, color: "#2f4494", fontSize: "12pt", marginBottom: 4 }}>Equipament</div>
            <div style={{ margin: "0 0 4mm 0", fontSize: "10pt", lineHeight: 1.55, color: PDF_COLORS.textBody }}>
              <div>· Cèl·lula elèctrode (garantia {cellHours} hores)</div>
              <div>· Quadre de control</div>
              <div>· Sondas REDOX (ORP) i pH.</div>
              <div>· Injector de reductor de pH + bomba peristàltica.</div>
            </div>
            {data.hidrolisiAltName && (
              <div style={{ fontSize: "9pt", fontStyle: "italic", color: PDF_COLORS.textBody, lineHeight: 1.3 }}>
                Alternativa disponible: {data.hidrolisiAltName}
              </div>
            )}
          </div>

          {/* Equipment image + model */}
          <div style={{ flex: 0.6, textAlign: "center", paddingTop: 4 }}>
            {equipImg ? (
              <img
                src={equipImg}
                alt=""
                crossOrigin="anonymous"
                style={{ width: "55mm", height: "38mm", objectFit: "contain", display: "block", margin: "0 auto" }}
              />
            ) : (
              <div style={{ width: "55mm", height: "38mm", margin: "0 auto" }} />
            )}
            <div
              style={{
                fontSize: "8.5pt",
                fontWeight: 700,
                color: PDF_COLORS.textDark,
                marginTop: 4,
                lineHeight: 1.2,
              }}
            >
              {equipName}
            </div>
          </div>

          {/* Connector line */}
          <div
            style={{
              position: "absolute",
              left: "52%",
              width: 96,
              top: "44%",
              height: 0,
              borderTop: "2px solid #1f497d",
              zIndex: 2,
            }}
          />

          {/* Right recommend card */}
          <div style={{ flex: 0.95, position: "relative", paddingTop: 4 }}>
            <RecommendCardOrange
              title={equipName}
              bullets={wifiBullet ? [...featureBullets, wifiBullet] : featureBullets}
              accentColor="#1f497d"
              iconSrc="/pdf/icono-bomba-variable.webp"
            />
          </div>
        </div>

        {/* Inclou + WiFi block — left text column, right small WiFi image under equipment image */}
        <div style={{ marginTop: "4mm", display: "flex", gap: "4mm", alignItems: "flex-start" }}>
          <div style={{ flex: 1.45 }}>
            <InclouLine icon="check">
              <div>
                <strong>Inclou:</strong>
                <div style={{ marginLeft: 0, marginTop: 2 }}>Material PVC (vàlvules, colzes i canonades)</div>
                <div>Sal especial piscines</div>
                <div>Primer bidó de reductor de pH</div>
              </div>
            </InclouLine>

            {/* Separate WiFi module Inclou/No inclou line — doesn't apply at
                all when the equip already has WiFi built in (wifiIncorporat)
                or doesn't support WiFi at all (noPermetWifi). */}
            {!wifiIncorporat && !noPermetWifi && (
              <div style={{ marginTop: "3mm" }}>
                <InclouLine icon={wifiOn ? "check" : "x"}>
                  <div>
                    <strong>{wifiOn ? "Inclou:" : "No inclou:"}</strong> Mòdul Ethernet / WIFI
                    {!wifiOn && (
                      <div style={{ color: "#ff751f", fontWeight: 700, marginTop: 2 }}>
                        Preu {wifiName}:{" "}
                        {typeof data.wifiSale === "number" ? `+${formatEuroNoCurrency(data.wifiSale)} €` : ""}
                      </div>
                    )}
                  </div>
                </InclouLine>
              </div>
            )}
          </div>

          {/* Right column: WiFi image aligned under equipment image — hidden
              when wifiIncorporat or noPermetWifi, same as the Inclou/No
              inclou line above. */}
          {!wifiIncorporat && !noPermetWifi && (
            <div style={{ flex: 0.55, textAlign: "center" }}>
              <div style={{ position: "relative", display: "inline-block" }}>
                <div
                  style={{
                    position: "absolute",
                    top: 88,
                    left: "-248px",
                    width: 44,
                    height: 46,
                    background: "#f6c5af",
                    borderRadius: 12,
                    zIndex: 0,
                  }}
                />
                <img
                  src={wifiImg}
                  alt=""
                  crossOrigin="anonymous"
                  style={{
                    position: "relative",
                    width: "14mm",
                    height: "18mm",
                    objectFit: "contain",
                    zIndex: 1,
                    left: "-240px",
                    top: 74,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom image — clorador salino, sized to fit beneath the content */}
      <img
        src="/pdf/fondo_electrolisis.webp"
        alt=""
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: "85%",
          objectFit: "cover",
          objectPosition: "center",
          zIndex: 0,
        }}
      />
    </section>
  );
}

/* ================== Helpers (mirrored from PageDepuracio1) ================== */

function InclouLine({ icon, children }: { icon: "check" | "x"; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <div style={{ flexShrink: 0, marginTop: 0 }}>
        <span
          style={{
            display: "inline-block",
            width: 14,
            height: 14,
            color: "#a8b8c4",
            fontWeight: 700,
            fontSize: "11pt",
            lineHeight: 1,
          }}
        >
          {icon === "check" ? "✓" : "✕"}
        </span>
      </div>
      <div style={{ flex: 1, fontSize: "10pt", lineHeight: 1.4 }}>{children}</div>
    </div>
  );
}

function RecommendCardOrange({
  title,
  bullets,
  accentColor = "#ff751f",
  iconSrc,
}: {
  title: string;
  bullets: string[];
  accentColor?: string;
  iconSrc?: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        background: "#ffffff",
        borderRadius: 22,
        padding: "10px 14px 10px 18px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        border: "1px solid #f0e7df",
        marginLeft: 28,
        minHeight: "auto",
      }}
    >
      <img
        src={iconSrc || "/pdf/check-double.png"}
        alt=""
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          top: -2,
          left: -37,
          width: 46,
          height: 46,
          zIndex: 3,
        }}
      />
      <div
        style={{
          color: accentColor,
          fontWeight: 700,
          fontSize: "10.5pt",
          lineHeight: 1.2,
          marginBottom: 6,
        }}
      >
        {title.split("\n").map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
      <div style={{ margin: 0, lineHeight: 1.35, fontSize: "8.5pt" }}>
        {bullets.map((b) => (
          <div key={b} style={{ marginBottom: 2 }}>
            · {renderWithOrange(b)}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderWithOrange(text: string): React.ReactNode {
  // Renders {{ORANGE:...}} fragments in orange to mirror the "no inclou" price color.
  const parts = text.split(/(\{\{ORANGE:[^}]+\}\})/g);
  return parts.map((p, i) => {
    const m = p.match(/^\{\{ORANGE:([^}]+)\}\}$/);
    if (m) {
      return (
        <span key={i} style={{ color: "#ff751f", fontWeight: 700 }}>
          {m[1]}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function formatEuroNoCurrency(n: number): string {
  return new Intl.NumberFormat("ca-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
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
