import { useState } from 'react';
import { Plus, Pencil, Trash2, Eye, Loader2, Truck, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';

interface SupplierForm {
  name: string;
  contact_email: string;
}

const emptyForm: SupplierForm = { name: '', contact_email: '' };

export default function Proveidors() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers-with-count'],
    queryFn: async () => {
      const { data: supps, error } = await supabase.from('suppliers').select('*').order('name');
      if (error) throw error;
      const [counts, lastUpdates] = await Promise.all([
        Promise.all(
          (supps || []).map((s: any) =>
            supabase.from('articles').select('*', { count: 'exact', head: true }).eq('supplier_id', s.id)
              .then(({ count }) => count || 0)
          )
        ),
        Promise.all(
          (supps || []).map((s: any) =>
            supabase.from('article_price_history').select('changed_at').eq('supplier_id', s.id)
              .order('changed_at', { ascending: false }).limit(1).maybeSingle()
              .then(({ data }) => data?.changed_at || null)
          )
        ),
      ]);
      return (supps || []).map((s: any, i: number) => ({ ...s, articleCount: counts[i], lastPriceChange: lastUpdates[i] }));
    },
  });

  const filteredSuppliers = suppliers.filter((s: any) => !search || s.name?.toLowerCase().includes(search.toLowerCase()));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from('suppliers').update({ name: form.name, contact_email: form.contact_email } as any).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('suppliers').insert({ name: form.name, contact_email: form.contact_email } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers-with-count'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success(editId ? 'Proveïdor actualitzat' : 'Proveïdor creat correctament');
      closeModal();
    },
    onError: () => toast.error("Error guardant el proveïdor"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supplier = suppliers.find((s: any) => s.id === id);
      if (supplier && supplier.articleCount > 0) {
        throw new Error(`No es pot eliminar: té ${supplier.articleCount} articles associats. Reassigna'ls primer.`);
      }
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers-with-count'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Proveïdor eliminat');
      setDeleteId(null);
    },
    onError: (err: any) => { toast.error(err.message); setDeleteId(null); },
  });

  const openCreate = () => { setForm(emptyForm); setEditId(null); setModalOpen(true); };
  const openEdit = (s: any) => { setForm({ name: s.name, contact_email: s.contact_email || '' }); setEditId(s.id); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditId(null); setForm(emptyForm); };

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20';
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Preus Proveïdors</h1>
          <p className="text-muted-foreground mt-1">{suppliers.length} proveïdors</p>
        </div>
        <button onClick={openCreate} className="gradient-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md">
          <Plus className="w-4 h-4" /> Nou Proveïdor
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Cercar proveïdor per nom..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/20" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden shadow-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proveïdor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Articles</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Última actualització</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSuppliers.map((s: any) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/proveidors/${s.id}`)}>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{s.contact_email || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right text-muted-foreground">{s.articleCount}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{s.lastPriceChange ? new Date(s.lastPriceChange).toLocaleDateString('ca-ES') : 'Sense canvis de preu'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Veure articles" onClick={() => navigate(`/proveidors/${s.id}`)}><Eye className="w-4 h-4 text-muted-foreground" /></button>
                        <button className="p-1.5 rounded-md hover:bg-muted transition-colors" onClick={() => openEdit(s)}><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                        <button className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors" onClick={() => setDeleteId(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {filteredSuppliers.map((s: any) => (
              <div key={s.id} className="bg-card rounded-xl border border-border p-4 shadow-card cursor-pointer" onClick={() => navigate(`/proveidors/${s.id}`)}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button className="p-1 rounded hover:bg-muted" onClick={() => openEdit(s)}><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    <button className="p-1 rounded hover:bg-destructive/10" onClick={() => setDeleteId(s.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{s.articleCount} articles · {s.contact_email || 'Sense email'}</p>
              </div>
            ))}
          </div>

          {filteredSuppliers.length === 0 && !isLoading && suppliers.length > 0 && (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">Cap proveïdor coincideix amb la cerca</p>
            </div>
          )}

          {suppliers.length === 0 && !isLoading && (
            <div className="py-12 text-center">
              <Truck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Encara no hi ha proveïdors</p>
              <button onClick={openCreate} className="mt-3 text-sm text-primary font-medium hover:underline">Afegir el primer proveïdor →</button>
            </div>
          )}
        </>
      )}

      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Proveïdor' : 'Nou Proveïdor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Nom del proveïdor *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Nom..." />
            </div>
            <div>
              <label className={labelClass}>Email de contacte</label>
              <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className={inputClass} placeholder="contacte@proveidor.com" />
            </div>
            <button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}
              className="w-full gradient-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-md flex items-center justify-center gap-2 disabled:opacity-60">
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editId ? 'Guardar canvis' : 'Crear proveïdor'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar proveïdor?</AlertDialogTitle>
            <AlertDialogDescription>Segur que vols eliminar aquest proveïdor?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
