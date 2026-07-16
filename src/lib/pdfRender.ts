/**
 * Shared renderer that turns a <PdfDocument> React tree into a multi-page A4
 * PDF. Renders each page individually via html2canvas + jsPDF.addImage to
 * avoid the blank-page artifacts produced by html2pdf.js when sections are
 * exactly 297mm tall.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { PdfData } from "@/components/pdf/pdfTypes";
import { PdfDocument } from "@/components/pdf/PdfDocument";

const PDF_IMAGE_TIMEOUT_MS = 6000;
let pdfRenderQueue: Promise<void> = Promise.resolve();

function waitForAnimationFrame(times = 1): Promise<void> {
  return new Promise((resolve) => {
    const tick = (remaining: number) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => tick(remaining - 1));
    };
    tick(times);
  });
}

async function waitForImage(img: HTMLImageElement): Promise<void> {
  img.loading = "eager";
  img.decoding = "sync";

  if (img.complete && img.naturalWidth > 0) {
    await img.decode?.().catch(() => undefined);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const src = img.currentSrc || img.src || "imatge desconeguda";
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
      if (ok && img.naturalWidth > 0) resolve();
      else reject(new Error(`No s'ha pogut carregar la imatge del PDF: ${src}`));
    };
    const onLoad = () => finish(true);
    const onError = () => finish(false);
    const timeout = window.setTimeout(() => finish(false), PDF_IMAGE_TIMEOUT_MS);
    img.addEventListener("load", onLoad, { once: true });
    img.addEventListener("error", onError, { once: true });
  });

  await img.decode?.().catch(() => undefined);
}

async function waitForPdfAssets(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img")) as HTMLImageElement[];
  // Images were already pre-warmed into the browser cache before mounting
  // the host. This pass just guarantees `naturalWidth > 0` before snapshot.
  // Failures are logged but never block the PDF — html2canvas will simply
  // draw whatever the browser has, instead of stalling the whole job.
  await Promise.all(
    images.map((img) =>
      waitForImage(img).catch((err) => {
        console.warn("[pdfRender] image skipped:", err?.message || err);
      }),
    ),
  );
  await waitForAnimationFrame(1);
}

/** Build the PDF Blob without saving. Caller is responsible for piping it
 *  through `saveBlobWithPicker` (which must be invoked first, inside the
 *  user-gesture handler, to keep the native "Save As" picker available). */
export async function buildPdfBlob(data: PdfData): Promise<Blob> {
  const previousJob = pdfRenderQueue;
  let releaseJob!: () => void;
  pdfRenderQueue = new Promise<void>((resolve) => {
    releaseJob = resolve;
  });

  await previousJob.catch(() => undefined);

  try {
    return await buildPdfBlobUnsafe(data);
  } finally {
    releaseJob();
  }
}

async function buildPdfBlobUnsafe(data: PdfData): Promise<Blob> {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const html = renderToStaticMarkup(createElement(PdfDocument, { data }));

  // Make sure custom Google Fonts (Tenor Sans, Inter, Cormorant Garamond,
  // Playfair Display) are fully loaded before html2canvas snapshots the DOM.
  // Without this, the production build falls back to system fonts which
  // produces overlapping glyphs (e.g. "i" over "t" in "Subministrament i").
  try {
    const fontSet: any = (document as any).fonts;
    if (fontSet) {
      await Promise.all([
        fontSet.load('400 14pt "Tenor Sans"'),
        fontSet.load('400 11pt "Inter"'),
        fontSet.load('700 11pt "Inter"'),
        fontSet.load('400 16pt "Cormorant Garamond"'),
        fontSet.load('700 16pt "Cormorant Garamond"'),
        fontSet.load('400 16pt "Playfair Display"'),
      ]).catch(() => undefined);
      if (fontSet.ready) await fontSet.ready;
    }
  } catch {
    /* ignore — best-effort */
  }

  // Pre-warm the browser image cache for every external (https://) asset
  // referenced in the HTML before we mount the offscreen DOM. This way
  // html2canvas finds the bytes already decoded in cache and doesn't have
  // to wait on slow Supabase Storage downloads per page.
  try {
    const urlSet = new Set<string>();
    const re = /https:\/\/[^\s"'<>)]+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const u = m[0];
      if (/\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(u)) urlSet.add(u);
    }
    const localRe = /\/pdf\/[^\s"'<>)]+\.(png|jpe?g|webp|gif|svg|avif)/gi;
    let lm: RegExpExecArray | null;
    while ((lm = localRe.exec(html)) !== null) {
      urlSet.add(lm[0]);
    }
    await Promise.all(
      Array.from(urlSet).map(
        (url) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            const done = () => resolve();
            img.onload = done;
            img.onerror = done; // ignore failures silently
            // Hard cap per image so one slow asset can't stall the whole job.
            setTimeout(done, 5000);
            img.src = url;
          }),
      ),
    );
  } catch {
    /* best-effort preload */
  }

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.background = "#ffffff";
  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    // Each direct child <div> of #pdf-document wraps a single A4 page.
    const root = host.querySelector("#pdf-document") as HTMLElement | null;
    if (!root) throw new Error("PDF root not found");
    const pageNodes = Array.from(root.children) as HTMLElement[];

    await waitForPdfAssets(root);

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
      // Help the GC reclaim the canvas between pages so memory doesn't
      // balloon with 20+ A4 snapshots in flight.
      canvas.width = 0;
      canvas.height = 0;
    }

    const blob: Blob = pdf.output("blob");
    return blob;
  } finally {
    document.body.removeChild(host);
  }
}

/** Back-compat helper. Prefer calling `saveBlobWithPicker(() => buildPdfBlob(data), filename)`
 *  directly from a click handler so the picker fires before any await. */
export async function renderPdfDocument(data: PdfData, filename: string) {
  const { saveBlobWithPicker } = await import("@/lib/saveFile");
  await saveBlobWithPicker(() => buildPdfBlob(data), filename);
}
