/**
 * Annex OPCIONALS — Depuració & Bomba.
 * Mirrors PageDepuracio1's "included" layout (filter + AFM + prefiltre +
 * recommend card, and bomba block) but rendered with the OPCIONAL orange
 * theme (orange title, orange divider, orange pills, orange card titles).
 * The pill amounts already arrive equivalent to the "as-included" total
 * (equip + subfase + MO + prefiltre) — computed in budgetSave.ts.
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, formatEuro, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";

const ORANGE = "#ff751f";
const ORANGE_PILL = "#ff751f99";

export function PageAnnexOpcionalsInstal({ data }: { data: PdfData }) {
  // This page is a "substitutive" upsell for whichever base section it
  // mirrors (see the disclaimer below: "imports substitutius dels equips
  // d'instal·lacions inclosos al pressupost") — an *Opcional article left
  // over on the draft with the corresponding base section OFF has nothing
  // to substitute, so each block also requires its base toggle to be on
  // (mirrors PdfDocument.tsx's own showOpcionalsInstal/depuracioOn/bombaOn).
  const depuracioOn = data.depuracioEnabled !== false;
  const bombaOn = data.bombaEnabled !== false;
  const showFiltre = depuracioOn && !!data.filtreOpcionalTipus;
  const showBomba = bombaOn && !!data.bombaOpcionalTipus;
  let n = 0;

  return (
    <section style={pdfPageStyle}>
      {/* Full-height background image */}
      <img
        src="/pdf/fondo_instalacion_opcional.webp"
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
            color: ORANGE,
            letterSpacing: 4,
            margin: 0,
            lineHeight: 1,
          }}
        >
          OPCIONALS
        </h1>
        <PdfLogo size={85} />
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: 6,
          background: "#2f4494", //ORANGE
          margin: "10mm 14mm 8mm 0",
          marginLeft: "0mm",
          width: "calc(100% - 36mm)",
        }}
      />

      <div style={{ padding: "0 14mm", position: "relative", zIndex: 1 }}>
        {showFiltre && (
          <>
            <SectionPillTenor number={String(++n)} title="DEPURACIÓ" amount={data.filtreOpcionalSale || 0} />
            {data.filtreOpcionalTipus === "cartutx" ? (
              <CartutxOpcionalBlock data={data} />
            ) : (
              <SorraOpcionalBlock data={data} />
            )}
          </>
        )}

        {showBomba && (
          <div style={{ marginTop: showFiltre ? "8mm" : 0 }}>
            <SectionPillTenor
              number={String(++n)}
              title="GRUP MOTOBOMBA AUTOASPIRANT"
              amount={data.bombaOpcionalSale || 0}
            />
            {data.bombaOpcionalTipus === "inverter" ? (
              <BombaVariableOpcionalBlock data={data} />
            ) : (
              <BombaStandardOpcionalBlock data={data} />
            )}
          </div>
        )}

        {/* Aclaració: imports substitutius */}
        <div
          style={{
            marginTop: "6mm",
            fontStyle: "italic",
            color: "#2f4494",
            fontSize: "9pt",
            lineHeight: 1.4,
          }}
        >
          *Aquests imports són substitutius dels equips d'instal·lacions inclosos al pressupost.
        </div>
      </div>
    </section>
  );
}

