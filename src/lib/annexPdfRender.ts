/**
 * Annex-PDF renderer. Mirrors `buildPdfBlob` in pdfRender.ts but mounts
 * <AnnexPdfDocument> instead of the full budget document.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { AnnexPdfDocument, type AnnexPdfDocumentData } from "@/components/pdf/AnnexPdfDocument";

let renderQueue: Promise<void> = Promise.resolve();

export async function buildAnnexPdfBlob(data: AnnexPdfDocumentData): Promise<Blob> {
  const prev = renderQueue;
  let release!: () => void;
  renderQueue = new Promise<void>((r) => (release = r));
  await prev.catch(() => undefined);

  try {
    return await buildAnnexPdfBlobUnsafe(data);
  } finally {
    release();
  }
}

async function buildAnnexPdfBlobUnsafe(data: AnnexPdfDocumentData): Promise<Blob> {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const html = renderToStaticMarkup(createElement(AnnexPdfDocument, { data }));

  try {
    const fontSet: any = (document as any).fonts;
    if (fontSet) {
      await Promise.all([
        fontSet.load('400 14pt "Tenor Sans"'),
        fontSet.load('400 11pt "Inter"'),
        fontSet.load('700 11pt "Inter"'),
        fontSet.load('400 16pt "Cormorant Garamond"'),
        fontSet.load('700 16pt "Cormorant Garamond"'),
      ]).catch(() => undefined);
      if (fontSet.ready) await fontSet.ready;
    }
  } catch {
    /* ignore */
  }

  // Preload images
  try {
    const urls = new Set<string>();
    const re = /https:\/\/[^\s"'<>)]+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      if (/\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(m[0])) urls.add(m[0]);
    }
    const localRe = /\/pdf\/[^\s"'<>)]+\.(png|jpe?g|webp|gif|svg|avif)/gi;
    let lm: RegExpExecArray | null;
    while ((lm = localRe.exec(html)) !== null) urls.add(lm[0]);
    await Promise.all(
      Array.from(urls).map(
        (u) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            const done = () => resolve();
            img.onload = done;
            img.onerror = done;
            setTimeout(done, 5000);
            img.src = u;
          }),
      ),
    );
  } catch {
    /* ignore */
  }

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.background = "#ffffff";
  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    const root = host.querySelector("#pdf-document") as HTMLElement | null;
    if (!root) throw new Error("PDF root not found");
    const pageNodes = Array.from(root.children) as HTMLElement[];

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = 210;
    const pageH = 297;

    for (let i = 0; i < pageNodes.length; i++) {
      const node = pageNodes[i];
      const canvas = await html2canvas(node, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#efe9e5",
        windowWidth: node.scrollWidth,
        windowHeight: node.scrollHeight,
        logging: false,
        imageTimeout: 0,
        removeContainer: true,
      });
      const image = canvas.toDataURL("image/jpeg", 0.88);
      if (i > 0) pdf.addPage("a4", "portrait");
      pdf.addImage(image, "JPEG", 0, 0, pageW, pageH);
      canvas.width = 0;
      canvas.height = 0;
    }
    return pdf.output("blob");
  } finally {
    document.body.removeChild(host);
  }
}