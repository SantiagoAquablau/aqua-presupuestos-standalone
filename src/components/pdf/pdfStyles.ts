/**
 * Visual constants for the AquaBlau PDF template.
 * Colors and fonts match the original printed budget exactly.
 */

export const PDF_COLORS = {
  navy: '#1F3D6B',          // Section titles, dark text
  navyDeep: '#162B4D',       // Cover "PISCINA" title
  aqua: '#5DA9D8',           // Logo wave + section badge fill
  beige: '#efe9e5',          // Page background
  cream: '#FBF7EE',          // Recommendation card background
  badgePill: '#A8C2DA',      // Total pill background (steel blue)
  badgeText: '#1F3D6B',      // Pill text (navy, per design refresh)
  textDark: '#1A1A2E',
  textBody: '#2F3236',
  textMuted: '#5A5A5A',
  optionalGreen: '#C7DDB1',  // "OPCIONALS" green pill
  borderLine: '#1F3D6B',
} as const;

export const PDF_FONTS = {
  // Use a stack that html2canvas can render reliably.
  serif: '"Cormorant Garamond", "Playfair Display", Georgia, "Times New Roman", serif',
  sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
} as const;

/**
 * A4 portrait page wrapper styles (used by every PdfPage<X> component).
 * NOTE: Page-break is NOT set here — it's added by <PdfDocument> only on
 * non-last pages to avoid a trailing blank page in html2pdf.
 */
export const pdfPageStyle: React.CSSProperties = {
  width: '210mm',
  height: '297mm',
  backgroundColor: PDF_COLORS.beige,
  position: 'relative',
  overflow: 'hidden',
  fontFamily: PDF_FONTS.sans,
  color: PDF_COLORS.textBody,
  boxSizing: 'border-box',
};

/** Format euros as "9.980,00 €" (Catalan format). */
export function formatEuro(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('ca-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' €';
}

/** Format a date as "DD/MM/YYYY". */
export function formatPdfDate(iso?: string): string {
  if (!iso) return new Date().toLocaleDateString('ca-ES');
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ca-ES');
}
