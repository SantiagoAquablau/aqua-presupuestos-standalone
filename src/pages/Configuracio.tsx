import { useState } from 'react';
import { Settings, Users, Building2, Image, Loader2, Plus, Pencil, Trash2, Shield, User, UserX, Check, Tag, X, Calculator, Umbrella, Euro } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FormulaEnginePanel } from '@/components/config/FormulaEnginePanel';

type Section = 'usuaris' | 'escales' | 'categories' | 'formules' | 'cobertors' | 'cobertor_prices' | 'autoportant_prices';

export default function Configuracio() {
  const [activeSection, setActiveSection] = useState<Section | null>(null);

  const { isAdmin } = useAuth();

  const sections = [
    { id: 'usuaris' as Section, icon: Users, title: "Gestió d'Usuaris", desc: "Afegir, editar i gestionar els permisos dels comercials" },
    { id: 'categories' as Section, icon: Tag, title: "Categories d'Articles", desc: "Gestionar les categories del catàleg d'articles" },
    { id: 'escales' as Section, icon: Image, title: "Imatges Escales Interiors", desc: "Configurar imatges per cada tipus d'escala" },
    { id: 'cobertors' as Section, icon: Umbrella, title: "Imatges Cobertors", desc: "Imatges dels models i colors de lames del cobertor" },
    ...(isAdmin ? [{ id: 'cobertor_prices' as Section, icon: Euro, title: "Preus Cobertors", desc: "Preus base d'estructura, lames, transport i instal·lació + fórmula global" }] : []),
    ...(isAdmin ? [{ id: 'autoportant_prices' as Section, icon: Euro, title: "Preus Piscines Autoportants", desc: "Preus per model, ample, llarg, altura d'aigua i transport" }] : []),
    ...(isAdmin ? [{ id: 'formules' as Section, icon: Calculator, title: "Motor de Càlcul", desc: "Configura les fórmules de càlcul de cada fase del pressupost" }] : []),
  ];

  return (
    <div className={cn("p-4 md:p-8 space-y-6 mx-auto", activeSection === 'formules' ? 'max-w-6xl' : 'max-w-4xl')}>
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Configuració</h1>
        <p className="text-muted-foreground mt-1">Configuració general de l'aplicació</p>
      </div>

      {!activeSection ? (
        <div className="space-y-4">
          {sections.map((item) => (
            <button key={item.id} onClick={() => setActiveSection(item.id)}
              className="w-full bg-card rounded-xl border border-border p-5 shadow-card flex items-start gap-4 hover:shadow-elevated transition-shadow text-left">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button onClick={() => setActiveSection(null)} className="text-sm text-primary font-medium hover:underline mb-4">← Tornar</button>
          {activeSection === 'usuaris' && <UserManagement />}
          {activeSection === 'escales' && <StairImagesSection />}
          {activeSection === 'cobertors' && <CobertorImagesSection />}
          {activeSection === 'cobertor_prices' && <CobertorPricesSection />}
          {activeSection === 'autoportant_prices' && <AutoportantPricesSection />}
          {activeSection === 'categories' && <CategoriesSection />}
          {activeSection === 'formules' && <FormulaEnginePanel />}
        </div>
      )}
    </div>
  );
}

// ── Categories Section ─────────────────────────────
function CategoriesSection() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      return data as { id: string; name: string; created_at: string }[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('categories').insert({ name } as any);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setNewName(''); toast.success('Categoria afegida'); },
    onError: (err: any) => toast.error(err?.message?.includes('unique') ? 'Ja existeix una categoria amb aquest nom' : 'Error afegint'),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('categories').update({ name } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setEditingId(null); toast.success('Categoria renombrada'); },
    onError: (err: any) => toast.error(err?.message?.includes('unique') ? 'Ja existeix' : 'Error renombrant'),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      // Check if any articles use this category
      const { count } = await supabase.from('articles').select('id', { count: 'exact', head: true }).eq('category', name);
      if (count && count > 0) throw new Error(`Hi ha ${count} articles amb aquesta categoria. Canvia'ls primer.`);
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setDeleteTarget(null); toast.success('Categoria eliminada'); },
    onError: (err: any) => { toast.error(err.message || 'Error eliminant'); setDeleteTarget(null); },
  });

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20';

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-5">
      <h2 className="text-lg font-semibold text-foreground">Categories d'Articles</h2>

      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-1 bg-muted rounded-lg px-3 py-1.5 text-sm">
            {editingId === cat.id ? (
              <>
                <input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="bg-transparent border-b border-primary text-sm w-24 focus:outline-none" autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && editingName.trim()) renameMutation.mutate({ id: cat.id, name: editingName.trim() }); if (e.key === 'Escape') setEditingId(null); }} />
                <button onClick={() => editingName.trim() && renameMutation.mutate({ id: cat.id, name: editingName.trim() })} className="p-0.5 hover:bg-primary/10 rounded"><Check className="w-3.5 h-3.5 text-primary" /></button>
                <button onClick={() => setEditingId(null)} className="p-0.5 hover:bg-destructive/10 rounded"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">{cat.name}</span>
                <button onClick={() => { setEditingId(cat.id); setEditingName(cat.name); }} className="p-0.5 hover:bg-primary/10 rounded ml-1"><Pencil className="w-3 h-3 text-muted-foreground" /></button>
                <button onClick={() => setDeleteTarget(cat)} className="p-0.5 hover:bg-destructive/10 rounded"><X className="w-3 h-3 text-muted-foreground" /></button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} className={inputClass} placeholder="Nova categoria..."
          onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) addMutation.mutate(newName.trim()); }} />
        <button onClick={() => newName.trim() && addMutation.mutate(newName.trim())} disabled={!newName.trim() || addMutation.isPending}
          className="gradient-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 shadow-md whitespace-nowrap disabled:opacity-60">
          <Plus className="w-4 h-4" /> Afegir
        </button>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar categoria "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Només es pot eliminar si cap article utilitza aquesta categoria.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Company Settings (unchanged) ───────────────────
