/**
 * Orchestrator: composes the 7 page components into one A4 document.
 * Used by the live preview AND by html2pdf.js (rendered to static markup).
 */
import type { PdfData } from './pdfTypes';
import { PageCover } from './PageCover';
import { PageEstructura } from './PageEstructura';
import { PageElementsEstructurals } from './PageElementsEstructurals';
import { PageAcabats } from './PageAcabats';
import { PageDepuracio1 } from './PageDepuracio1';
import { PageDepuracio2 } from './PageDepuracio2';
import { PageElectricitat } from './PageElectricitat';
import { PageAccessoris } from './PageAccessoris';
import { PageResum } from './PageResum';
import { PageComanda } from './PageComanda';
import { PageAnnexProjecte } from './PageAnnexProjecte';
import { PageAnnexExcavacio } from './PageAnnexExcavacio';
import { PageAnnexNetejafons } from './PageAnnexNetejafons';
import { PageAnnexRobot } from './PageAnnexRobot';
import { PageAnnexBombaCalor } from './PageAnnexBombaCalor';
import { PageAnnexCobertor } from './PageAnnexCobertor';
import { PageAnnexCaseta } from './PageAnnexCaseta';
import { PageAnnexGespa } from './PageAnnexGespa';
import { PageAnnexRevestiment } from './PageAnnexRevestiment';
import { PageAnnexPaviment } from './PageAnnexPaviment';
import { PageAnnexOpcionalsInstal } from './PageAnnexOpcionalsInstal';
import { PageContacte } from './PageContacte';
import { PageManteniment } from './PageManteniment';
import { PagePostaPunt } from './PagePostaPunt';
import { PageCondicionsGenerals } from './PageCondicionsGenerals';

