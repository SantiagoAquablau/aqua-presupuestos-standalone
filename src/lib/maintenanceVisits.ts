/**
 * Build human-friendly maintenance visit period strings for the PDF.
 *
 * Maps each month's visit count to a periodicity label and groups
 * consecutive months sharing the same periodicity (including wrap-around
 * from December → January) into a single line.
 */

const MONTHS_CA = [
  "gener",
  "febrer",
  "març",
  "abril",
  "maig",
  "juny",
  "juliol",
  "agost",
  "setembre",
  "octubre",
  "novembre",
  "desembre",
];

const MONTH_LAST_DAY = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Visit frequency stored per month. Used by the wizard's selector and to
 *  derive both the actual visit count and the natural-language PDF text. */
export type MaintenanceVisitFreq =
  | 'none'
  | 'monthly1'
  | 'monthly2'
  | 'weekly1'
  | 'weekly2'
  | 'weekly3';

export interface VisitFreqOption {
  value: MaintenanceVisitFreq;
  label: string;
  /** Catalan singular/plural phrase used in the PDF body. */
  pdfLabel: string;
}

export const VISIT_FREQ_OPTIONS: VisitFreqOption[] = [
  { value: 'none',     label: 'Sense visites',            pdfLabel: '' },
  { value: 'monthly1', label: '1 visita al mes',          pdfLabel: '1 visita mensual' },
  { value: 'monthly2', label: '2 visites al mes',         pdfLabel: '2 visites mensuals' },
  { value: 'weekly1',  label: '1 visita setmanal',        pdfLabel: '1 visita setmanal' },
  { value: 'weekly2',  label: '2 visites setmanals',      pdfLabel: '2 visites setmanals' },
  { value: 'weekly3',  label: '3 visites setmanals',      pdfLabel: '3 visites setmanals' },
];

/** Number of "work weeks" in a given month, counted as the number of
 *  Mondays the month contains. This avoids counting weekends as a full
 *  week of service (we only work Mon–Fri). */
export function weeksInMonth(year: number, monthIdx: number): number {
  const days = new Date(year, monthIdx + 1, 0).getDate();
  let mondays = 0;
  for (let d = 1; d <= days; d++) {
    if (new Date(year, monthIdx, d).getDay() === 1) mondays++;
  }
  return mondays;
}

/** Convert a frequency to the actual visit count for the given month. */
export function visitsForFrequency(
  freq: MaintenanceVisitFreq,
  year: number,
  monthIdx: number,
): number {
  switch (freq) {
    case 'monthly1': return 1;
    case 'monthly2': return 2;
    case 'weekly1':  return weeksInMonth(year, monthIdx);
    case 'weekly2':  return 2 * weeksInMonth(year, monthIdx);
    case 'weekly3':  return 3 * weeksInMonth(year, monthIdx);
    default:         return 0;
  }
}

/** Build the 12-month visit count array from a frequency array. */
export function visitsFromFrequency(
  freq: MaintenanceVisitFreq[],
  year: number = new Date().getFullYear(),
): number[] {
  return Array.from({ length: 12 }, (_, i) =>
    visitsForFrequency(freq[i] || 'none', year, i),
  );
}

/** Best-effort reverse mapping: given a raw visit count for a month, pick
 *  the closest frequency option (used for backward compatibility when a
 *  budget was saved before the selector existed). */
export function frequencyFromVisits(n: number): MaintenanceVisitFreq {
  if (!n || n <= 0) return 'none';
  if (n >= 12) return 'weekly3';
  if (n >= 8)  return 'weekly2';
  if (n >= 4)  return 'weekly1';
  if (n === 2) return 'monthly2';
  return 'monthly1';
}

function classifyFromCount(n: number): { key: string; label: string } | null {
  if (!n || n <= 0) return null;
  if (n >= 4) return { key: "setmanal", label: "1 visita setmanal" };
  if (n === 3) return { key: "tri", label: "3 visites mensuals" };
  if (n === 2) return { key: "quinzenal", label: "2 visites mensuals" };
  return { key: "mensual", label: "1 visita mensual" };
}

/** Build human-readable period lines.
 *  Prefer passing the frequency array — it groups by the user's explicit
 *  choice instead of guessing from a count. */
export function buildVisitPeriodsText(
  visits: number[],
  freq?: MaintenanceVisitFreq[],
): string[] {
  const patt: Array<{ key: string; label: string } | null> = freq
    ? freq.map((f) => {
        const opt = VISIT_FREQ_OPTIONS.find((o) => o.value === f);
        if (!opt || f === 'none') return null;
        return { key: f, label: opt.pdfLabel };
      })
    : visits.map(classifyFromCount);

  type G = { start: number; end: number; key: string; label: string };
  const groups: G[] = [];
  for (let i = 0; i < 12; i++) {
    const p = patt[i];
    if (!p) continue;
    const last = groups[groups.length - 1];
    if (last && last.key === p.key && last.end === i - 1) {
      last.end = i;
    } else {
      groups.push({ start: i, end: i, key: p.key, label: p.label });
    }
  }

  // Wrap-around merge: if first starts in January and last ends in December and
  // they share the same key, fuse them into a single Nov→Apr style period.
  if (groups.length >= 2) {
    const first = groups[0];
    const last = groups[groups.length - 1];
    if (first.start === 0 && last.end === 11 && first.key === last.key) {
      const merged: G = { start: last.start, end: first.end, key: first.key, label: first.label };
      groups.shift();
      groups.pop();
      groups.push(merged);
    }
  }

  // Combine non-adjacent groups that share the same periodicity into a
  // single line: "Del X al Y i del A al B 1 visita setmanal."
  const byKey = new Map<string, G[]>();
  const order: string[] = [];
  for (const g of groups) {
    if (!byKey.has(g.key)) {
      byKey.set(g.key, []);
      order.push(g.key);
    }
    byKey.get(g.key)!.push(g);
  }

  const fmtRange = (g: G) =>
    `del 01 de ${MONTHS_CA[g.start]} al ${MONTH_LAST_DAY[g.end]} de ${MONTHS_CA[g.end]}`;

  return order.map((key) => {
    const gs = byKey.get(key)!;
    const label = gs[0].label;
    const ranges = gs.map(fmtRange);
    let joined: string;
    if (ranges.length === 1) joined = ranges[0];
    else if (ranges.length === 2) joined = `${ranges[0]} i ${ranges[1]}`;
    else joined = `${ranges.slice(0, -1).join(', ')} i ${ranges[ranges.length - 1]}`;
    // Capitalize first letter.
    joined = joined.charAt(0).toUpperCase() + joined.slice(1);
    return `${joined} ${label}.`;
  });
}