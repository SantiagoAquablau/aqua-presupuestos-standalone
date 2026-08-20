import { useState, useRef } from 'react';
import { Search, Plus, Package, Pencil, Trash2, Loader2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const units = ['ud', 'm²', 'm³', 'ml', 'l', 'kg'];
const acabatCategories = ['Coronament', 'Gressite', 'Porcelànic'];

interface ArticleForm {
  name: string;
  reference: string;
  supplier_id: string;
  category: string;
  cost_price: number;
  sale_price: number;
  sale_price_supply_only: number;
  unit: string;
  format: string;
  quality: string;
  acabat_type: string;
  image_url: string;
  subtipus: string;
  technical_specs: Record<string, number | string | boolean | null>;
  beurada_color: string;
  beurada_color_normal: string;
  beurada_color_epoxi: string;
  fase: string;
  linia_preferent: boolean;
}

const subtipusOptions: Record<string, string[]> = {
  'Filtració': ['Polièster', 'Especial (diatomees/cartutx)', 'Canvi de medi filtrant', 'Components filtració'],
  'Bomba': ['On/Off', 'Velocitat variable', 'Soplants'],
  'Dosificació': ['Estàndard (pH/Cl)', 'Hidròlisi / UV', 'Mòdul connectivitat', 'Components dosificació'],
  'Elèctric': ['Quadre elèctric', 'Material elèctric', 'Altres'],
  'Accessoris': ['Impulsors', 'Skimmers', 'Embornal', 'Focus LED', 'Projectors Mini LED', 'Control RGB', 'Regulador de nivell', 'Presa netejafons', 'Escala inox', 'Dutxa exterior', 'Plat de dutxa', 'Cascada', 'Pulsador piezoelèctric', 'Salvavides + Suport paret', 'Barana'],
  'Varis': ['Cobertors', 'Robots', 'Bombes de calor', "Projecte d'obra", 'Gespa', 'Paviment perimetral'],
};

const emptyForm: ArticleForm = { name: '', reference: '', supplier_id: '', category: 'Varis', cost_price: 0, sale_price: 0, sale_price_supply_only: 0, unit: 'ud', format: '', quality: '', acabat_type: '', image_url: '', subtipus: '', technical_specs: {}, beurada_color: '', beurada_color_normal: '', beurada_color_epoxi: '', fase: '', linia_preferent: false };

type TechSpecField = {
  key: string;
  label: string;
  step: string;
  integer?: boolean;
  type?: 'number' | 'text' | 'boolean';
  placeholder?: string;
};

type TechSpecConfig = { title: string; fields: TechSpecField[]; columns?: 1 | 2 };

function getTechSpecConfig(category: string, subtipus: string): TechSpecConfig | null {
  if (category === 'Filtració' && subtipus === 'Polièster') {
    return {
      title: 'Especificacions tècniques del filtre',
      fields: [
        { key: 'diametro_mm', label: 'Diàmetre (mm)', step: '1', integer: true },
        { key: 'area_m2', label: 'Àrea filtrant (m²)', step: '0.01' },
        { key: 'caudal_min_m3h', label: 'Caudal mínim (m³/h)', step: '0.1' },
        { key: 'caudal_max_m3h', label: 'Caudal màxim (m³/h)', step: '0.1' },
        { key: 'caudal_lavado_m3h', label: 'Caudal rentat (m³/h)', step: '0.1' },
      ],
    };
  }
  if (category === 'Bomba' && subtipus === 'On/Off') {
    return {
      title: 'Especificacions tècniques de la bomba',
      fields: [
        { key: 'caudal_m3h', label: 'Caudal màxim (m³/h)', step: '0.1' },
        { key: 'cv', label: 'Potència (CV)', step: '0.01' },
        { key: 'conexion_mm', label: 'Connexió (mm)', step: '1', integer: true },
      ],
    };
  }
  if (category === 'Bomba' && subtipus === 'Velocitat variable') {
    return {
      title: 'Especificacions tècniques de la bomba',
      fields: [
        { key: 'qmax_m3h', label: 'Qmax (m³/h)', step: '0.1' },
        { key: 'caudal_8m', label: 'Caudal @ 8m (m³/h)', step: '0.1' },
        { key: 'caudal_10m', label: 'Caudal @ 10m (m³/h)', step: '0.1' },
        { key: 'hmax_m', label: 'Alçada màxima / Hmax (m)', step: '0.1' },
        { key: 'p1_kw', label: 'Potència P1 (kW)', step: '0.01' },
        { key: 'cv_equivalent', label: 'Potència equivalent (CV)', step: '0.01' },
      ],
    };
  }
  if (category === 'Dosificació' && subtipus === 'Estàndard (pH/Cl)') {
    return {
      title: "Característiques (targeta de recomanació al PDF)",
      columns: 1,
      fields: [
        // Nota: la connexió WI-FI NO es demana com a característica manual —
        // es gestiona a part (toggle del wizard + wifi_incorporat més avall),
        // per evitar duplicar/contradir el bullet automàtic al PDF.
        { key: 'feature1', label: 'Característica 1', step: '', type: 'text', placeholder: 'Pantalla tàctil extraïble.' },
        { key: 'feature2', label: 'Característica 2', step: '', type: 'text', placeholder: "Control de salinitat de l'aigua." },
        { key: 'feature3', label: 'Característica 3', step: '', type: 'text', placeholder: 'Control de producció i bomba de filtració.' },
        { key: 'garantia_cellula_hores', label: 'Garantia cèl·lula (hores)', step: '1', integer: true, placeholder: '8000' },
        { key: 'wifi_incorporat', label: 'Wi-Fi incorporat (l\'equip ja el porta de sèrie, no cal mòdul a part)', step: '', type: 'boolean' },
        // Independent de wifi_incorporat: marca els equips (p.ex. Plus NG) on,
        // tot i mostrar-se al client com a Wi-Fi incorporat, internament cal
        // comprar/instal·lar igualment el mòdul físic — genera una partida
        // normal (sumada al total) sense toggle ni text visible al PDF.
        { key: 'wifi_modul_compra_interna', label: 'Cal comprar mòdul Wi-Fi internament (encara que sigui "incorporat" de cara al client)', step: '', type: 'boolean' },
      ],
    };
  }
  if (category === 'Accessoris' && subtipus === 'Cascada') {
    return {
      title: 'Especificacions tècniques de la cascada',
      fields: [
        // Exposat al Motor de Càlcul com a condició acc_cascada_encastada,
        // per poder condicionar-hi partides (p.ex. "MANO DE OBRA PALETERIA").
        { key: 'encastada', label: 'Cascada encastada', step: '', type: 'boolean' },
        // Diàmetre d'aspiració de la cascada — determina el text de canonada
        // i accessoris PVC mostrat a la pàgina de Cascada del PDF.
        { key: 'diametre_mm', label: "Diàmetre d'aspiració (mm)", step: '1', integer: true, placeholder: '50' },
      ],
    };
  }
  return null;
}

export default function Cataleg() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tots');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ArticleForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['articles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('articles').select('*, suppliers:supplier_id(name)').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const categoryNames = categories.map((c) => c.name);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('article-images').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('article-images').getPublicUrl(path);
      setForm({ ...form, image_url: urlData.publicUrl });
      toast.success('Imatge pujada');
    } catch {
      toast.error('Error pujant la imatge');
    } finally {
      setUploading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        reference: form.reference,
        supplier_id: form.supplier_id || null,
        category: form.category,
        cost_price: Math.round(form.cost_price * 100),
        sale_price: Math.round(form.sale_price * 100),
        sale_price_supply_only: Math.round(form.sale_price_supply_only * 100),
        unit: form.unit,
        format: form.format || '',
        quality: form.quality || null,
        acabat_type: form.acabat_type || null,
        image_url: form.image_url || '',
        subtipus: form.subtipus || null,
        technical_specs: (() => {
          const cfg = getTechSpecConfig(form.category, form.subtipus);
          if (!cfg) return null;
          const cleaned: Record<string, number | string | boolean> = {};
          for (const [k, v] of Object.entries(form.technical_specs || {})) {
            if (typeof v === 'number' && !Number.isNaN(v)) cleaned[k] = v;
            else if (typeof v === 'string' && v.trim() !== '') cleaned[k] = v.trim();
            else if (typeof v === 'boolean') cleaned[k] = v;
          }
          return Object.keys(cleaned).length ? cleaned : null;
        })(),
        beurada_color: form.category === 'Coronament' ? (form.beurada_color || null) : null,
        beurada_color_normal: form.category === 'Porcelànic' ? (form.beurada_color_normal || null) : null,
        beurada_color_epoxi: form.category === 'Porcelànic' ? (form.beurada_color_epoxi || null) : null,
        fase: form.category === 'Bomba' ? (form.fase || null) : null,
        linia_preferent:
          form.category === 'Bomba' || (form.category === 'Dosificació' && form.subtipus === 'Estàndard (pH/Cl)')
            ? form.linia_preferent
            : false,
      };
      if (editId) {
        const { error } = await supabase.from('articles').update(payload as any).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('articles').insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      toast.success(editId ? 'Article actualitzat' : 'Article creat correctament');
      closeModal();
    },
    onError: () => toast.error("Error guardant l'article"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('articles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      toast.success('Article eliminat');
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast.error(err?.message?.includes('foreign key') ? "No es pot eliminar: s'utilitza en pressupostos existents" : "Error eliminant l'article");
      setDeleteId(null);
    },
  });

  const openCreate = () => { setForm(emptyForm); setEditId(null); setModalOpen(true); };
  const openEdit = (a: any) => {
    setForm({
      name: a.name,
      reference: a.reference || '',
      supplier_id: a.supplier_id || '',
      category: a.category,
      cost_price: (a.cost_price || 0) / 100,
      sale_price: (a.sale_price || 0) / 100,
      sale_price_supply_only: (a.sale_price_supply_only || 0) / 100,
      unit: a.unit,
      format: a.format || '',
      quality: a.quality || '',
      acabat_type: a.acabat_type || '',
      image_url: a.image_url || '',
      subtipus: a.subtipus || '',
      technical_specs: (a.technical_specs && typeof a.technical_specs === 'object') ? a.technical_specs : {},
        beurada_color: a.beurada_color || '',
        beurada_color_normal: (a as any).beurada_color_normal || '',
        beurada_color_epoxi: (a as any).beurada_color_epoxi || '',
        fase: (a as any).fase || '',
        linia_preferent: !!(a as any).linia_preferent,
    });
    setEditId(a.id);
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditId(null); setForm(emptyForm); };

  const filtered = articles.filter((a: any) => {
    const matchSearch = !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.reference?.toLowerCase().includes(search.toLowerCase()) || (a.suppliers as any)?.name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'Tots' || a.category === category;
    return matchSearch && matchCat;
  });

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20';
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Catàleg d'Articles</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} articles</p>
        </div>
        <button onClick={openCreate} className="gradient-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md">
          <Plus className="w-4 h-4" /> Nou Article
        </button>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Cercar per nom, referència o proveïdor..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/20" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {['Tots', ...categoryNames].map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={cn('px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border',
                category === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:bg-muted'
              )}>{c}</button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="hidden lg:block bg-card rounded-xl border border-border overflow-hidden shadow-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-2 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-10"></th>
                  <th className="text-left px-2 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[40%]">Article</th>
                  <th className="text-left px-2 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-20">Ref.</th>
                  <th className="text-left px-2 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proveïdor</th>
                  <th className="text-left px-2 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categoria</th>
                  <th className="text-right px-2 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">P. Cost</th>
                  <th className="text-right px-2 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">P. Venda</th>
                  <th className="text-right px-2 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Marge</th>
                  <th className="text-center px-2 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ud.</th>
                  <th className="text-right px-2 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((a: any) => {
                  const cost = (a.cost_price || 0) / 100;
                  const sale = (a.sale_price || 0) / 100;
                  const margin = sale > 0 ? ((sale - cost) / sale) * 100 : 0;
                  return (
                    <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-2 py-2">
                        {a.image_url ? (
                          <button type="button" onClick={() => setLightboxUrl(a.image_url)} className="block rounded focus:outline-none focus:ring-2 focus:ring-ring/40">
                            <img src={a.image_url} alt="" className="w-8 h-8 rounded object-cover cursor-zoom-in hover:opacity-80 transition-opacity" />
                          </button>
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">{a.category?.[0]}</div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-sm font-medium text-foreground">
                        <div className="break-words">{a.name}</div>
                        {a.format && <div className="text-[10px] text-muted-foreground mt-0.5">{a.format}</div>}
                      </td>
                      <td className="px-2 py-2 text-xs font-mono text-muted-foreground">{a.reference}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">{(a.suppliers as any)?.name || '-'}</td>
                      <td className="px-2 py-2">
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">{a.category}</span>
                        {a.subtipus && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{a.subtipus}</p>}
                      </td>
                      <td className="px-2 py-2 text-xs text-right text-muted-foreground whitespace-nowrap">{cost.toFixed(2)}€</td>
                      <td className="px-2 py-2 text-xs text-right font-medium text-foreground whitespace-nowrap">{sale.toFixed(2)}€</td>
                      <td className="px-2 py-2 text-xs text-right whitespace-nowrap">
                        <span className={cn('font-medium', margin >= 28 ? 'text-success' : margin >= 20 ? 'text-warning' : 'text-destructive')}>
                          {margin.toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-2 py-2 text-xs text-center text-muted-foreground">{a.unit}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <button className="p-1 rounded-md hover:bg-muted transition-colors" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
                          <button className="p-1 rounded-md hover:bg-destructive/10 transition-colors" onClick={() => setDeleteId(a.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-3">
            {filtered.map((a: any) => {
              const cost = (a.cost_price || 0) / 100;
              const sale = (a.sale_price || 0) / 100;
              const margin = sale > 0 ? ((sale - cost) / sale) * 100 : 0;
              return (
                <div key={a.id} className="bg-card rounded-xl border border-border p-4 shadow-card">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {a.image_url ? (
                        <button type="button" onClick={() => setLightboxUrl(a.image_url)} className="block rounded focus:outline-none focus:ring-2 focus:ring-ring/40">
                          <img src={a.image_url} alt="" className="w-8 h-8 rounded object-cover cursor-zoom-in hover:opacity-80 transition-opacity" />
                        </button>
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">{a.category?.[0]}</div>
                      )}
                      <div>
                        <p className="font-medium text-foreground text-sm">{a.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{a.reference}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button className="p-1 rounded hover:bg-muted" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
                      <button className="p-1 rounded hover:bg-destructive/10" onClick={() => setDeleteId(a.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Cost: </span><span>€ {cost.toFixed(2)}</span>
                      <span className="text-muted-foreground ml-3">Venda: </span><span className="font-medium">€ {sale.toFixed(2)}</span>
                    </div>
                    <span className={cn('text-sm font-medium', margin >= 28 ? 'text-success' : margin >= 20 ? 'text-warning' : 'text-destructive')}>
                      {margin.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && !isLoading && (
            <div className="py-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No s'han trobat articles</p>
              <button onClick={openCreate} className="mt-3 text-sm text-primary font-medium hover:underline">Crear el primer article →</button>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Article' : 'Nou Article'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Image upload */}
            <div>
              <label className={labelClass}>Imatge</label>
              <div className="flex items-center gap-3">
                {form.image_url ? (
                  <div className="relative">
                    <button type="button" onClick={() => setLightboxUrl(form.image_url)} className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/40">
                      <img src={form.image_url} alt="" className="w-16 h-16 rounded-lg object-cover border border-border cursor-zoom-in hover:opacity-80 transition-opacity" />
                    </button>
                    <button onClick={() => setForm({ ...form, image_url: '' })} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted border-2 border-dashed border-border flex items-center justify-center">
                    <Package className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="px-3 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted flex items-center gap-2 disabled:opacity-50">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Pujant...' : 'Pujar imatge'}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Nom de l'article *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Nom..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Referència</label>
                <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={inputClass} placeholder="REF-001" />
              </div>
              <div>
                <label className={labelClass}>Proveïdor</label>
                <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className={inputClass}>
                  <option value="">-- Cap --</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Categoria</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, format: '', quality: '', acabat_type: '', subtipus: '', technical_specs: {} })} className={inputClass}>
                  {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Unitat</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputClass}>
                  {units.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            {/* Subtipus conditional */}
            {subtipusOptions[form.category] && (
              <div>
                <label className={labelClass}>Subtipus</label>
                <select value={form.subtipus} onChange={(e) => setForm({ ...form, subtipus: e.target.value, technical_specs: {} })} className={inputClass}>
                  <option value="">-- Seleccionar --</option>
                  {subtipusOptions[form.category].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            {form.category === 'Bomba' && (
              <div>
                <label className={labelClass}>Fase</label>
                <select value={form.fase} onChange={(e) => setForm({ ...form, fase: e.target.value })} className={inputClass}>
                  <option value="">-- Seleccionar --</option>
                  <option value="Monofàsic">Monofàsic</option>
                  <option value="Trifàsic">Trifàsic</option>
                </select>
              </div>
            )}
            {(form.category === 'Bomba' || (form.category === 'Dosificació' && form.subtipus === 'Estàndard (pH/Cl)')) && (
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.linia_preferent}
                  onChange={(e) => setForm({ ...form, linia_preferent: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                Línia preferent (apareix a les recomanacions automàtiques d'equipament)
              </label>
            )}
            {/* Technical specs (conditional) */}
            {(() => {
              const cfg = getTechSpecConfig(form.category, form.subtipus);
              if (!cfg) return null;
              return (
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">{cfg.title}</h4>
                  <div className={cfg.columns === 1 ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3'}>
                    {cfg.fields.map((f) => {
                      const raw = form.technical_specs?.[f.key];
                      if (f.type === 'boolean') {
                        return (
                          <label key={f.key} className="flex items-center gap-2 text-sm text-foreground">
                            <input
                              type="checkbox"
                              checked={raw === true}
                              onChange={(e) => {
                                const next = { ...(form.technical_specs || {}) };
                                next[f.key] = e.target.checked;
                                setForm({ ...form, technical_specs: next });
                              }}
                              className="h-4 w-4 rounded border-border"
                            />
                            {f.label}
                          </label>
                        );
                      }
                      const value = raw === undefined || raw === null ? '' : String(raw);
                      const isText = f.type === 'text';
                      return (
                        <div key={f.key}>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">{f.label}</label>
                          <input
                            type={isText ? 'text' : 'number'}
                            step={isText ? undefined : f.step}
                            placeholder={f.placeholder}
                            value={value}
                            onChange={(e) => {
                              const v = e.target.value;
                              const next = { ...(form.technical_specs || {}) };
                              if (v === '') {
                                delete next[f.key];
                              } else if (isText) {
                                next[f.key] = v;
                              } else {
                                const n = f.integer ? parseInt(v, 10) : parseFloat(v);
                                next[f.key] = Number.isNaN(n) ? null : n;
                              }
                              setForm({ ...form, technical_specs: next });
                            }}
                            className={inputClass}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Preu cost (€)</label>
                <input type="number" step="0.01" value={form.cost_price || ''} onChange={(e) => setForm({ ...form, cost_price: parseFloat(e.target.value) || 0 })} className={inputClass} />
              </div>
               <div>
                <label className={labelClass}>Preu venda (€)</label>
                <input type="number" step="0.01" value={form.sale_price || ''} onChange={(e) => setForm({ ...form, sale_price: parseFloat(e.target.value) || 0 })} className={inputClass} />
              </div>
            </div>
            {acabatCategories.includes(form.category) && (
              <>
                <div>
                  <label className={labelClass}>Preu venda només subministrament (€)</label>
                  <input type="number" step="0.01" value={form.sale_price_supply_only || ''} onChange={(e) => setForm({ ...form, sale_price_supply_only: parseFloat(e.target.value) || 0 })} className={inputClass} placeholder="0.00" />
                </div>
                <div>
                  <label className={labelClass}>Format</label>
                  <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} className={inputClass}>
                    <option value="">-- Seleccionar --</option>
                    {form.category === 'Gressite' && (
                      <>
                        <option value="2,5 x 2,5">2,5 x 2,5</option>
                        <option value="5 x 5">5 x 5</option>
                      </>
                    )}
                    {form.category === 'Porcelànic' && (
                      <>
                        <option value="31 x 31">31 x 31</option>
                        <option value="31 x 62">31 x 62</option>
                        <option value="49 x 98">49 x 98</option>
                      </>
                    )}
                    {form.category === 'Coronament' && (
                      <>
                        <option value="ROSAGRES L62">ROSAGRES L62</option>
                        <option value="ROSAGRES L98">ROSAGRES L98</option>
                        <option value="ROSAGRES BR6">ROSAGRES BR6</option>
                        <option value="ROSAGRES BR9">ROSAGRES BR9</option>
                        <option value="PEDRA BLANCA">PEDRA BLANCA</option>
                        <option value="BREINCO">BREINCO</option>
                      </>
                    )}
                  </select>
                </div>
                {form.category === 'Coronament' && (
                  <div>
                    <label className={labelClass}>Color de la beurada</label>
                    <input
                      type="text"
                      value={form.beurada_color}
                      onChange={(e) => setForm({ ...form, beurada_color: e.target.value })}
                      className={inputClass}
                      placeholder="Ex: Gris cendra, Blanc trencat..."
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Es preomplirà al pressupost quan s'esculli aquest model</p>
                  </div>
                )}
                {form.category === 'Porcelànic' && (
                  <>
                    <div>
                      <label className={labelClass}>Color beurada normal (cimentosa)</label>
                      <input
                        type="text"
                        value={form.beurada_color_normal}
                        onChange={(e) => setForm({ ...form, beurada_color_normal: e.target.value })}
                        className={inputClass}
                        placeholder="Ex: Gris cendra, Blanc trencat..."
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Es preomplirà al pressupost si el client tria beurada normal</p>
                    </div>
                    <div>
                      <label className={labelClass}>Color beurada epoxi</label>
                      <input
                        type="text"
                        value={form.beurada_color_epoxi}
                        onChange={(e) => setForm({ ...form, beurada_color_epoxi: e.target.value })}
                        className={inputClass}
                        placeholder="Ex: Pearl, Antracita..."
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Es preomplirà al pressupost si el client tria epoxi</p>
                    </div>
                  </>
                )}
                {form.category === 'Gressite' && (
                  <div>
                    <label className={labelClass}>Qualitat</label>
                    <select value={form.quality} onChange={(e) => setForm({ ...form, quality: e.target.value })} className={inputClass}>
                      <option value="">-- Cap --</option>
                      <option value="estandard">Estàndard</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className={labelClass}>Tipus d'acabat</label>
                  <select value={form.acabat_type} onChange={(e) => setForm({ ...form, acabat_type: e.target.value })} className={inputClass}>
                    <option value="">-- Cap --</option>
                    <option value="coronament">Coronament</option>
                    <option value="gressite">Gressite</option>
                    <option value="porcelanic">Porcelànic</option>
                  </select>
                </div>
              </>
            )}
            <button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}
              className="w-full gradient-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-md flex items-center justify-center gap-2 disabled:opacity-60">
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editId ? 'Guardar canvis' : 'Crear article'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
        <DialogContent hideCloseButton className="max-w-3xl w-fit bg-transparent border-none shadow-none p-0 flex items-center justify-center">
          <DialogTitle className="sr-only">Imatge ampliada</DialogTitle>
          <DialogClose className="absolute right-4 top-4 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white opacity-90 transition-opacity hover:opacity-100 hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/60">
            <X className="h-4 w-4" />
            <span className="sr-only">Tancar</span>
          </DialogClose>
          {lightboxUrl && (
            <img src={lightboxUrl} alt="" className="max-w-[90vw] max-h-[85vh] w-auto h-auto rounded-lg object-contain shadow-lg" />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar article?</AlertDialogTitle>
            <AlertDialogDescription>Segur que vols eliminar aquest article? Pot afectar pressupostos existents.</AlertDialogDescription>
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
