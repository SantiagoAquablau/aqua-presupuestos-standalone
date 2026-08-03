import { useState, useEffect } from 'react';
import { Search, Plus, Pencil, Copy, Trash2, Download, FileText, Loader2, AlertCircle, RefreshCw, ClipboardList, Files, User as UserIcon, FileSignature } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { BudgetStatus } from '@/stores/budgetStore';
import { useBudgetStore } from '@/stores/budgetStore';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { buildBudgetPdf } from '@/lib/budgetSave';
import { generateTechnicalSheet } from '@/lib/technicalSheet';
import { loadBudgetAsDraft } from '@/lib/budgetMapper';
import { loadBudgetReadyForPdf } from '@/lib/budgetPdfPrep';
import { populateObraFromBudget } from '@/lib/populateObraFromBudget';
import { saveBlobWithPicker } from '@/lib/saveFile';
import { buildMaintenanceContractPdf } from '@/lib/maintenanceContract';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const statusFilters: { label: string; value: BudgetStatus | 'tots' }[] = [
  { label: 'Tots', value: 'tots' },
  { label: 'Esborrany', value: 'borrador' },
  { label: 'Enviat', value: 'enviat' },
  { label: 'Acceptat', value: 'acceptat' },
  { label: 'Rebutjat', value: 'rebutjat' },
];

const statusOptions: { value: BudgetStatus; label: string }[] = [
  { value: 'borrador', label: 'Esborrany' },
  { value: 'enviat', label: 'Enviat' },
  { value: 'acceptat', label: 'Acceptat' },
  { value: 'rebutjat', label: 'Rebutjat' },
];

const statusClasses: Record<BudgetStatus, string> = {
  borrador: 'bg-muted text-muted-foreground',
  enviat: 'bg-info/15 text-info',
  acceptat: 'bg-success/15 text-success',
  rebutjat: 'bg-destructive/15 text-destructive',
};

const isMaintenanceBudget = (type?: string | null) => type === 'mantenimiento' || type === 'manteniment';

const PAGE_SIZE = 25;

// Escape characters that are structurally significant in a PostgREST `.or()`
// filter string (condition separator / grouping) so a client name or number
// containing a comma or parenthesis doesn't break the query.
function escapeOrTerm(value: string): string {
  return value.replace(/[,()]/g, '\\$&');
}

