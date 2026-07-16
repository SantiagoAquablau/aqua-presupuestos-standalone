import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sparkles, Plus, Minus, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { EquipmentSelector, type SelectedArticle } from '@/components/wizard/EquipmentSelector';
import { useCobertorCalc, useCobertorPricingData } from '@/hooks/useCobertorCalc';
import type { CoverMaterial, CoverTipus } from '@/components/wizard/CobertorSelector';
import { cn } from '@/lib/utils';

export type AssistedSeed =
  | 'bomba_calor'
  | 'robot'
  | 'cobertor'
  | 'gespa'
  | 'paviment'
  | 'accessoris_basics'
  | 'accessoris_opcionals';

interface Props {
  seed: AssistedSeed;
  annexId: string;
  budgetId: string;
  onDone: () => void;
  onCancel: () => void;
}

interface QueueProps {
  seeds: AssistedSeed[];
  annexId: string;
  budgetId: string;
  onDone: () => void;
  onCancel: () => void;
}

const fmtEur = (n: number) =>
  new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(n);

/** Fetch the parent budget so the assisted panels know pool dimensions and volume. */
function useBudgetCtx(budgetId: string) {
  return useQuery({
    queryKey: ['assisted-budget-ctx', budgetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select(
          'id, pool_length, pool_width, pool_depth_min, pool_depth_max',
        )
        .eq('id', budgetId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!budgetId,
  });
}

/** Insert an array of items into pressupost_annex_items (prices already in cents). */
async function insertItems(
  annexId: string,
  rows: Array<{
    description: string;
    quantity: number;
    unit?: string;
    unit_cost_cents: number;
    unit_sale_cents: number;
    article_id?: string | null;
  }>,
) {
  // Append after any existing items so multi-seed annexes don't collide on `order`
  const { count } = await supabase
    .from('pressupost_annex_items' as any)
    .select('id', { count: 'exact', head: true })
    .eq('annex_id', annexId);
  const baseOrder = count ?? 0;
  const payload = rows.map((r, i) => ({
    annex_id: annexId,
    description: r.description,
    quantity: r.quantity,
    unit: r.unit || 'ud',
    unit_cost: r.unit_cost_cents,
    unit_sale: r.unit_sale_cents,
    article_id: r.article_id ?? null,
    order: baseOrder + i,
  }));
  const { error } = await supabase
    .from('pressupost_annex_items' as any)
    .insert(payload as any);
  if (error) throw error;
}

/**
 * Merge per-seed metadata into pressupost_annexos.assisted_meta so the PDF
 * generator can render the rich, original-style page for each assisted block.
 */
async function saveMeta(annexId: string, seed: AssistedSeed, meta: Record<string, any>) {
  try {
    const { data } = await supabase
      .from('pressupost_annexos' as any)
      .select('assisted_meta')
      .eq('id', annexId)
      .single();
    const current = ((data as any)?.assisted_meta || {}) as Record<string, any>;
    current[seed] = { ...(current[seed] || {}), ...meta };
    await supabase
      .from('pressupost_annexos' as any)
      .update({ assisted_meta: current } as any)
      .eq('id', annexId);
  } catch {
    /* Non-blocking: PDF will fall back to item-derived data */
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
 * BOMBA DE CALOR
 * ────────────────────────────────────────────────────────────────────────────── */
function BombaCalorConfig({ annexId, budgetId, onDone, onCancel }: Omit<Props, 'seed'>) {
  const { data: budget, isLoading: loadingBudget } = useBudgetCtx(budgetId);
  const [temperatura, setTemperatura] = useState<number>(27);
  const [coberta, setCoberta] = useState<boolean>(false);
  const [winterBuffer, setWinterBuffer] = useState<boolean>(false);
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: heatPumps = [], isLoading: loadingPumps } = useQuery({
    queryKey: ['assisted-heat-pumps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('id, name, sale_price, cost_price')
        .eq('category', 'Varis')
        .eq('subtipus', 'Bombes de calor');
      if (error) throw error;
      return (data || [])
        .map((a: any) => {
          const m = (a.name || '').match(/(\d+[,.]?\d*)\s*KW/i);
          const kw = m ? parseFloat(m[1].replace(',', '.')) : NaN;
          return { ...a, kw };
        })
        .filter((a: any) => !isNaN(a.kw))
        .sort((a: any, b: any) => a.kw - b.kw);
    },
  });

  const calc = useMemo(() => {
    const L = Number(budget?.pool_length || 0);
    const W = Number(budget?.pool_width || 0);
    const dMin = Number(budget?.pool_depth_min || 0);
    const dMax = Number(budget?.pool_depth_max || 0);
    const dAvg = dMin && dMax ? (dMin + dMax) / 2 : dMin || dMax;
    const volumeM3 = L && W && dAvg ? L * W * dAvg : 0;
    if (!volumeM3) return null;
    const deltaT = temperatura - 15;
    const coverFactor = coberta ? 1.0 : 0.8;
    const baseKw = (volumeM3 * deltaT * 1.16) / (48 * coverFactor);
    const kwNeeded = winterBuffer ? baseKw * 1.2 : baseKw;
    return { volumeM3, kwNeeded };
  }, [budget, temperatura, coberta, winterBuffer]);

  const recommendation = useMemo(() => {
    if (!calc || heatPumps.length === 0) return null;
    return heatPumps.find((h: any) => h.kw >= calc.kwNeeded) || null;
  }, [calc, heatPumps]);

  const selected = useMemo(() => {
    if (overrideId) return heatPumps.find((h: any) => h.id === overrideId) || null;
    return recommendation;
  }, [overrideId, recommendation, heatPumps]);

  const handleGenerate = async () => {
    if (!selected) {
      toast.error('Selecciona una bomba de calor');
      return;
    }
    setSaving(true);
    try {
      // Fetch labor article so the assisted annex mirrors the wizard, which
      // always pairs the heat pump with its installation labor partida.
      const { data: labor } = await supabase
        .from('articles')
        .select('id, name, cost_price, sale_price')
        .ilike('name', 'MANO DE OBRA INSTALADOR BOMBA DE CALOR')
        .maybeSingle();
      const rows: Parameters<typeof insertItems>[1] = [
        {
          description: selected.name,
          quantity: 1,
          unit: 'ud',
          unit_cost_cents: Math.round(Number(selected.cost_price || 0)),
          unit_sale_cents: Math.round(Number(selected.sale_price || 0)),
          article_id: selected.id,
        },
      ];
      if (labor) {
        rows.push({
          description: (labor as any).name,
          quantity: 8,
          unit: 'ud',
          unit_cost_cents: Math.round(Number((labor as any).cost_price || 0)),
          unit_sale_cents: Math.round(Number((labor as any).sale_price || 0)),
          article_id: (labor as any).id,
        });
      }
      await insertItems(annexId, rows);
      const y = new Date().getFullYear();
      await saveMeta(annexId, 'bomba_calor', {
        name: selected.name,
        article_id: selected.id,
        labor_article_id: labor ? (labor as any).id : null,
        article_ids: labor ? [selected.id, (labor as any).id] : [selected.id],
        coberta,
        temperatura,
        desde: `${y}-05-01`,
        fins_a: `${y}-09-30`,
      });
      toast.success('Partida generada');
      onDone();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingBudget || loadingPumps) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Volum del got</label>
          <div className="mt-1 px-3 py-2 rounded-lg border border-border bg-muted/30 text-sm">
            {calc ? `${calc.volumeM3.toFixed(1)} m³` : '—'}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Temperatura objectiu (ºC)</label>
          <input type="number" min={20} max={32} value={temperatura}
            onChange={(e) => setTemperatura(Number(e.target.value) || 27)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">Condicions d'ús</label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={coberta} onChange={(e) => setCoberta(e.target.checked)} />
            Té cobertor / coberta
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={winterBuffer} onChange={(e) => setWinterBuffer(e.target.checked)} />
            Ús a l'hivern (Dec/Gen/Feb)
          </label>
        </div>
      </div>

      {calc && (
        <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 text-sm">
          <div className="flex items-center gap-2 text-primary font-medium">
            <Sparkles className="w-4 h-4" /> kW necessaris: {calc.kwNeeded.toFixed(1)} kW
          </div>
          {recommendation && (
            <p className="text-muted-foreground mt-1">
              Recomanació: <span className="font-medium text-foreground">{recommendation.name}</span> ·{' '}
              {fmtEur(Number(recommendation.sale_price || 0) / 100)}
            </p>
          )}
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-muted-foreground">Bomba a incloure (pots canviar la recomanada)</label>
        <select
          value={overrideId ?? recommendation?.id ?? ''}
          onChange={(e) => setOverrideId(e.target.value || null)}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
        >
          <option value="">— Selecciona —</option>
          {heatPumps.map((h: any) => (
            <option key={h.id} value={h.id}>
              {h.name} · {fmtEur(Number(h.sale_price || 0) / 100)}
            </option>
          ))}
        </select>
      </div>

      <PanelFooter onCancel={onCancel} onGenerate={handleGenerate} saving={saving}
        disabled={!selected}
        priceLabel={selected ? fmtEur(Number(selected.sale_price || 0) / 100) : null} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
 * ROBOT NETEJAFONS
 * ────────────────────────────────────────────────────────────────────────────── */
function RobotConfig({ annexId, onDone, onCancel }: Omit<Props, 'seed' | 'budgetId'>) {
  const [article, setArticle] = useState<SelectedArticle | null>(null);
  const [qty, setQty] = useState(1);
  const [prices, setPrices] = useState<{ cost: number; sale: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!article?.id) { setPrices(null); return; }
    (async () => {
      const { data } = await supabase
        .from('articles').select('cost_price, sale_price').eq('id', article.id).single();
      if (data) setPrices({ cost: Number(data.cost_price || 0), sale: Number(data.sale_price || 0) });
    })();
  }, [article?.id]);

  const handleGenerate = async () => {
    if (!article || !prices) { toast.error('Selecciona un robot'); return; }
    setSaving(true);
    try {
      await insertItems(annexId, [{
        description: article.name,
        quantity: qty,
        unit: 'ud',
        unit_cost_cents: Math.round(prices.cost),
        unit_sale_cents: Math.round(prices.sale),
        article_id: article.id,
      }]);
      await saveMeta(annexId, 'robot', {
        name: article.name,
        article_id: article.id,
        qty,
      });
      toast.success('Partida generada');
      onDone();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <EquipmentSelector
        label="Robot netejafons"
        placeholder="Cercar robot..."
        categoryFilter="Varis"
        subtipusFilter="Robots"
        value={article}
        onChange={setArticle}
        allowNone={false}
        quantity={qty}
        onQuantityChange={setQty}
      />
      {prices && (
        <div className="rounded-lg bg-muted/30 border border-border p-3 text-sm">
          <div className="flex justify-between"><span>Preu venda unitari</span><span className="font-medium">{fmtEur(prices.sale / 100)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Cost unitari</span><span>{fmtEur(prices.cost / 100)}</span></div>
          <div className="flex justify-between mt-1 pt-1 border-t border-border font-medium">
            <span>Total venda ({qty}×)</span>
            <span className="text-primary">{fmtEur((prices.sale * qty) / 100)}</span>
          </div>
        </div>
      )}
      <PanelFooter onCancel={onCancel} onGenerate={handleGenerate} saving={saving}
        disabled={!article || !prices}
        priceLabel={prices ? fmtEur((prices.sale * qty) / 100) : null} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
 * COBERTOR — minimalist configurator on top of cobertorCalc
 * ────────────────────────────────────────────────────────────────────────────── */
function CobertorConfig({ annexId, budgetId, onDone, onCancel }: Omit<Props, 'seed'>) {
  const { data: budget, isLoading: loadingBudget } = useBudgetCtx(budgetId);
  const { modelPrices } = useCobertorPricingData();
  const [tipus, setTipus] = useState<CoverTipus>('fora_aigua');
  const [material, setMaterial] = useState<CoverMaterial>('pvc');
  const [modelId, setModelId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const { data: models = [] } = useQuery({
    queryKey: ['assisted-cover-models', tipus],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cover_models').select('id, code, name, cover_type').eq('cover_type', tipus).order('order_index');
      if (error) throw error;
      return data as any[];
    },
  });

  const selectedModel = models.find((m: any) => m.id === modelId) || null;

  const { result } = useCobertorCalc({
    modelId: selectedModel?.id,
    modelName: selectedModel?.name,
    modelCode: selectedModel?.code,
    coverType: tipus,
    material,
    poolWidth: Number(budget?.pool_width || 0),
    poolLength: Number(budget?.pool_length || 0),
  });

  useEffect(() => {
    // Reset model when tipus changes
    setModelId('');
  }, [tipus]);

  const handleGenerate = async () => {
    if (!selectedModel || !result?.ok) { toast.error('Configura el cobertor i tria un model vàlid'); return; }
    const totalSale = Number(result.breakdown.totalSale || 0);
    const totalCost = Number(result.breakdown.totalCost || 0);
    setSaving(true);
    try {
      await insertItems(annexId, [{
        description: `Cobertor ${selectedModel.name} · lames ${material === 'pvc' ? 'PVC' : 'Policarbonat'}`,
        quantity: 1,
        unit: 'ud',
        unit_cost_cents: Math.round(totalCost * 100),
        unit_sale_cents: Math.round(totalSale * 100),
      }]);
      await saveMeta(annexId, 'cobertor', {
        tipus,
        lames: material,
        model_name: selectedModel.name,
        model_code: selectedModel.code,
      });
      toast.success('Partida generada');
      onDone();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally { setSaving(false); }
  };

  if (loadingBudget) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  const hasDims = !!(budget?.pool_length && budget?.pool_width);
  const totalSale = result?.ok ? Number(result.breakdown.totalSale || 0) : 0;

  return (
    <div className="space-y-4">
      {!hasDims && (
        <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 text-sm">
          El pressupost no té dimensions de la piscina; el càlcul del cobertor no és possible.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Tipus</label>
          <select value={tipus} onChange={(e) => setTipus(e.target.value as CoverTipus)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="fora_aigua">Fora de l'aigua (e-Series)</option>
            <option value="submergit">Submergit (s-Series)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Lames</label>
          <select value={material} onChange={(e) => setMaterial(e.target.value as CoverMaterial)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="pvc">PVC 83 mm</option>
            <option value="policarbonat">Policarbonat 83 mm</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Model</label>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="">— Selecciona —</option>
            {models.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {result && !result.ok && selectedModel && (
        <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 text-sm">
          {result.reason || 'No es pot calcular el preu per aquesta combinació.'}
        </div>
      )}

      {result?.ok && (
        <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 text-sm space-y-1">
          <div className="flex justify-between font-medium text-primary">
            <span>Preu venda</span><span>{fmtEur(totalSale)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Cost</span><span>{fmtEur(Number(result.breakdown.totalCost || 0))}</span>
          </div>
        </div>
      )}

      <PanelFooter onCancel={onCancel} onGenerate={handleGenerate} saving={saving}
        disabled={!selectedModel || !result?.ok}
        priceLabel={result?.ok ? fmtEur(totalSale) : null} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
 * GESPA ARTIFICIAL
 * ────────────────────────────────────────────────────────────────────────────── */
function GespaConfig({ annexId, onDone, onCancel }: Omit<Props, 'seed' | 'budgetId'>) {
  const [article, setArticle] = useState<SelectedArticle | null>(null);
  const [prices, setPrices] = useState<{ cost: number; sale: number; unit: string } | null>(null);
  const [m2, setM2] = useState<number>(0);
  const [prepEnabled, setPrepEnabled] = useState(false);
  const [prepSale, setPrepSale] = useState<number>(0); // euros (sale)
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!article?.id) { setPrices(null); return; }
    (async () => {
      const { data } = await supabase
        .from('articles').select('cost_price, sale_price, unit').eq('id', article.id).single();
      if (data) setPrices({
        cost: Number(data.cost_price || 0),
        sale: Number(data.sale_price || 0),
        unit: (data as any).unit || 'm²',
      });
    })();
  }, [article?.id]);

  const totalModelSale = prices ? (prices.sale * m2) / 100 : 0;
  const totalSale = totalModelSale + (prepEnabled ? prepSale : 0);

  const handleGenerate = async () => {
    if (!article || !prices) { toast.error('Selecciona un model de gespa'); return; }
    if (m2 <= 0) { toast.error('Indica els m² de gespa'); return; }
    setSaving(true);
    try {
      const rows = [] as any[];
      if (prepEnabled && prepSale > 0) {
        rows.push({
          description: 'Preparació de terreny per gespa artificial',
          quantity: 1,
          unit: 'pa',
          unit_cost_cents: Math.round(prepSale * 100 * 0.7),
          unit_sale_cents: Math.round(prepSale * 100),
        });
      }
      rows.push({
        description: article.name,
        quantity: m2,
        unit: prices.unit || 'm²',
        unit_cost_cents: Math.round(prices.cost),
        unit_sale_cents: Math.round(prices.sale),
        article_id: article.id,
      });
      await insertItems(annexId, rows);
      await saveMeta(annexId, 'gespa', {
        model_name: article.name,
        article_id: article.id,
        m2,
        price_per_m2: prices.sale / 100,
        preparacio_inclosa: prepEnabled && prepSale > 0,
        prep_sale: prepEnabled ? prepSale : 0,
      });
      toast.success('Partides generades');
      onDone();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <EquipmentSelector
        label="Model de gespa"
        placeholder="Cercar gespa..."
        categoryFilter="Varis"
        subtipusFilter="Gespa"
        value={article}
        onChange={setArticle}
        allowNone={false}
      />
      <div>
        <label className="text-xs font-medium text-muted-foreground">M² de gespa</label>
        <input type="number" step="0.01" min={0} value={m2 || ''}
          onChange={(e) => setM2(Number(e.target.value) || 0)}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          placeholder="0" />
      </div>
      <div className="rounded-lg border border-border p-3 space-y-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={prepEnabled} onChange={(e) => setPrepEnabled(e.target.checked)} />
          Inclou preparació de terreny
        </label>
        {prepEnabled && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">Import preparació (€ venda)</label>
            <input type="number" step="0.01" min={0} value={prepSale || ''}
              onChange={(e) => setPrepSale(Number(e.target.value) || 0)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              placeholder="0,00" />
            <p className="text-xs text-muted-foreground mt-1">El cost s'estima en 70% del preu de venda.</p>
          </div>
        )}
      </div>
      {prices && m2 > 0 && (
        <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 text-sm space-y-1">
          <div className="flex justify-between"><span>Gespa ({m2} {prices.unit})</span><span className="font-medium">{fmtEur(totalModelSale)}</span></div>
          {prepEnabled && prepSale > 0 && (
            <div className="flex justify-between text-muted-foreground"><span>Preparació terreny</span><span>{fmtEur(prepSale)}</span></div>
          )}
          <div className="flex justify-between mt-1 pt-1 border-t border-primary/15 font-medium text-primary">
            <span>Total venda</span><span>{fmtEur(totalSale)}</span>
          </div>
        </div>
      )}
      <PanelFooter onCancel={onCancel} onGenerate={handleGenerate} saving={saving}
        disabled={!article || !prices || m2 <= 0}
        priceLabel={prices && m2 > 0 ? fmtEur(totalSale) : null} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
 * PAVIMENT PERIMETRAL
 * ────────────────────────────────────────────────────────────────────────────── */
type PavMaterial = 'aplacat' | 'fusta';
type PavFormat = '31 × 62 cm' | '48 × 98 cm' | '98 × 98 cm';
const FORMAT_FILTER: Record<PavFormat, string> = {
  '31 × 62 cm': '31 x 62',
  '48 × 98 cm': '49 x 98',
  '98 × 98 cm': '98 x 98',
};

function PavimentConfig({ annexId, onDone, onCancel }: Omit<Props, 'seed' | 'budgetId'>) {
  const [material, setMaterial] = useState<PavMaterial>('aplacat');
  const [format, setFormat] = useState<PavFormat>('48 × 98 cm');
  const [article, setArticle] = useState<SelectedArticle | null>(null);
  const [prices, setPrices] = useState<{ cost: number; sale: number; unit: string } | null>(null);
  const [m2, setM2] = useState<number>(0);
  // Fusta: manual unit sale per m² (no catalog)
  const [fustaSalePerM2, setFustaSalePerM2] = useState<number>(0);
  // Formigó base optional
  const [formigoEnabled, setFormigoEnabled] = useState(false);
  const [formigoM2, setFormigoM2] = useState<number>(0);
  const [formigoSalePerM2, setFormigoSalePerM2] = useState<number>(35);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setArticle(null);
    setPrices(null);
  }, [format, material]);

  useEffect(() => {
    if (!article?.id) { setPrices(null); return; }
    (async () => {
      const { data } = await supabase
        .from('articles').select('cost_price, sale_price, unit').eq('id', article.id).single();
      if (data) setPrices({
        cost: Number(data.cost_price || 0),
        sale: Number(data.sale_price || 0),
        unit: (data as any).unit || 'm²',
      });
    })();
  }, [article?.id]);

  const pavSale =
    material === 'aplacat'
      ? (prices ? (prices.sale * m2) / 100 : 0)
      : fustaSalePerM2 * m2;
  const formigoSale = formigoEnabled ? formigoSalePerM2 * formigoM2 : 0;
  const totalSale = pavSale + formigoSale;

  const handleGenerate = async () => {
    if (m2 <= 0) { toast.error('Indica els m² de paviment'); return; }
    if (material === 'aplacat' && (!article || !prices)) {
      toast.error('Selecciona un model d\'aplacat'); return;
    }
    if (material === 'fusta' && fustaSalePerM2 <= 0) {
      toast.error('Indica el preu de venda per m² de la fusta'); return;
    }
    setSaving(true);
    try {
      const rows: any[] = [];
      if (formigoEnabled && formigoM2 > 0 && formigoSalePerM2 > 0) {
        // Cost ~ 70% of sale (default margin assumption for ancillary work)
        rows.push({
          description: 'Formigó de base per paviment perimetral',
          quantity: formigoM2,
          unit: 'm²',
          unit_cost_cents: Math.round(formigoSalePerM2 * 100 * 0.7),
          unit_sale_cents: Math.round(formigoSalePerM2 * 100),
        });
      }
      if (material === 'aplacat' && article && prices) {
        rows.push({
          description: `${article.name} (${format})`,
          quantity: m2,
          unit: prices.unit || 'm²',
          unit_cost_cents: Math.round(prices.cost),
          unit_sale_cents: Math.round(prices.sale),
          article_id: article.id,
        });
      } else if (material === 'fusta') {
        rows.push({
          description: 'Paviment de fusta tecnològica',
          quantity: m2,
          unit: 'm²',
          unit_cost_cents: Math.round(fustaSalePerM2 * 100 * 0.7),
          unit_sale_cents: Math.round(fustaSalePerM2 * 100),
        });
      }
      await insertItems(annexId, rows);
      await saveMeta(annexId, 'paviment', {
        material,
        format,
        model_name: material === 'aplacat' ? article?.name : 'Paviment de fusta tecnològica',
        m2,
        nou_total: pavSale,
        formigo_enabled: formigoEnabled,
        formigo_m2: formigoEnabled ? formigoM2 : 0,
        formigo_total: formigoEnabled ? formigoSale : 0,
      });
      toast.success('Partides generades');
      onDone();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally { setSaving(false); }
  };

  const disabled =
    m2 <= 0 ||
    (material === 'aplacat' && (!article || !prices)) ||
    (material === 'fusta' && fustaSalePerM2 <= 0);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Tipus de paviment</label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {([
            { v: 'aplacat' as const, label: 'Aplacat (rajola)' },
            { v: 'fusta' as const, label: 'Fusta tecnològica' },
          ]).map((o) => (
            <button key={o.v} type="button" onClick={() => setMaterial(o.v)}
              className={cn('px-3 py-2 rounded-lg border text-sm',
                material === o.v ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground')}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {material === 'aplacat' && (
        <>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Format</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(['31 × 62 cm', '48 × 98 cm', '98 × 98 cm'] as PavFormat[]).map((f) => (
                <button key={f} type="button" onClick={() => setFormat(f)}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-medium border',
                    format === f ? 'bg-primary/15 text-primary border-primary/30' : 'bg-card text-muted-foreground border-border')}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <EquipmentSelector
            label={`Model d'aplacat (${format})`}
            placeholder="Cercar model..."
            categoryFilter="Porcelànic"
            formatFilter={FORMAT_FILTER[format]}
            excludeReferencePrefix="PAVIMENT_APLACAT_"
            value={article}
            onChange={setArticle}
            allowNone={false}
          />
        </>
      )}

      {material === 'fusta' && (
        <div>
          <label className="text-xs font-medium text-muted-foreground">Preu venda per m² (€)</label>
          <input type="number" step="0.01" min={0} value={fustaSalePerM2 || ''}
            onChange={(e) => setFustaSalePerM2(Number(e.target.value) || 0)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            placeholder="0,00" />
          <p className="text-xs text-muted-foreground mt-1">El cost s'estima en 70% del preu de venda.</p>
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-muted-foreground">M² de paviment</label>
        <input type="number" step="0.01" min={0} value={m2 || ''}
          onChange={(e) => setM2(Number(e.target.value) || 0)}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          placeholder="0" />
      </div>

      <div className="rounded-lg border border-border p-3 space-y-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={formigoEnabled} onChange={(e) => setFormigoEnabled(e.target.checked)} />
          Inclou formigó de base
        </label>
        {formigoEnabled && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">M² de formigó</label>
              <input type="number" step="0.01" min={0} value={formigoM2 || ''}
                onChange={(e) => setFormigoM2(Number(e.target.value) || 0)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">€/m² venda</label>
              <input type="number" step="0.01" min={0} value={formigoSalePerM2 || ''}
                onChange={(e) => setFormigoSalePerM2(Number(e.target.value) || 0)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                placeholder="0,00" />
            </div>
          </div>
        )}
      </div>

      {totalSale > 0 && (
        <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 text-sm space-y-1">
          {pavSale > 0 && (
            <div className="flex justify-between">
              <span>Paviment ({m2} m²)</span><span className="font-medium">{fmtEur(pavSale)}</span>
            </div>
          )}
          {formigoSale > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Formigó base ({formigoM2} m²)</span><span>{fmtEur(formigoSale)}</span>
            </div>
          )}
          <div className="flex justify-between mt-1 pt-1 border-t border-primary/15 font-medium text-primary">
            <span>Total venda</span><span>{fmtEur(totalSale)}</span>
          </div>
        </div>
      )}

      <PanelFooter onCancel={onCancel} onGenerate={handleGenerate} saving={saving}
        disabled={disabled}
        priceLabel={totalSale > 0 ? fmtEur(totalSale) : null} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Wrapper
 * ────────────────────────────────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────────────────────
 * ACCESSORIS (bàsics / opcionals) — multi-row picker
 * ────────────────────────────────────────────────────────────────────────────── */
const BASICS_SUBTIPUS = [
  'Impulsors',
  'Skimmers',
  'Embornal',
  'Focus LED',
  'Projectors Mini LED',
  'Regulador de nivell',
  'Presa netejafons',
];
const OPCIONALS_SUBTIPUS = [
  'Escala inox',
  'Dutxa exterior',
  'Plat de dutxa',
  'Cascada',
  'Salvavides + Suport paret',
  'Barana',
];

type AccRow = {
  key: string;
  subtipus: string;
  article: SelectedArticle | null;
  prices: { cost: number; sale: number; unit: string } | null;
  qty: number;
};

function AccessorisConfig({
  annexId, onDone, onCancel, variant,
}: Omit<Props, 'seed' | 'budgetId'> & { variant: 'basics' | 'opcionals' }) {
  const subtipusList = variant === 'basics' ? BASICS_SUBTIPUS : OPCIONALS_SUBTIPUS;
  const [rows, setRows] = useState<AccRow[]>([
    { key: crypto.randomUUID(), subtipus: subtipusList[0], article: null, prices: null, qty: 1 },
  ]);
  const [saving, setSaving] = useState(false);

  const addRow = () => setRows((r) => [
    ...r,
    { key: crypto.randomUUID(), subtipus: subtipusList[0], article: null, prices: null, qty: 1 },
  ]);
  const removeRow = (key: string) => setRows((r) => r.filter((x) => x.key !== key));
  const updateRow = (key: string, patch: Partial<AccRow>) =>
    setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  // Load prices when an article is selected
  useEffect(() => {
    rows.forEach((row) => {
      if (row.article?.id && (!row.prices || row.prices == null)) {
        (async () => {
          const { data } = await supabase
            .from('articles').select('cost_price, sale_price, unit').eq('id', row.article!.id).single();
          if (data) {
            updateRow(row.key, {
              prices: {
                cost: Number(data.cost_price || 0),
                sale: Number(data.sale_price || 0),
                unit: (data as any).unit || 'ud',
              },
            });
          }
        })();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => r.article?.id || '').join('|')]);

  const totalSale = rows.reduce(
    (acc, r) => acc + (r.prices ? (r.prices.sale * r.qty) / 100 : 0),
    0,
  );

  const validRows = rows.filter((r) => r.article && r.prices && r.qty > 0);

  const handleGenerate = async () => {
    if (validRows.length === 0) {
      toast.error('Afegeix com a mínim un accessori');
      return;
    }
    setSaving(true);
    try {
      await insertItems(
        annexId,
        validRows.map((r) => ({
          description: r.article!.name,
          quantity: r.qty,
          unit: r.prices!.unit || 'ud',
          unit_cost_cents: Math.round(r.prices!.cost),
          unit_sale_cents: Math.round(r.prices!.sale),
          article_id: r.article!.id,
        })),
      );
      await saveMeta(
        annexId,
        variant === 'basics' ? 'accessoris_basics' : 'accessoris_opcionals',
        { article_ids: validRows.map((r) => r.article!.id) },
      );
      toast.success('Partides generades');
      onDone();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Afegeix els {variant === 'basics' ? 'accessoris bàsics' : 'accessoris opcionals'} que vulguis incloure a l'annex. Pots barrejar diferents subtipus.
      </p>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">Subtipus</label>
                <select
                  value={row.subtipus}
                  onChange={(e) => updateRow(row.key, { subtipus: e.target.value, article: null, prices: null })}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                >
                  {subtipusList.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(row.key)}
                  className="mt-6 p-2 rounded-lg hover:bg-destructive/10 text-destructive" title="Eliminar">
                  <Minus className="w-4 h-4" />
                </button>
              )}
            </div>
            <EquipmentSelector
              label="Article"
              placeholder="Cercar article..."
              categoryFilter="Accessoris"
              subtipusFilter={row.subtipus}
              value={row.article}
              onChange={(a) => updateRow(row.key, { article: a, prices: null })}
              allowNone={false}
              quantity={row.qty}
              onQuantityChange={(q) => updateRow(row.key, { qty: q })}
            />
            {row.prices && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Preu venda unitari: <span className="text-foreground font-medium">{fmtEur(row.prices.sale / 100)}</span></span>
                <span>Subtotal: <span className="text-primary font-medium">{fmtEur((row.prices.sale * row.qty) / 100)}</span></span>
              </div>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={addRow}
        className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
        <Plus className="w-4 h-4" /> Afegir un altre accessori
      </button>

      {totalSale > 0 && (
        <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 text-sm">
          <div className="flex justify-between font-medium text-primary">
            <span>Total venda ({validRows.length} {validRows.length === 1 ? 'partida' : 'partides'})</span>
            <span>{fmtEur(totalSale)}</span>
          </div>
        </div>
      )}

      <PanelFooter onCancel={onCancel} onGenerate={handleGenerate} saving={saving}
        disabled={validRows.length === 0}
        priceLabel={totalSale > 0 ? fmtEur(totalSale) : null} />
    </div>
  );
}

function PanelFooter({ onCancel, onGenerate, saving, disabled, priceLabel }: {
  onCancel: () => void; onGenerate: () => void; saving: boolean; disabled: boolean; priceLabel: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
      <button type="button" onClick={onCancel}
        className="text-sm text-muted-foreground hover:text-foreground">
        Cancel·lar i editar manualment
      </button>
      <div className="flex items-center gap-3">
        {priceLabel && <span className="text-sm text-muted-foreground">Total: <span className="font-semibold text-foreground">{priceLabel}</span></span>}
        <button type="button" onClick={onGenerate} disabled={disabled || saving}
          className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
            'gradient-primary text-primary-foreground shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed')}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          Generar partida
        </button>
      </div>
    </div>
  );
}

function SeedTitle(seed: AssistedSeed) {
  return (
    seed === 'bomba_calor' ? 'Configurar bomba de calor' :
    seed === 'robot' ? 'Configurar robot netejafons' :
    seed === 'cobertor' ? 'Configurar cobertor' :
    seed === 'gespa' ? 'Configurar gespa artificial' :
    seed === 'accessoris_basics' ? 'Configurar accessoris bàsics' :
    seed === 'accessoris_opcionals' ? 'Configurar accessoris opcionals' :
    'Configurar paviment perimetral'
  );
}

export function AssistedAnnexPanel({ seeds, annexId, budgetId, onDone, onCancel }: QueueProps) {
  const [index, setIndex] = useState(0);
  const total = seeds.length;
  const seed = seeds[index];

  // If parent passes a new queue, reset cursor
  useEffect(() => { setIndex(0); /* eslint-disable-next-line */ }, [seeds.join('|')]);

  if (!seed) return null;

  const advance = () => {
    if (index + 1 < total) {
      setIndex(index + 1);
      toast.success(`Bloc ${index + 1}/${total} configurat. Continuem amb el següent.`);
    } else {
      onDone();
    }
  };

  const handleSkip = () => {
    if (index + 1 < total) setIndex(index + 1);
    else onCancel();
  };

  return (
    <div className="bg-card border border-primary/30 rounded-xl shadow-card p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">{SeedTitle(seed)}</h3>
        {total > 1 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            {index + 1} / {total}
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">Generarà les partides automàticament</span>
      </div>
      {total > 1 && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {seeds.map((s, i) => (
            <span key={`${s}-${i}`} className={cn(
              'px-2 py-0.5 rounded-full border',
              i < index ? 'bg-success/10 border-success/30 text-success' :
              i === index ? 'bg-primary/10 border-primary/30 text-primary' :
              'bg-muted/40 border-border text-muted-foreground',
            )}>
              {i < index ? '✓ ' : ''}{SeedTitle(s).replace('Configurar ', '')}
            </span>
          ))}
        </div>
      )}
      {total > 1 && (
        <div className="text-xs text-muted-foreground -mt-2">
          Pots saltar aquest bloc si no el necessites. En finalitzar l'últim bloc es tancarà el panell.
        </div>
      )}
      {seed === 'bomba_calor' && (
        <BombaCalorConfig key={`bc-${index}`} annexId={annexId} budgetId={budgetId} onDone={advance} onCancel={handleSkip} />
      )}
      {seed === 'robot' && (
        <RobotConfig key={`rb-${index}`} annexId={annexId} onDone={advance} onCancel={handleSkip} />
      )}
      {seed === 'cobertor' && (
        <CobertorConfig key={`cb-${index}`} annexId={annexId} budgetId={budgetId} onDone={advance} onCancel={handleSkip} />
      )}
      {seed === 'gespa' && (
        <GespaConfig key={`gs-${index}`} annexId={annexId} onDone={advance} onCancel={handleSkip} />
      )}
      {seed === 'paviment' && (
        <PavimentConfig key={`pv-${index}`} annexId={annexId} onDone={advance} onCancel={handleSkip} />
      )}
      {seed === 'accessoris_basics' && (
        <AccessorisConfig key={`ab-${index}`} annexId={annexId} onDone={advance} onCancel={handleSkip} variant="basics" />
      )}
      {seed === 'accessoris_opcionals' && (
        <AccessorisConfig key={`ao-${index}`} annexId={annexId} onDone={advance} onCancel={handleSkip} variant="opcionals" />
      )}
    </div>
  );
}