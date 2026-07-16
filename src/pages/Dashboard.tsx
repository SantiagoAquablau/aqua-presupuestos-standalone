import { FileText, Euro, TrendingUp, BarChart3, Plus, HardHat } from 'lucide-react';
import { KpiCard } from '@/components/ui/KpiCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { BudgetStatus } from '@/stores/budgetStore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fmtCents, fmtPct, marginColorClass, type Obra } from '@/lib/obrasHelpers';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, role, isAdministrativa, canAccessObres, user } = useAuth();

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets-dashboard', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('id, number, client_name, client_town, type, status, total_sale, budget_date, created_at')
        .eq('deleted', false)
        .eq('comercial_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) {
        console.error('[Dashboard] Query error:', error);
        throw error;
      }
      return data || [];
    },
    staleTime: 30000,
    enabled: !isAdministrativa && !!user?.id,
  });

  const { data: stats } = useQuery({
    queryKey: ['budget-stats', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('status, total_sale, total_cost, margin_pct')
        .eq('deleted', false)
        .eq('comercial_id', user!.id);
      if (error) {
        console.error('[Dashboard] Stats error:', error);
        throw error;
      }
      const active = data?.filter((b: any) => b.status !== 'rebutjat').length || 0;
      const pending = data?.filter((b: any) => b.status === 'enviat').reduce((s: number, b: any) => s + (b.total_sale || 0), 0) || 0;
      const accepted = data?.filter((b: any) => b.status === 'acceptat').length || 0;
      const total = data?.length || 0;
      const rate = total > 0 ? Math.round((accepted / total) * 100) : 0;
      const avgMargin = data?.length ? (data.reduce((s: number, b: any) => s + (b.margin_pct || 0), 0) / data.length).toFixed(1) : '0';
      return { active, pending, rate, avgMargin };
    },
    enabled: !isAdministrativa && !!user?.id,
  });

  const { data: activeObras = [] } = useQuery({
    queryKey: ['obras-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('obras' as any)
        .select('*')
        .eq('status', 'activa')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as unknown as Obra[];
    },
    enabled: canAccessObres,
  });

  const today = new Date().toLocaleDateString('ca-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Benvingut de nou, {profile?.full_name || 'Usuari'}!
        </h1>
        <p className="text-muted-foreground mt-1">
          {role === 'admin' ? 'Administrador' : role === 'administrativa' ? 'Administrativa' : 'Comercial'} · AquaBlau — {today}
        </p>
      </div>

      {!isAdministrativa && (
      <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Pressupostos actius" value={String(stats?.active || 0)} icon={FileText} />
        <KpiCard title="Import pendent" value={`€ ${((stats?.pending || 0) / 100).toLocaleString('ca-ES')}`} icon={Euro} />
        <KpiCard title="Taxa d'acceptació" value={`${stats?.rate || 0}%`} icon={TrendingUp} />
        <KpiCard title="Marge mitjà" value={`${stats?.avgMargin || 0}%`} icon={BarChart3} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Pressupostos recents</h2>
          <button onClick={() => navigate('/pressupostos')} className="text-sm text-primary font-medium hover:underline">
            Veure tots →
          </button>
        </div>

        <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden shadow-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Número</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipus</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Import</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estat</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {budgets.map((b: any) => (
                <tr key={b.id} className="hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => navigate('/pressupostos')}>
                  <td className="px-4 py-3 text-sm font-mono font-medium text-primary">{b.number || '-'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{b.client_name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {b.type === 'obra_nueva'
                      ? 'Obra Nova'
                      : b.type === 'rehabilitacion'
                      ? 'Rehabilitació'
                      : b.type === 'piscina_autoportant'
                      ? 'Piscina Autoportant'
                      : 'Manteniment'}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-foreground text-right">€ {((b.total_sale || 0) / 100).toLocaleString('ca-ES')}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status as BudgetStatus} /></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{b.budget_date ? new Date(b.budget_date).toLocaleDateString('ca-ES') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {budgets.length === 0 && (
            <div className="py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Encara no hi ha pressupostos</p>
              <button onClick={() => navigate('/nou-pressupost')} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                <Plus className="w-4 h-4" /> Crear el primer pressupost
              </button>
            </div>
          )}
        </div>

        <div className="md:hidden space-y-3">
          {budgets.map((b: any) => (
            <div key={b.id} onClick={() => navigate('/pressupostos')} className="bg-card rounded-xl border border-border p-4 shadow-card cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-mono font-medium text-primary">{b.number || '-'}</span>
                <StatusBadge status={b.status as BudgetStatus} />
              </div>
              <p className="font-medium text-foreground">{b.client_name}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <span className="text-lg font-bold text-foreground">€ {((b.total_sale || 0) / 100).toLocaleString('ca-ES')}</span>
              </div>
            </div>
          ))}
          {budgets.length === 0 && (
            <div className="py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Encara no hi ha pressupostos</p>
              <button onClick={() => navigate('/nou-pressupost')} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                <Plus className="w-4 h-4" /> Crear el primer pressupost
              </button>
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {canAccessObres && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <HardHat className="w-5 h-5 text-primary" /> Resum d'obres actives
            </h2>
            <button onClick={() => navigate('/control-obres')} className="text-sm text-primary font-medium hover:underline">
              Veure totes →
            </button>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    {['Obra','Client','Marge est.','Marge real','Desviació'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeObras.map((o) => {
                    const dev = (o.total_cost_estimated || 0) - (o.total_cost_real || 0);
                    return (
                      <tr key={o.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/control-obres/${o.id}`)}>
                        <td className="px-4 py-3 font-mono text-primary">{o.budget_number}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{o.client_name}</td>
                        <td className={cn('px-4 py-3 font-semibold', marginColorClass(o.margin_estimated_pct))}>{fmtPct(o.margin_estimated_pct)}</td>
                        <td className={cn('px-4 py-3 font-semibold', marginColorClass(o.margin_real_pct))}>{fmtPct(o.margin_real_pct)}</td>
                        <td className={cn('px-4 py-3 font-semibold', dev >= 0 ? 'text-success' : 'text-destructive')}>
                          {dev >= 0 ? '+' : ''}{fmtCents(dev)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {activeObras.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-sm">No hi ha obres actives.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}