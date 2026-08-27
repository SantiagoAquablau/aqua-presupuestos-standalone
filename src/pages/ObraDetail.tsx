import { Fragment, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, ChevronDown, ChevronRight, Plus, Loader2, FileSpreadsheet, Trash2, Search, ShoppingCart, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as XLSX from 'xlsx-js-style';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  fmtCents, fmtCentsPrecise, fmtPct, marginColorClass,
  obraStatusBadge, phaseStatusBadge, logObraActivity,
  type Obra, type ObraPhase, type ObraCostItem, type ObraCostItemPurchase, type ObraStatus, type ObraPhaseStatus, type ObraActivity,
} from '@/lib/obrasHelpers';

interface SupplierOption { id: string; name: string; }

export default function ObraDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile, user } = useAuth();
  const [search, setSearch] = useState('');

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

  const { data: purchases = [] } = useQuery({
    queryKey: ['obra-purchases', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('obra_cost_item_purchases' as any).select('*').eq('obra_id', id)
        .order('purchased_at', { ascending: true }).order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ObraCostItemPurchase[];
    },
    enabled: !!id,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('id, name').order('name');
      if (error) throw error;
      return (data || []) as SupplierOption[];
    },
  });

  const purchasesByItem = new Map<string, ObraCostItemPurchase[]>();
  for (const p of purchases) {
    const arr = purchasesByItem.get(p.item_id) ?? [];
    arr.push(p);
    purchasesByItem.set(p.item_id, arr);
  }

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['obra', id] });
    qc.invalidateQueries({ queryKey: ['obra-phases', id] });
    qc.invalidateQueries({ queryKey: ['obra-items', id] });
    qc.invalidateQueries({ queryKey: ['obra-activity', id] });
    qc.invalidateQueries({ queryKey: ['obra-purchases', id] });
  };

  // Realtime updates
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`obra-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'obras', filter: `id=eq.${id}` }, () => refreshAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'obra_phases', filter: `obra_id=eq.${id}` }, () => refreshAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'obra_cost_items', filter: `obra_id=eq.${id}` }, () => refreshAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'obra_cost_item_purchases', filter: `obra_id=eq.${id}` }, () => refreshAll())
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Cercar partida per descripció..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/20" />
      </div>

      {/* Phases */}
      <div className="space-y-4">
        {phases.map((ph) => {
          const phaseItems = items.filter((it) => it.phase_id === ph.id);
          const searchTerm = search.trim().toLowerCase();
          const visibleItems = searchTerm
            ? phaseItems.filter((it) => (it.description || '').toLowerCase().includes(searchTerm))
            : phaseItems;
          return (
            <PhaseSection
              key={ph.id}
              obraId={obra.id}
              phase={ph}
              items={phaseItems}
              visibleItems={visibleItems}
              forceOpen={searchTerm.length > 0 && visibleItems.length > 0}
              onChange={refreshAll}
              currentUser={{ id: user?.id, name: profile?.full_name }}
              purchasesByItem={purchasesByItem}
              suppliers={suppliers}
            />
          );
        })}
        {phases.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Aquesta obra no té fases.</p>
        )}
      </div>

      {/* Activity */}
      <ActivitySection obraId={obra.id} activity={activity} currentUser={{ id: user?.id, name: profile?.full_name }} onChange={refreshAll} />
    </div>
  );
}

const ALTRES_PARTIDES_LABEL = 'Altres partides';

// Same substring criterion already established elsewhere in the codebase
// (wizardLines.ts, StepPartides.tsx, budgetSave.ts, formulaPhases.ts) to
// tell a mà d'obra line from a materials line — there's no dedicated
// item_type/category field, only the description text.
function isManoObra(description: string): boolean {
  return (description || '').toLowerCase().includes('mano de obra');
}

/**
 * Mà d'obra lines first, materials after. Array.prototype.sort is stable
 * (guaranteed since ES2019), so items already ordered by sort_order/
 * created_at (the query in ObraDetail.tsx) keep that relative order within
 * each of the two buckets -- this doesn't disturb the sort_order tie-break
 * fixed earlier, it just adds a coarser grouping on top of it.
 */
function sortManoObraFirst(items: ObraCostItem[]): ObraCostItem[] {
  return [...items].sort((a, b) => Number(isManoObra(b.description)) - Number(isManoObra(a.description)));
}

/**
 * Group items by sub_phase, preserving first-seen order among the named
 * groups. Items with no sub_phase (old obres created before this field
 * existed) are collected under a generic "Altres partides" group, always
 * placed last regardless of where they first appear. Within each group,
 * mà d'obra lines are sorted first (see sortManoObraFirst).
 */
function groupBySubPhase(items: ObraCostItem[]): { label: string | null; items: ObraCostItem[] }[] {
  const order: string[] = [];
  const groups = new Map<string, ObraCostItem[]>();
  let ungrouped: ObraCostItem[] = [];
  for (const it of items) {
    const sp = (it.sub_phase || '').trim();
    if (!sp) { ungrouped.push(it); continue; }
    if (!groups.has(sp)) { groups.set(sp, []); order.push(sp); }
    groups.get(sp)!.push(it);
  }
  const result = order.map((label) => ({ label, items: sortManoObraFirst(groups.get(label)!) }));
  if (ungrouped.length > 0) result.push({ label: null, items: sortManoObraFirst(ungrouped) });
  return result;
}

function PhaseSection({ obraId, phase, items, visibleItems, forceOpen, onChange, currentUser, purchasesByItem, suppliers }: {
  obraId: string;
  phase: ObraPhase;
  items: ObraCostItem[];
  visibleItems?: ObraCostItem[];
  forceOpen?: boolean;
  onChange: () => void;
  currentUser: { id?: string; name?: string };
  purchasesByItem: Map<string, ObraCostItemPurchase[]>;
  suppliers: SupplierOption[];
}) {
  const [open, setOpen] = useState(true);
  const [showExtra, setShowExtra] = useState(false);
  const displayItems = visibleItems ?? items;
  const isOpen = open || !!forceOpen;
  const subPhaseGroups = groupBySubPhase(displayItems);
  // Only show subgroup headers when there's more than one group -- for old
  // obres where every item lacks sub_phase (a single "Altres partides"
  // group), render the flat table as before to avoid visual noise.
  const showSubPhaseHeaders = subPhaseGroups.length > 1;

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
          {isOpen ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
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
      {isOpen && (
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
                {showSubPhaseHeaders
                  ? subPhaseGroups.map((group) => (
                      <Fragment key={`sp-${group.label ?? ALTRES_PARTIDES_LABEL}`}>
                        <tr className="bg-muted/30">
                          <td colSpan={10} className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
                            {group.label ?? ALTRES_PARTIDES_LABEL}
                          </td>
                        </tr>
                        {group.items.map((it) => (
                          <CostItemRow key={it.id} item={it} onChange={onChange}
                            purchases={purchasesByItem.get(it.id) ?? []} suppliers={suppliers} currentUser={currentUser} />
                        ))}
                      </Fragment>
                    ))
                  : subPhaseGroups.flatMap((group) => group.items).map((it) => (
                      <CostItemRow key={it.id} item={it} onChange={onChange}
                        purchases={purchasesByItem.get(it.id) ?? []} suppliers={suppliers} currentUser={currentUser} />
                    ))}
                {displayItems.length === 0 && (
                  <tr><td colSpan={10} className="text-center text-muted-foreground py-4 text-xs">
                    {items.length === 0 ? 'Cap partida en aquesta fase.' : 'Cap partida coincideix amb la cerca.'}
                  </td></tr>
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

function CostItemRow({ item, onChange, purchases, suppliers, currentUser }: {
  item: ObraCostItem;
  onChange: () => void;
  purchases: ObraCostItemPurchase[];
  suppliers: SupplierOption[];
  currentUser: { id?: string; name?: string };
}) {
  const hasPurchases = purchases.length > 0;
  const [draft, setDraft] = useState({
    real_qty: item.real_qty?.toString() ?? '',
    real_unit_cost: item.real_unit_cost != null ? (item.real_unit_cost / 100).toString() : '',
    notes: item.notes ?? '',
  });
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    setDraft({
      real_qty: item.real_qty?.toString() ?? '',
      real_unit_cost: item.real_unit_cost != null ? (item.real_unit_cost / 100).toString() : '',
      notes: item.notes ?? '',
    });
  }, [item.id, item.real_qty, item.real_unit_cost, item.notes]);

  // Direct inline edit of real_qty / real_unit_cost. Only reachable when the
  // item has no purchase history; once history exists the DB trigger owns
  // those fields and the cells become read-only.
  const save = async (overrides: Partial<typeof draft> = {}) => {
    const d = { ...draft, ...overrides };
    const qty = d.real_qty === '' ? null : Number(d.real_qty);
    const unit = d.real_unit_cost === '' ? null : Math.round(Number(d.real_unit_cost) * 100);
    const total = (qty != null && unit != null) ? qty * unit : null;
    const patch: Record<string, unknown> = { notes: d.notes || null };
    if (!hasPurchases) {
      patch.real_qty = qty;
      patch.real_unit_cost = unit;
      patch.real_total_cost = total;
    }
    const { error } = await supabase.from('obra_cost_items' as any).update(patch).eq('id', item.id);
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
  const readonlyCls = 'w-full px-1.5 py-1 text-xs text-right text-muted-foreground cursor-pointer hover:text-foreground';

  return (
    <tr className={cn('hover:bg-muted/20', item.is_extra && 'bg-warning/5')}>
      <td className="px-2 py-1.5 max-w-[280px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.is_extra && <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-bold">EXTRA</span>}
          <span className="text-xs">{item.description}</span>
          {hasPurchases ? (
            <button
              onClick={() => setHistoryOpen(true)}
              className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold hover:bg-primary/20"
              title="Veure historial de compres"
            >
              <ShoppingCart className="w-3 h-3" /> {purchases.length} {purchases.length === 1 ? 'compra' : 'compres'}
            </button>
          ) : (
            <button
              onClick={() => setHistoryOpen(true)}
              className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border border-border text-muted-foreground font-medium hover:bg-muted"
              title="Registrar compres per proveïdor"
            >
              <ShoppingCart className="w-3 h-3" /> Compres
            </button>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5 text-right text-xs text-muted-foreground">{item.estimated_qty ?? '—'}</td>
      <td className="px-2 py-1.5 text-right text-xs text-muted-foreground">{item.estimated_unit_cost != null ? fmtCentsPrecise(item.estimated_unit_cost) : '—'}</td>
      <td className="px-2 py-1.5 text-right text-xs">{item.estimated_total_cost != null ? fmtCentsPrecise(item.estimated_total_cost) : '—'}</td>
      <td className="px-2 py-1.5 w-20">
        {hasPurchases ? (
          <div className={readonlyCls} onClick={() => setHistoryOpen(true)} title="Suma de les compres">
            {item.real_qty ?? '—'}
          </div>
        ) : (
          <input
            type="number" step="0.01" value={draft.real_qty}
            onChange={(e) => setDraft({ ...draft, real_qty: e.target.value })}
            onBlur={() => save()}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className={inputCls} placeholder="—"
          />
        )}
      </td>
      <td className="px-2 py-1.5 w-24">
        {hasPurchases ? (
          <div className={readonlyCls} onClick={() => setHistoryOpen(true)} title="Mitjana ponderada de les compres">
            {item.real_unit_cost != null ? fmtCentsPrecise(item.real_unit_cost) : '—'}
          </div>
        ) : (
          <input
            type="number" step="0.01" value={draft.real_unit_cost}
            onChange={(e) => setDraft({ ...draft, real_unit_cost: e.target.value })}
            onBlur={() => save()}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className={inputCls} placeholder="€/u"
          />
        )}
      </td>
      <td className="px-2 py-1.5 text-right text-xs font-semibold">
        {item.real_total_cost != null ? fmtCentsPrecise(item.real_total_cost) : <span className="text-muted-foreground italic">Pendent</span>}
        {saved && <span className="ml-1 text-success">✓</span>}
      </td>
      <td className={cn('px-2 py-1.5 text-right text-xs font-semibold', item.is_extra ? 'text-muted-foreground' : (dev >= 0 ? 'text-success' : 'text-destructive'))}>
        {item.is_extra ? '—' : (item.real_total_cost == null ? '—' : `${dev >= 0 ? '+' : ''}${fmtCentsPrecise(dev)}`)}
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

      {historyOpen && (
        <td className="p-0">
          <PurchaseHistoryModal
            item={item}
            purchases={purchases}
            suppliers={suppliers}
            currentUser={currentUser}
            onClose={() => setHistoryOpen(false)}
            onChange={onChange}
          />
        </td>
      )}
    </tr>
  );
}

function PurchaseHistoryModal({ item, purchases, suppliers, currentUser, onClose, onChange }: {
  item: ObraCostItem;
  purchases: ObraCostItemPurchase[];
  suppliers: SupplierOption[];
  currentUser: { id?: string; name?: string };
  onClose: () => void;
  onChange: () => void;
}) {
  const emptyForm = {
    qty: '', unit_cost: '', supplier: '', invoice_ref: '',
    purchased_at: new Date().toISOString().slice(0, 10), note: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  const listId = `suppliers-dl-${item.id}`;

  // Resolve the free-text / picked supplier value into { supplier_id, supplier_label }.
  const resolveSupplier = (value: string) => {
    const v = value.trim();
    if (!v) return { supplier_id: null as string | null, supplier_label: null as string | null };
    const match = suppliers.find((s) => s.name.toLowerCase() === v.toLowerCase());
    return { supplier_id: match?.id ?? null, supplier_label: match?.name ?? v };
  };

  const supplierValue = (p: ObraCostItemPurchase) =>
    p.supplier_label ?? suppliers.find((s) => s.id === p.supplier_id)?.name ?? '';

  const parsed = (f: typeof emptyForm) => {
    const qty = Number(f.qty);
    const unit = Math.round(Number(f.unit_cost) * 100);
    return { qty, unit, valid: f.qty !== '' && f.unit_cost !== '' && qty > 0 && Number.isFinite(unit) };
  };

  const totalQty = purchases.reduce((s, p) => s + p.qty, 0);
  const totalSpend = purchases.reduce((s, p) => s + p.qty * p.unit_cost, 0);
  const avgUnit = totalQty !== 0 ? totalSpend / totalQty : 0;
  const estTotal = item.estimated_total_cost ?? 0;
  const dev = estTotal - totalSpend;

  const addEntry = async () => {
    const p = parsed(form);
    if (!p.valid) return toast.error('Quantitat i cost unitari són obligatoris');
    setSaving(true);
    const { supplier_id, supplier_label } = resolveSupplier(form.supplier);
    const { error } = await supabase.from('obra_cost_item_purchases' as any).insert({
      item_id: item.id, obra_id: item.obra_id,
      qty: p.qty, unit_cost: p.unit,
      supplier_id, supplier_label,
      invoice_ref: form.invoice_ref.trim() || null,
      purchased_at: form.purchased_at,
      note: form.note.trim() || null,
      created_by: currentUser.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error('Error afegint la compra: ' + error.message);
    setForm({ ...emptyForm, purchased_at: form.purchased_at });
    onChange();
  };

  const startEdit = (p: ObraCostItemPurchase) => {
    setEditId(p.id);
    setEditForm({
      qty: String(p.qty),
      unit_cost: String(p.unit_cost / 100),
      supplier: supplierValue(p),
      invoice_ref: p.invoice_ref ?? '',
      purchased_at: p.purchased_at,
      note: p.note ?? '',
    });
  };

  const saveEdit = async () => {
    if (!editId) return;
    const p = parsed(editForm);
    if (!p.valid) return toast.error('Quantitat i cost unitari són obligatoris');
    setBusyRow(editId);
    const { supplier_id, supplier_label } = resolveSupplier(editForm.supplier);
    const { error } = await supabase.from('obra_cost_item_purchases' as any).update({
      qty: p.qty, unit_cost: p.unit,
      supplier_id, supplier_label,
      invoice_ref: editForm.invoice_ref.trim() || null,
      purchased_at: editForm.purchased_at,
      note: editForm.note.trim() || null,
    }).eq('id', editId);
    setBusyRow(null);
    if (error) return toast.error('Error desant la compra: ' + error.message);
    setEditId(null);
    onChange();
  };

  const removeEntry = async (pid: string) => {
    setBusyRow(pid);
    const { error } = await supabase.from('obra_cost_item_purchases' as any).delete().eq('id', pid);
    setBusyRow(null);
    if (error) return toast.error('Error eliminant la compra: ' + error.message);
    if (editId === pid) setEditId(null);
    onChange();
  };

  const prefillFromManual = () => {
    if (item.real_qty == null) return;
    setForm({
      ...emptyForm,
      qty: String(item.real_qty),
      unit_cost: item.real_unit_cost != null ? String(item.real_unit_cost / 100) : '',
    });
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
  const cellInputCls = 'w-full px-2 py-1 rounded border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/40';
  const labelCls = 'text-xs font-medium text-muted-foreground mb-1 block';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-elevated w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Historial de compres</h3>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        {/* Aggregates */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/40 border border-border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Qty real</p>
            <p className="text-base font-bold">{purchases.length ? totalQty : '—'}</p>
          </div>
          <div className="bg-muted/40 border border-border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">€/u mitjà pond.</p>
            <p className="text-base font-bold">{purchases.length ? fmtCentsPrecise(avgUnit) : '—'}</p>
          </div>
          <div className="bg-muted/40 border border-border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total real</p>
            <p className="text-base font-bold">{purchases.length ? fmtCentsPrecise(totalSpend) : '—'}</p>
          </div>
          <div className="bg-muted/40 border border-border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Desviació vs estimat</p>
            <p className={cn('text-base font-bold', dev >= 0 ? 'text-success' : 'text-destructive')}>
              {purchases.length ? `${dev >= 0 ? '+' : ''}${fmtCentsPrecise(dev)}` : '—'}
            </p>
          </div>
        </div>

        {/* Entries table */}
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {['Data', 'Proveïdor', 'Qty', '€/u', 'Subtotal', 'Ref.', 'Nota', ''].map((h) => (
                  <th key={h} className="text-left px-2 py-2 font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {purchases.map((p) => {
                const editing = editId === p.id;
                return (
                  <tr key={p.id} className="align-top">
                    {editing ? (
                      <>
                        <td className="px-2 py-1.5 w-28"><input type="date" value={editForm.purchased_at} onChange={(e) => setEditForm({ ...editForm, purchased_at: e.target.value })} className={cellInputCls} /></td>
                        <td className="px-2 py-1.5 min-w-[140px]"><input list={listId} value={editForm.supplier} onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })} className={cellInputCls} placeholder="Proveïdor" /></td>
                        <td className="px-2 py-1.5 w-16"><input type="number" step="0.01" value={editForm.qty} onChange={(e) => setEditForm({ ...editForm, qty: e.target.value })} className={cellInputCls} /></td>
                        <td className="px-2 py-1.5 w-20"><input type="number" step="0.01" value={editForm.unit_cost} onChange={(e) => setEditForm({ ...editForm, unit_cost: e.target.value })} className={cellInputCls} /></td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">{parsed(editForm).valid ? fmtCentsPrecise(parsed(editForm).qty * parsed(editForm).unit) : '—'}</td>
                        <td className="px-2 py-1.5 w-24"><input value={editForm.invoice_ref} onChange={(e) => setEditForm({ ...editForm, invoice_ref: e.target.value })} className={cellInputCls} /></td>
                        <td className="px-2 py-1.5 min-w-[120px]"><input value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} className={cellInputCls} /></td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button onClick={saveEdit} disabled={busyRow === p.id} className="px-2 py-1 rounded bg-primary text-primary-foreground text-[11px] font-medium disabled:opacity-50">Desar</button>
                            <button onClick={() => setEditId(null)} className="px-2 py-1 rounded border border-border text-[11px]">Cancel·lar</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{new Date(p.purchased_at).toLocaleDateString('ca-ES')}</td>
                        <td className="px-2 py-1.5">{supplierValue(p) || <span className="text-muted-foreground italic">—</span>}</td>
                        <td className="px-2 py-1.5 text-right">{p.qty}</td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">{fmtCentsPrecise(p.unit_cost)}</td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap font-semibold">{fmtCentsPrecise(p.qty * p.unit_cost)}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{p.invoice_ref || '—'}</td>
                        <td className="px-2 py-1.5 text-muted-foreground max-w-[160px] truncate">{p.note || '—'}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => startEdit(p)} className="text-muted-foreground hover:text-primary" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => removeEntry(p.id)} disabled={busyRow === p.id} className="text-muted-foreground hover:text-destructive disabled:opacity-50" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {purchases.length === 0 && (
                <tr><td colSpan={8} className="text-center text-muted-foreground py-4">Cap compra registrada. En afegir la primera, la partida deixarà d'editar-se manualment.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <datalist id={listId}>
          {suppliers.map((s) => <option key={s.id} value={s.name} />)}
        </datalist>

        {/* Add form */}
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Afegir compra</h4>
            {purchases.length === 0 && item.real_qty != null && (
              <button onClick={prefillFromManual} className="text-xs text-primary hover:underline">
                Usar el valor manual actual com a primera compra
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Data</label><input type="date" value={form.purchased_at} onChange={(e) => setForm({ ...form, purchased_at: e.target.value })} className={inputCls} /></div>
            <div className="md:col-span-2"><label className={labelCls}>Proveïdor</label><input list={listId} value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className={inputCls} placeholder="Escull o escriu un nom..." /></div>
            <div><label className={labelCls}>Quantitat *</label><input type="number" step="0.01" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Cost unitari (€) *</label><input type="number" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Subtotal</label><div className="px-3 py-2 text-sm font-semibold">{parsed(form).valid ? fmtCentsPrecise(parsed(form).qty * parsed(form).unit) : '—'}</div></div>
            <div><label className={labelCls}>Ref. albarà / factura</label><input value={form.invoice_ref} onChange={(e) => setForm({ ...form, invoice_ref: e.target.value })} className={inputCls} /></div>
            <div className="md:col-span-2"><label className={labelCls}>Nota</label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={inputCls} /></div>
          </div>
          <div className="flex justify-end">
            <button onClick={addEntry} disabled={saving || !parsed(form).valid} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Afegir compra
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Tancar</button>
        </div>
      </div>
    </div>
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