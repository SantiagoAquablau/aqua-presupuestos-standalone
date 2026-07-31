/**
 * Page 5 — INSTAL·LACIONS.
 * Header styled like ESTRUCTURA / ACABATS (Tenor Sans navy 46pt, blue divider, logo right).
 * Section 1 pill — DEPURACIÓ.
 * Shows ONLY the included filter (Filtre de sorra laminat OR Filtre de cartutx)
 * with image, model, "Inclou:" line for AFM/sorra, and "Inclou/No inclou:"
 * line for the Hydrospin prefiltre. A right-side recommendation card shows
 * benefits of either AFM glass or the SwimClear cartridge filter.
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";

export function PageDepuracio1({ data }: { data: PdfData }) {
  const isSorra = (data.filtreInclosTipus ?? "sorra") === "sorra";
  const depuracioAmount =
    typeof data.depuracioSectionAmount === "number" ? data.depuracioSectionAmount : data.phaseDepuracioTotal;

  return (
    <section style={pdfPageStyle}>
      {/* Full-height background image */}
      <img
        src="/pdf/fondo_instalacion.webp"
        crossOrigin="anonymous"
        alt=""
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "210mm",
          height: "297mm",
          objectFit: "cover",
          zIndex: 0,
        }}
      />
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
        <SectionPillTenor number="1" title="DEPURACIÓ" amount={depuracioAmount} />

        {isSorra ? <SorraBlock data={data} /> : <CartutxBlock data={data} />}

        {/* Section 2 — GRUP MOTOBOMBA AUTOASPIRANT */}
        {data.bombaInclosTipus && (
          <div style={{ marginTop: "4mm" }}>
            <SectionPillTenor number="2" title="GRUP MOTOBOMBA AUTOASPIRANT" amount={data.bombaInclosTotal || 0} />
            {data.bombaInclosTipus === "inverter" ? (
              <BombaVariableBlock data={data} />
            ) : (
              <BombaStandardBlock data={data} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ================== Filtre de sorra laminat (included) ================== */
function SorraBlock({ data }: { data: PdfData }) {
  const articleName = data.filtreInclosName || "ASTRAL ASTER/ICE 600 SORRA SILICE + VÀLVULA 6V";
  const afmOn = !!data.afmEnabled;
  const prefiltreOn = !!data.prefiltreEnabled;
  const prefiltreImg = data.prefiltreImageUrl || "/pdf/hydrospin.webp";

  return (
    <div style={{ display: "flex", gap: "6mm", alignItems: "flex-start", position: "relative" }}>
      {/* LEFT column */}
      <div style={{ flex: 1.05, fontSize: "8.5pt", lineHeight: 1.35, color: PDF_COLORS.textBody }}>
        <div style={{ display: "flex", gap: "5mm", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#2f4494", fontSize: "9.5pt", marginBottom: 3 }}>
              Filtre de sorra laminat
            </div>
            <div>Amb monòmetre i vàlvula selectora per a rentat, filtrat, recirculació, desguàs i tancament.</div>
          </div>

          {data.filtreInclosImageUrl ? (
            <img
              src={data.filtreInclosImageUrl}
              alt=""
              crossOrigin="anonymous"
              style={{ width: "24mm", height: "28mm", objectFit: "contain", flexShrink: 0 }}
            />
          ) : (
            <div style={{ width: "24mm", height: "28mm", flexShrink: 0 }} />
          )}
        </div>

        <div
          style={{
            textAlign: "right",
            fontSize: "8.5pt",
            fontWeight: 700,
            color: PDF_COLORS.textDark,
            marginTop: -6,
            marginBottom: 6,
            lineHeight: 1.2,
          }}
        >
          {articleName}
        </div>

        {/* AFM line */}
        <InclouLine icon="check">
          <div style={{ position: "relative" }}>
            {afmOn ? (
              <>
                <strong>Inclou:</strong>{" "}
                <span style={{ color: "#ff751f", fontWeight: 700 }}>vidre AFM ecofiltrant</span>.
              </>
            ) : (
              <>
                <strong>Inclou:</strong> sorra silícia estàndard
                <br />
                <span style={{ color: "#ff751f", fontWeight: 700 }}>Alternativa: vidre AFM ecofiltrant</span>
                {((typeof data.afmQty === "number" && data.afmQty > 0) ||
                  (typeof data.afmExtraSale === "number" && data.afmExtraSale > 0)) && (
                  <div style={{ color: "#ff751f", fontWeight: 700, marginTop: 2 }}>
                    {typeof data.afmQty === "number" && data.afmQty > 0 ? `${data.afmQty} sacs de 25 kg` : ""}
                    {typeof data.afmExtraSale === "number" && data.afmExtraSale > 0
                      ? ` +${formatEuroInt(data.afmExtraSale)} €`
                      : ""}
                  </div>
                )}
              </>
            )}
            {/* Orange connector line — always rendered, positioned at AFM text level */}
            <div
              style={{
                position: "absolute",
                right: -49,
                top: "64%",
                width: 150,
                height: 0,
                borderTop: "2px solid #ff751f",
                zIndex: 2,
              }}
            />
          </div>
        </InclouLine>

        <div style={{ height: 6 }} />

        {/* Prefiltre line */}
        <InclouLine icon={prefiltreOn ? "check" : "x"}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <strong>{prefiltreOn ? "Inclou:" : "No inclou:"}</strong> Prefiltre centrífug hidrociclònic per protegir
              el filtre i allargar vida útil.
              <div style={{ color: "#ff751f", fontWeight: 700, marginTop: 2 }}>
                {prefiltreOn ? (
                  <>Inclòs {data.prefiltreName || "HYDROSPIN COMPACT"}</>
                ) : (
                  <>
                    Preu {data.prefiltreName || "HYDROSPIN COMPACT"}:{" "}
                    {typeof data.prefiltreSale === "number" ? `+${formatEuroNoCurrency(data.prefiltreSale)} €` : ""}
                  </>
                )}
              </div>
            </div>
            <div style={{ position: "relative", width: 78, height: 78, flexShrink: 0 }}>
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: 10,
                  width: 58,
                  height: 58,
                  background: "#f6c5af",
                  borderRadius: 14,
                  zIndex: 0,
                }}
              />
              <img
                src={prefiltreImg}
                alt=""
                crossOrigin="anonymous"
                style={{ position: "relative", width: 78, height: 78, objectFit: "contain", zIndex: 1 }}
              />
            </div>
          </div>
        </InclouLine>
      </div>

      {/* RIGHT recommend card */}
      <div style={{ flex: 0.95, position: "relative", paddingTop: 50 }}>
        <RecommendCardOrange
          title={"Per què omplir el seu filtre\namb VIDRE ACTIU AFM?"}
          bullets={[
            "Filtra partícules molt més fines",
            "Filtra 50% + de substàncies orgàniques",
            "Estalvia aigua, producte químic i energia",
            "Evita olor a clor",
            "No s'ha de canviar mai",
          ]}
          bottomRightImage="/pdf/afm-glass.webp"
        />
      </div>
    </div>
  );
}

/* ================== Filtre de cartutx (included) ================== */
function CartutxBlock({ data }: { data: PdfData }) {
  const articleName = data.filtreInclosName || "HAYWARD SWIMCLEAR C200SE";
  const prefiltreOn = !!data.prefiltreEnabled;
  const prefiltreImg = data.prefiltreImageUrl || "/pdf/hydrospin.webp";
  return (
    <div style={{ display: "flex", gap: "6mm", alignItems: "flex-start" }}>
      <div style={{ flex: 1.05, fontSize: "8.5pt", lineHeight: 1.35, color: PDF_COLORS.textBody }}>
        <div style={{ display: "flex", gap: "5mm", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#2f4494", fontSize: "9.5pt", marginBottom: 3 }}>
              Filtre de cartutx
            </div>
            <div>Amb paper filtrant plisat 100% polièster.</div>
          </div>
          {data.filtreInclosImageUrl ? (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img
                src="/pdf/eco-friendly.webp"
                alt=""
                crossOrigin="anonymous"
                style={{
                  position: "absolute",
                  left: 98,
                  bottom: 6,
                  width: 40,
                  height: 40,
                  objectFit: "contain",
                  zIndex: 2,
                }}
              />
              <img
                src={data.filtreInclosImageUrl}
                alt=""
                crossOrigin="anonymous"
                style={{ width: "32mm", height: "40mm", objectFit: "contain", display: "block" }}
              />
            </div>
          ) : (
            <div style={{ width: "32mm", height: "40mm", flexShrink: 0 }} />
          )}
        </div>
        <div
          style={{
            textAlign: "right",
            fontSize: "8.5pt",
            fontWeight: 700,
            color: PDF_COLORS.textDark,
            marginTop: -6,
            marginBottom: 6,
            lineHeight: 1.2,
          }}
        >
          {articleName}
        </div>

        {/* Prefiltre line */}
        <InclouLine icon={prefiltreOn ? "check" : "x"}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <strong>{prefiltreOn ? "Inclou:" : "No inclou:"}</strong> Prefiltre centrífug hidrociclònic per protegir
              el filtre i allargar vida útil.
              <div style={{ color: "#ff751f", fontWeight: 700, marginTop: 2 }}>
                {prefiltreOn ? (
                  <>Inclòs {data.prefiltreName || "HYDROSPIN COMPACT"}</>
                ) : (
                  <>
                    Preu {data.prefiltreName || "HYDROSPIN COMPACT"}:{" "}
                    {typeof data.prefiltreSale === "number" ? `+${formatEuroNoCurrency(data.prefiltreSale)} €` : ""}
                  </>
                )}
              </div>
            </div>
            <div style={{ position: "relative", width: 78, height: 78, flexShrink: 0 }}>
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: 10,
                  width: 58,
                  height: 58,
                  background: "#f6c5af",
                  borderRadius: 14,
                  zIndex: 0,
                }}
              />
              <img
                src={prefiltreImg}
                alt=""
                crossOrigin="anonymous"
                style={{ position: "relative", width: 78, height: 78, objectFit: "contain", zIndex: 1 }}
              />
            </div>
          </div>
        </InclouLine>
      </div>

      {/* ✅ Línea naranja: hija del flex padre, se extiende entre las dos columnas */}
      <div
        style={{
          position: "absolute",
          left: "48%", // empieza al final de la columna izquierda
          right: -49, // llega hasta el borde derecho (RecommendCard)
          width: 72,
          top: "29%",
          height: 0,
          borderTop: "2px solid #1f497d",
          zIndex: 2,
        }}
      />

      <div style={{ flex: 0.95, position: "relative", paddingTop: 4 }}>
        <RecommendCardOrange
          title={"Per què un filtre de cartutx\nHayward SwimClear?"}
          bullets={[
            "Redueix les pèrdues de càrrega",
            "Gran estalvi d'aigua i producte químic",
            "Gran finor de filtració",
            "Sense contrarentat",
            "Fàcil manteniment",
          ]}
          accentColor="#1f497d"
          iconSrc="/pdf/icono-filtr-swimclear.webp"
        />
      </div>
    </div>
  );
}

/* ================== Helpers ================== */

/* ================== Bomba blocks (Section 2) ================== */
function BombaVariableBlock({ data }: { data: PdfData }) {
  const flow = data.bombaInclosFlowText || "5 a 25m3/h";
  const modelName = data.bombaInclosName || "";
  const img = data.bombaInclosImageUrl;
  return (
    <div style={{ display: "flex", gap: "6mm", alignItems: "flex-start" }}>
      {/* LEFT — title + description */}
      <div style={{ flex: 1.05, fontSize: "8.5pt", lineHeight: 1.35, color: PDF_COLORS.textBody }}>
        <div style={{ display: "flex", gap: "5mm", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#2f4494", fontSize: "9.5pt", marginBottom: 3 }}>
              Bomba de velocitat variable
            </div>
            <div>
              Amb variador de freqüència per aconseguir gran confort i reduir costos energètics. Panell amb pantalla
              tàctil. De {flow}.
            </div>
          </div>

          <div style={{ position: "relative", flexShrink: 0, width: "34mm" }}>
            {img ? (
              <img
                src={img}
                alt=""
                crossOrigin="anonymous"
                style={{
                  maxWidth: "100%",
                  maxHeight: "26mm",
                  width: "auto",
                  height: "auto",
                  objectFit: "contain",
                  display: "block",
                  margin: "0 auto",
                }}
              />
            ) : (
              <div style={{ width: "34mm", height: "26mm" }} />
            )}
            <img
              src="/pdf/eco-friendly.webp"
              alt=""
              crossOrigin="anonymous"
              style={{
                position: "absolute",
                right: -20,
                bottom: 32,
                width: 32,
                height: 32,
                objectFit: "contain",
              }}
            />
            <div
              style={{
                textAlign: "center",
                fontSize: "8.5pt",
                fontWeight: 700,
                left: -4,
                color: PDF_COLORS.textDark,
                marginTop: -2,
                lineHeight: 1.2,
                width: "170px",
              }}
            >
              {modelName}
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Línea naranja: hija del flex padre, se extiende entre las dos columnas */}
      <div
        style={{
          position: "absolute",
          left: "50%", // empieza al final de la columna izquierda
          right: -49, // llega hasta el borde derecho (RecommendCard)
          width: 54,
          top: "88%",
          height: 0,
          borderTop: "2px solid #1f497d",
          zIndex: 2,
        }}
      />

      {/* RIGHT — advantages card */}
      <div style={{ flex: 0.95, position: "relative", paddingTop: 4 }}>
        <RecommendCardOrange
          title={"Avantatges\nAQUAGEM FULL INVERTER"}
          bullets={[
            "Estalvi energètic fins a un 85%.",
            "Extremadament silencioses.",
            "Fins a 5 programes de filtració.",
            "Connectivitat integrada amb altres elements de la piscina",
          ]}
          accentColor="#1f497d"
          iconSrc="/pdf/icono-bomba-variable.webp"
        />
      </div>
    </div>
  );
}

function BombaStandardBlock({ data }: { data: PdfData }) {
  const flow = data.bombaInclosFlowText || "";
  const modelName = data.bombaInclosName || "";
  const img = data.bombaInclosImageUrl;
  return (
    <div style={{ display: "flex", gap: "6mm", alignItems: "flex-start" }}>
      <div style={{ flex: 1, fontSize: "8.5pt", lineHeight: 1.35, color: PDF_COLORS.textBody }}>
        <div style={{ fontWeight: 700, color: "#2f4494", fontSize: "9.5pt", marginBottom: 3 }}>
          Bomba amb motor stàndard
        </div>
        <div>
          Motor asíncron de dos pols, Protecció IP55. Aïllament Classe F.
          {flow ? ` (${flow})` : ""}
        </div>
      </div>
      <div style={{ flexShrink: 0, width: "45mm", textAlign: "center" }}>
        {img ? (
          <img
            src={img}
            alt=""
            crossOrigin="anonymous"
            style={{
              maxWidth: "100%",
              maxHeight: "28mm",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              display: "block",
              margin: "0 auto",
            }}
          />
        ) : (
          <div style={{ width: "45mm", height: "28mm" }} />
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
          {modelName}
        </div>
      </div>
    </div>
  );
}

function InclouLine({ icon, children }: { icon: "check" | "x"; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <div style={{ flexShrink: 0, marginTop: 0 }}>
        {icon === "check" ? (
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
            ✓
          </span>
        ) : (
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
            ✕
          </span>
        )}
      </div>
      <div style={{ flex: 1, fontSize: "8.5pt", lineHeight: 1.35 }}>{children}</div>
    </div>
  );
}

function RecommendCardOrange({
  title,
  bullets,
  bottomRightImage,
  accentColor = "#ff751f", // 👈 por defecto naranja
  iconSrc,
}: {
  title: string;
  bullets: string[];
  bottomRightImage?: string;
  accentColor?: string;
  iconSrc?: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        background: "#ffffff",
        borderRadius: 22,
        padding: "8px 12px 8px 16px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        border: "1px solid #f0e7df",
        marginLeft: 28,
        minHeight: "auto",
      }}
    >
      {/* Floating orange double-check badge */}
      <img
        src={iconSrc || "/pdf/check-double.png"}
        alt=""
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          top: -2,
          left: -30,
          width: 38,
          height: 38,
          zIndex: 3,
        }}
      />
      <div
        style={{
          color: accentColor,
          fontWeight: 700,
          fontSize: "9.5pt",
          lineHeight: 1.2,
          marginBottom: 4,
        }}
      >
        {title.split("\n").map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
      <ul style={{ margin: 0, paddingLeft: 6, lineHeight: 1.3, fontSize: "7.5pt", listStyle: "none" }}>
        {bullets.map((b) => (
          <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: 4, marginBottom: 1 }}>
            <span style={{ color: "#1a1a1a", fontSize: "7.5pt", lineHeight: 1.2, marginTop: 0 }}>•</span>
            <span style={{ flex: 1 }}>{b}</span>
          </li>
        ))}
      </ul>
      {bottomRightImage && (
        <img
          src={bottomRightImage}
          alt=""
          crossOrigin="anonymous"
          style={{
            position: "absolute",
            bottom: 6,
            top: 76,
            right: -30,
            width: 146,
            height: 116,
            objectFit: "contain",
          }}
        />
      )}
    </div>
  );
}

function formatEuroNoCurrency(n: number): string {
  return new Intl.NumberFormat("ca-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// AFM increment is a rounded whole-euro figure (see budgetSave.ts afmExtraSale) —
// no decimals here so it agrees with what's added to the DEPURACIÓ pill.
function formatEuroInt(n: number): string {
  return new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 0 }).format(Math.round(n));
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

// keep referenced
void PDF_FONTS;
