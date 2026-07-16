import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, Plus, Pencil, Trash2, Loader2, FileText, Wand2, Pencil as PencilIcon, Thermometer, Bot, Layers, Leaf, Square, Sparkles, Settings2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { fmtCents, fmtPct } from '@/lib/obrasHelpers';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

type AssistedSeed =
  | 'bomba_calor'
  | 'robot'
  | 'cobertor'
  | 'gespa'
  | 'paviment'
  | 'accessoris_basics'
  | 'accessoris_opcionals';

type SeedDef = { seed: AssistedSeed; icon: any; label: string; desc: string; shortLabel: string };
const ASSISTED_SEEDS: SeedDef[] = [
  { seed: 'bomba_calor', icon: Thermometer, label: 'Bomba de calor', shortLabel: 'Bomba de calor', desc: 'Recomanació de kW segons volum i temperatura' },
  { seed: 'robot', icon: Bot, label: 'Robot netejafons', shortLabel: 'Robot', desc: 'Tria del catàleg amb quantitat' },
  { seed: 'cobertor', icon: Layers, label: 'Cobertor', shortLabel: 'Cobertor', desc: 'Càlcul automàtic segons model i mides de la piscina' },
  { seed: 'gespa', icon: Leaf, label: 'Gespa artificial', shortLabel: 'Gespa', desc: 'Model del catàleg per m² i preparació de terreny opcional' },
  { seed: 'paviment', icon: Square, label: 'Paviment perimetral', shortLabel: 'Paviment', desc: 'Aplacat porcelànic o fusta tecnològica amb formigó opcional' },
  { seed: 'accessoris_basics', icon: Sparkles, label: 'Accessoris bàsics', shortLabel: 'Accessoris bàsics', desc: 'Impulsors, skimmers, focus LED, embornal, reguladors…' },
  { seed: 'accessoris_opcionals', icon: Settings2, label: 'Accessoris opcionals', shortLabel: 'Accessoris opcionals', desc: 'Escala inox, dutxa, cascada, salvavides, barana…' },
];

type AnnexStatus = 'borrador' | 'enviat' | 'acceptat' | 'rebutjat';

const statusBadge: Record<AnnexStatus, { label: string; cls: string }> = {
  borrador: { label: 'Esborrany', cls: 'bg-muted text-muted-foreground' },
  enviat: { label: 'Enviat', cls: 'bg-info/15 text-info' },
  acceptat: { label: 'Acceptat', cls: 'bg-success/15 text-success' },
  rebutjat: { label: 'Rebutjat', cls: 'bg-destructive/15 text-destructive' },
};