function StatusSelect({
  status,
  onChange,
  disabled,
}: {
  status: BudgetStatus;
  onChange: (s: BudgetStatus) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={status}
      disabled={disabled}
      onChange={(e) => {
        const next = e.target.value as BudgetStatus;
        if (next !== status) onChange(next);
      }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex items-center pl-3 pr-7 py-1 rounded-full text-xs font-medium border-0 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60',
        'bg-no-repeat',
        statusClasses[status],
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.5rem center',
        backgroundSize: '0.85em 0.85em',
      }}
    >
      {statusOptions.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export default function BudgetList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BudgetStatus | 'tots'>('tots');
  const [comercialFilter, setComercialFilter] = useState<string>('me');

  // Debounce the free-text search before it hits the SQL query, so we don't
  // fire a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [comandaBudget, setComandaBudget] = useState<any | null>(null);
  const [comandaForm, setComandaForm] = useState({
    contractant_name: '', contractant_nif: '', contractant_address: '',
    contractant_town: '', obra_location: '',
    service_start_date: '',
  });
  const [comandaSaving, setComandaSaving] = useState(false);
  const { loadDraft, resetDraft } = useBudgetStore();

  const { data: comercials = [] } = useQuery({
    queryKey: ['comercials-list'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_comercials' as any);
      if (error) {
        console.error('[BudgetList] list_comercials error:', error);
        return [] as any[];
      }
      return (data || []) as { id: string; full_name: string; email: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: budgetPages,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['budgets', comercialFilter, statusFilter, debouncedSearch, user?.id],
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('budgets')
        .select(
          'id, number, client_name, client_town, type, status, total_sale, total_cost, margin_pct, budget_date, created_at, comercial_id',
          { count: 'exact' },
        )
        .eq('deleted', false);

      if (comercialFilter === 'me') {
        query = query.eq('comercial_id', user!.id);
      } else if (comercialFilter !== 'tots') {
        query = query.eq('comercial_id', comercialFilter);
      }
      if (statusFilter !== 'tots') {
        query = query.eq('status', statusFilter);
      }
      const term = debouncedSearch.trim();
      if (term) {
        const escaped = escapeOrTerm(term);
        query = query.or(`client_name.ilike.%${escaped}%,number.ilike.%${escaped}%,client_town.ilike.%${escaped}%`);
      }

      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
      if (error) {
        console.error('[BudgetList] Query error:', error);
        throw error;
      }
      return {
        rows: data || [],
        totalCount: count ?? 0,
        nextPage: (data?.length || 0) === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 30000,
    enabled: !!user?.id,
  });

  const budgets = budgetPages?.pages.flatMap((p) => p.rows) ?? [];
  const totalCount = budgetPages?.pages[0]?.totalCount ?? 0;

  const { data: annexCounts = {} } = useQuery({
    queryKey: ['annex-counts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pressupost_annexos' as any)
        .select('budget_id')
        .eq('deleted', false);
      const counts: Record<string, number> = {};
      ((data || []) as any[]).forEach((a) => {
        counts[a.budget_id] = (counts[a.budget_id] || 0) + 1;
      });
      return counts;
    },
    staleTime: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budgets').update({ deleted: true } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['budgets-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['budget-stats'] });
      toast.success('Pressupost eliminat');
      setDeleteId(null);
    },
    onError: () => toast.error("Error eliminant el pressupost"),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: full } = await supabase.from('budgets').select('*').eq('id', id).single();
      if (!full) throw new Error('Not found');
      const { id: _id, created_at, updated_at, number, ...rest } = full as any;
      // `number` has a UNIQUE constraint and is NOT NULL — generate a temporary
      // placeholder so duplicates do not collide. The user assigns a final
      // number later from the wizard.
      const placeholder = `COPIA-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase
        .from('budgets')
        .insert({ ...rest, number: placeholder, status: 'borrador', deleted: false } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Pressupost duplicat. Assigna un número nou.');
    },
    onError: (err: any) => {
      console.error('[duplicateMutation]', err);
      toast.error(`Error duplicant${err?.message ? `: ${err.message}` : ''}`);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, number, type }: { id: string; status: BudgetStatus; number?: string; type?: string }) => {
      const { error } = await supabase.from('budgets').update({ status } as any).eq('id', id);
      if (error) throw error;
      if (status === 'acceptat' && !isMaintenanceBudget(type)) {
        try { await populateObraFromBudget(id); }
        catch (e) { console.error('[populateObraFromBudget]', e); }
      }
      return { id, status, number, type };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['budgets-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['budget-stats'] });
      if (data?.status === 'acceptat') {
        if (isMaintenanceBudget(data.type)) {
          toast.success('Pressupost de manteniment acceptat.');
          const b = budgets.find((x: any) => x.id === data.id);
          if (b) openComandaModal(b);
          else {
            supabase.from('budgets').select('*').eq('id', data.id).single().then(({ data: full }) => {
              if (full) openComandaModal(full);
            });
          }
        } else {
          toast.success(`Pressupost acceptat. S'ha creat l'obra ${data.number || ''} al mòdul de Control d'Obres.`, {
            action: { label: "Veure Control d'Obres →", onClick: () => navigate('/control-obres') },
            duration: 6000,
          });
          // Open Confirmació de Comanda modal prefilled with client data
          const b = budgets.find((x: any) => x.id === data.id);
          if (b) openComandaModal(b);
          else {
            supabase.from('budgets').select('*').eq('id', data.id).single().then(({ data: full }) => {
              if (full) openComandaModal(full);
            });
          }
        }
      } else {
        toast.success('Estat actualitzat');
      }
    },
    onError: () => toast.error("Error actualitzant l'estat"),
  });

  const openComandaModal = async (b: any) => {
    // Ensure we have full row (client_address etc may be missing in list query)
    let row = b;
    if (!('client_address' in row) || !('contractant_name' in row)) {
      const { data } = await supabase.from('budgets').select('*').eq('id', b.id).single();
      if (data) row = data;
    }
    setComandaForm({
      contractant_name: (row as any).contractant_name || row.client_name || '',
      contractant_nif: (row as any).contractant_nif || (row as any).client_nif || '',
      contractant_address: (row as any).contractant_address || (row as any).client_address || '',
      contractant_town: (row as any).contractant_town || row.client_town || '',
      obra_location: (row as any).obra_location || row.client_town || '',
      service_start_date: new Date().toISOString().slice(0, 10),
    });
    setComandaBudget(row);
  };

  const handleGenerateComanda = async () => {
    if (!comandaBudget) return;
    setComandaSaving(true);
    try {
      const updatePayload: any = {
        contractant_name: comandaForm.contractant_name,
        contractant_nif: comandaForm.contractant_nif,
        contractant_address: comandaForm.contractant_address,
        contractant_town: comandaForm.contractant_town,
        obra_location: comandaForm.obra_location,
      };
      const { error } = await supabase
        .from('budgets')
        .update(updatePayload)
        .eq('id', comandaBudget.id);
      if (error) throw error;

      // ─── Maintenance branch: render the contract PDF and stop. ─────────
      if (isMaintenanceBudget(comandaBudget.type)) {
        const stripAccents = (s: any) => String(s ?? '')
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
        const numberPart = String(comandaBudget.number ?? '').trim();
        const namePart = stripAccents(comandaBudget.client_name);
        const townPart = stripAccents(comandaBudget.client_town);
        const head = [numberPart, namePart ? ` ${namePart}` : ''].filter(Boolean).join('-');
        const filename =
          ((head + (townPart ? ` (${townPart})` : '')).trim() || 'contracte') +
          '-contracte-manteniment.pdf';
        await saveBlobWithPicker(async () =>
          buildMaintenanceContractPdf({
            budgetId: comandaBudget.id,
            contractDate: new Date().toISOString(),
            serviceStartDate: comandaForm.service_start_date,
            contractantName: comandaForm.contractant_name,
            contractantNif: comandaForm.contractant_nif,
            contractantAddress: comandaForm.contractant_address,
            contractantTown: comandaForm.contractant_town,
            obraTown: comandaBudget.client_town || '',
            obraLocation: comandaForm.obra_location,
          }),
        filename);
        toast.success('Contracte de manteniment generat');
        setComandaBudget(null);
        return;
      }

      // Pre-compute filename
      const stripAccents = (s: any) => String(s ?? '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
      const numberPart = String(comandaBudget.number ?? '').trim();
      const namePart = stripAccents(comandaBudget.client_name);
      const townPart = stripAccents(comandaBudget.client_town);
      const head = [numberPart, namePart ? ` ${namePart}` : ''].filter(Boolean).join('-');
      const filename = ((head + (townPart ? ` (${townPart})` : '')).trim() || 'pressupost') + '-comanda.pdf';

      await saveBlobWithPicker(async () => {
        const fullDraft = await loadBudgetReadyForPdf(comandaBudget.id);
        const draftWithComanda = {
          ...fullDraft,
          contractantName: comandaForm.contractant_name,
          contractantNif: comandaForm.contractant_nif,
          contractantAddress: comandaForm.contractant_address,
          contractantTown: comandaForm.contractant_town,
          obraLocation: comandaForm.obra_location,
        } as any;
        const { blob } = await buildBudgetPdf(draftWithComanda);
        return blob;
      }, filename);

      toast.success('PDF amb comanda generat');
      setComandaBudget(null);

      // Fire-and-forget: create obra in Gestió de Projectes
      const b = comandaBudget;
      const tipoMap: Record<string, string> = {
        obra_nueva: 'OBRA NUEVA',
        rehabilitacion: 'REHABILITACIÓN',
        mantenimiento: 'MANTENIMIENTO',
      };
      const addr = (b as any).client_address || '';
      const town = b.client_town || '';
      const direccion = [addr, town].filter(Boolean).join(', ');
      const payload = {
        referencia: b.number,
        cliente: b.client_name,
        poblacion: town,
        ubicacion: town,
        direccion_completa: direccion,
        tipo_obra: tipoMap[b.type] ?? 'OBRA NUEVA',
        estado_obra: 'ACTIVA',
        numero_presupuesto: b.number,
        total_presupuesto: (b.total_sale || 0) / 100,
        comercial_vendedor: profile?.full_name ?? '',
        enlace_presupuesto_pdf: 'enlacpendent.com',
        enlace_presupuesto: 'enlacpendent.com',
        tiene_dos_contratos: false,
        fecha_creacion: new Date().toISOString(),
      };
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('create-obra-external', { body: payload });
          if (error) {
            toast.warning("El PDF s'ha generat correctament. L'obra s'haurà de crear manualment a Gestió de Projectes.");
            return;
          }
          if (data?.status === 409) {
            toast.warning("L'obra ja existeix a Gestió de Projectes");
          } else if (data?.success) {
            toast.success('Obra creada a Gestió de Projectes ✓');
          } else {
            toast.warning("El PDF s'ha generat correctament. L'obra s'haurà de crear manualment a Gestió de Projectes.");
          }
        } catch (_e) {
          toast.warning("El PDF s'ha generat correctament. L'obra s'haurà de crear manualment a Gestió de Projectes.");
        }
      })();
    } catch (e: any) {
      console.error('[Comanda] error', e);
      toast.error(
        isMaintenanceBudget(comandaBudget?.type)
          ? 'Error generant el contracte de manteniment'
          : 'Error generant el PDF amb comanda',
      );
    } finally {
      setComandaSaving(false);
    }
  };

  const handleEdit = async (b: any) => {
    try {
      const { draft } = await loadBudgetAsDraft(b.id);
      loadDraft(draft);
    } catch (e) {
      toast.error('Error carregant el pressupost');
      return;
    }
    navigate('/nou-pressupost');
  };

  const handleDownloadPDF = async (b: any) => {
    // Pre-compute a sensible filename synchronously from row data so the
    // picker can open BEFORE we hit any await (preserves user-gesture).
    const stripAccents = (s: any) => String(s ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    const numberPart = String(b.number ?? '').trim();
    const namePart = stripAccents(b.client_name);
    const townPart = stripAccents(b.client_town);
    const head = [numberPart, namePart ? ` ${namePart}` : ''].filter(Boolean).join('-');
    const filename = (head + (townPart ? ` (${townPart})` : '')).trim() || 'pressupost';
    try {
      await saveBlobWithPicker(async () => {
        const fullDraft = await loadBudgetReadyForPdf(b.id);
        const { blob } = await buildBudgetPdf(fullDraft);
        return blob;
      }, `${filename}.pdf`);
      toast.success('PDF generat');
    } catch (err) {
      console.error('[BudgetList] PDF error', err);
      toast.error('Error generant el PDF');
    }
  };

  const handleDownloadTechSheet = async (b: any) => {
    try {
      toast.loading('Generant fitxa tècnica...', { id: 'tech-sheet' });
      await generateTechnicalSheet(b.id);
      toast.success('Fitxa tècnica generada', { id: 'tech-sheet' });
    } catch (e: any) {
      console.error('[TechSheet] error', e);
      toast.error('Error generant la fitxa tècnica', { id: 'tech-sheet' });
    }
  };

  const SkeletonRows = () => (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="border-b border-border">
          <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-10 ml-auto" /></td>
          <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
        </tr>
      ))}
    </>
  );

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Pressupostos</h1>
          <p className="text-muted-foreground mt-1">
            {budgets.length < totalCount ? `${budgets.length} de ${totalCount} pressupostos` : `${totalCount} pressupostos`}
          </p>
        </div>
        <button onClick={() => { resetDraft(); navigate('/nou-pressupost'); }}
          className="gradient-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md">
          <Plus className="w-4 h-4" /> Nou Pressupost
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Cercar per client, número o municipi..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow min-h-[44px]" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {statusFilters.map((f) => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={cn('px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border min-h-[44px]',
                statusFilter === f.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:bg-muted'
              )}>{f.label}</button>
          ))}
        </div>
        <div className="relative">
          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <select
            value={comercialFilter}
            onChange={(e) => setComercialFilter(e.target.value)}
            className="pl-9 pr-8 py-2 rounded-lg border border-input bg-card text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-ring/20"
            title="Filtrar per comercial"
          >
            <option value="me">Els meus pressupostos</option>
            <option value="tots">Tots els comercials</option>
            {comercials
              .filter((c) => c.id !== user?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>{c.full_name || c.email}</option>
              ))}
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-sm text-destructive font-medium">Error carregant els pressupostos</p>
          <p className="text-xs text-muted-foreground">{(error as any)?.message}</p>
          <button onClick={() => refetch()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <RefreshCw className="w-4 h-4" /> Tornar a intentar
          </button>
        </div>
      )}

      {/* Desktop table — only on lg+ to avoid clipping on portrait tablets */}
      {!error && (
        <div className="hidden lg:block bg-card rounded-xl border border-border overflow-hidden shadow-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Número</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Municipi</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipus</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Import</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Marge%</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estat</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? <SkeletonRows /> : budgets.map((b: any) => (
                <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-primary">{b.number || '-'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{b.client_name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{b.client_town}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {b.type === 'obra_nueva'
                      ? 'Obra Nova'
                      : b.type === 'rehabilitacion'
                        ? 'Rehabilitació'
                        : b.type === 'piscina_autoportant'
                          ? 'Piscina Autoportant'
                          : 'Manteniment'}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-foreground text-right">{((b.total_sale || 0) / 100).toLocaleString('ca-ES')} €</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={cn('font-medium', (b.margin_pct || 0) >= 30 ? 'text-success' : (b.margin_pct || 0) >= 20 ? 'text-warning' : 'text-destructive')}>
                      {(b.margin_pct || 0).toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusSelect
                      status={b.status as BudgetStatus}
                      disabled={statusMutation.isPending}
                      onChange={(s) => statusMutation.mutate({ id: b.id, status: s, number: b.number, type: b.type })}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{b.budget_date ? new Date(b.budget_date).toLocaleDateString('ca-ES') : '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Editar" onClick={() => handleEdit(b)}><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                      <button className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Duplicar" onClick={() => duplicateMutation.mutate(b.id)}><Copy className="w-4 h-4 text-muted-foreground" /></button>
                      <button className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Descarregar PDF" onClick={() => handleDownloadPDF(b)}><Download className="w-4 h-4 text-muted-foreground" /></button>
                      {b.status === 'acceptat' && isMaintenanceBudget(b.type) && (
                        <button
                          className="p-1.5 rounded-md hover:bg-primary/10 transition-colors"
                          title="Generar contracte de manteniment"
                          onClick={() => openComandaModal(b)}
                        >
                          <FileSignature className="w-4 h-4 text-primary" />
                        </button>
                      )}
                      {b.status === 'acceptat' && !isMaintenanceBudget(b.type) && (
                        <>
                          <button
                            className="p-1.5 rounded-md hover:bg-success/10 transition-colors"
                            title="Descarregar Fitxa Tècnica (jefe d'obra/magatzem)"
                            onClick={() => handleDownloadTechSheet(b)}
                          >
                            <ClipboardList className="w-4 h-4 text-success" />
                          </button>
                          <button
                            className="p-1.5 rounded-md hover:bg-primary/10 transition-colors"
                            title="Confirmació de Comanda"
                            onClick={() => openComandaModal(b)}
                          >
                            <FileSignature className="w-4 h-4 text-primary" />
                          </button>
                          <button
                            className="p-1.5 rounded-md hover:bg-primary/10 transition-colors relative"
                            title="Annexos d'aquest pressupost"
                            onClick={() => navigate(`/pressupostos/${b.id}/annexos`)}
                          >
                            <Files className="w-4 h-4 text-primary" />
                            {(annexCounts[b.id] || 0) > 0 && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
                                {annexCounts[b.id]}
                              </span>
                            )}
                          </button>
                        </>
                      )}
                      <button className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors" title="Eliminar" onClick={() => setDeleteId(b.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && budgets.length === 0 && (
            <div className="py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Encara no hi ha pressupostos</p>
              <button onClick={() => { resetDraft(); navigate('/nou-pressupost'); }} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                <Plus className="w-4 h-4" /> Crear el primer pressupost
              </button>
            </div>
          )}
          {!isLoading && hasNextPage && (
            <div className="py-4 flex justify-center border-t border-border">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
              >
                {isFetchingNextPage ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Carregar més
              </button>
            </div>
          )}
        </div>
      )}

      {/* Card view — mobile and portrait tablets */}
      {!error && (
        <div className="lg:hidden space-y-3">
          {isLoading ? [...Array(3)].map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 shadow-card space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          )) : budgets.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Encara no hi ha pressupostos</p>
              <button onClick={() => { resetDraft(); navigate('/nou-pressupost'); }} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                <Plus className="w-4 h-4" /> Crear el primer pressupost
              </button>
            </div>
          ) : budgets.map((b: any) => (
            <div key={b.id} className="bg-card rounded-xl border border-border p-4 shadow-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-mono font-medium text-primary">{b.number || '-'}</span>
                <StatusSelect
                  status={b.status as BudgetStatus}
                  disabled={statusMutation.isPending}
                      onChange={(s) => statusMutation.mutate({ id: b.id, status: s, number: b.number, type: b.type })}
                />
              </div>
              <p className="font-medium text-foreground">{b.client_name}</p>
              <p className="text-sm text-muted-foreground">{b.client_town}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <span className="text-lg font-bold text-foreground">{((b.total_sale || 0) / 100).toLocaleString('ca-ES')} €</span>
                <div className="flex gap-1">
                  <button className="p-1.5 rounded-md hover:bg-muted" onClick={() => handleEdit(b)}><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                  <button className="p-1.5 rounded-md hover:bg-muted" onClick={() => handleDownloadPDF(b)}><Download className="w-4 h-4 text-muted-foreground" /></button>
                      {b.status === 'acceptat' && isMaintenanceBudget(b.type) && (
                        <button className="p-1.5 rounded-md hover:bg-primary/10" onClick={() => openComandaModal(b)} title="Generar contracte de manteniment"><FileSignature className="w-4 h-4 text-primary" /></button>
                      )}
                      {b.status === 'acceptat' && !isMaintenanceBudget(b.type) && (
                    <>
                      <button className="p-1.5 rounded-md hover:bg-success/10" onClick={() => handleDownloadTechSheet(b)} title="Fitxa Tècnica"><ClipboardList className="w-4 h-4 text-success" /></button>
                      <button className="p-1.5 rounded-md hover:bg-primary/10" onClick={() => openComandaModal(b)} title="Confirmació de Comanda"><FileSignature className="w-4 h-4 text-primary" /></button>
                      <button className="p-1.5 rounded-md hover:bg-primary/10 relative" onClick={() => navigate(`/pressupostos/${b.id}/annexos`)} title="Annexos">
                        <Files className="w-4 h-4 text-primary" />
                        {(annexCounts[b.id] || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">{annexCounts[b.id]}</span>
                        )}
                      </button>
                    </>
                  )}
                  <button className="p-1.5 rounded-md hover:bg-destructive/10" onClick={() => setDeleteId(b.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
                </div>
              </div>
            </div>
          ))}
          {!isLoading && hasNextPage && (
            <div className="pt-1 flex justify-center">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
              >
                {isFetchingNextPage ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Carregar més
              </button>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar pressupost?</AlertDialogTitle>
            <AlertDialogDescription>Segur que vols eliminar aquest pressupost? Aquesta acció es pot revertir.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!comandaBudget} onOpenChange={(o) => { if (!o) setComandaBudget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isMaintenanceBudget(comandaBudget?.type)
                ? 'Contracte de Manteniment'
                : 'Confirmació de Comanda'}
            </DialogTitle>
            <DialogDescription>
              {isMaintenanceBudget(comandaBudget?.type)
                ? "Revisa les dades del contractant i indica la data d'inici del servei. En prémer «Generar contracte» es descarregarà el PDF del contracte."
                : 'Revisa o modifica les dades del contractant. Si coincideixen amb les del client, només cal confirmar.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="cm-name">Nom del contractant</Label>
              <Input id="cm-name" value={comandaForm.contractant_name}
                onChange={(e) => setComandaForm((f) => ({ ...f, contractant_name: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cm-nif">NIF del contractant</Label>
              <Input id="cm-nif" value={comandaForm.contractant_nif}
                onChange={(e) => setComandaForm((f) => ({ ...f, contractant_nif: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cm-addr">Domicili del contractant</Label>
              <Input id="cm-addr" value={comandaForm.contractant_address}
                onChange={(e) => setComandaForm((f) => ({ ...f, contractant_address: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cm-town">Municipi del contractant</Label>
              <Input id="cm-town" value={comandaForm.contractant_town}
                onChange={(e) => setComandaForm((f) => ({ ...f, contractant_town: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cm-obra">
                {isMaintenanceBudget(comandaBudget?.type)
                  ? 'Adreça / ubicació de la piscina'
                  : "Ubicació / municipi de l'obra"}
              </Label>
              <Input id="cm-obra" value={comandaForm.obra_location}
                onChange={(e) => setComandaForm((f) => ({ ...f, obra_location: e.target.value }))} />
            </div>
            {isMaintenanceBudget(comandaBudget?.type) && (
              <div className="grid gap-1.5">
                <Label htmlFor="cm-start">Data d'inici del servei</Label>
                <Input
                  id="cm-start"
                  type="date"
                  value={comandaForm.service_start_date}
                  onChange={(e) => setComandaForm((f) => ({ ...f, service_start_date: e.target.value }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setComandaBudget(null)}
              className="px-4 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted"
              disabled={comandaSaving}
            >
              Cancel·lar
            </button>
            <button
              type="button"
              onClick={handleGenerateComanda}
              disabled={comandaSaving}
              className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-medium hover:opacity-90 inline-flex items-center gap-2 disabled:opacity-60"
            >
              {comandaSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />}
              {isMaintenanceBudget(comandaBudget?.type)
                ? 'Generar contracte'
                : 'Generar PDF amb Comanda'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}