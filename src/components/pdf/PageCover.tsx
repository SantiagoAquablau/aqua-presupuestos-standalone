/**
 * Page 1 — Cover.
 * Full-bleed pool photo, AquaBlau logo top-left, client info card (semi-transparent
 * white), and big "PISCINA d'Obra Nova" title bottom-right.
 */
import type { PdfData } from "./pdfTypes";
import { PDF_COLORS, PDF_FONTS, formatPdfDate, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";

const STAIRS_LABEL: Record<string, string> = {
  estandard: "Amb escala estàndard interior.",
  plataforma: "Amb escala + plataforma interior.",
  banc: "Amb escala + banc interior.",
  tot_ample: "Amb escala a tot l'ample.",
};

const POOL_TYPE_LABEL: Record<string, string> = {
  particular: "particular",
  comunitaria: "comunitària",
};

const POOL_SHAPE_LABEL: Record<string, string> = {
  regular: "rectangular",
  irregular: "irregular",
};

export function PageCover({ data }: { data: PdfData }) {
  const isM = !!data.isMaintenance;
  const isA = !!data.isAutoportant;
  const tipusLine = (() => {
    const t = data.poolType ? POOL_TYPE_LABEL[data.poolType] : undefined;
    const s = data.poolShape ? POOL_SHAPE_LABEL[data.poolShape] : undefined;
    if (isA) {
      return data.autoportantModelName ? `Model: ${data.autoportantModelName}` : undefined;
    }
    if (isM) {
      if (!t) return undefined;
      const electroSuffix =
        data.hasElectrolisi === true
          ? " amb electròlisi"
          : data.hasElectrolisi === false
            ? " sense electròlisi"
            : "";
      return `Tipus: Piscina ${t}${electroSuffix}`;
    }
    if (!t && !s) return undefined;
    if (t && s) return `Tipus: Piscina ${t} i ${s}`;
    return `Tipus: Piscina ${t || s}`;
  })();
  const stairsLine = data.interiorStairsType
    ? STAIRS_LABEL[data.interiorStairsType]
    : data.hasInteriorStairs
      ? STAIRS_LABEL.plataforma
      : undefined;
  return (
    <section style={{ ...pdfPageStyle, backgroundColor: "#FFFFFF", fontFamily: '"Tenor Sans", serif' }}>
      {/* Background photo */}
      <img
        src="/pdf/cover.webp"
        alt=""
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      {/* Logo top-left */}
      <div style={{ position: "absolute", top: "58mm", left: "14mm" }}>
        <PdfLogo size={360} variant="white" />
      </div>

      {/* PRESSUPOST # pill */}

      <div
        style={{
          position: "absolute",
          top: "108mm",
          left: "14mm",
          background: "rgba(255,255,255,0.78)",
          borderRadius: 999,
          padding: "4px 36px 6px",
          display: "inline-block",
          textAlign: "center",
          color: "#2f4494",
          fontFamily: '"Tenor Sans", serif',
          fontWeight: 400,
          letterSpacing: 2,
          fontSize: "12pt",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            display: "inline-block",
            lineHeight: 1.6,
            marginBottom: "10px",
          }}
        >
          PRESSUPOST : {data.budgetNumber || "#"}
        </span>
      </div>

      {/* Client info card */}
      <div
        style={{
          position: "absolute",
          top: "128mm",
          left: "14mm",
          display: "inline-block",
          maxWidth: "130mm",
          background: "rgba(255,255,255,0.78)",
          borderRadius: "28px",
          padding: "8mm 10mm",
          color: "#2f4494",
          fontFamily: '"Tenor Sans", serif',
          fontSize: "10.5pt",
          lineHeight: 1.6,
        }}
      >
        <Field label="Sol·licitat per:" value={data.clientName} />
        <Field label="Adreça obra:" value={data.clientAddress} />
        <Field label="Municipi:" value={data.clientTown} />
        <Field label="Tel. contacte:" value={data.clientPhone} />
        <Field label="Email:" value={data.clientEmail} />
        <Field label="Data:" value={formatPdfDate(data.budgetDate)} />
      </div>

      {/* Title block (title + underline + specs) bottom-right, single column */}
      <div
        style={{
          position: "absolute",
          bottom: "18mm",
          right: "0mm",
          width: "170mm",
          paddingRight: "14mm",
          textAlign: "right",
          color: "#2f4494",
        }}
      >
        <div
          style={{
            fontFamily: '"Tenor Sans", serif',
            fontWeight: 400,
            fontSize: isM ? "44pt" : "70pt",
            letterSpacing: 6,
            lineHeight: 1,
          }}
        >
          {isM ? "MANTENIMENT" : isA ? "PISCINA" : "PISCINA"}
        </div>
        <div
          style={{
            fontFamily: PDF_FONTS.serif,
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: "46pt",
            color: "#FFFFFF",
            marginTop: 4,
            letterSpacing: 1,
            textShadow: "0 1px 2px rgba(0,0,0,0.18)",
            lineHeight: 1.15,
            paddingBottom: "6px",
          }}
        >
          {isM
            ? `Piscina ${
                data.poolType === "comunitaria"
                  ? "Comunitària"
                  : data.poolType === "particular"
                    ? "Particular"
                    : ""
              }`.trim()
            : isA
              ? "Autoportant"
            : `d'${data.type || "Obra Nova"}`}
        </div>
        <div
          style={{
            height: 5,
            background: "#2f4494",
            margin: "28px 0 12px 0",
            width: "calc(80% + 14mm)",
            marginLeft: "auto",
            marginRight: "-14mm",
          }}
        />
        <div
          style={{
            color: "#2f4494",
            fontFamily: '"Tenor Sans", serif',
            fontSize: "11.5pt",
            lineHeight: 1.7,
          }}
        >
          {tipusLine && <div>{tipusLine}</div>}
          {isA ? (
            <>
              {(data.autoportantAmple || data.autoportantLlarg) && (
                <div>
                  Mides: {data.autoportantAmple || "—"} d'ample × {data.autoportantLlarg || "—"} de llarg
                </div>
              )}
              {data.autoportantAlturaAigua && (
                <div>Altura d'aigua: {data.autoportantAlturaAigua}</div>
              )}
            </>
          ) : data.poolShape === "irregular" ? (
            typeof data.poolSurfaceM2 === "number" && (
              <div>
                Superfície: {data.poolSurfaceM2.toLocaleString("ca-ES", { minimumFractionDigits: 2 })}m²
                {typeof data.poolVolumeM3 === "number" ? (
                  <>
                    {" "}
                    · {data.poolVolumeM3.toLocaleString("ca-ES", { minimumFractionDigits: 2 })}m
                    <sup style={{ fontSize: "0.65em" }}>3</sup>
                  </>
                ) : (
                  ""
                )}
              </div>
            )
          ) : typeof data.poolLength === "number" && typeof data.poolWidth === "number" && (
            <div>
              Mides: {data.poolLength.toLocaleString("ca-ES", { minimumFractionDigits: 2 })}m x{" "}
              {data.poolWidth.toLocaleString("ca-ES", { minimumFractionDigits: 2 })}m
              {typeof data.poolVolumeM3 === "number" ? (
                <>
                  {" "}
                  | {data.poolVolumeM3.toLocaleString("ca-ES", { minimumFractionDigits: 2 })}m
                  <sup style={{ fontSize: "0.65em" }}>3</sup>
                </>
              ) : (
                ""
              )}
            </div>
          )}
          {!isM && !isA && stairsLine && <div>{stairsLine}</div>}
          {isM && typeof data.poolDepthAvg === "number" && data.poolDepthAvg > 0 ? (
            <div>
              Profunditat mitjana{" "}
              {data.poolDepthAvg.toLocaleString("ca-ES", { minimumFractionDigits: 2 })}m
            </div>
          ) : null}
          {isM && data.hasSecondPool && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 600 }}>Segona piscina:</div>
              {typeof data.poolLength2 === "number" && typeof data.poolWidth2 === "number" && (
                <div>
                  Mides: {data.poolLength2.toLocaleString("ca-ES", { minimumFractionDigits: 2 })}m x{" "}
                  {data.poolWidth2.toLocaleString("ca-ES", { minimumFractionDigits: 2 })}m
                  {data.poolLength2 && data.poolWidth2 && typeof data.poolDepthAvg2 === "number" && data.poolDepthAvg2 > 0 ? (
                    <>
                      {" "}
                      | {Math.ceil(data.poolLength2 * data.poolWidth2 * data.poolDepthAvg2).toLocaleString("ca-ES")}m
                      <sup style={{ fontSize: "0.65em" }}>3</sup>
                    </>
                  ) : (
                    ""
                  )}
                </div>
              )}
              {typeof data.poolDepthAvg2 === "number" && data.poolDepthAvg2 > 0 ? (
                <div>
                  Profunditat mitjana{" "}
                  {data.poolDepthAvg2.toLocaleString("ca-ES", { minimumFractionDigits: 2 })}m
                </div>
              ) : null}
            </div>
          )}
          {!isM && !isA && typeof data.poolDepthMin === "number" && typeof data.poolDepthMax === "number" && (
            <div>
              Profunditat total {data.poolDepthMin.toLocaleString("ca-ES", { minimumFractionDigits: 2 })}m{" - "}
              {data.poolDepthMax.toLocaleString("ca-ES", { minimumFractionDigits: 2 })}m
            </div>
          )}
          {!isM && !isA && data.poolDisposition === "semi_enterrada" && <div>Semi-soterrada</div>}
          {!isM && !isA && data.poolDisposition === "elevada" && <div>Elevada</div>}
        </div>
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 4, fontSize: "10.5pt", whiteSpace: "nowrap" }}>
      <span style={{ minWidth: "34mm", fontWeight: 600 }}>{label}</span>
      <span style={{ fontWeight: 400 }}>{value || ""}</span>
    </div>
  );
}