function CompanySettings() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_settings').select('*').limit(1).single();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('company_settings').update({
        company_name: form.company_name, cif: form.cif, address: form.address,
        town: form.town, phone: form.phone, email: form.email, website: form.website,
      } as any).eq('id', form.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['company-settings'] }); toast.success('Dades guardades'); },
    onError: () => toast.error('Error guardant'),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (settings && !form) setTimeout(() => setForm(settings), 0);
  if (!form) return null;

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20';
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-5">
      <h2 className="text-lg font-semibold text-foreground">Dades de l'Empresa</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className={labelClass}>Nom de l'empresa</label><input value={form.company_name || ''} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className={inputClass} /></div>
        <div><label className={labelClass}>CIF</label><input value={form.cif || ''} onChange={(e) => setForm({ ...form, cif: e.target.value })} className={inputClass} /></div>
        <div className="md:col-span-2"><label className={labelClass}>Adreça</label><input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputClass} /></div>
        <div><label className={labelClass}>Municipi</label><input value={form.town || ''} onChange={(e) => setForm({ ...form, town: e.target.value })} className={inputClass} /></div>
        <div><label className={labelClass}>Telèfon</label><input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} /></div>
        <div><label className={labelClass}>Email</label><input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} /></div>
        <div><label className={labelClass}>Web</label><input value={form.website || ''} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputClass} /></div>
      </div>
      <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
        className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-md flex items-center gap-2 disabled:opacity-60">
        {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}Guardar
      </button>
    </div>
  );
}

function PreferencesSection() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_settings').select('*').limit(1).single();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('company_settings').update({
        default_iva: form.default_iva, default_payment_conditions: form.default_payment_conditions,
        budget_number_format: form.budget_number_format,
      } as any).eq('id', form.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['company-settings'] }); toast.success('Preferències guardades'); },
    onError: () => toast.error('Error guardant'),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (settings && !form) setTimeout(() => setForm(settings), 0);
  if (!form) return null;

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20';
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-5">
      <h2 className="text-lg font-semibold text-foreground">Preferències</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className={labelClass}>Format número pressupost</label><input value={form.budget_number_format || ''} onChange={(e) => setForm({ ...form, budget_number_format: e.target.value })} className={inputClass} /></div>
        <div><label className={labelClass}>IVA per defecte (%)</label><input type="number" value={form.default_iva || ''} onChange={(e) => setForm({ ...form, default_iva: parseFloat(e.target.value) || 0 })} className={inputClass} /></div>
        <div className="md:col-span-2"><label className={labelClass}>Condicions de pagament per defecte</label>
          <textarea value={form.default_payment_conditions || ''} onChange={(e) => setForm({ ...form, default_payment_conditions: e.target.value })} className={cn(inputClass, 'min-h-[100px]')} />
        </div>
        <div><label className={labelClass}>Moneda</label><input value="EUR (€)" disabled className={cn(inputClass, 'opacity-60')} /></div>
      </div>
      <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
        className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-md flex items-center gap-2 disabled:opacity-60">
        {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}Guardar
      </button>
    </div>
  );
}

