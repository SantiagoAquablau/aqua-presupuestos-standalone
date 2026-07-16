/**
 * Composes the annex PDF: PageCover + one PageAnnexBlock per assisted/manual
 * group + PageAnnexResum + PageContacte.
 */
import type { PdfData } from "./pdfTypes";
import { PageCover } from "./PageCover";
import { PageContacte } from "./PageContacte";
import { PageAnnexBlock, type AnnexBlockBullet } from "./PageAnnexBlock";
import { PageAnnexResum } from "./PageAnnexResum";
import { PageAnnexRobot } from "./PageAnnexRobot";
import { PageAnnexBombaCalor } from "./PageAnnexBombaCalor";
import { PageAnnexGespa } from "./PageAnnexGespa";
import { PageAnnexPaviment } from "./PageAnnexPaviment";
import { PageAnnexCobertor } from "./PageAnnexCobertor";
import { PageAnnexAccessoris, type AnnexAccessoriLine } from "./PageAnnexAccessoris";

export type AnnexBlockKind =
  | "bomba_calor"
  | "robot"
  | "cobertor"
  | "gespa"
  | "paviment"
  | "accessoris"
  | "manual";

export interface AnnexPdfBlock {
  key: string;
  /** Determines which PDF page renders this block. */
  kind: AnnexBlockKind;
  sectionLabel: string;
  subtitle?: string;
  bullets: AnnexBlockBullet[];
  total: number;
  backgroundImageUrl?: string;
  /** Per-block PdfData used by the kind-specific page (Robot, BombaCalor…). */
  pdfData?: PdfData;
  /** When the block is a manual block (free-typed partides), show the annex
   *  reason instead of the "Subministrament i col·locació de:" subtitle. */
  reason?: string;
  /** For accessoris blocks: which variant to render. */
  accessorisVariant?: "basics" | "opcionals";
}

export interface AnnexPdfDocumentData {
  /** Cover data (client, pool, dates) — reuses PdfData shape so PageCover
   *  renders identically to the budget PDF. */
  cover: PdfData;
  annexNumber: string;
  budgetNumber: string;
  reason?: string;
  blocks: AnnexPdfBlock[];
  total: number;
  globalPct?: number;
  /** Contact info for the closing page. */
  comercialName?: string;
  comercialEmail?: string;
}

export function AnnexPdfDocument({ data }: { data: AnnexPdfDocumentData }) {
  const grand = data.total || 0;
  const total = data.blocks.length;

  const renderBlock = (b: AnnexPdfBlock, i: number) => {
    const common = {
      annexIndex: i + 1,
      annexTotalCount: total,
      // The annex PDF has its own RESUM page right after the blocks, so we
      // never want the in-page TOTAL ANNEX badge to appear here.
      isLastAnnex: false,
      annexGrandTotal: grand,
    };
    if (b.kind === "accessoris") {
      const lines: AnnexAccessoriLine[] = b.bullets.map((bl) => ({
        label: bl.description,
        qty: bl.quantity || 1,
        total: bl.totalSale || 0,
      }));
      return (
        <PageAnnexAccessoris
          variant={b.accessorisVariant || "basics"}
          lines={lines}
          total={b.total}
          {...common}
        />
      );
    }
    if (b.pdfData) {
      switch (b.kind) {
        case "robot":
          return <PageAnnexRobot data={b.pdfData} variant="inclos" {...common} />;
        case "bomba_calor":
          return <PageAnnexBombaCalor data={b.pdfData} variant="inclos" {...common} />;
        case "gespa":
          return <PageAnnexGespa data={b.pdfData} variant="inclos" {...common} />;
        case "paviment":
          return <PageAnnexPaviment data={b.pdfData} variant="inclos" {...common} />;
        case "cobertor":
          return <PageAnnexCobertor data={b.pdfData} variant="inclos" {...common} />;
        default:
          break;
      }
    }
    return (
      <PageAnnexBlock
        sectionLabel={b.sectionLabel}
        subtitle={b.subtitle}
        bullets={b.bullets}
        total={b.total}
        annexIndex={i + 1}
        annexTotalCount={total}
        isLastAnnex={false}
        annexGrandTotal={grand}
        backgroundImageUrl={b.backgroundImageUrl}
        reason={b.reason}
        tableMode={b.kind === "manual"}
      />
    );
  };

  const pages = [
    <PageCover key="cover" data={data.cover} />,
    ...data.blocks.map((b, i) => (
      <div key={`block-${b.key}-${i}`}>{renderBlock(b, i)}</div>
    )),
    <PageAnnexResum
      key="resum"
      annexNumber={data.annexNumber}
      budgetNumber={data.budgetNumber}
      rows={data.blocks.map((b) => ({ label: b.sectionLabel, value: b.total }))}
      total={data.total}
      globalPct={data.globalPct}
      reason={data.reason}
    />,
    <PageContacte
      key="contacte"
      data={{
        ...data.cover,
        comercialName: data.comercialName,
        comercialEmail: data.comercialEmail,
      }}
    />,
  ];

  return (
    <div id="pdf-document" style={{ width: "210mm", margin: "0 auto", background: "#ffffff" }}>
      {pages.map((page, i) => (
        <div
          key={i}
          style={
            i < pages.length - 1
              ? { breakAfter: "page", pageBreakAfter: "always" }
              : undefined
          }
        >
          {page}
        </div>
      ))}
    </div>
  );
}