/**
 * Maintenance PDF — "Posta a punt" page (between Manteniment and Resum).
 * Reuses the same chrome (title, divider, pill) as PageManteniment for
 * a consistent maintenance document look.
 */
import { PDF_COLORS, pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";

const NAVY = "#2f4494";

export function PagePostaPunt() {
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
            fontSize: "46pt",
            color: NAVY,
            letterSpacing: 4,
            margin: 0,
            lineHeight: 1,
          }}
        >
          MANTENIMENT
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
            SERVEI POSTA A PUNT
          </span>
        </div>

        <div
          style={{
            color: NAVY,
            fontFamily: '"Tenor Sans", serif',
            fontSize: "13pt",
            letterSpacing: 2,
            marginBottom: "4mm",
            fontWeight: 600,
          }}
        >
          CONDICIONS DEL SERVEI:
        </div>

        <p style={{ fontSize: "10.5pt", lineHeight: 1.55, color: "#2a2a2a", margin: "0 0 5mm 0" }}>
          Primera visita d'actuació per posar l'aigua en condicions òptimes, descartar possibles falles
          i comprovar el correcte funcionament de la mateixa. En cas de trobar quelcom inadequat, en mal
          estat, o que representi un impediment per fer correctament la tasca de manteniment anual de la
          piscina, es tindrà en compte i es valorarà de nou el pressupost o es proposarà com portar a
          terme la millora del sistema.
        </p>

        <p style={{ fontSize: "10.5pt", lineHeight: 1.55, margin: "0 0 5mm 0", fontStyle: "italic" }}>
          <strong>
            Preu servei: 1 desplaçament (35€) + Hores operari (85€/h) + producte químic si s'escau
            (IVA NO INCLÒS)
          </strong>
        </p>

        <p style={{ fontSize: "10.5pt", lineHeight: 1.55, margin: "0 0 5mm 0" }}>
          <em>
            <strong>Nota important:</strong>
          </em>{" "}
          Els dies de visites no es podran canviar a voluntat, doncs l'operari porta una ruta establerta
          i aquesta ha de ser coherent amb la resta de manteniments segons proximitat. Som conscients
          que hi ha unes hores i dies que son els més adequats per a fer la neteja i manteniment de les
          piscines, però és físicament impossible agrupar totes les visites durant les primeres hores
          del dia. Intentem sempre ser el mes equitatius possibles però demanem que si un dia l'operari
          es troba banyistes fent ús de la piscina i necessita que surtin un moment per poder fer la
          seva tasca correctament, en cas de negació Aquablau tampoc podrà garantir la seva feina.
        </p>

        <div
          style={{
            marginTop: "10mm",
            padding: "6mm 7mm",
            background: "rgba(47,68,148,0.06)",
            borderLeft: `4px solid ${NAVY}`,
            borderRadius: 6,
            fontSize: "10pt",
            lineHeight: 1.55,
            color: "#1a1a1a",
            fontStyle: "italic",
          }}
        >
          En cas de que el client opti per no posar a punt la piscina, l'empresa (Piscines Aquablau)
          no podrà garantir la correcta manutenció de la mateixa tot i complir amb el compromís
          establert al contracte, podent inclús desistir de la prestació del servei en casos extrems en
          que aquest representi un clar desavantatge per a l'empresa.
        </div>
      </div>
    </section>
  );
}
