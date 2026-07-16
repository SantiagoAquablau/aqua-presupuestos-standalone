## Objectiu

Generar un PDF propi per cada annex amb l'estructura:

```
Page 1   → PageCover (mateixa portada del pressupost)
Page 2…N → Pàgines dels annexos assistits triats (bomba calor, robot,
           cobertor, gespa, paviment, accessoris) + 1 pàgina genèrica
           per cada bloc “manual” (títol = títol de l'annex, partides
           en bullets)
Penúltima → PageAnnexResum (nou, estil PageResum amb total de l'annex)
Última   → PageContacte (reutilitzada)
```

El PDF es genera amb el botó **“Enviar per correu”** (i amb un nou botó **“Descarregar PDF”**) a `AnnexDetail.tsx`.

## Decisions clau

- **Quins blocs assistits inclou l'annex** → es desa al crear:
  afegim columna `assisted_seeds text[]` a `pressupost_annexos` i la
  guardem des de `AnnexList.tsx` quan l'usuari tria seeds.
- **Si hi ha partides manuals** (partides sense `article_id` que no
  pertanyen a cap seed, o annexos amb `assisted_seeds` buit) →
  s'afegeix una pàgina `PageAnnexManual` amb el títol de l'annex i
  les partides en bullets (descripció · qty × unit · total venda).
- **Quan hi ha múltiples seeds** s'enumeren les pàgines amb el mateix
  prefix que ja fan servir (ex. “1/3 CLIMATITZACIÓ”) i la badge gran
  del total annex es renderitza a l'última.
- **Resum**: nova pàgina compacta amb el mateix look (logo, hairline
  navy, pill amb total) que mostra el llistat de blocs i el total
  venda final (incloent `global_pct`).
- **Contacte**: reutilitzem PageContacte amb el comercial de l'annex
  (`comercial_id` de la fila `pressupost_annexos`, amb fallback al
  comercial del pressupost).

## Pla d'implementació

1. **Migració**
   - `ALTER TABLE pressupost_annexos ADD COLUMN assisted_seeds text[] DEFAULT '{}'::text[];`

2. **AnnexList.tsx**
   - `createMutation` desa `assisted_seeds: picked` (o `[]` quan és
     manual en blanc).

3. **Mapatge items → PdfData** (`src/lib/annexPdfData.ts` nou)
   - Càrrega: annex + items + budget + comercial.
   - Per cada seed present a `assisted_seeds`, omplir els camps
     corresponents del `PdfData` (igual que fa `budgetSave.ts`):
     - `bomba_calor` → `annexBombaCalorEstat='inclos'`, name/image/amount des de l'item amb `article_id` del subtipus de bombes.
     - `robot` → mateix patró amb subtipus Robots.
     - `cobertor` → omple `annexCobertorEstat`, models/colors si es poden recuperar (en el cas mínim només el name i amount).
     - `gespa`, `paviment`, `accessoris_basics`, `accessoris_opcionals` igual.
   - `phaseAnnexTotal` = `annex.total_sale` (ja inclou `global_pct`).
   - Partides sense article_id i no associades a cap seed → llista
     per a la pàgina manual.

4. **Components nous**
   - `src/components/pdf/PageAnnexManual.tsx`: portada amb header
     “ANNEX”, hairline navy, pill amb títol de l'annex + total,
     bullets de les partides manuals, fons subtil.
   - `src/components/pdf/PageAnnexResum.tsx`: pill “TOTAL ANNEX”,
     llistat de blocs (nom + subtotal), gran badge final amb total
     venda incloent `global_pct`.
   - `src/components/pdf/AnnexPdfDocument.tsx`: composa
     PageCover + pàgines (assistides en ordre + manual si cal) +
     PageAnnexResum + PageContacte. Mateixa estructura
     `<div id="pdf-document">` perquè `pdfRender.ts` la pugui
     pintar sense canvis.

5. **Renderer** (`src/lib/annexPdfRender.ts` nou)
   - Funció `buildAnnexPdfBlob(data)` quasi idèntica a
     `buildPdfBlob` però muntant `AnnexPdfDocument` en lloc de
     `PdfDocument` (reutilitzem helpers de fonts/imatges fent
     refactor mínim: extraiem `renderDocumentToPdf(root)` a
     `pdfRender.ts` i la cridem des d'ambdós).

6. **AnnexDetail.tsx**
   - Botó nou **Descarregar PDF** (i el `handleSendEmail`
     genera/desa el PDF abans d'obrir el `mailto:`).
   - Crida `buildAnnexPdfData(annexId)` → `buildAnnexPdfBlob` →
     `saveBlobWithPicker` (mateix flux iOS/Windows existent).
   - Nom de fitxer: `Annex_{annex.number}_{budget.number}.pdf`.

## Detalls tècnics

- No tocar `PdfDocument.tsx` ni les pàgines existents.
- `comercial_id` de l'annex té fallback al del pressupost si està buit.
- Si un seed no troba item amb `article_id` (cas: usuari l'ha
  esborrat), no pintem la pàgina d'aquell seed; els seus imports
  passen al bloc manual.
- Imatges d'article (image_url) es recuperen en batch igual que ja
  fa `buildBudgetPdf`.

## Fora d'abast

- No es modifica el càlcul de totals de l'annex (`total_sale`,
  `global_pct`) — ja funciona.
- No es modifica la visualització web de l'annex; només s'afegeix el
  botó de descàrrega.