export default function AnnexList() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [picked, setPicked] = useState<AssistedSeed[]>([]);

  const { data: budget } = useQuery({
    queryKey: ['budget-mini', budgetId],
    queryFn: async () => {
      const { data } = await supabase.from('budgets').select('id, number, client_name, client_town, status, comercial_id').eq('id', budgetId!).single();
      return data;
    },
    enabled: !!budgetId,
  });

  const { data: annexos = [], isLoading } = useQuery({
    queryKey: ['annexos', budgetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pressupost_annexos' as any)
        .select('*')
        .eq('budget_id', budgetId!)
        .eq('deleted', false)
        .order('annex_index', { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!budgetId,
  });

  const createMutation = useMutation({
    mutationFn: async (opts: { seeds?: AssistedSeed[]; title: string }) => {
      const { data, error } = await supabase
        .from('pressupost_annexos' as any)
        .insert({
          budget_id: budgetId,
          comercial_id: user?.id,
          title: opts.title,
          status: 'borrador',
          assisted_seeds: opts.seeds ?? [],
        } as any)
        .select('id')
        .single();
      if (error) throw error;
      return { id: (data as any).id as string, seeds: opts.seeds };
    },
    onSuccess: ({ id, seeds }) => {
      qc.invalidateQueries({ queryKey: ['annexos', budgetId] });
      setNewOpen(false);
      setPicked([]);
      const qs = seeds && seeds.length ? `?seeds=${seeds.join(',')}` : '';
      navigate(`/pressupostos/${budgetId}/annexos/${id}${qs}`);
    },
    onError: (e: any) => toast.error('Error creant annex: ' + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pressupost_annexos' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['annexos', budgetId] });
      qc.invalidateQueries({ queryKey: ['obra-phases'] });
      qc.invalidateQueries({ queryKey: ['obra-items'] });
      toast.success('Annex eliminat');
      setDeleteId(null);
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });

  const togglePick = (s: AssistedSeed) =>
    setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const createAssisted = () => {
    if (picked.length === 0) return;
    const labels = picked.map((s) => ASSISTED_SEEDS.find((x) => x.seed === s)?.shortLabel || s);
    const title =
      picked.length === 1
        ? `Annex — ${labels[0]}`
        : `Annex — ${labels.join(' + ')}`;
    createMutation.mutate({ seeds: picked, title });
  };

  if (budget && budget.status !== 'acceptat') {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-6 text-center">
          <p className="text-sm">Només es poden crear annexos per pressupostos <strong>acceptats</strong>.</p>
          <button onClick={() => navigate('/pressupostos')} className="mt-3 text-sm text-primary underline">Tornar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <button onClick={() => navigate('/pressupostos')} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" /> Tornar a Pressupostos
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Annexos del pressupost</h1>
          {budget && (
            <p className="text-muted-foreground text-sm mt-1">
              <span className="font-mono text-primary">{budget.number}</span> · {budget.client_name} · {budget.client_town}
            </p>
          )}
        </div>
        <button
          onClick={() => setNewOpen(true)}
          disabled={createMutation.isPending}
          className="gradient-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 shadow-md"
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Nou annex
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : annexos.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center shadow-card">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Encara no hi ha annexos per aquest pressupost.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
          <table className="w-full">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {['Núm','Títol','Data','Cost','Venda','Marge','Estat',''].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {annexos.map((a) => {
                const sb = statusBadge[a.status as AnnexStatus];
                return (
                  <tr key={a.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => navigate(`/pressupostos/${budgetId}/annexos/${a.id}`)}>
                    <td className="px-3 py-2 font-mono text-sm font-medium text-primary">{a.number}</td>
                    <td className="px-3 py-2 text-sm">{a.title}</td>
                    <td className="px-3 py-2 text-sm text-muted-foreground">{a.annex_date ? new Date(a.annex_date).toLocaleDateString('ca-ES') : '-'}</td>
                    <td className="px-3 py-2 text-sm">{fmtCents(a.total_cost)}</td>
                    <td className="px-3 py-2 text-sm font-medium">{fmtCents(a.total_sale)}</td>
                    <td className="px-3 py-2 text-sm">{fmtPct(a.margin_pct)}</td>
                    <td className="px-3 py-2"><span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', sb.cls)}>{sb.label}</span></td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 rounded hover:bg-muted" title="Editar" onClick={() => navigate(`/pressupostos/${budgetId}/annexos/${a.id}`)}>
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button className="p-1.5 rounded hover:bg-destructive/10" title="Eliminar" onClick={() => setDeleteId(a.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar annex?</AlertDialogTitle>
            <AlertDialogDescription>
              Aquesta acció eliminarà l'annex permanentment. Si està acceptat, també s'eliminaran les seves partides del Control d'Obres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Nou annex picker */}
      <Dialog open={newOpen} onOpenChange={(o) => { setNewOpen(o); if (!o) setPicked([]); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear nou annex</DialogTitle>
            <DialogDescription>Selecciona un o més blocs assistits per generar les partides automàticament. Pots combinar-los en un sol annex (ex: bomba de calor + gespa). O comença un esborrany buit.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Annex assistit (multi-selecció)</p>
            {ASSISTED_SEEDS.map(({ seed, icon: Icon, label, desc }) => {
              const checked = picked.includes(seed);
              return (
                <button
                  key={seed}
                  type="button"
                  disabled={createMutation.isPending}
                  onClick={() => togglePick(seed)}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors disabled:opacity-50',
                    checked
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:bg-primary/5',
                  )}
                >
                  <div className={cn(
                    'mt-0.5 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0',
                    checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-background',
                  )}>
                    {checked && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="pt-3 flex items-center justify-between gap-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {picked.length === 0 ? 'Cap bloc seleccionat' : `${picked.length} bloc${picked.length > 1 ? 's' : ''} seleccionat${picked.length > 1 ? 's' : ''}`}
            </span>
            <button
              type="button"
              onClick={createAssisted}
              disabled={picked.length === 0 || createMutation.isPending}
              className="gradient-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 shadow-md hover:opacity-90 disabled:opacity-50"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              Crear annex assistit
            </button>
          </div>

          <div className="pt-2 mt-2 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Manual</p>
            <button
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate({ title: 'Nou annex' })}
              className="w-full flex items-start gap-3 p-3 rounded-lg border border-border hover:border-foreground/20 hover:bg-muted/40 text-left transition-colors disabled:opacity-50"
            >
              <PencilIcon className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Annex en blanc</p>
                <p className="text-xs text-muted-foreground">Comença un esborrany buit i afegeix partides manualment</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}