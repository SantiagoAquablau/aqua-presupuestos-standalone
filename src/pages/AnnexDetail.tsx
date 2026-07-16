import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, Plus, Trash2, Loader2, Send, CheckCircle2, Percent, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { fmtCents, fmtPct } from '@/lib/obrasHelpers';
import { AssistedAnnexPanel, type AssistedSeed } from '@/components/annex/AssistedAnnexPanel';
import { buildAnnexPdfData } from '@/lib/annexPdfData';
import { buildAnnexPdfBlob } from '@/lib/annexPdfRender';
import { saveBlobWithPicker } from '@/lib/saveFile';

type AnnexStatus = 'borrador' | 'enviat' | 'acceptat' | 'rebutjat';

const statusBadge: Record<AnnexStatus, { label: string; cls: string }> = {
  borrador: { label: 'Esborrany', cls: 'bg-muted text-muted-foreground' },
  enviat: { label: 'Enviat', cls: 'bg-info/15 text-info' },
  acceptat: { label: 'Acceptat', cls: 'bg-success/15 text-success' },
  rebutjat: { label: 'Rebutjat', cls: 'bg-destructive/15 text-destructive' },
};

export default function AnnexDetail() {
  const { budgetId, annexId } = useParams<{ budgetId: string; annexId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const seedsParam = searchParams.get('seeds');
  const singleSeed = searchParams.get('seed');
  const seeds: AssistedSeed[] = seedsParam
    ? (seedsParam.split(',').map((s) => s.trim()).filter(Boolean) as AssistedSeed[])
    : singleSeed
      ? [singleSeed as AssistedSeed]
      : [];

  const { data: annex, isLoading } = useQuery({
    queryKey: ['annex', annexId],
    queryFn: async () => {
      const { data, error } = await supabase.from('pressupost_annexos' as any).select('*').eq('id', annexId!).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!annexId,
  });

  const { data: budget } = useQuery({
    queryKey: ['budget-mini', budgetId],
    queryFn: async () => {
      const { data } = await supabase.from('budgets').select('id, number, client_name, client_email').eq('id', budgetId!).single();
      return data;
    },
    enabled: !!budgetId,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['annex-items', annexId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pressupost_annex_items' as any)
        .select('*')
        .eq('annex_id', annexId!)
        .order('order', { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!annexId,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['annex', annexId] });
    qc.invalidateQueries({ queryKey: ['annex-items', annexId] });
    qc.invalidateQueries({ queryKey: ['annexos', budgetId] });
    qc.invalidateQueries({ queryKey: ['obra-phases'] });
    qc.invalidateQueries({ queryKey: ['obra-items'] });
    qc.invalidateQueries({ queryKey: ['obra'] });
  };

  // Realtime
  useEffect(() => {
    if (!annexId) return;
    const ch = supabase
      .channel(`annex-${annexId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pressupost_annexos', filter: `id=eq.${annexId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pressupost_annex_items', filter: `annex_id=eq.${annexId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annexId]);

  const updateAnnex = async (patch: Record<string, any>) => {
    const { error } = await supabase.from('pressupost_annexos' as any).update(patch).eq('id', annexId!);
    if (error) toast.error('Error: ' + error.message);
    else refresh();
  };

  const addItem = async () => {
    const { error } = await supabase.from('pressupost_annex_items' as any).insert({
      annex_id: annexId,
      description: 'Nova partida',
      quantity: 1,
      unit: 'ud',
      unit_cost: 0,
      unit_sale: 0,
      order: items.length,
    } as any);
    if (error) toast.error('Error: ' + error.message);
    else refresh();
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from('pressupost_annex_items' as any).delete().eq('id', id);
    if (error) toast.error('Error: ' + error.message);
    else refresh();
  };

  const handleSendEmail = async () => {
    if (!budget?.client_email) {
      toast.error('El client no té correu electrònic configurat al pressupost');
      return;
    }
    // Pre-build + save the PDF first so the comercial can attach it.
    try {
      await handleDownloadPdf({ silent: true });
    } catch (e: any) {
      console.warn('[annex] PDF generation failed before email', e);
    }
    const subject = `Annex ${annex.number} al pressupost ${budget.number}`;
    const lines = [
      `Bon dia ${budget.client_name || ''},`,
      '',
      `Us adjuntem l'annex ${annex.number} al pressupost ${budget.number}.`,
      annex.title ? `Concepte: ${annex.title}` : '',
      annex.reason ? `Motiu: ${annex.reason}` : '',
      '',
      'Quedem a la vostra disposició per a qualsevol consulta.',
      '',
      'Salutacions cordials,',
      profile?.full_name || '',
    ].filter(Boolean);
    const body = lines.join('\r\n');
    const mailto = `mailto:${encodeURIComponent(budget.client_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    await updateAnnex({ status: 'enviat', sent_at: new Date().toISOString() });
    window.location.href = mailto;
    toast.success("S'ha obert el client de correu. Adjunta-hi el PDF si cal.");
  };

  const handleDownloadPdf = async (opts: { silent?: boolean } = {}) => {
    if (!annexId) return;
    const filename = `Annex_${annex?.number || annexId}.pdf`.replace(/\s+/g, '_');
    try {
      await saveBlobWithPicker(async () => {
        const data = await buildAnnexPdfData(annexId);
        return await buildAnnexPdfBlob(data);
      }, filename);
      if (!opts.silent) toast.success('PDF generat');
    } catch (e: any) {
      if (!opts.silent) toast.error('Error generant PDF: ' + (e?.message || e));
      throw e;
    }
  };

  if (isLoading || !annex) {
    return <div className="p-8 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const sb = statusBadge[annex.status as AnnexStatus];
  const readOnly = annex.status === 'acceptat' || annex.status === 'enviat';
  const showAssisted = seeds.length > 0 && !readOnly;

  const closeSeed = () => {
    const sp = new URLSearchParams(searchParams);
    sp.delete('seed');
    sp.delete('seeds');
    setSearchParams(sp, { replace: true });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <button onClick={() => navigate(`/pressupostos/${budgetId}/annexos`)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" /> Tornar als annexos
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-mono text-primary">{annex.number}</h1>
          {budget && <p className="text-muted-foreground text-sm mt-1">{budget.client_name} · pressupost {budget.number}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center px-3 py-1 rounded-full text-sm font-medium', sb.cls)}>{sb.label}</span>
          <select
            value={annex.status}
            onChange={(e) => updateAnnex({ status: e.target.value })}
            className="px-3 py-1.5 rounded-lg border border-border bg-card text-sm"
          >
            <option value="borrador">Esborrany</option>
            <option value="enviat">Enviat</option>
            <option value="acceptat">Acceptat</option>
            <option value="rebutjat">Rebutjat</option>
          </select>
          {items.length > 0 && annex.status !== 'acceptat' && (
            <>
            <button
              onClick={() => handleDownloadPdf()}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted"
            >
              <Download className="w-4 h-4" />
              Descarregar PDF
            </button>
            <button
              onClick={handleSendEmail}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-info text-info-foreground text-sm font-medium hover:opacity-90"
            >
              <Send className="w-4 h-4" />
              Enviar per correu
            </button>
            </>
          )}
        </div>
      </div>

      {/* General info */}
      <div className="bg-card border border-border rounded-xl shadow-card p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Títol</label>
          <input
            type="text"
            defaultValue={annex.title}
            disabled={readOnly}
            onBlur={(e) => e.target.value !== annex.title && updateAnnex({ title: e.target.value })}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm disabled:opacity-60"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</label>
          <input
            type="date"
            defaultValue={annex.annex_date}
            disabled={readOnly}
            onBlur={(e) => e.target.value !== annex.annex_date && updateAnnex({ annex_date: e.target.value })}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm disabled:opacity-60"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Motiu de l'annex</label>
          <textarea
            defaultValue={annex.reason || ''}
            disabled={readOnly}
            onBlur={(e) => e.target.value !== (annex.reason || '') && updateAnnex({ reason: e.target.value })}
            rows={2}
            placeholder="Per què cal aquest annex? (canvis sol·licitats, treballs no previstos…)"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm disabled:opacity-60"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descripció general</label>
          <textarea
            defaultValue={annex.description || ''}
            disabled={readOnly}
            onBlur={(e) => e.target.value !== (annex.description || '') && updateAnnex({ description: e.target.value })}
            rows={3}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm disabled:opacity-60"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Percent className="w-3 h-3" /> % increment global sobre venda
          </label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              step="0.1"
              defaultValue={Number(annex.global_pct ?? 0)}
              disabled={readOnly}
              onBlur={(e) => {
                const v = Number(e.target.value) || 0;
                if (v !== Number(annex.global_pct ?? 0)) updateAnnex({ global_pct: v });
              }}
              className="w-32 px-3 py-2 rounded-lg border border-border bg-background text-sm disabled:opacity-60"
            />
            <span className="text-xs text-muted-foreground">
              Aplica un increment percentual sobre el preu de venda total de les partides. No afecta el cost.
            </span>
          </div>
        </div>
      </div>

      {/* Assisted creation panel — visible only when ?seed=... AND no items yet */}
      {showAssisted && budgetId && (
        <AssistedAnnexPanel
          seeds={seeds}
          annexId={annexId!}
          budgetId={budgetId}
          onDone={() => { closeSeed(); refresh(); }}
          onCancel={closeSeed}
        />
      )}

      {/* Items table */}
      <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Partides ({items.length})</h3>
          {!readOnly && (
            <button onClick={addItem} className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
              <Plus className="w-4 h-4" /> Afegir partida
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {['Descripció','Unitat','Qty','€/u Cost','€/u Venda','Total Cost','Total Venda',''].map((h) => (
                  <th key={h} className="text-left px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((it) => (
                <ItemRow key={it.id} item={it} readOnly={readOnly} onChange={refresh} onDelete={() => deleteItem(it.id)} />
              ))}
              {items.length === 0 && (
                <tr><td colSpan={8} className="text-center text-muted-foreground py-6 text-xs">Cap partida. Afegeix-ne una per començar.</td></tr>
              )}
            </tbody>
            <tfoot className="bg-muted/30 border-t border-border">
              <tr className="font-semibold">
                <td colSpan={5} className="px-2 py-2 text-right">TOTALS</td>
                <td className="px-2 py-2">{fmtCents(annex.total_cost)}</td>
                <td className="px-2 py-2">{fmtCents(annex.total_sale)}</td>
                <td className="px-2 py-2 text-xs text-muted-foreground">Marge: {fmtPct(annex.margin_pct)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {annex.status === 'acceptat' && (
        <div className="bg-success/10 border border-success/20 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Aquest annex està acceptat.</p>
            <p className="text-muted-foreground mt-0.5">Les seves partides s'han afegit automàticament a la rentabilitat de l'obra com a costos extres.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, readOnly, onChange, onDelete }: { item: any; readOnly: boolean; onChange: () => void; onDelete: () => void }) {
  const [draft, setDraft] = useState({
    description: item.description,
    unit: item.unit,
    quantity: String(item.quantity),
    unit_cost: String((item.unit_cost ?? 0) / 100),
    unit_sale: String((item.unit_sale ?? 0) / 100),
  });

  useEffect(() => {
    setDraft({
      description: item.description,
      unit: item.unit,
      quantity: String(item.quantity),
      unit_cost: String((item.unit_cost ?? 0) / 100),
      unit_sale: String((item.unit_sale ?? 0) / 100),
    });
  }, [item.id, item.description, item.unit, item.quantity, item.unit_cost, item.unit_sale]);

  const save = async (overrides: Partial<typeof draft> = {}) => {
    const d = { ...draft, ...overrides };
    const patch = {
      description: d.description,
      unit: d.unit,
      quantity: Number(d.quantity) || 0,
      unit_cost: Math.round((Number(d.unit_cost) || 0) * 100),
      unit_sale: Math.round((Number(d.unit_sale) || 0) * 100),
    };
    const { error } = await supabase.from('pressupost_annex_items' as any).update(patch).eq('id', item.id);
    if (error) toast.error('Error: ' + error.message);
    else onChange();
  };

  const totalCost = (Number(draft.quantity) || 0) * (Number(draft.unit_cost) || 0);
  const totalSale = (Number(draft.quantity) || 0) * (Number(draft.unit_sale) || 0);
  const inputCls = 'w-full px-1.5 py-1 rounded border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-60';

  return (
    <tr className="hover:bg-muted/20">
      <td className="px-2 py-2 min-w-[200px]">
        <input className={inputCls} value={draft.description} disabled={readOnly}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          onBlur={() => draft.description !== item.description && save()} />
      </td>
      <td className="px-2 py-2 w-16">
        <input className={inputCls} value={draft.unit} disabled={readOnly}
          onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
          onBlur={() => draft.unit !== item.unit && save()} />
      </td>
      <td className="px-2 py-2 w-20">
        <input type="number" step="0.01" className={inputCls} value={draft.quantity} disabled={readOnly}
          onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
          onBlur={() => Number(draft.quantity) !== Number(item.quantity) && save()} />
      </td>
      <td className="px-2 py-2 w-24">
        <input type="number" step="0.01" className={inputCls} value={draft.unit_cost} disabled={readOnly}
          onChange={(e) => setDraft({ ...draft, unit_cost: e.target.value })}
          onBlur={() => Math.round(Number(draft.unit_cost) * 100) !== item.unit_cost && save()} />
      </td>
      <td className="px-2 py-2 w-24">
        <input type="number" step="0.01" className={inputCls} value={draft.unit_sale} disabled={readOnly}
          onChange={(e) => setDraft({ ...draft, unit_sale: e.target.value })}
          onBlur={() => Math.round(Number(draft.unit_sale) * 100) !== item.unit_sale && save()} />
      </td>
      <td className="px-2 py-2 text-xs">{fmtCents(Math.round(totalCost * 100))}</td>
      <td className="px-2 py-2 text-xs font-medium">{fmtCents(Math.round(totalSale * 100))}</td>
      <td className="px-2 py-2 text-right">
        {!readOnly && (
          <button className="p-1 rounded hover:bg-destructive/10" onClick={onDelete} title="Eliminar">
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </button>
        )}
      </td>
    </tr>
  );
}