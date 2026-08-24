import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, ChevronDown, ChevronRight, Plus, Loader2, FileSpreadsheet, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as XLSX from 'xlsx-js-style';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  fmtCents, fmtPct, marginColorClass,
  obraStatusBadge, phaseStatusBadge, logObraActivity,
  type Obra, type ObraPhase, type ObraCostItem, type ObraStatus, type ObraPhaseStatus, type ObraActivity,
} from '@/lib/obrasHelpers';

export default function ObraDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile, user } = useAuth();

  const { data: obra, isLoading: loadingObra } = useQuery({
    queryKey: ['obra', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('obras' as any).select('*').eq('id', id).single();
      if (error) throw error;
      return data as unknown as Obra;
    },
    enabled: !!id,
  });

  const { data: phases = [] } = useQuery({
    queryKey: ['obra-phases', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('obra_phases' as any).select('*').eq('obra_id', id).order('order_index');
      if (error) throw error;
      return (data || []) as unknown as ObraPhase[];
    },
    enabled: !!id,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['obra-items', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('obra_cost_items' as any).select('*').eq('obra_id', id)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ObraCostItem[];
    },
    enabled: !!id,
  });

  const { data: activity = [] } = useQuery({
    queryKey: ['obra-activity', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('obra_activity' as any).select('*').eq('obra_id', id).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ObraActivity[];
    },
    enabled: !!id,
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['obra', id] });
    qc.invalidateQueries({ queryKey: ['obra-phases', id] });
    qc.invalidateQueries({ queryKey: ['obra-items', id] });
    qc.invalidateQueries({ queryKey: ['obra-activity', id] });
  };

  // Realtime updates
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`obra-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'obras', filter: `id=eq.${id}` }, () => refreshAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'obra_phases', filter: `obra_id=eq.${id}` }, () => refreshAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'obra_cost_items', filter: `obra_id=eq.${id}` }, () => refreshAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'obra_activity', filter: `obra_id=eq.${id}` }, () => refreshAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const statusMutation = useMutation({
    mutationFn: async (status: ObraStatus) => {
      const { error } = await supabase.from('obras' as any).update({ status }).eq('id', id!);
      if (error) throw error;
      await logObraActivity(id!, 'status_change', `Canvi d'estat a: ${obraStatusBadge[status].label}`, user?.id, profile?.full_name);
    },
    onSuccess: () => { toast.success('Estat actualitzat'); refreshAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (loadingObra) {
    return <div className="p-8 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!obra) {
    return <div className="p-8 text-center text-muted-foreground">Obra no trobada</div>;
  }

  const sb = obraStatusBadge[obra.status];
  const totalReal = obra.total_cost_real || 0;
  const totalEst = obra.total_cost_estimated || 0;
  const progressPct = totalEst > 0 ? Math.min(200, (totalReal / totalEst) * 100) : 0;
  const progressColor = progressPct < 90 ? 'bg-success' : progressPct <= 100 ? 'bg-warning' : 'bg-destructive';
  const marginRealEur = (obra.total_sale_estimated || 0) - totalReal;
  const desviacioTotal = totalEst - totalReal;

  const exportExcel = () => {
    const EUR_FMT = '#,##0.00" €"';
    const PCT_FMT = '0.0"%"';
    const thin = { style: 'thin', color: { rgb: 'D0D5DD' } } as const;
    const allBorders = { top: thin, bottom: thin, left: thin, right: thin };
    const headerStyle = {
      font: { bold: true, color: { rgb: '1F3864' }, sz: 11 },
      fill: { fgColor: { rgb: 'D9E2F3' } },
      alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
      border: allBorders,
    };
    const labelStyle = { font: { bold: true }, border: allBorders, alignment: { vertical: 'center' as const } };
    const cellStyle = { border: allBorders, alignment: { vertical: 'center' as const } };
    const rightCellStyle = { ...cellStyle, alignment: { ...cellStyle.alignment, horizontal: 'right' as const } };
    const moneyStyle = { ...rightCellStyle, numFmt: EUR_FMT };
    const pctStyle = { ...rightCellStyle, numFmt: PCT_FMT };
    // Desviació: positiva (real <= estimat) = favorable -> verd; negativa = desfavorable -> vermell.
    const devStyle = (favorable: boolean) => ({
      ...rightCellStyle,
      font: { bold: true, color: { rgb: favorable ? '1B5E20' : 'B71C1C' } },
      fill: { fgColor: { rgb: favorable ? 'E6F4EA' : 'FDEAEA' } },
      numFmt: EUR_FMT,
    });

    const wb = XLSX.utils.book_new();

    // --- Resum ---
    const summary: any[][] = [
      ['Obra', obra.budget_number],
      ['Client', obra.client_name],
      ['Municipi', obra.client_town],
      ['Estat', sb.label],
      [],
      ['Venda pressupostada (€)', (obra.total_sale_estimated || 0) / 100],
      ['Cost estimat (€)', totalEst / 100],
      ['Cost real (€)', totalReal / 100],
      ['Marge estimat (%)', obra.margin_estimated_pct],
      ['Marge real (%)', obra.margin_real_pct],
      ['Marge real (€)', marginRealEur / 100],
      ['Desviació (€)', desviacioTotal / 100],
    ];
    const moneyRows = new Set([5, 6, 7, 10]);
    const pctRows = new Set([8, 9]);
    const devRows = new Set([11]);
    const ws1 = XLSX.utils.aoa_to_sheet(summary);
    summary.forEach((row, r) => {
      if (row.length === 0) return;
      const labelRef = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws1[labelRef]) ws1[labelRef].s = labelStyle;
      const valueRef = XLSX.utils.encode_cell({ r, c: 1 });
      const cell = ws1[valueRef];
      if (!cell) return;
      if (devRows.has(r)) cell.s = devStyle(desviacioTotal >= 0);
      else if (moneyRows.has(r)) cell.s = moneyStyle;
      else if (pctRows.has(r)) cell.s = pctStyle;
      else cell.s = cellStyle;
    });
    ws1['!cols'] = [{ wch: 26 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Resum');

    // --- Detall per fase ---
    const headers = ['Fase', 'Partida', 'Qty est.', '€/u est.', 'Total est.', 'Qty real', '€/u real', 'Total real', 'Desviació', 'Notes', 'Extra'];
    const detail: any[][] = [headers];
    const devFavorable: boolean[] = [];
    phases.forEach((ph) => {
      items.filter((it) => it.phase_id === ph.id).forEach((it) => {
        const dev = (it.estimated_total_cost ?? 0) - (it.real_total_cost ?? 0);
        devFavorable.push(dev >= 0);
        detail.push([
          ph.phase_name, it.description,
          it.estimated_qty ?? '', (it.estimated_unit_cost ?? 0) / 100, (it.estimated_total_cost ?? 0) / 100,
          it.real_qty ?? '', it.real_unit_cost != null ? it.real_unit_cost / 100 : '', it.real_total_cost != null ? it.real_total_cost / 100 : '',
          dev / 100, it.notes ?? '', it.is_extra ? 'Sí' : '',
        ]);
      });
    });
    const ws2 = XLSX.utils.aoa_to_sheet(detail);
    const moneyCols = new Set([3, 4, 6, 7]);
    const numCols = new Set([2, 5]);
    headers.forEach((_, c) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c });
      if (ws2[ref]) ws2[ref].s = headerStyle;
    });
    for (let r = 1; r < detail.length; r++) {
      for (let c = 0; c < headers.length; c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        const cell = ws2[ref];
        if (!cell) continue;
        if (c === 8) cell.s = devStyle(devFavorable[r - 1]);
        else if (moneyCols.has(c)) cell.s = moneyStyle;
        else if (numCols.has(c)) cell.s = rightCellStyle;
        else cell.s = cellStyle;
      }
    }
    ws2['!cols'] = [
      { wch: 18 }, { wch: 32 }, { wch: 9 }, { wch: 11 }, { wch: 12 },
      { wch: 9 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 26 }, { wch: 7 },
    ];
    // Nota: la cabecera queda destacada visualmente (negrita + fondo), pero
    // esta build de xlsx-js-style (sin JSZip/Pro) no escribe el XML de
    // sheetView/pane, así que no se puede "congelar" la fila 1 de verdad.
    ws2['!freeze'] = { xSplit: 0, ySplit: 1 };

    const datestr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Rentabilitat_${obra.budget_number}_${datestr}.xlsx`);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      <button onClick={() => navigate('/control-obres')} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" /> Tornar a Control d'Obres
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            <span className="font-mono text-primary">{obra.budget_number}</span> · {obra.client_name}
          </h1>
          <p className="text-muted-foreground text-sm">{obra.client_town}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center px-3 py-1 rounded-full text-sm font-medium', sb.className)}>{sb.label}</span>
          <select
            value={obra.status}
            onChange={(e) => statusMutation.mutate(e.target.value as ObraStatus)}
            disabled={statusMutation.isPending}
            className="px-3 py-1.5 rounded-lg border border-border bg-card text-sm"
          >
            <option value="activa">Activa</option>
            <option value="pausada">Pausada</option>
            <option value="finalitzada">Finalitzada</option>
          </select>
          <button onClick={exportExcel} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-muted/40 border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Venda pressupostada</p>
          <p className="text-2xl font-bold text-foreground mt-1">{fmtCents(obra.total_sale_estimated)}</p>
        </div>
        <div className="bg-info/5 border border-info/20 rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Cost estimat</p>
          <p className="text-2xl font-bold text-foreground mt-1">{fmtCents(totalEst)}</p>
          <p className={cn('text-xs mt-1 font-semibold', marginColorClass(obra.margin_estimated_pct))}>Marge est: {fmtPct(obra.margin_estimated_pct)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Cost real imputat</p>
          <p className="text-2xl font-bold text-foreground mt-1">{fmtCents(totalReal)}</p>
          <div className="w-full bg-muted rounded-full h-2 mt-2 overflow-hidden">
            <div className={cn('h-full transition-all', progressColor)} style={{ width: `${Math.min(100, progressPct)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{progressPct.toFixed(0)}% del cost estimat</p>
        </div>
        <div className={cn('border rounded-xl p-4', obra.margin_real_pct >= 20 ? 'bg-success/5 border-success/20' : 'bg-destructive/5 border-destructive/20')}>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Marge real</p>
          <p className={cn('text-2xl font-bold mt-1', marginColorClass(obra.margin_real_pct))}>{fmtPct(obra.margin_real_pct)}</p>
          <p className="text-xs text-foreground mt-1">{fmtCents(marginRealEur)}</p>
          <p className={cn('text-xs mt-1', desviacioTotal >= 0 ? 'text-success' : 'text-destructive')}>
            Desviació: {desviacioTotal >= 0 ? '+' : ''}{fmtCents(desviacioTotal)}
          </p>
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-4">
        {phases.map((ph) => (
          <PhaseSection
            key={ph.id}
            obraId={obra.id}
            phase={ph}
            items={items.filter((it) => it.phase_id === ph.id)}
            onChange={refreshAll}
            currentUser={{ id: user?.id, name: profile?.full_name }}
          />
        ))}
        {phases.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Aquesta obra no té fases.</p>
        )}
      </div>

      {/* Activity */}
      <ActivitySection obraId={obra.id} activity={activity} currentUser={{ id: user?.id, name: profile?.full_name }} onChange={refreshAll} />
    </div>
  );
}

