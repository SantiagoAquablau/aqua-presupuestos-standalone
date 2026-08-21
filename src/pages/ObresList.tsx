import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { HardHat, Search, Eye, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  fmtCents, fmtPct, marginColorClass, obraStatusBadge,
  type Obra, type ObraStatus,
} from '@/lib/obrasHelpers';

const statusFilters: { label: string; value: ObraStatus | 'totes' }[] = [
  { label: 'Totes', value: 'totes' },
  { label: 'Actives', value: 'activa' },
  { label: 'Pausades', value: 'pausada' },
  { label: 'Finalitzades', value: 'finalitzada' },
];

export default function ObresList() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ObraStatus | 'totes'>('totes');
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<Obra | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await supabase.from('obras' as any).delete().eq('id', toDelete.id);
    setDeleting(false);
    if (error) {
      toast.error('No s\'ha pogut eliminar l\'obra: ' + error.message);
      return;
    }
    toast.success('Obra eliminada correctament');
    setToDelete(null);
    queryClient.invalidateQueries({ queryKey: ['obras-list'] });
  };

  const { data: obras = [], isLoading } = useQuery({
    queryKey: ['obras-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('obras' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Obra[];
    },
  });

  const { data: comercials = [] } = useQuery({
    queryKey: ['profiles-min'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return data || [];
    },
  });
  const commName = (id: string | null) => comercials.find((c: any) => c.id === id)?.full_name || '—';

  const filtered = useMemo(() => {
    return obras.filter((o) => {
      const matchStatus = filter === 'totes' || o.status === filter;
      const q = search.trim().toLowerCase();
      const matchSearch = !q ||
        o.client_name?.toLowerCase().includes(q) ||
        o.budget_number?.toLowerCase().includes(q) ||
        o.client_town?.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [obras, filter, search]);

  const actives = obras.filter((o) => o.status === 'activa');
  const kpis = useMemo(() => {
    if (!obras.length) return { count: 0, avgEst: 0, avgReal: 0, totalDev: 0 };
    const avgEst = actives.reduce((s, o) => s + (o.margin_estimated_pct || 0), 0) / Math.max(actives.length, 1);
    const avgReal = actives.reduce((s, o) => s + (o.margin_real_pct || 0), 0) / Math.max(actives.length, 1);
    const totalDev = actives.reduce((s, o) => s + ((o.total_cost_estimated || 0) - (o.total_cost_real || 0)), 0);
    return { count: actives.length, avgEst, avgReal, totalDev };
  }, [obras, actives]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
          <HardHat className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Control d'Obres</h1>
          <p className="text-muted-foreground text-sm">{actives.length} obres actives</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiBox label="Total obres actives" value={String(kpis.count)} />
          <KpiBox label="Marge estimat mitjà" value={fmtPct(kpis.avgEst)} valueClass={marginColorClass(kpis.avgEst)} />
          <KpiBox label="Marge real mitjà" value={fmtPct(kpis.avgReal)} valueClass={marginColorClass(kpis.avgReal)} />
          <KpiBox
            label="Desviació total"
            value={`${kpis.totalDev >= 0 ? '+' : ''}${fmtCents(kpis.totalDev)}`}
            valueClass={kpis.totalDev >= 0 ? 'text-success' : 'text-destructive'}
          />
        </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                filter === f.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per client, núm. pressupost, municipi..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {['OBRA','CLIENT','MUNICIPI','COMERCIAL','VENDA','COST EST.','COST REAL','MARGE EST.','MARGE REAL','DESVIACIÓ','ESTAT','DATA','ACCIONS'].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((o) => {
                const dev = (o.total_cost_estimated || 0) - (o.total_cost_real || 0);
                const devPositive = dev >= 0;
                const sb = obraStatusBadge[o.status];
                return (
                  <tr key={o.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/control-obres/${o.id}`)}>
                    <td className="px-3 py-3 font-mono font-medium text-primary whitespace-nowrap">{o.budget_number}</td>
                    <td className="px-3 py-3 font-medium text-foreground whitespace-nowrap">{o.client_name || '—'}</td>
                    <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{o.client_town || '—'}</td>
                    <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{commName(o.comercial_id)}</td>
                    <td className="px-3 py-3 text-right font-medium whitespace-nowrap">{fmtCents(o.total_sale_estimated)}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">{fmtCents(o.total_cost_estimated)}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">{fmtCents(o.total_cost_real)}</td>
                    <td className={cn("px-3 py-3 text-right font-semibold whitespace-nowrap", marginColorClass(o.margin_estimated_pct))}>{fmtPct(o.margin_estimated_pct)}</td>
                    <td className={cn("px-3 py-3 text-right font-semibold whitespace-nowrap", marginColorClass(o.margin_real_pct))}>{fmtPct(o.margin_real_pct)}</td>
                    <td className={cn("px-3 py-3 text-right font-semibold whitespace-nowrap align-middle", devPositive ? 'text-success' : 'text-destructive')}>
                      <span className="inline-flex items-center gap-1 justify-end">
                        {devPositive ? '+' : ''}{fmtCents(dev)}
                        {devPositive ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', sb.className)}>{sb.label}</span>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{new Date(o.created_at).toLocaleDateString('ca-ES')}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/control-obres/${o.id}`); }}
                        className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-primary"
                        title="Veure detall"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setToDelete(o); }}
                          className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive ml-1"
                          title="Eliminar obra"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!isLoading && filtered.length === 0 && (
          <div className="py-12 text-center">
            <HardHat className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No hi ha obres {filter !== 'totes' ? `en estat «${filter}»` : ''}.</p>
            <p className="text-xs text-muted-foreground mt-2">Les obres es creen automàticament quan un pressupost passa a «Acceptat».</p>
          </div>
        )}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar obra?</AlertDialogTitle>
            <AlertDialogDescription>
              Aquesta acció eliminarà l'obra <strong>{toDelete?.budget_number}</strong>
              {toDelete?.client_name ? ` (${toDelete.client_name})` : ''} del control d'obres,
              juntament amb totes les seves fases, costos i activitat. El pressupost original
              no es veurà afectat. Aquesta acció no es pot desfer.
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
    </div>
  );
}

function KpiBox({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-card">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
      <p className={cn('text-2xl font-bold mt-1', valueClass || 'text-foreground')}>{value}</p>
    </div>
  );
}