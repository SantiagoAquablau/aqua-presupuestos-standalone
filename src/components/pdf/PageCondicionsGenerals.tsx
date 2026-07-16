/**
 * Maintenance PDF — "Condicions Generals" page (between Posta a punt and Resum).
 */
import { PDF_COLORS, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";

const NAVY = "#2f4494";

export function PageCondicionsGenerals() {
  return (
    <section style={{ ...pdfPageStyle, backgroundColor: PDF_COLORS.beige }}>
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
            fontFamily: '"Tenor Sans", serif',
            fontWeight: 400,
            fontSize: "38pt",
            color: NAVY,
            letterSpacing: 4,
            margin: 0,
            lineHeight: 1,
          }}
        >
          CONDICIONS GENERALS
        </h1>
        <PdfLogo size={85} />
      </div>

      <div
        style={{
          height: 6,
          background: NAVY,
          margin: "10mm 14mm 8mm 0",
          marginLeft: 0,
          width: "calc(100% - 36mm)",
        }}
      />

      <div style={{ padding: "0 14mm" }}>
        <div
          style={{
            backgroundColor: PDF_COLORS.badgePill,
            color: NAVY,
            borderRadius: 999,
            padding: "0 32px",
            minHeight: "44px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontFamily: '"Tenor Sans", serif',
            fontSize: "13pt",
            letterSpacing: 1,
            margin: "0 0 8mm 0",
            textAlign: "center",
          }}
        >
          <span style={{ display: "block", lineHeight: 1, marginBottom: "12px" }}>
            SERVEI REGULAR D'ACTUACIÓ
          </span>
        </div>

        <p style={{ fontSize: "10.5pt", lineHeight: 1.6, color: "#2a2a2a", margin: "0 0 5mm 0" }}>
          El manteniment consta de la neteja de parets i terra de la piscina, neteja de l'aigua de
          fulles i brutícia, revisió del sistema de filtració per assegurar-ne el bon funcionament,
          neteja dels pre-filtres de les bombes i reposició del producte químic. Control i calibració
          de sondes en cas que sigui necessari.
        </p>

        <p style={{ fontSize: "10.5pt", lineHeight: 1.6, color: "#2a2a2a", margin: "0 0 5mm 0" }}>
          Es contempla a proporció, la mitja necessària de producte químic (clor, àcids, etc.) per al
          manteniment i correcte funcionament del sistema de filtració i cloració. En onades de fred
          poden ser necessàries aportacions extra de producte anti-congelant o similars.
        </p>

        <p style={{ fontSize: "10.5pt", lineHeight: 1.6, color: "#2a2a2a", margin: "0 0 5mm 0" }}>
          Qualsevol reparació o treball aliè a la descripció del manteniment tindrà un cost a part,
          l'operari informarà de qualsevol incidència i es pressupostarà per solucionar-la tant aviat
          com sigui possible. Visites fora de les estipulades en el pressupost es facturaran a part a
          raó de 85€/hora/operari i 35€ en concepte de desplaçament (tret de condicionants resultants
          d'una mala tasca per part nostra).
        </p>
      </div>
    </section>
  );
}
