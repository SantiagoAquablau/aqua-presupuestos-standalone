import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowUpRight, X } from 'lucide-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { BudgetStatus, BudgetType } from '@/stores/budgetStore';
import { cn } from '@/lib/utils';

interface Props {
  /** Live value from the StepClient form (react-hook-form `watch`). */
  email?: string;
  phone?: string;
  /** Type of the budget being created/edited — drives same-type vs other-type grouping. */
  currentType?: BudgetType;
  /** Set when editing an existing budget — excluded from the results. */
  currentBudgetId?: string;
  /** Secondary self-exclusion, covers the gap before the first auto-save assigns an id. */
  currentBudgetNumber?: string;
}

interface DupRow {
  id: string;
  number: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  type: BudgetType | null;
  budget_date: string | null;
  status: BudgetStatus | null;
}

const TYPE_META: Record<string, { label: string; emoji: string }> = {
  obra_nueva: { label: 'Obra Nova', emoji: '🏗️' },
  rehabilitacion: { label: 'Rehabilitació', emoji: '🔧' },
  mantenimiento: { label: 'Manteniment', emoji: '🛡️' },
  piscina_autoportant: { label: 'Piscina Autoportant', emoji: '🌊' },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const digitsOnly = (s?: string | null): string => (s || '').replace(/\D/g, '');

function fmtDate(d?: string | null): string {
  if (!d) return '';
  const [y, m, day] = d.split('T')[0].split('-');
  return y && m && day ? `${day}/${m}/${y}` : d;
}

// Escape the PostgREST `.or()` structural characters so a value containing a
// comma or parenthesis can't break out of its condition.
const escapeOr = (v: string): string => v.replace(/[,()]/g, '\\$&');

function matchedFields(row: DupRow, emailNorm: string, phone9: string): Array<'email' | 'phone'> {
  const out: Array<'email' | 'phone'> = [];
  if (emailNorm && (row.client_email || '').trim().toLowerCase() === emailNorm) out.push('email');
  if (phone9) {
    const rd = digitsOnly(row.client_phone);
    if (rd.length >= 9 && rd.endsWith(phone9)) out.push('phone');
  }
  return out;
}

function matchLabel(fields: Array<'email' | 'phone'>): string {
  if (fields.includes('email') && fields.includes('phone')) return 'email i telèfon';
  if (fields.includes('email')) return 'email';
  return 'telèfon';
}

function DupCard({ row, match, tone }: { row: DupRow; match: string; tone: 'warning' | 'info' }) {
  const meta = row.type ? TYPE_META[row.type] : undefined;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm',
        tone === 'warning' ? 'border-warning/30 bg-warning/5' : 'border-border bg-muted/40',
      )}
    >
      <span className="font-medium text-foreground">{row.client_name || 'Sense nom'}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-foreground">
        {meta ? `${meta.emoji} ${meta.label}` : row.type || '—'}
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">{fmtDate(row.budget_date)}</span>
      <span className="font-mono text-xs text-primary">{row.number}</span>
      {row.status && <StatusBadge status={row.status} />}
      <span className="text-xs text-muted-foreground">Coincidència per: {match}</span>
      <a
        href={`/pressupostos?q=${encodeURIComponent(row.number)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      >
        Veure pressupost <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

export function DuplicateClientBanner({
  email,
  phone,
  currentType,
  currentBudgetId,
  currentBudgetNumber,
}: Props) {
  const emailNorm = useMemo(() => {
    const e = (email || '').trim().toLowerCase();
    return EMAIL_RE.test(e) ? e : '';
  }, [email]);

  const phone9 = useMemo(() => {
    const d = digitsOnly(phone);
    return d.length >= 9 ? d.slice(-9) : '';
  }, [phone]);

  // Debounce the typed values (500ms) before they hit Supabase — mirrors the
  // auto-save cadence elsewhere in the wizard.
  const [deb, setDeb] = useState({ email: '', phone: '' });
  useEffect(() => {
    const t = setTimeout(() => setDeb({ email: emailNorm, phone: phone9 }), 500);
    return () => clearTimeout(t);
  }, [emailNorm, phone9]);

  const { data: rows = [] } = useQuery({
    queryKey: ['budget-duplicates', deb.email || null, deb.phone || null, currentBudgetId || null],
    enabled: !!(deb.email || deb.phone),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const ors: string[] = [];
      if (deb.email) ors.push(`client_email.ilike.${escapeOr(deb.email)}`);
      // Loose subsequence match on the digits — the stored phone may carry
      // spaces / a country prefix. Results are re-verified in JS below.
      if (deb.phone) ors.push(`client_phone.ilike.%${deb.phone.split('').join('%')}%`);

      let q = supabase
        .from('budgets')
        .select('id, number, client_name, client_email, client_phone, type, budget_date, status')
        .eq('deleted', false)
        .or(ors.join(','))
        .order('budget_date', { ascending: false })
        .limit(20);
      if (currentBudgetId) q = q.neq('id', currentBudgetId);

      const { data, error } = await q.abortSignal(signal);
      if (error) throw error;
      return (data || []) as DupRow[];
    },
  });

  const { sameType, otherType, total } = useMemo(() => {
    const seen = new Set<string>();
    const verified = rows
      .filter((r) => r.id !== currentBudgetId && r.number !== currentBudgetNumber)
      .map((r) => ({ row: r, fields: matchedFields(r, deb.email, deb.phone) }))
      .filter((x) => x.fields.length > 0)
      .filter((x) => (seen.has(x.row.id) ? false : (seen.add(x.row.id), true)));

    return {
      sameType: verified.filter((x) => currentType && x.row.type === currentType),
      otherType: verified.filter((x) => !currentType || x.row.type !== currentType),
      total: verified.length,
    };
  }, [rows, currentType, currentBudgetId, currentBudgetNumber, deb.email, deb.phone]);

  // Dismiss is scoped to the exact query — a new email/phone re-shows the banner.
  const signature = `${deb.email}|${deb.phone}`;
  const [dismissed, setDismissed] = useState<string | null>(null);
  const visible = total > 0 && dismissed !== signature;

  const MAX = 3;
  const sameShown = sameType.slice(0, MAX);
  const otherShown = otherType.slice(0, MAX);
  const hidden = total - sameShown.length - otherShown.length;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="md:col-span-2 overflow-hidden"
        >
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    Ja existeix un pressupost per a aquest client
                  </p>
                  <button
                    type="button"
                    onClick={() => setDismissed(signature)}
                    className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-warning/20 hover:text-foreground"
                    aria-label="Descartar avís"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {sameShown.length > 0 && (
                  <div className="space-y-1.5">
                    {sameShown.map((x) => (
                      <DupCard key={x.row.id} row={x.row} match={matchLabel(x.fields)} tone="warning" />
                    ))}
                  </div>
                )}

                {otherShown.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Altres tipus
                    </p>
                    {otherShown.map((x) => (
                      <DupCard key={x.row.id} row={x.row} match={matchLabel(x.fields)} tone="info" />
                    ))}
                  </div>
                )}

                {hidden > 0 && (
                  <a
                    href={`/pressupostos?q=${encodeURIComponent(
                      (email || '').trim() || (phone || '').trim(),
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs font-medium text-primary hover:underline"
                  >
                    +{hidden} pressupost{hidden === 1 ? '' : 's'} més
                  </a>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