function UserManagement() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteAction, setDeleteAction] = useState<'deactivate' | 'activate' | 'delete'>('deactivate');
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'comercial' as 'admin' | 'comercial' | 'administrativa' });
  const [newPassword, setNewPassword] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase.from('profiles').select('*').order('created_at');
      if (error) throw error;
      const { data: roles } = await supabase.from('user_roles').select('*');
      return profiles?.map((p: any) => ({
        ...p,
        role: (roles as any[])?.find((r: any) => r.user_id === p.id)?.role || 'comercial',
      })) || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('manage-users', {
        body: { action: 'create', email: form.email, password: form.password, full_name: form.full_name, role: form.role },
      });
      if (res.error) throw res.error;
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users-list'] }); toast.success('Usuari creat correctament'); closeModal(); },
    onError: (err: any) => toast.error(err.message || "Error creant l'usuari"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('manage-users', {
        body: { action: 'update', user_id: editUser.id, full_name: form.full_name, role: form.role, active: editUser.active },
      });
      if (res.error) throw res.error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users-list'] }); toast.success('Usuari actualitzat'); closeModal(); },
    onError: () => toast.error("Error actualitzant"),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('manage-users', {
        body: { action: 'reset_password', user_id: editUser.id, password: newPassword },
      });
      if (res.error) throw res.error;
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { setNewPassword(''); toast.success('Contrasenya actualitzada correctament'); },
    onError: (err: any) => toast.error(err.message || 'Error actualitzant la contrasenya'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await supabase.functions.invoke('manage-users', { body: { action: 'update', user_id: id, active } });
      if (res.error) throw res.error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users-list'] }); toast.success(deleteAction === 'activate' ? 'Usuari activat' : 'Usuari desactivat'); setDeleteId(null); },
    onError: () => toast.error("Error actualitzant l'estat"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await supabase.functions.invoke('manage-users', { body: { action: 'delete_permanent', user_id: id } });
      if (res.error) throw res.error;
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users-list'] }); toast.success('Usuari eliminat'); setDeleteId(null); },
    onError: (err: any) => toast.error(err.message || "Error eliminant"),
  });

  const deleteImpactQuery = useQuery({
    queryKey: ['delete-user-impact', deleteId],
    queryFn: async () => {
      const [{ count: budgets }, { count: obras }] = await Promise.all([
        supabase.from('budgets').select('id', { count: 'exact', head: true }).eq('comercial_id', deleteId as string),
        supabase.from('obras').select('id', { count: 'exact', head: true }).eq('comercial_id', deleteId as string),
      ]);
      return { budgets: budgets || 0, obras: obras || 0 };
    },
    enabled: deleteAction === 'delete' && !!deleteId,
  });

  const openCreate = () => { setForm({ full_name: '', email: '', password: '', role: 'comercial' }); setEditUser(null); setNewPassword(''); setModalOpen(true); };
  const openEdit = (u: any) => { setForm({ full_name: u.full_name, email: u.email, password: '', role: u.role }); setEditUser(u); setNewPassword(''); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditUser(null); setNewPassword(''); };
  const newPasswordValid = !newPassword || newPassword.length >= 6;

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20';
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Gestió d'Usuaris</h2>
        <button onClick={openCreate} className="gradient-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 shadow-md">
          <Plus className="w-4 h-4" /> Nou Usuari
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Nom</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Rol</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Estat</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Accions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{u.full_name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                      u.role === 'admin' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    )}>
                      {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {u.role === 'admin' ? 'Admin' : 'Comercial'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                      u.active ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                    )}>
                      {u.active ? 'Actiu' : 'Inactiu'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 rounded-md hover:bg-muted" onClick={() => openEdit(u)}><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                      {u.active ? (
                        <>
                          <button className="p-1.5 rounded-md hover:bg-destructive/10" title="Desactivar"
                            onClick={() => { setDeleteAction('deactivate'); setDeleteId(u.id); }}>
                            <UserX className="w-4 h-4 text-destructive" />
                          </button>
                          <button className="p-1.5 rounded-md hover:bg-destructive/10" title="Eliminar permanentment"
                            onClick={() => { setDeleteAction('delete'); setDeleteId(u.id); }}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="p-1.5 rounded-md hover:bg-success/10" title="Activar"
                            onClick={() => { setDeleteAction('activate'); setDeleteId(u.id); }}>
                            <Check className="w-4 h-4 text-success" />
                          </button>
                          <button className="p-1.5 rounded-md hover:bg-destructive/10" title="Eliminar permanentment"
                            onClick={() => { setDeleteAction('delete'); setDeleteId(u.id); }}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="py-8 text-center"><p className="text-muted-foreground">Encara no hi ha usuaris</p></div>
          )}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editUser ? 'Editar Usuari' : 'Nou Usuari'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><label className={labelClass}>Nom complet *</label><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputClass} /></div>
            {!editUser && (
              <>
                <div><label className={labelClass}>Email *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} /></div>
                <div><label className={labelClass}>Contrasenya inicial * (mínim 8 caràcters)</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} /></div>
              </>
            )}
            {editUser && (
              <div>
                <label className={labelClass}>Nova contrasenya</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Deixa en blanc per no canviar-la" className={inputClass} />
                {!newPasswordValid && <p className="text-xs text-destructive mt-1">La contrasenya ha de tenir com a mínim 6 caràcters</p>}
              </div>
            )}
            <div>
              <label className={labelClass}>Rol</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })} className={inputClass}>
                <option value="comercial">Comercial</option>
                <option value="administrativa">Administrativa</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <button
              onClick={() => {
                if (editUser) {
                  updateMutation.mutate();
                  if (newPassword) resetPasswordMutation.mutate();
                } else {
                  createMutation.mutate();
                }
              }}
              disabled={!form.full_name || (!editUser && (!form.email || form.password.length < 8)) || (!!editUser && !newPasswordValid) || createMutation.isPending || updateMutation.isPending || resetPasswordMutation.isPending}
              className="w-full gradient-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 shadow-md flex items-center justify-center gap-2 disabled:opacity-60">
              {(createMutation.isPending || updateMutation.isPending || resetPasswordMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              {editUser ? 'Guardar canvis' : 'Crear usuari'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteAction === 'activate' ? 'Activar usuari?' : deleteAction === 'delete' ? 'Eliminar usuari permanentment?' : 'Desactivar usuari?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAction === 'activate'
                ? "L'usuari podrà tornar a accedir a l'aplicació."
                : deleteAction === 'delete'
                ? (deleteImpactQuery.isLoading
                    ? "Comprovant pressupostos i obres assignades…"
                    : deleteImpactQuery.data && (deleteImpactQuery.data.budgets > 0 || deleteImpactQuery.data.obras > 0)
                    ? `Aquest usuari té ${deleteImpactQuery.data.budgets} pressupost${deleteImpactQuery.data.budgets === 1 ? '' : 's'} i ${deleteImpactQuery.data.obras} obra${deleteImpactQuery.data.obras === 1 ? '' : 's'} assignades. Si l'elimines permanentment, quedaran sense comercial assignat i aquesta acció no es pot desfer. Vols continuar?`
                    : "Aquesta acció no es pot desfer. L'usuari serà eliminat completament del sistema.")
                : "L'usuari ja no podrà accedir a l'aplicació. Podràs reactivar-lo posteriorment."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteAction === 'delete' && deleteImpactQuery.isLoading}
              onClick={() => {
                if (!deleteId) return;
                if (deleteAction === 'activate') toggleActiveMutation.mutate({ id: deleteId, active: true });
                else if (deleteAction === 'deactivate') toggleActiveMutation.mutate({ id: deleteId, active: false });
                else deleteMutation.mutate(deleteId);
              }}>
              {deleteAction === 'activate' ? 'Activar' : deleteAction === 'delete' ? 'Eliminar' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StairImagesSection() {
  const queryClient = useQueryClient();
  const stairTypes = ['Escala Estàndard', 'Escala amb Plataforma', 'Escala amb Banc', 'Escala a Tot l\'Ample'];

  const { data: images = [], isLoading } = useQuery({
    queryKey: ['stair-images'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stair_images').select('*');
      if (error) throw error;
      return data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ type, file }: { type: string; file: File }) => {
      const ext = file.name.split('.').pop();
      const slug = type
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip diacritics (à -> a)
        .replace(/['’`]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
      const path = `${slug}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('stair-images').upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('stair-images').getPublicUrl(path);
      const existing = images.find((i: any) => i.stair_type === type);
      if (existing) {
        const { error } = await supabase.from('stair_images').update({ image_url: urlData.publicUrl } as any).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('stair_images').insert({ stair_type: type, image_url: urlData.publicUrl } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['stair-images'] }); toast.success('Imatge actualitzada'); },
    onError: (err: any) => {
      console.error('[stair-image upload]', err);
      toast.error(`Error pujant la imatge: ${err?.message || 'desconegut'}`);
    },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-5">
      <h2 className="text-lg font-semibold text-foreground">Imatges Escales Interiors</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stairTypes.map((type) => {
          const img = images.find((i: any) => i.stair_type === type);
          return (
            <div key={type} className="border border-border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">{type}</p>
              {img?.image_url ? (
                <img src={img.image_url} alt={type} className="w-full h-32 object-contain rounded bg-muted" />
              ) : (
                <div className="w-full h-32 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">Sense imatge</div>
              )}
              <label className="block">
                <span className="text-xs text-primary font-medium cursor-pointer hover:underline">Canviar imatge</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadMutation.mutate({ type, file: e.target.files[0] }); }} />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Autoportant Transport Section ──────────────────
function AutoportantTransportSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['autoportant_transport_config'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('autoportant_transport_config').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
  const [form, setForm] = useState<any>(null);
  const current = form ?? data;

  const save = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await (supabase as any)
        .from('autoportant_transport_config').update(patch).eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configuració desada');
      queryClient.invalidateQueries({ queryKey: ['autoportant_transport_config'] });
      setForm(null);
    },
    onError: (e: any) => toast.error(e?.message || 'Error'),
  });

  if (isLoading || !current) return <div className="text-muted-foreground">Carregant…</div>;

  const upd = (k: string, v: any) => setForm({ ...(form ?? data), [k]: v });
  const inputCls = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm';

  return (
    <div className="space-y-4 pt-2">
      <div>
        <h3 className="text-base font-semibold text-foreground">Configuració del transport</h3>
        <p className="text-sm text-muted-foreground">
          El sistema calcula els km des de l'adreça del proveïdor fins a l'adreça de l'obra i aplica: quota base + €/km segons l'ample de la piscina. El venda s'obté multiplicant el coste pel marge configurat.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          <span className="block text-muted-foreground mb-1">Adreça del proveïdor</span>
          <input className={inputCls} value={current.provider_address || ''}
            onChange={(e) => upd('provider_address', e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="block text-muted-foreground mb-1">Quota base (€)</span>
          <input type="number" step="0.01" className={inputCls}
            value={(Number(current.base_fee_cents) || 0) / 100}
            onChange={(e) => upd('base_fee_cents', Math.round(Number(e.target.value) * 100))} />
        </label>
        <label className="text-sm">
          <span className="block text-muted-foreground mb-1">€/km ample &lt; {Number(current.narrow_width_threshold_m)} m</span>
          <input type="number" step="0.01" className={inputCls}
            value={(Number(current.rate_narrow_cents_per_km) || 0) / 100}
            onChange={(e) => upd('rate_narrow_cents_per_km', Math.round(Number(e.target.value) * 100))} />
        </label>
        <label className="text-sm">
          <span className="block text-muted-foreground mb-1">€/km ample entre {Number(current.narrow_width_threshold_m)} i {Number(current.wide_width_threshold_m)} m</span>
          <input type="number" step="0.01" className={inputCls}
            value={(Number(current.rate_wide_cents_per_km) || 0) / 100}
            onChange={(e) => upd('rate_wide_cents_per_km', Math.round(Number(e.target.value) * 100))} />
        </label>
        <label className="text-sm">
          <span className="block text-muted-foreground mb-1">Llindar ample estret (m)</span>
          <input type="number" step="0.01" className={inputCls}
            value={Number(current.narrow_width_threshold_m) || 0}
            onChange={(e) => upd('narrow_width_threshold_m', Number(e.target.value))} />
        </label>
        <label className="text-sm">
          <span className="block text-muted-foreground mb-1">Llindar ample ampli (m)</span>
          <input type="number" step="0.01" className={inputCls}
            value={Number(current.wide_width_threshold_m) || 0}
            onChange={(e) => upd('wide_width_threshold_m', Number(e.target.value))} />
        </label>
        <label className="text-sm">
          <span className="block text-muted-foreground mb-1">Marge de venda (multiplicador)</span>
          <input type="number" step="0.01" className={inputCls}
            value={Number(current.margin_multiplier) || 0}
            onChange={(e) => upd('margin_multiplier', Number(e.target.value))} />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        {form && (
          <button className="px-4 py-2 text-sm rounded-lg border border-border"
            onClick={() => setForm(null)}>Cancel·lar</button>
        )}
        <button
          disabled={!form || save.isPending}
          onClick={() => save.mutate(form)}
          className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
          {save.isPending ? 'Desant…' : 'Desar canvis'}
        </button>
      </div>
    </div>
  );
}

// ── Cobertor Images Section ─────────────────────────
function CobertorImagesSection() {
  const queryClient = useQueryClient();

  const { data: models = [], isLoading: loadingModels } = useQuery({
    queryKey: ['cover_models'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cover_models').select('*').order('cover_type').order('order_index');
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: colors = [], isLoading: loadingColors } = useQuery({
    queryKey: ['cover_colors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cover_colors').select('*').order('material').order('order_index');
      if (error) throw error;
      return data as any[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ kind, id, slug, file }: { kind: 'model' | 'color'; id: string; slug: string; file: File }) => {
      const ext = file.name.split('.').pop();
      const path = `${kind}-${slug}.${ext}`;
      const { error: upErr } = await supabase.storage.from('cover-images').upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('cover-images').getPublicUrl(path);
      const table = kind === 'model' ? 'cover_models' : 'cover_colors';
      const { error } = await supabase.from(table).update({ image_url: urlData.publicUrl } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: [vars.kind === 'model' ? 'cover_models' : 'cover_colors'] });
      toast.success('Imatge actualitzada');
    },
    onError: (err: any) => toast.error(`Error pujant la imatge: ${err?.message || 'desconegut'}`),
  });

  if (loadingModels || loadingColors) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const foraAigua = models.filter((m) => m.cover_type === 'fora_aigua');
  const submergit = models.filter((m) => m.cover_type === 'submergit');
  const pvc = colors.filter((c) => c.material === 'pvc');
  const poli = colors.filter((c) => c.material === 'policarbonat');

  const renderCard = (kind: 'model' | 'color', item: any, slug: string) => (
    <div key={item.id} className="border border-border rounded-lg p-3 space-y-2">
      {item.image_url ? (
        <img src={item.image_url} alt={item.name} className="w-full h-28 object-cover rounded bg-muted" />
      ) : (
        <div className="w-full h-28 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">Sense imatge</div>
      )}
      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
      <label className="block">
        <span className="text-xs text-primary font-medium cursor-pointer hover:underline">Canviar imatge</span>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadMutation.mutate({ kind, id: item.id, slug, file: e.target.files[0] }); }} />
      </label>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-5">
        <h2 className="text-lg font-semibold text-foreground">Models — Cobertes fora de l'aigua</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {foraAigua.map((m) => renderCard('model', m, m.code))}
        </div>
      </div>
      <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-5">
        <h2 className="text-lg font-semibold text-foreground">Models — Cobertes submergides</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {submergit.map((m) => renderCard('model', m, m.code))}
        </div>
      </div>
      <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-5">
        <h2 className="text-lg font-semibold text-foreground">Colors — Lames PVC 83 mm</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {pvc.map((c) => renderCard('color', c, c.code))}
        </div>
      </div>
      <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-5">
        <h2 className="text-lg font-semibold text-foreground">Colors — Lames Policarbonat 83 mm</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {poli.map((c) => renderCard('color', c, c.code))}
        </div>
      </div>
    </div>
  );
}

// ── Cobertor Prices Section ─────────────────────────
function CobertorPricesSection() {
  const queryClient = useQueryClient();
  const widths = [3, 3.5, 4, 4.5, 5, 5.5, 6];

  const { data: models = [] } = useQuery({
    queryKey: ['cover_models'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cover_models').select('*').order('cover_type').order('order_index');
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: modelPrices = [] } = useQuery({
    queryKey: ['cover_model_prices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cover_model_prices').select('*');
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: lamaPrices = [] } = useQuery({
    queryKey: ['cover_lama_prices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cover_lama_prices').select('*');
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['cover_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cover_settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from('cover_settings').update(patch).eq('id', settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Constants actualitzades');
      queryClient.invalidateQueries({ queryKey: ['cover_settings'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const upsertModelPrice = useMutation({
    mutationFn: async (row: { model_id: string; width_m: number; price_eur: number; max_length_m: number }) => {
      const existing = modelPrices.find((p) => p.model_id === row.model_id && Number(p.width_m) === row.width_m);
      if (existing) {
        const { error } = await supabase.from('cover_model_prices').update({ price_eur: row.price_eur, max_length_m: row.max_length_m }).eq('id', existing.id);
        if (error) throw error;
      } else if (row.price_eur > 0) {
        const { error } = await supabase.from('cover_model_prices').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Preu desat');
      queryClient.invalidateQueries({ queryKey: ['cover_model_prices'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const upsertLamaPrice = useMutation({
    mutationFn: async (row: { material: string; width_m: number; price_per_m: number }) => {
      const existing = lamaPrices.find((p) => p.material === row.material && Number(p.width_m) === row.width_m);
      if (existing) {
        const { error } = await supabase.from('cover_lama_prices').update({ price_per_m: row.price_per_m }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cover_lama_prices').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Preu lama desat');
      queryClient.invalidateQueries({ queryKey: ['cover_lama_prices'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!settings) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* FORMULA + CONSTANTS */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Fórmula global del cobertor</h2>
          <p className="text-sm text-muted-foreground mt-1">Aquesta és la fórmula que s'aplica a tots els pressupostos:</p>
        </div>
        <div className="rounded-lg bg-muted/50 border border-border p-4 font-mono text-sm text-foreground">
          TOTAL = <span className="text-primary font-bold">Estructura(model, ample)</span> + <span className="text-primary font-bold">Preu_lama(material, ample) × llarg</span> + Embalatge + Transport + Instal·lació
        </div>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>L'<strong>ample</strong> de la piscina s'arrodoneix sempre cap amunt al següent tram estàndard (3 / 3.5 / 4 / 4.5 / 5 / 5.5 / 6 m).</li>
          <li>El <strong>llarg</strong> s'arrodoneix sempre cap amunt al metre sencer més proper (8.5 m → 9 m).</li>
          <li>Cada model té un llarg màxim. Si la piscina el supera, es notifica i es proposa marcar "pressupost personalitzat".</li>
          <li>El <strong>cost</strong> s'obté multiplicant la venda pel factor de cost (per defecte 0.55, és a dir un 45% de descompte).</li>
        </ul>

        <h3 className="text-sm font-semibold text-foreground pt-2 border-t border-border">Constants editables</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { key: 'embalatge_eur', label: 'Embalatge (€)' },
            { key: 'transport_eur', label: 'Transport (€)' },
            { key: 'installation_fora_aigua_eur', label: 'Instal·lació fora aigua (€)' },
            { key: 'installation_submergit_eur', label: 'Instal·lació submergit (€)' },
            { key: 'cost_factor', label: 'Factor cost (0–1)' },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-xs text-muted-foreground mb-1">{f.label}</label>
              <input
                type="number"
                step={f.key === 'cost_factor' ? 0.01 : 1}
                defaultValue={settings[f.key]}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (Number(settings[f.key]) !== v) updateSettings.mutate({ [f.key]: v });
                }}
                className="w-full px-2 py-1.5 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
          ))}
        </div>
      </div>

      {/* LAMA PRICES */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Preus per metre de lames</h2>
        <p className="text-xs text-muted-foreground">Preu €/m segons l'ample arrodonit de la piscina. El multiplicador és el llarg arrodonit cap amunt.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 font-semibold text-foreground">Material</th>
                {widths.map((w) => <th key={w} className="text-center p-2 font-semibold text-foreground">{w} m</th>)}
              </tr>
            </thead>
            <tbody>
              {(['pvc','policarbonat'] as const).map((mat) => (
                <tr key={mat} className="border-b border-border/50">
                  <td className="p-2 font-medium capitalize text-foreground">{mat === 'pvc' ? 'PVC 83 mm' : 'Policarbonat 83 mm'}</td>
                  {widths.map((w) => {
                    const row = lamaPrices.find((p) => p.material === mat && Number(p.width_m) === w);
                    return (
                      <td key={w} className="p-1">
                        <input
                          type="number"
                          step={1}
                          defaultValue={row?.price_per_m ?? ''}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (!isNaN(v) && v !== Number(row?.price_per_m ?? -1)) {
                              upsertLamaPrice.mutate({ material: mat, width_m: w, price_per_m: v });
                            }
                          }}
                          className="w-20 px-2 py-1 text-right rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODEL PRICES */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Preus base d'estructura per model</h2>
        <p className="text-xs text-muted-foreground">Deixa el preu en blanc o a 0 si el model no admet aquell ample. Llarg màx. = limit en metres de la piscina.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-2 font-semibold text-foreground sticky left-0 bg-muted/30">Model</th>
                <th className="text-center p-2 font-semibold text-foreground">Tipus</th>
                <th className="text-center p-2 font-semibold text-foreground">Llarg màx.</th>
                {widths.map((w) => <th key={w} className="text-center p-2 font-semibold text-foreground">{w} m</th>)}
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const rows = modelPrices.filter((p) => p.model_id === m.id);
                const maxL = rows.length > 0 ? Math.max(...rows.map((r) => Number(r.max_length_m))) : 10;
                return (
                  <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-2 font-medium text-foreground sticky left-0 bg-card">{m.name}</td>
                    <td className="p-2 text-center text-xs text-muted-foreground">{m.cover_type === 'submergit' ? 'Submergit' : 'Fora aigua'}</td>
                    <td className="p-1 text-center">
                      <input
                        type="number"
                        step={1}
                        defaultValue={maxL}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (!isNaN(v) && v !== maxL) {
                            // Update all rows for this model
                            rows.forEach((r) => {
                              upsertModelPrice.mutate({ model_id: m.id, width_m: Number(r.width_m), price_eur: Number(r.price_eur), max_length_m: v });
                            });
                          }
                        }}
                        className="w-16 px-2 py-1 text-right rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                      />
                    </td>
                    {widths.map((w) => {
                      const r = rows.find((p) => Number(p.width_m) === w);
                      return (
                        <td key={w} className="p-1">
                          <input
                            type="number"
                            step={1}
                            defaultValue={r?.price_eur ?? ''}
                            placeholder="—"
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (!isNaN(v) && v !== Number(r?.price_eur ?? -1)) {
                                upsertModelPrice.mutate({ model_id: m.id, width_m: w, price_eur: v, max_length_m: r?.max_length_m ?? maxL });
                              }
                            }}
                            className="w-20 px-2 py-1 text-right rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Autoportant Prices Section ─────────────────────
type AutoportantModelKey = 'line_confort' | 'line_luxe' | 'line_luxe_plus';
const AUTOPORTANT_MODEL_LABELS_UI: Record<AutoportantModelKey, string> = {
  line_confort: 'LINE CONFORT',
  line_luxe: 'LINE LUXE',
  line_luxe_plus: 'LINE LUXE PLUS',
};

interface AutoportantPriceRow {
  id: string;
  model: AutoportantModelKey;
  altura_aigua_m: number;
  altura_total_m: number;
  ample_m: number;
  llarg_m: number;
  cost_price: number;
  sale_price: number;
}

function AutoportantPricesSection() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AutoportantModelKey | 'transport'>('line_confort');
  const model = (tab === 'transport' ? 'line_confort' : tab) as AutoportantModelKey;
  const [bulkPct, setBulkPct] = useState<string>('');
  const [bulkTarget, setBulkTarget] = useState<'both' | 'cost' | 'sale'>('both');
  const [bulkScope, setBulkScope] = useState<'model' | 'all'>('model');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['autoportant_prices_admin'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('autoportant_prices')
        .select('*')
        .order('model')
        .order('altura_aigua_m')
        .order('ample_m')
        .order('llarg_m');
      if (error) throw error;
      return (data || []) as AutoportantPriceRow[];
    },
  });

  const updateOne = useMutation({
    mutationFn: async (row: { id: string; cost_price?: number; sale_price?: number }) => {
      const { id, ...patch } = row;
      const { error } = await (supabase as any).from('autoportant_prices').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['autoportant_prices_admin'] }),
    onError: (e: any) => toast.error(e.message || 'Error guardant'),
  });

  const bulkApply = useMutation({
    mutationFn: async () => {
      const pct = Number(bulkPct);
      if (!pct || isNaN(pct)) throw new Error('Introdueix un percentatge');
      const factor = 1 + pct / 100;
      const affected = rows.filter((r) => (bulkScope === 'all' ? true : r.model === model));
      const updates = affected.map((r) => {
        const patch: any = {};
        if (bulkTarget !== 'sale') patch.cost_price = Number((Number(r.cost_price) * factor).toFixed(2));
        if (bulkTarget !== 'cost') patch.sale_price = Number((Number(r.sale_price) * factor).toFixed(2));
        return (supabase as any).from('autoportant_prices').update(patch).eq('id', r.id);
      });
      const results = await Promise.all(updates);
      const err = results.find((r: any) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => {
      toast.success('Percentatge aplicat');
      setBulkPct('');
      queryClient.invalidateQueries({ queryKey: ['autoportant_prices_admin'] });
    },
    onError: (e: any) => toast.error(e.message || 'Error aplicant'),
  });

  const modelRows = rows.filter((r) => r.model === model);
  const inputClass = 'w-24 px-2 py-1 text-right rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20';

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Preus Piscines Autoportants</h2>
          <p className="text-xs text-muted-foreground mt-1">Preus de cost i venda per model, altura d'aigua, ample i llarg. En generar un pressupost, el sistema aplica el preu que coincideixi amb les mides seleccionades.</p>
        </div>

        {/* Model tabs */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(AUTOPORTANT_MODEL_LABELS_UI) as AutoportantModelKey[]).map((m) => (
            <button
              key={m}
              onClick={() => setTab(m)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                tab === m
                  ? 'gradient-primary text-primary-foreground border-transparent shadow-md'
                  : 'bg-background border-border text-foreground hover:bg-muted'
              )}
            >
              {AUTOPORTANT_MODEL_LABELS_UI[m]} <span className="opacity-60">({rows.filter((r) => r.model === m).length})</span>
            </button>
          ))}
          <button
            key="transport"
            onClick={() => setTab('transport')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
              tab === 'transport'
                ? 'gradient-primary text-primary-foreground border-transparent shadow-md'
                : 'bg-background border-border text-foreground hover:bg-muted'
            )}
          >
            Transport
          </button>
        </div>

        {tab === 'transport' ? (
          <AutoportantTransportSection />
        ) : (
        <>
        {/* Bulk % */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Ajust massiu per percentatge</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">% (ex: 5 o -10)</label>
              <input type="number" step={0.1} value={bulkPct} onChange={(e) => setBulkPct(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Aplicar a</label>
              <select value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value as any)} className="px-2 py-1.5 rounded-md border border-input bg-background text-sm">
                <option value="both">Coste i venda</option>
                <option value="cost">Només coste</option>
                <option value="sale">Només venda</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Abast</label>
              <select value={bulkScope} onChange={(e) => setBulkScope(e.target.value as any)} className="px-2 py-1.5 rounded-md border border-input bg-background text-sm">
                <option value="model">Només {AUTOPORTANT_MODEL_LABELS_UI[model]}</option>
                <option value="all">Tots els models</option>
              </select>
            </div>
            <button
              onClick={() => bulkApply.mutate()}
              disabled={bulkApply.isPending || !bulkPct}
              className="gradient-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 shadow-md disabled:opacity-60"
            >
              {bulkApply.isPending && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />} Aplicar
            </button>
          </div>
        </div>

        {/* Table */}
        {modelRows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Encara no hi ha preus per aquest model.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-center p-2 font-semibold">Altura aigua</th>
                  <th className="text-center p-2 font-semibold">Altura total</th>
                  <th className="text-center p-2 font-semibold">Ample</th>
                  <th className="text-center p-2 font-semibold">Llarg</th>
                  <th className="text-center p-2 font-semibold">Cost (€)</th>
                  <th className="text-center p-2 font-semibold">Venda (€)</th>
                </tr>
              </thead>
              <tbody>
                {modelRows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-2 text-center">{Number(r.altura_aigua_m).toFixed(2)} m</td>
                    <td className="p-2 text-center">{Number(r.altura_total_m).toFixed(2)} m</td>
                    <td className="p-2 text-center">{Number(r.ample_m).toFixed(2)} m</td>
                    <td className="p-2 text-center">{Number(r.llarg_m).toFixed(2)} m</td>
                    <td className="p-1 text-center">
                      <input
                        type="number"
                        step={0.01}
                        defaultValue={Number(r.cost_price)}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (!isNaN(v) && v !== Number(r.cost_price)) updateOne.mutate({ id: r.id, cost_price: v });
                        }}
                        className={inputClass}
                      />
                    </td>
                    <td className="p-1 text-center">
                      <input
                        type="number"
                        step={0.01}
                        defaultValue={Number(r.sale_price)}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (!isNaN(v) && v !== Number(r.sale_price)) updateOne.mutate({ id: r.id, sale_price: v });
                        }}
                        className={inputClass}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
