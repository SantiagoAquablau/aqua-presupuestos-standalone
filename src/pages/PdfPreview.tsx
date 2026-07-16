import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { PdfDocument } from '@/components/pdf/PdfDocument';
import { buildSamplePdfData } from '@/components/pdf/pdfSample';
import type { PdfData } from '@/components/pdf/pdfTypes';
import { toast } from 'sonner';

/**
 * Admin-only preview of the AquaBlau PDF template.
 * Renders the same HTML used by html2pdf.js inside a scaled iframe so
 * admins can validate the design with sample data before sending real
 * documents to clients.
 */
export default function PdfPreview() {
  const [data, setData] = useState<PdfData>(() => buildSamplePdfData());
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { renderPdfDocument } = await import('@/lib/pdfRender');
      await renderPdfDocument(data, 'aquablau-pdf-preview.pdf');
      toast.success('PDF de previsualització descarregat');
    } catch (err: any) {
      console.error('[PdfPreview] download error', err);
      toast.error('Error generant el PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <Link to="/configuracio" className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Tornar a Configuració
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">Previsualització plantilla PDF</h1>
          <p className="text-sm text-muted-foreground">Vista del disseny amb dades de mostra. Aquesta plantilla és la mateixa que es genera des del wizard.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setData(buildSamplePdfData())}
            className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refrescar mostra
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="gradient-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 shadow-md flex items-center gap-2 disabled:opacity-60"
          >
            <Download className="w-4 h-4" /> {downloading ? 'Generant…' : 'Descarregar PDF'}
          </button>
        </div>
      </div>

      <div className="bg-[#9aa5b1] rounded-xl border border-border shadow-card p-6 overflow-auto" style={{ maxHeight: '85vh' }}>
        <PdfDocument data={data} />
      </div>
    </div>
  );
}