function PhaseSection({ obraId, phase, items, onChange, currentUser }: {
  obraId: string;
  phase: ObraPhase;
  items: ObraCostItem[];
  onChange: () => void;
  currentUser: { id?: string; name?: string };
}) {
  const [open, setOpen] = useState(true);
  const [showExtra, setShowExtra] = useState(false);

  const totalEst = items.reduce((s, it) => s + (it.estimated_total_cost ?? 0), 0);
  const totalReal = items.reduce((s, it) => s + (it.real_total_cost ?? 0), 0);
  const dev = totalEst - totalReal;
  const sb = phaseStatusBadge[phase.status];

  const updatePhaseStatus = async (status: ObraPhaseStatus) => {
    await supabase.from('obra_phases' as any).update({ status }).eq('id', phase.id);
    onChange();
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
          <h3 className="font-semibold text-foreground">{phase.phase_name}</h3>
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', sb.className)}>{sb.label}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Estimat: <strong className="text-foreground">{fmtCents(totalEst)}</strong></span>
          <span>Real: <strong className="text-foreground">{fmtCents(totalReal)}</strong></span>
          <span className={cn('font-semibold', dev >= 0 ? 'text-success' : 'text-destructive')}>
            Desviació: {dev >= 0 ? '+' : ''}{fmtCents(dev)}
          </span>
        </div>
      </button>
      {open && (
        <div className="border-t border-border">
          <div className="px-4 py-2 flex items-center gap-2 border-b border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">Estat fase:</span>
            <select
              value={phase.status}
              onChange={(e) => updatePhaseStatus(e.target.value as ObraPhaseStatus)}
              className="px-2 py-1 rounded border border-border bg-card text-xs"
            >
              <option value="pendent">Pendent</option>
              <option value="en_curs">En curs</option>
              <option value="completada">Completada</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  {['PARTIDA','QTY EST.','C.U. EST.','TOTAL EST.','QTY REAL','C.U. REAL','TOTAL REAL','DESVIACIÓ','NOTES',''].map((h) => (
                    <th key={h} className="text-left px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((it) => (
                  <CostItemRow key={it.id} item={it} onChange={onChange} />
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={10} className="text-center text-muted-foreground py-4 text-xs">Cap partida en aquesta fase.</td></tr>
                )}
              </tbody>
              <tfoot className="bg-muted/30 border-t border-border">
                <tr className="font-semibold">
                  <td className="px-2 py-2">TOTALS</td>
                  <td colSpan={2}></td>
                  <td className="px-2 py-2 text-right">{fmtCents(totalEst)}</td>
                  <td colSpan={2}></td>
                  <td className="px-2 py-2 text-right">{fmtCents(totalReal)}</td>
                  <td className={cn('px-2 py-2 text-right', dev >= 0 ? 'text-success' : 'text-destructive')}>
                    {dev >= 0 ? '+' : ''}{fmtCents(dev)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-border">
            <button onClick={() => setShowExtra(true)} className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
              <Plus className="w-4 h-4" /> Afegir cost no previst
            </button>
          </div>
        </div>
      )}

      {showExtra && (
        <ExtraCostModal
          obraId={obraId}
          phaseId={phase.id}
          nextSortOrder={items.reduce((max, it) => Math.max(max, it.sort_order ?? -1), -1) + 1}
          onClose={() => setShowExtra(false)}
          onCreated={() => { setShowExtra(false); onChange(); }}
          createdBy={currentUser.id}
        />
      )}
    </div>
  );
}

function CostItemRow({ item, onChange }: { item: ObraCostItem; onChange: () => void }) {
  const [draft, setDraft] = useState({
    real_qty: item.real_qty?.toString() ?? '',
    real_unit_cost: item.real_unit_cost != null ? (item.real_unit_cost / 100).toString() : '',
    notes: item.notes ?? '',
  });
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setDraft({
      real_qty: item.real_qty?.toString() ?? '',
      real_unit_cost: item.real_unit_cost != null ? (item.real_unit_cost / 100).toString() : '',
      notes: item.notes ?? '',
    });
  }, [item.id, item.real_qty, item.real_unit_cost, item.notes]);

  const save = async (overrides: Partial<typeof draft> = {}) => {
    const d = { ...draft, ...overrides };
    const qty = d.real_qty === '' ? null : Number(d.real_qty);
    const unit = d.real_unit_cost === '' ? null : Math.round(Number(d.real_unit_cost) * 100);
    const total = (qty != null && unit != null) ? qty * unit : null;
    const { error } = await supabase.from('obra_cost_items' as any).update({
      real_qty: qty,
      real_unit_cost: unit,
      real_total_cost: total,
      notes: d.notes || null,
    }).eq('id', item.id);
    if (error) {
      toast.error('Error en desar: ' + error.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onChange();
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('obra_cost_items' as any).delete().eq('id', item.id);
    setDeleting(false);
    setConfirmOpen(false);
    if (error) return toast.error('Error eliminant: ' + error.message);
    toast.success('Cost eliminat');
    onChange();
  };

  const dev = (item.estimated_total_cost ?? 0) - (item.real_total_cost ?? 0);
  const inputCls = 'w-full px-1.5 py-1 rounded border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/40';

  return (
    <tr className={cn('hover:bg-muted/20', item.is_extra && 'bg-warning/5')}>
      <td className="px-2 py-1.5 max-w-[280px]">
        <div className="flex items-center gap-1.5">
          {item.is_extra && <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-bold">EXTRA</span>}
          <span className="text-xs">{item.description}</span>
        </div>
      </td>
      <td className="px-2 py-1.5 text-right text-xs text-muted-foreground">{item.estimated_qty ?? '—'}</td>
      <td className="px-2 py-1.5 text-right text-xs text-muted-foreground">{item.estimated_unit_cost != null ? fmtCents(item.estimated_unit_cost) : '—'}</td>
      <td className="px-2 py-1.5 text-right text-xs">{item.estimated_total_cost != null ? fmtCents(item.estimated_total_cost) : '—'}</td>
      <td className="px-2 py-1.5 w-20">
        <input
          type="number" step="0.01" value={draft.real_qty}
          onChange={(e) => setDraft({ ...draft, real_qty: e.target.value })}
          onBlur={() => save()}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className={inputCls} placeholder="—"
        />
      </td>
      <td className="px-2 py-1.5 w-24">
        <input
          type="number" step="0.01" value={draft.real_unit_cost}
          onChange={(e) => setDraft({ ...draft, real_unit_cost: e.target.value })}
          onBlur={() => save()}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className={inputCls} placeholder="€/u"
        />
      </td>
      <td className="px-2 py-1.5 text-right text-xs font-semibold">
        {item.real_total_cost != null ? fmtCents(item.real_total_cost) : <span className="text-muted-foreground italic">Pendent</span>}
        {saved && <span className="ml-1 text-success">✓</span>}
      </td>
      <td className={cn('px-2 py-1.5 text-right text-xs font-semibold', item.is_extra ? 'text-muted-foreground' : (dev >= 0 ? 'text-success' : 'text-destructive'))}>
        {item.is_extra ? '—' : (item.real_total_cost == null ? '—' : `${dev >= 0 ? '+' : ''}${fmtCents(dev)}`)}
      </td>
      <td className="px-2 py-1.5 w-32">
        <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} onBlur={() => save()} className={inputCls} placeholder="—" />
      </td>
      <td className="px-2 py-1.5 w-10 text-center">
        {item.is_extra && (
          <>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={deleting}
              className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
              title="Eliminar cost no previst"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar cost no previst?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Aquesta acció eliminarà definitivament la partida «{item.description}». No es pot desfer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel·lar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); handleDelete(); }}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? 'Eliminant...' : 'Eliminar'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </td>
    </tr>
  );
}

function ExtraCostModal({ obraId, phaseId, nextSortOrder, onClose, onCreated, createdBy }: {
  obraId: string; phaseId: string; nextSortOrder: number; onClose: () => void; onCreated: () => void; createdBy?: string;
}) {
  const [form, setForm] = useState({
    description: '', real_qty: '1', real_unit_cost: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.description.trim()) return toast.error('Descripció obligatòria');
    setSaving(true);
    const qty = Number(form.real_qty || 1);
    const unit = form.real_unit_cost ? Math.round(Number(form.real_unit_cost) * 100) : 0;
    const { error } = await supabase.from('obra_cost_items' as any).insert({
      obra_id: obraId, phase_id: phaseId,
      description: form.description,
      real_qty: qty, real_unit_cost: unit, real_total_cost: qty * unit,
      notes: form.notes || null, is_extra: true, created_by: createdBy,
      sort_order: nextSortOrder,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Cost extra afegit');
    onCreated();
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
  const labelCls = 'text-xs font-medium text-muted-foreground mb-1 block';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-elevated w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Afegir cost no previst</h3>
        <div className="space-y-3">
          <div><label className={labelCls}>Descripció *</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Quantitat</label><input type="number" step="0.01" value={form.real_qty} onChange={(e) => setForm({ ...form, real_qty: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Preu unitari (€)</label><input type="number" step="0.01" value={form.real_unit_cost} onChange={(e) => setForm({ ...form, real_unit_cost: e.target.value })} className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancel·lar</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 inline-flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Afegir cost
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivitySection({ obraId, activity, currentUser, onChange }: {
  obraId: string; activity: ObraActivity[]; currentUser: { id?: string; name?: string }; onChange: () => void;
}) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const addNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    await logObraActivity(obraId, 'note', note.trim(), currentUser.id, currentUser.name);
    setSaving(false);
    setNote('');
    onChange();
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-card p-4 space-y-4">
      <h3 className="font-semibold text-foreground">Activitat i comentaris</h3>
      <div className="flex gap-2">
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Afegir nota o comentari..."
          rows={2}
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button onClick={addNote} disabled={saving || !note.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 self-start">
          Desar nota
        </button>
      </div>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {activity.map((a) => (
          <div key={a.id} className="flex gap-3 text-sm">
            <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
              {(a.user_name || 'S').slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">{a.user_name || 'Sistema'}</strong> · {new Date(a.created_at).toLocaleString('ca-ES')}
              </p>
              <p className={cn('mt-0.5', a.kind === 'system' || a.kind === 'status_change' ? 'italic text-muted-foreground' : 'text-foreground')}>
                {a.message}
              </p>
            </div>
          </div>
        ))}
        {activity.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Cap activitat encara.</p>}
      </div>
    </div>
  );
}