/**
 * Save a Blob to disk. Receives a `getBlob` callback (NOT a resolved blob)
 * so that `showSaveFilePicker` can be invoked first — while the user's click
 * gesture is still active. Only after the user picks a destination is the
 * (potentially slow) blob generation triggered. Without this ordering, the
 * browser silently rejects the picker because the transient user activation
 * gets consumed by the awaits during PDF rendering.
 *
 * Falls back to a regular anchor-based download (Firefox / Safari) when the
 * File System Access API is unavailable.
 */
function isAbortError(err: any) {
  return err && (err.name === 'AbortError' || err.code === 20);
}

function downloadBlobWithAnchor(blob: Blob, suggestedName: string, preferDataUrl = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const trigger = (url: string, revoke?: () => void) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (revoke) setTimeout(revoke, 1500);
      resolve();
    };

    if (preferDataUrl) {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('No s’ha pogut preparar el fitxer'));
      reader.onload = () => trigger(String(reader.result || ''));
      reader.readAsDataURL(blob);
      return;
    }

    const url = URL.createObjectURL(blob);
    trigger(url, () => URL.revokeObjectURL(url));
  });
}

function promptIOSShare(file: File, suggestedName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const navAny: any = navigator;
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '2147483647';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '24px';
    overlay.style.background = 'hsl(var(--foreground) / 0.35)';

    const panel = document.createElement('div');
    panel.style.width = 'min(420px, 100%)';
    panel.style.borderRadius = '12px';
    panel.style.border = '1px solid hsl(var(--border))';
    panel.style.background = 'hsl(var(--background))';
    panel.style.color = 'hsl(var(--foreground))';
    panel.style.boxShadow = '0 24px 80px hsl(var(--foreground) / 0.22)';
    panel.style.padding = '20px';
    panel.style.fontFamily = 'Inter, system-ui, sans-serif';

    const title = document.createElement('h2');
    title.textContent = 'PDF preparat';
    title.style.margin = '0 0 8px';
    title.style.fontSize = '20px';
    title.style.fontWeight = '700';

    const text = document.createElement('p');
    text.textContent = 'A iPad/iPhone, Safari no permet descarregar PDFs automàticament a Descàrregues. Toca “Guardar PDF” i tria “Guardar a Arxius” o “Descàrregues”.';
    text.style.margin = '0 0 18px';
    text.style.fontSize = '14px';
    text.style.lineHeight = '1.5';
    text.style.color = 'hsl(var(--muted-foreground))';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.justifyContent = 'flex-end';
    actions.style.flexWrap = 'wrap';

    const makeButton = (label: string, primary = false) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.style.border = `1px solid hsl(var(${primary ? '--primary' : '--border'}))`;
      button.style.borderRadius = '8px';
      button.style.padding = '10px 14px';
      button.style.fontSize = '14px';
      button.style.fontWeight = '600';
      button.style.background = primary ? 'hsl(var(--primary))' : 'hsl(var(--background))';
      button.style.color = primary ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))';
      return button;
    };

    const cancel = makeButton('Cancel·lar');
    const open = makeButton('Obrir PDF');
    const save = makeButton('Guardar PDF', true);

    const cleanup = () => overlay.remove();
    cancel.onclick = () => {
      cleanup();
      resolve();
    };
    open.onclick = async () => {
      try {
        await downloadBlobWithAnchor(file, suggestedName, true);
        cleanup();
        resolve();
      } catch (err) {
        cleanup();
        reject(err);
      }
    };
    save.onclick = async () => {
      try {
        // Only pass `files` — including `title` or `text` causes iOS to
        // additionally save a .txt note alongside the PDF in some apps.
        await navAny.share({ files: [file] });
        cleanup();
        resolve();
      } catch (err: any) {
        cleanup();
        if (isAbortError(err)) resolve();
        else reject(err);
      }
    };

    actions.append(cancel, open, save);
    panel.append(title, text, actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  });
}

export async function saveBlobWithPicker(
  getBlob: () => Promise<Blob>,
  suggestedName: string,
  mime: string = 'application/pdf',
): Promise<void> {
  const w = window as any;
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);

  // iOS Safari ignores the <a download> attribute for blob URLs and it often
  // rejects `navigator.share()` after a long PDF render because the original
  // tap gesture has expired. Build the PDF once, then ask for a second tap on
  // a native share button so iOS opens the system save/share sheet reliably.
  if (isIOS) {
    const blob = await getBlob();
    const file = new File([blob], suggestedName, { type: mime });
    const navAny: any = navigator;
    if (typeof navAny.canShare === 'function' && navAny.canShare({ files: [file] })) {
      await promptIOSShare(file, suggestedName);
      return;
    }
    await downloadBlobWithAnchor(blob, suggestedName, true);
    return;
  }

  if (typeof w.showSaveFilePicker === 'function') {
    let handle: any = null;
    try {
      const ext = suggestedName.includes('.') ? suggestedName.split('.').pop()! : 'pdf';
      // IMPORTANT — call the picker FIRST, before any other await, so the
      // user-gesture activation is still live.
      handle = await w.showSaveFilePicker({
        suggestedName,
        types: [{
          description: ext.toUpperCase() + ' file',
          accept: { [mime]: ['.' + ext] },
        }],
      });
    } catch (err: any) {
      // User cancelled — silently abort.
      if (isAbortError(err)) return;
      console.warn('[saveBlobWithPicker] picker unavailable, falling back to download', err);
    }
    if (handle) {
      const blob = await getBlob();
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }
  }
  // Fallback for browsers without the File System Access API (or when the
  // picker threw something other than AbortError).
  const blob = await getBlob();
  await downloadBlobWithAnchor(blob, suggestedName);
}