import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Package, TrendingUp, History } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ProveidorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [increaseOpen, setIncreaseOpen] = useState(false);
  const [percent, setPercent] = useState<string>('');
  const [historyArticle, setHistoryArticle] = useState<{ id: string; name: string } | null>(null);

  const { data: supplier, isLoading: loadingSupplier } = useQuery({
    queryKey: ['supplier', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: articles = [], isLoading: loadingArticles } = useQuery({
    queryKey: ['supplier-articles', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('articles').select('*').eq('supplier_id', id).order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: historyRows = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['article-price-history', historyArticle?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('article_price_history').select('*')
        .eq('article_id', historyArticle!.id).order('changed_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!historyArticle,
  });

  const isLoading = loadingSupplier || loadingArticles;

  const grouped = articles.reduce((acc: Record<string, any[]>, a: any) => {
    const cat = a.category || 'Sense categoria';
    (acc[cat] ||= []).push(a);
    return acc;
  }, {});
  const categoryNames = Object.keys(grouped).sort();

  const selectedArticles = articles.filter((a: any) => selectedIds.has(a.id));
  const parsedPercent = parseFloat(percent.replace(',', '.'));
  const hasValidPercent = percent.trim() !== '' && !Number.isNaN(parsedPercent);

  const computeNewPrice = (price: number) => Math.ceil((price / 100) * (1 + parsedPercent / 100)) * 100;

  const toggleOne = (articleId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(articleId)) next.delete(articleId); else next.add(articleId);
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    const ids = grouped[cat].map((a: any) => a.id);
    const allSelected = ids.every((articleId: string) => selectedIds.has(articleId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((articleId: string) => { if (allSelected) next.delete(articleId); else next.add(articleId); });
      return next;
    });
  };

  const closeIncreaseModal = () => { setIncreaseOpen(false); setPercent(''); };

  const applyIncreaseMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(selectedArticles.map((a: any) => {
        const newCost = computeNewPrice(a.cost_price || 0);
        const newSale = computeNewPrice(a.sale_price || 0);
        return supabase.from('articles').update({ cost_price: newCost, sale_price: newSale } as any).eq('id', a.id)
          .then(({ error }) => { if (error) throw error; });
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-articles', id] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-with-count'] });
      toast.success(`Preus actualitzats per a ${selectedArticles.length} articles`);
      setSelectedIds(new Set());
      closeIncreaseModal();
    },
    onError: () => toast.error('Error aplicant l\'increment de preus'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <p className="text-muted-foreground">Proveïdor no trobat.</p>
        <button onClick={() => navigate('/proveidors')} className="mt-3 text-sm text-primary font-medium hover:underline">← Tornar a proveïdors</button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <button onClick={() => navigate('/proveidors')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Tornar a proveïdors
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{supplier.name}</h1>
          <p className="text-muted-foreground mt-1">{supplier.contact_email || 'Sense email de contacte'} · {articles.length} articles</p>
        </div>
        {selectedIds.size > 0 && (
          <button onClick={() => setIncreaseOpen(true)}
            className="gradient-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md">
            <TrendingUp className="w-4 h-4" /> Incrementar preus ({selectedIds.size})
          </button>
        )}
      </div>

      {articles.length === 0 ? (
        <div className="py-12 text-center bg-card rounded-xl border border-border">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Aquest proveïdor encara no té articles associats</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categoryNames.map((cat) => {
            const catArticles = grouped[cat];
            const allSelected = catArticles.every((a: any) => selectedIds.has(a.id));
            return (
              <div key={cat} className="bg-card rounded-xl border border-border overflow-hidden shadow-card">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/50">
                  <Checkbox checked={allSelected} onCheckedChange={() => toggleCategory(cat)} />
                  <h2 className="text-sm font-semibold text-foreground">{cat}</h2>
                  <span className="text-xs text-muted-foreground">({catArticles.length})</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="w-10 px-4 py-2"></th>
                      <th className="text-left px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Article</th>
                      <th className="text-left px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Referència</th>
                      <th className="text-right px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preu cost</th>
                      <th className="text-right px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preu venda</th>
                      <th className="w-10 px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {catArticles.map((a: any) => (
                      <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5"><Checkbox checked={selectedIds.has(a.id)} onCheckedChange={() => toggleOne(a.id)} /></td>
                        <td className="px-2 py-2.5 text-sm font-medium text-foreground">{a.name}</td>
                        <td className="px-2 py-2.5 text-sm text-muted-foreground">{a.reference || '-'}</td>
                        <td className="px-2 py-2.5 text-sm text-right text-muted-foreground">{((a.cost_price || 0) / 100).toFixed(2)} €</td>
                        <td className="px-2 py-2.5 text-sm text-right text-foreground font-medium">{((a.sale_price || 0) / 100).toFixed(2)} €</td>
                        <td className="px-4 py-2.5 text-right">
                          <button className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Veure històric de preus"
                            onClick={() => setHistoryArticle({ id: a.id, name: a.name })}>
                            <History className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={increaseOpen} onOpenChange={(open) => !open && closeIncreaseModal()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Incrementar preus ({selectedArticles.length} articles)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Percentatge d'increment</label>
              <div className="relative w-40">
                <input type="text" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)}
                  placeholder="ex: 5" autoFocus
                  className="w-full pl-3 pr-8 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Negatiu per aplicar un descompte. S'aplica per igual a preu de cost i preu de venda.</p>
            </div>

            {hasValidPercent && (
              <div className="border border-border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr className="border-b border-border">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Article</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cost actual → nou</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Venda actual → nou</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedArticles.map((a: any) => (
                      <tr key={a.id}>
                        <td className="px-3 py-2 text-sm text-foreground">{a.name}</td>
                        <td className="px-3 py-2 text-sm text-right text-muted-foreground">
                          {((a.cost_price || 0) / 100).toFixed(2)} € → <span className="font-medium text-foreground">{(computeNewPrice(a.cost_price || 0) / 100).toFixed(2)} €</span>
                        </td>
                        <td className="px-3 py-2 text-sm text-right text-muted-foreground">
                          {((a.sale_price || 0) / 100).toFixed(2)} € → <span className="font-medium text-foreground">{(computeNewPrice(a.sale_price || 0) / 100).toFixed(2)} €</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button onClick={() => applyIncreaseMutation.mutate()} disabled={!hasValidPercent || applyIncreaseMutation.isPending}
              className="w-full gradient-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-md flex items-center justify-center gap-2 disabled:opacity-60">
              {applyIncreaseMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Aplicar increment
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyArticle} onOpenChange={(open) => !open && setHistoryArticle(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Històric de preus — {historyArticle?.name}</DialogTitle>
          </DialogHeader>
          {loadingHistory ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : historyRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Encara no hi ha canvis de preu registrats per aquest article.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                    <th className="text-right px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cost</th>
                    <th className="text-right px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Venda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {historyRows.map((h: any) => (
                    <tr key={h.id}>
                      <td className="px-2 py-2 text-sm text-muted-foreground">{new Date(h.changed_at).toLocaleString('ca-ES')}</td>
                      <td className="px-2 py-2 text-sm text-right text-foreground">{(h.cost_price / 100).toFixed(2)} €</td>
                      <td className="px-2 py-2 text-sm text-right text-foreground">{(h.sale_price / 100).toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