export function PdfDocument({ data }: { data: PdfData }) {
  // Maintenance variant: Portada → Manteniment → Resum → Contacte.
  if (data.isMaintenance) {
    const mPages = [
      <PageCover key="cover" data={data} />,
      <PageManteniment key="manteniment" data={data} />,
      <PagePostaPunt key="posta-punt" />,
      <PageCondicionsGenerals key="condicions" />,
      <PageResum key="resum" data={data} />,
      <PageContacte key="contacte" data={data} />,
    ];
    return (
      <div id="pdf-document" style={{ width: '210mm', margin: '0 auto', background: '#ffffff' }}>
        {mPages.map((page, i) => (
          <div
            key={i}
            style={
              i < mPages.length - 1
                ? { breakAfter: 'page', pageBreakAfter: 'always' }
                : undefined
            }
          >
            {page}
          </div>
        ))}
      </div>
    );
  }
  const projecteEstat = data.annexProjecteEstat;
  const excavacioEstat = data.annexExcavacioEstat;
  const netejafonsEstat = data.annexNetejafonsEstat;
  const robotEstat = data.annexRobotEstat;
  const bombaCalorEstat = data.annexBombaCalorEstat;
  const cobertorEstat = data.annexCobertorEstat;
  const casetaEstat = data.annexCasetaEstat;
  const gespaEstat = data.annexGespaEstat;
  const opcRevestimentEstat = data.annexOpcionalRevestimentEstat;
  const pavimentEstat = data.annexPavimentEstat;
  const showOpcionalsInstal = !!data.filtreOpcionalTipus || !!data.bombaOpcionalTipus;
  const coronamentOn = data.coronamentInclos !== false;
  const revestimentOn = data.revestimentInclos !== false;
  const showAcabats = coronamentOn || revestimentOn;

  // Build the ordered list of "inclos" annexes to enumerate them and know
  // which page is the last (where we render the TOTAL ANNEX badge).
  const inclosOrder: string[] = [];
  if (projecteEstat === 'inclos') inclosOrder.push('projecte');
  if (excavacioEstat === 'inclos') inclosOrder.push('excavacio');
  if (netejafonsEstat === 'inclos') inclosOrder.push('netejafons');
  if (robotEstat === 'inclos') inclosOrder.push('robot');
  if (bombaCalorEstat === 'inclos') inclosOrder.push('bombaCalor');
  if (cobertorEstat === 'inclos') inclosOrder.push('cobertor');
  if (casetaEstat === 'inclos') inclosOrder.push('caseta');
  if (gespaEstat === 'inclos') inclosOrder.push('gespa');
  if (pavimentEstat === 'inclos') inclosOrder.push('paviment');
  const annexTotalCount = inclosOrder.length;
  const annexIdx = (key: string) => inclosOrder.indexOf(key) + 1;
  const isLast = (key: string) => inclosOrder[inclosOrder.length - 1] === key;
  const annexGrandTotal = data.phaseAnnexTotal || 0;
  const annexProps = (key: string) => ({
    annexIndex: annexIdx(key),
    annexTotalCount,
    isLastAnnex: isLast(key),
    annexGrandTotal,
  });

  const pages = [
    <PageCover key="cover" data={data} />,
    <PageEstructura key="estructura" data={data} />,
    <PageElementsEstructurals key="elements" data={data} />,
    ...(showAcabats ? [<PageAcabats key="acabats" data={data} />] : []),
    <PageDepuracio1 key="dep1" data={data} />,
    <PageDepuracio2 key="dep2" data={data} />,
    <PageElectricitat key="elec" data={data} />,
    <PageAccessoris key="accessoris" data={data} />,
    ...(projecteEstat === 'inclos'
      ? [<PageAnnexProjecte key="annex-projecte-in" data={data} variant="inclos" {...annexProps('projecte')} />]
      : []),
    ...(excavacioEstat === 'inclos'
      ? [<PageAnnexExcavacio key="annex-excavacio-in" data={data} variant="inclos" {...annexProps('excavacio')} />]
      : []),
    ...(netejafonsEstat === 'inclos'
      ? [<PageAnnexNetejafons key="annex-netejafons-in" data={data} variant="inclos" {...annexProps('netejafons')} />]
      : []),
    ...(robotEstat === 'inclos'
      ? [<PageAnnexRobot key="annex-robot-in" data={data} variant="inclos" {...annexProps('robot')} />]
      : []),
    ...(bombaCalorEstat === 'inclos'
      ? [<PageAnnexBombaCalor key="annex-bc-in" data={data} variant="inclos" {...annexProps('bombaCalor')} />]
      : []),
    ...(cobertorEstat === 'inclos'
      ? [<PageAnnexCobertor key="annex-cob-in" data={data} variant="inclos" {...annexProps('cobertor')} />]
      : []),
    ...(casetaEstat === 'inclos'
      ? [<PageAnnexCaseta key="annex-caseta-in" data={data} variant="inclos" {...annexProps('caseta')} />]
      : []),
    ...(gespaEstat === 'inclos'
      ? [<PageAnnexGespa key="annex-gespa-in" data={data} variant="inclos" {...annexProps('gespa')} />]
      : []),
    ...(pavimentEstat === 'inclos'
      ? [<PageAnnexPaviment key="annex-paviment-in" data={data} variant="inclos" {...annexProps('paviment')} />]
      : []),
    <PageResum key="resum" data={data} />,
    ...(data.contractantName || data.contractantNif || data.contractantAddress || data.contractantTown || data.obraLocation
      ? [<PageComanda key="comanda" data={data} />]
      : []),
    ...(projecteEstat === 'opcional'
      ? [<PageAnnexProjecte key="annex-projecte-op" data={data} variant="opcional" />]
      : []),
    ...(excavacioEstat === 'opcional'
      ? [<PageAnnexExcavacio key="annex-excavacio-op" data={data} variant="opcional" />]
      : []),
    ...(netejafonsEstat === 'opcional'
      ? [<PageAnnexNetejafons key="annex-netejafons-op" data={data} variant="opcional" />]
      : []),
    ...(robotEstat === 'opcional'
      ? [<PageAnnexRobot key="annex-robot-op" data={data} variant="opcional" />]
      : []),
    ...(bombaCalorEstat === 'opcional'
      ? [<PageAnnexBombaCalor key="annex-bc-op" data={data} variant="opcional" />]
      : []),
    ...(cobertorEstat === 'opcional'
      ? [<PageAnnexCobertor key="annex-cob-op" data={data} variant="opcional" />]
      : []),
    ...(casetaEstat === 'opcional'
      ? [<PageAnnexCaseta key="annex-caseta-op" data={data} variant="opcional" />]
      : []),
    ...(gespaEstat === 'opcional'
      ? [<PageAnnexGespa key="annex-gespa-op" data={data} variant="opcional" />]
      : []),
    ...(pavimentEstat === 'opcional'
      ? [<PageAnnexPaviment key="annex-paviment-op" data={data} variant="opcional" />]
      : []),
    ...(opcRevestimentEstat === 'opcional'
      ? [<PageAnnexRevestiment key="annex-revestiment-op" data={data} />]
      : []),
    ...(showOpcionalsInstal
      ? [<PageAnnexOpcionalsInstal key="annex-opc-instal" data={data} />]
      : []),
    <PageContacte key="contacte" data={data} />,
  ];
  return (
    <div id="pdf-document" style={{ width: '210mm', margin: '0 auto', background: '#ffffff' }}>
      {pages.map((page, i) => (
        <div
          key={i}
          style={
            i < pages.length - 1
              ? { breakAfter: 'page', pageBreakAfter: 'always' }
              : undefined
          }
        >
          {page}
        </div>
      ))}
    </div>
  );
}