/* ================== Filtre de sorra (opcional) ================== */
function SorraOpcionalBlock({ data }: { data: PdfData }) {
  const articleName = data.filtreOpcionalName || "";
  const afmOn = !!data.afmEnabled;
  const prefiltreOn = !!data.prefiltreEnabled;
  const prefiltreImg = data.prefiltreImageUrl || "/pdf/hydrospin.webp";
  // Si el prefiltre ja està inclòs al pressupost (PageDepuracio1), no el mostrem aquí.
  const showPrefiltre = !prefiltreOn;

  return (
    <div style={{ display: "flex", gap: "6mm", alignItems: "flex-start", position: "relative" }}>
      <div style={{ flex: 1.05, fontSize: "8.5pt", lineHeight: 1.35, color: PDF_COLORS.textBody }}>
        <div style={{ display: "flex", gap: "5mm", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#2f4494", fontSize: "9.5pt", marginBottom: 3 }}>
              Filtre de sorra laminat
            </div>
            <div>Amb monòmetre i vàlvula selectora per a rentat, filtrat, recirculació, desguàs i tancament.</div>
          </div>
          {data.filtreOpcionalImageUrl ? (
            <img
              src={data.filtreOpcionalImageUrl}
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
                <strong>Inclou:</strong> <span style={{ color: ORANGE, fontWeight: 700 }}>vidre AFM ecofiltrant</span>.
              </>
            ) : (
              <>
                <strong>Inclou:</strong> sorra silícia estàndard
                <br />
                <span style={{ color: ORANGE, fontWeight: 700 }}>Alternativa: vidre AFM ecofiltrant</span>
                {((typeof data.afmQty === "number" && data.afmQty > 0) ||
                  (typeof data.afmExtraSale === "number" && data.afmExtraSale > 0)) && (
                  <div style={{ color: ORANGE, fontWeight: 700, marginTop: 2 }}>
                    {typeof data.afmQty === "number" && data.afmQty > 0 ? `${data.afmQty} sacs de 25 kg` : ""}
                    {typeof data.afmExtraSale === "number" && data.afmExtraSale > 0
                      ? ` +${formatEuroInt(data.afmExtraSale)} €`
                      : ""}
                  </div>
                )}
              </>
            )}
            <div
              style={{
                position: "absolute",
                right: -49,
                top: "64%",
                width: 150,
                height: 0,
                borderTop: `2px solid ${ORANGE}`,
                zIndex: 2,
              }}
            />
          </div>
        </InclouLine>

        <div style={{ height: 6 }} />

        {/* Prefiltre line — només si no està inclòs al pressupost */}
        {showPrefiltre && (
        <InclouLine icon="x">
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <strong>No inclou:</strong> Prefiltre centrífug hidrociclònic per protegir
              el filtre i allargar vida útil.
              <div style={{ color: ORANGE, fontWeight: 700, marginTop: 2 }}>
                Preu {data.prefiltreName || "HYDROSPIN COMPACT"}:{" "}
                {typeof data.prefiltreSale === "number" ? `+${formatEuroNoCurrency(data.prefiltreSale)} €` : ""}
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
        )}
      </div>

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
        />
      </div>
    </div>
  );
}

/* ================== Filtre de cartutx (opcional) ================== */
function CartutxOpcionalBlock({ data }: { data: PdfData }) {
  const articleName = data.filtreOpcionalName || "";
  const prefiltreOn = !!data.prefiltreEnabled;
  const prefiltreImg = data.prefiltreImageUrl || "/pdf/hydrospin.webp";
  const showPrefiltre = !prefiltreOn;
  return (
    <div style={{ display: "flex", gap: "6mm", alignItems: "flex-start", position: "relative" }}>
      <div style={{ flex: 1.05, fontSize: "8.5pt", lineHeight: 1.35, color: PDF_COLORS.textBody }}>
        <div style={{ display: "flex", gap: "5mm", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#2f4494", fontSize: "9.5pt", marginBottom: 3 }}>
              Filtre de cartutx
            </div>
            <div>Amb paper filtrant plisat 100% polièster.</div>
          </div>
          {data.filtreOpcionalImageUrl ? (
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
                src={data.filtreOpcionalImageUrl}
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

        {/* Prefiltre line — només si no està inclòs al pressupost */}
        {showPrefiltre && (
        <InclouLine icon="x">
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <strong>No inclou:</strong> Prefiltre centrífug hidrociclònic per protegir
              el filtre i allargar vida útil.
              <div style={{ color: ORANGE, fontWeight: 700, marginTop: 2 }}>
                Preu {data.prefiltreName || "HYDROSPIN COMPACT"}:{" "}
                {typeof data.prefiltreSale === "number" ? `+${formatEuroNoCurrency(data.prefiltreSale)} €` : ""}
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
        )}
      </div>

      <div
        style={{
          position: "absolute",
          left: "48%",
          right: -49,
          width: 72,
          top: "29%",
          height: 0,
          borderTop: `2px solid ${ORANGE}`,
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
          iconSrc="/pdf/icono-filtr-swimclear.webp"
        />
      </div>
    </div>
  );
}

/* ================== Bomba variable (opcional) ================== */
function BombaVariableOpcionalBlock({ data }: { data: PdfData }) {
  const flow = data.bombaOpcionalFlowText || "5 a 25m3/h";
  const modelName = data.bombaOpcionalName || "";
  const img = data.bombaOpcionalImageUrl;
  return (
    <div style={{ display: "flex", gap: "6mm", alignItems: "flex-start", position: "relative" }}>
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

      <div
        style={{
          position: "absolute",
          left: "50%",
          right: -49,
          width: 54,
          top: "45%",
          height: 0,
          borderTop: `2px solid ${ORANGE}`,
          zIndex: 2,
        }}
      />

      <div style={{ flex: 0.95, position: "relative", paddingTop: 4 }}>
        <RecommendCardOrange
          title={"Avantatges\nAQUAGEM FULL INVERTER"}
          bullets={[
            "Estalvi energètic fins a un 85%.",
            "Extremadament silencioses.",
            "Fins a 5 programes de filtració.",
            "Connectivitat integrada amb altres elements de la piscina",
          ]}
          iconSrc="/pdf/icono-bomba-variable.webp"
        />
      </div>
    </div>
  );
}

/* ================== Bomba standard (opcional) ================== */
function BombaStandardOpcionalBlock({ data }: { data: PdfData }) {
  const flow = data.bombaOpcionalFlowText || "";
  const modelName = data.bombaOpcionalName || "";
  const img = data.bombaOpcionalImageUrl;
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

/* ================== Atoms ================== */
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
      <div style={{ flex: 1, fontSize: "8.5pt", lineHeight: 1.35 }}>{children}</div>
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

function RecommendCardOrange({ title, bullets, iconSrc }: { title: string; bullets: string[]; iconSrc?: string }) {
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
      }}
    >
      <img
        src={iconSrc || "/pdf/check-double.png"}
        alt=""
        crossOrigin="anonymous"
        style={{ position: "absolute", top: -2, left: -30, width: 38, height: 38, zIndex: 3 }}
      />
      <div
        style={{
          color: ORANGE,
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
            <span style={{ color: "#1a1a1a", fontSize: "7.5pt", lineHeight: 1.2 }}>•</span>
            <span style={{ flex: 1 }}>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionPillTenor({ number, title, amount }: { number: string; title: string; amount: number }) {
  return (
    <div
      style={{
        backgroundColor: ORANGE_PILL,
        color: "#ffffff",
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
      <span style={{ display: "block", lineHeight: 1, marginBottom: "12px", fontWeight: 700 }}>
        {formatEuro(amount)}
      </span>
    </div>
  );
}

void PDF_FONTS;
