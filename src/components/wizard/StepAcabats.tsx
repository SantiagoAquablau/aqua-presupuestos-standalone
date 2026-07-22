import { useBudgetStore } from '@/stores/budgetStore';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, ChevronDown, Search, Plus, X, Info, ZoomIn } from 'lucide-react';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useWizardValidation, fieldErrorClass } from '@/hooks/useWizardValidation';
import { FieldError } from './FieldError';

// ── Constants ──────────────────────────────────────────
const CORONAMENT_TYPES = [
  // pieceWidth (m) is the slab width that gets added to LARGO+ANCHO in the perimeter formula
  { value: 'gres_31x62', label: 'GRES PORCELÀNIC 31×62', format: 'ROSAGRES L62', pieceWidth: 0.3 },
  { value: 'gres_31x98', label: 'GRES PORCELÀNIC 31×98', format: 'ROSAGRES L98', pieceWidth: 0.3 },
  { value: 'gres_50x62', label: 'GRES PORCELÀNIC 50×62', format: 'ROSAGRES BR6', pieceWidth: 0.5 },
  { value: 'gres_98x50', label: 'GRES PORCELÀNIC 98×50', format: 'ROSAGRES BR9', pieceWidth: 0.5 },
  { value: 'pedra_blanca', label: 'PEDRA BLANCA ARTIFICIAL 40cm', format: '', pieceWidth: 0.4 },
  { value: 'breinco', label: 'BREINCO 40×60', format: 'BREINCO', pieceWidth: 0.4 },
];

const ACTUACIO_OPTIONS = [
  { value: 'suministre_col', label: 'Subministrament i col·locació' },
  { value: 'suministre', label: 'Només subministrament' },
  { value: 'col', label: 'Només col·locació' },
];

const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 min-h-[44px]';
const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

// ── Stable text input that won't lose focus ────────────
function StableInput({ value, onChange, className, placeholder }: {
  value: string; onChange: (v: string) => void; className?: string; placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState(value);
  const latestOnChange = useRef(onChange);
  latestOnChange.current = onChange;

  useEffect(() => { setLocal(value); }, [value]);

  return (
    <input
      ref={ref}
      value={local}
      onChange={(e) => { setLocal(e.target.value); latestOnChange.current(e.target.value); }}
      className={className}
      placeholder={placeholder}
    />
  );
}

// ── Model Selector ─────────────────────────────────────
function ModelSelector({ category, format, quality, selectedId, aDeterminar, onSelect, onSetADeterminar }: {
  category: string; format: string; quality?: string;
  selectedId?: string; aDeterminar: boolean;
  onSelect: (id: string | undefined) => void; onSetADeterminar: (v: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const { data: articles = [] } = useQuery({
    queryKey: ['articles-acabats', category, format, quality],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('*, suppliers:supplier_id(name)')
        .ilike('acabat_type', category)
        .order('name');

      // Map internal format values to exact stored DB values
      const formatMap: Record<string, string> = {
        '2.5x2.5': '2,5 x 2,5',
        '5x5': '5 x 5',
        '31x31': '31 x 31',
        '31x62': '31 x 62',
        '49x98': '49 x 98',
        'ROSAGRES L62': 'ROSAGRES L62',
        'ROSAGRES L98': 'ROSAGRES L98',
        'ROSAGRES BR6': 'ROSAGRES BR6',
        'ROSAGRES BR9': 'ROSAGRES BR9',
        'PEDRA BLANCA': 'PEDRA BLANCA',
        'BREINCO': 'BREINCO',
      };
      const dbFormat = formatMap[format] || format;

      const filteredData = (data || []).filter((article: any) => {
        const matchesFormat = !format || (article.format || '') === dbFormat;
        const matchesQuality = !quality || (article.quality || '').toLowerCase() === quality.toLowerCase();
        return matchesFormat && matchesQuality;
      });

      console.log('[ModelSelector] filter values:', { category, format, quality, dbFormat });
      console.log('[ModelSelector] raw query result:', { data, error, filteredCount: filteredData.length });

      if (error) throw error;
      return filteredData;
    },
  });

  const filtered = articles.filter((a: any) =>
    !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.reference?.toLowerCase().includes(search.toLowerCase())
  );

  const selected = articles.find((a: any) => a.id === selectedId);

  const handleSelect = (id: string | undefined) => {
    onSelect(id);
    onSetADeterminar(false);
    setOpen(false);
    setSearch('');
  };

  const handleADeterminar = () => {
    onSelect(undefined);
    onSetADeterminar(true);
    setOpen(false);
    setSearch('');
  };

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const ArticleThumb = ({ article, size = 8, enlargeable = false }: { article: any; size?: number; enlargeable?: boolean }) => {
    const imgEl = article?.image_url ? (
      <img src={article.image_url} alt="" className={cn('rounded object-cover flex-shrink-0', enlargeable && 'cursor-pointer')} style={{ width: size * 4, height: size * 4 }} onClick={enlargeable ? (e) => { e.stopPropagation(); setLightboxUrl(article.image_url); } : undefined} />
    ) : (
      <div className="rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground flex-shrink-0" style={{ width: size * 4, height: size * 4 }}>
        {article?.category?.[0] || '?'}
      </div>
    );
    return imgEl;
  };

  return (
    <div className="space-y-2">
      <label className={labelClass}>Model</label>
      {aDeterminar && !selectedId ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-primary/30 bg-primary/5">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">?</div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Model a determinar</p>
            <p className="text-xs text-muted-foreground">Es definirà posteriorment</p>
          </div>
          <button onClick={() => setOpen(true)} className="text-xs text-primary font-medium hover:underline">Canviar</button>
        </div>
      ) : selected ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-primary/30 bg-primary/5">
          <ArticleThumb article={selected} size={10} enlargeable />
           <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{selected.name}</p>
            <p className="text-xs text-muted-foreground">{(selected as any).reference}{selected.format ? ` · ${selected.format}` : ''}{(selected as any).suppliers?.name ? ` · ${(selected as any).suppliers.name}` : ''}</p>
          </div>
          <button onClick={() => setOpen(true)} className="text-xs text-primary font-medium hover:underline">Canviar</button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="w-full p-3 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary/40 transition-colors text-left">
          Seleccionar model...
        </button>
      )}

      {open && (
        <div className="border border-border rounded-lg bg-card shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cercar model..." className="w-full pl-9 pr-3 py-2 text-sm border-0 bg-transparent focus:outline-none" autoFocus />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button onClick={handleADeterminar} className="w-full text-left px-3 py-2.5 hover:bg-muted/50 text-sm flex items-center gap-2 border-b border-border">
              <span className="text-primary font-bold">◉</span> Model a determinar (es definirà posteriorment)
            </button>
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No s'han trobat models per aquest format i qualitat. Comprova el Catàleg d'Articles.
              </div>
            )}
            {filtered.map((a: any) => (
              <button key={a.id} onClick={() => handleSelect(a.id)}
                className={cn('w-full text-left px-3 py-2.5 hover:bg-muted/50 text-sm flex items-center gap-3 group', selectedId === a.id && 'bg-primary/5')}>
                <div className="relative flex-shrink-0">
                  <ArticleThumb article={a} size={8} />
                  {a.image_url && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={(e) => { e.stopPropagation(); setLightboxUrl(a.image_url); }}>
                      <ZoomIn className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.format || ''}{(a as any).suppliers?.name ? `${a.format ? ' · ' : ''}${(a as any).suppliers.name}` : ''}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-border">
            <button onClick={() => { setOpen(false); setSearch(''); }} className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1">Tancar</button>
          </div>
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/90 border-none flex items-center justify-center [&>button]:bg-white [&>button]:text-foreground [&>button]:rounded-full [&>button]:w-9 [&>button]:h-9 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:shadow-lg [&>button]:opacity-100 [&>button]:top-4 [&>button]:right-4 [&>button]:z-10">
          {lightboxUrl && <img src={lightboxUrl} alt="" className="max-w-full max-h-[80vh] object-contain rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Grout Selector ─────────────────────────────────────
function GroutSelector({ beurada, color, onBeurada, onColor, locked, lockedMsg, hideEpoxi }: {
  beurada: string; color: string; onBeurada: (v: string) => void; onColor: (v: string) => void;
  locked?: boolean; lockedMsg?: string; hideEpoxi?: boolean;
}) {
  const colorLabel = beurada === 'epoxi' ? "Color de l'epoxi" : 'Color de la beurada';
  const options = hideEpoxi
    ? [{ v: 'normal', l: 'Beurada normal (cimentosa)' }]
    : [{ v: 'normal', l: 'Beurada normal (cimentosa)' }, { v: 'epoxi', l: 'Epoxi' }];

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Beurada</label>
        {locked ? (
          <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 p-2.5 rounded-lg">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{lockedMsg}</span>
          </div>
        ) : (
          <div className="flex gap-2">
            {options.map(o => (
              <button key={o.v} onClick={() => onBeurada(o.v)}
                className={cn('flex-1 py-2 rounded-lg border-2 text-xs font-medium transition-all',
                  beurada === o.v ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                )}>{o.l}</button>
            ))}
          </div>
        )}
      </div>
      {!locked && beurada && (
        <div>
          <label className={labelClass}>{colorLabel}</label>
          <StableInput value={color} onChange={onColor} className={inputClass} placeholder="Ex: Blanc, Gris perla..." />
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────
export function StepAcabats() {
  const { draft, updateDraft, setStep } = useBudgetStore();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ coronament: true, revestiment: true });
  const [showOpcional, setShowOpcional] = useState(!!draft.opcionalRevestimentTipus);
  const { validate, hasError, clearError, registerField, shakeKey } = useWizardValidation();

  // Sensible defaults so the comercial doesn't have to click through the most
  // common picks. The user can change any of these afterwards.
  useEffect(() => {
    const patch: Partial<typeof draft> = {};
    if (draft.coronamentInclos === undefined) patch.coronamentInclos = true;
    if (draft.revestimentInclos === undefined) patch.revestimentInclos = true;
    if (!draft.coronamentActuacio) patch.coronamentActuacio = 'suministre_col';
    if (!draft.coronamentTipus) {
      patch.coronamentTipus = 'gres_31x62';
      patch.coronamentFormat = 'ROSAGRES L62';
    }
    if (!draft.revestimentActuacio) patch.revestimentActuacio = 'suministre_col';
    if (!draft.revestimentTipus) {
      patch.revestimentTipus = 'gressite';
      patch.revestimentFormat = '2.5x2.5';
      patch.revestimentQualitat = 'estandard';
    }
    if (!draft.revestimentBeurada) patch.revestimentBeurada = 'normal';
    if (Object.keys(patch).length) updateDraft(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNext = () => {
    const coronaOn = draft.coronamentInclos !== false;
    const revestOn = draft.revestimentInclos !== false;
    const checks = [] as Array<{ field: string; isValid: boolean; message: string }>;
    if (coronaOn) {
      checks.push({ field: 'coronamentActuacio', isValid: !!draft.coronamentActuacio, message: "Selecciona el tipus d'actuació del coronament" });
      checks.push({ field: 'coronamentTipus', isValid: !!draft.coronamentTipus, message: 'Selecciona el tipus de coronament' });
    }
    if (revestOn) {
      checks.push({ field: 'revestimentActuacio', isValid: !!draft.revestimentActuacio, message: "Selecciona el tipus d'actuació del revestiment" });
      checks.push({ field: 'revestimentTipus', isValid: !!draft.revestimentTipus, message: 'Selecciona el tipus de revestiment' });
    }
    const ok = validate(checks);
    if (ok) setStep(5);
    else setOpenSections((s) => ({ ...s, coronament: true, revestiment: true }));
  };

  const toggle = (key: string) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  // ── Coronament calculations ──
  // Formula: base = (((LARGO+W)*2)+2) + (((ANCHO+W)*2)+2)
  // where W is the piece width depending on the coronament type:
  //   GRES 31×62 / 31×98  → 0.3
  //   PEDRA BLANCA 40 / BREINCO 40×60 → 0.4
  //   GRES 50×62 / 98×50  → 0.5
  // If exterior stairs: + (((LARGO_ESCALERA*2)+0.6)+2)
  const coronamentMl = useMemo(() => {
    const largo = draft.poolLength || 0;
    const ancho = draft.poolWidth || 0;
    if (largo === 0 && ancho === 0) return 0;
    const ct = CORONAMENT_TYPES.find(c => c.value === draft.coronamentTipus);
    const w = ct?.pieceWidth ?? 0.3;
    let ml = (((largo + w) * 2) + 2) + (((ancho + w) * 2) + 2);
    if (draft.hasExteriorStairs) {
      const largoEscalera = draft.extStairsLength || 0;
      if (largoEscalera > 0) {
        ml += ((largoEscalera * 2) + 0.6) + 2;
      }
    }
    return Math.round(ml * 100) / 100;
  }, [draft.poolLength, draft.poolWidth, draft.hasExteriorStairs, draft.extStairsLength, draft.coronamentTipus]);

  const coronamentFormat = useMemo(() => {
    const ct = CORONAMENT_TYPES.find(c => c.value === draft.coronamentTipus);
    return ct?.format || '';
  }, [draft.coronamentTipus]);

  const updateCoronament = useCallback((data: any) => {
    const merged = { ...data };
    if ('coronamentTipus' in data) {
      const ct = CORONAMENT_TYPES.find(c => c.value === data.coronamentTipus);
      merged.coronamentFormat = ct?.format || '';
    }
    updateDraft(merged);
  }, [updateDraft]);

  // Default coronament grout to "normal (cimentosa)" — we always use it.
  useEffect(() => {
    if (!draft.coronamentBeurada) {
      updateDraft({ coronamentBeurada: 'normal' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.coronamentBeurada]);

  // ── Auto-fill "Color de la beurada" from the selected coronament article ──
  // When the user picks a coronament model that has a `beurada_color` value
  // assigned in the catalogue, pre-populate the wizard field automatically.
  const { data: coronamentArticle } = useQuery({
    queryKey: ['coronament-article', draft.coronamentModelId],
    enabled: !!draft.coronamentModelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('id, beurada_color')
        .eq('id', draft.coronamentModelId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    // No model selected → clear the field so it doesn't keep stale data
    if (!draft.coronamentModelId) {
      if (draft.coronamentBeuradaColor) {
        updateDraft({ coronamentBeuradaColor: '' });
      }
      return;
    }
    // Model selected → overwrite with the article's beurada_color (or clear if none)
    const color = (coronamentArticle as any)?.beurada_color || '';
    if (color !== (draft.coronamentBeuradaColor || '')) {
      updateDraft({ coronamentBeuradaColor: color });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.coronamentModelId, coronamentArticle?.id, (coronamentArticle as any)?.beurada_color]);

  // ── Auto-fill "Color de la beurada/epoxi" for the porcelànic revestiment ──
  // When the user picks a porcelànic model, populate the wizard color field
  // based on whether they chose normal (cimentosa) or epoxi grout. The catalog
  // article stores both colors separately (beurada_color_normal / beurada_color_epoxi).
  const isPorcelanic = draft.revestimentTipus === 'porcelanic';
  const { data: revestimentArticle } = useQuery({
    queryKey: ['revestiment-porcelanic-article', draft.revestimentModelId],
    enabled: isPorcelanic && !!draft.revestimentModelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('id, beurada_color_normal, beurada_color_epoxi')
        .eq('id', draft.revestimentModelId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!isPorcelanic) return;
    // No model selected → clear stale color
    if (!draft.revestimentModelId) {
      if (draft.revestimentBeuradaColor) {
        updateDraft({ revestimentBeuradaColor: '' });
      }
      return;
    }
    if (!draft.revestimentBeurada) return; // wait until grout type is chosen
    const article = revestimentArticle as any;
    const color = draft.revestimentBeurada === 'epoxi'
      ? (article?.beurada_color_epoxi || '')
      : (article?.beurada_color_normal || '');
    if (color !== (draft.revestimentBeuradaColor || '')) {
      updateDraft({ revestimentBeuradaColor: color });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPorcelanic,
    draft.revestimentModelId,
    draft.revestimentBeurada,
    revestimentArticle?.id,
    (revestimentArticle as any)?.beurada_color_normal,
    (revestimentArticle as any)?.beurada_color_epoxi,
  ]);

  // ── Auto-fill grout color for the OPCIONAL revestiment (porcelànic) ──
  const isOpcPorcelanic = draft.opcionalRevestimentTipus === 'porcelanic';
  const { data: opcRevestimentArticle } = useQuery({
    queryKey: ['opc-revestiment-porcelanic-article', draft.opcionalRevestimentModelId],
    enabled: isOpcPorcelanic && !!draft.opcionalRevestimentModelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('id, beurada_color_normal, beurada_color_epoxi')
        .eq('id', draft.opcionalRevestimentModelId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!draft.opcionalRevestimentTipus) return;
    if (!draft.opcionalRevestimentModelId) {
      if (draft.opcionalRevestimentBeuradaColor) {
        updateDraft({ opcionalRevestimentBeuradaColor: '' });
      }
      return;
    }
    if (!isOpcPorcelanic) return;
    if (!draft.opcionalRevestimentBeurada) return;
    const article = opcRevestimentArticle as any;
    const color = draft.opcionalRevestimentBeurada === 'epoxi'
      ? (article?.beurada_color_epoxi || '')
      : (article?.beurada_color_normal || '');
    if (color !== (draft.opcionalRevestimentBeuradaColor || '')) {
      updateDraft({ opcionalRevestimentBeuradaColor: color });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpcPorcelanic,
    draft.opcionalRevestimentTipus,
    draft.opcionalRevestimentModelId,
    draft.opcionalRevestimentBeurada,
    opcRevestimentArticle?.id,
    (opcRevestimentArticle as any)?.beurada_color_normal,
    (opcRevestimentArticle as any)?.beurada_color_epoxi,
  ]);

  const SectionHeader = ({ id, title, emoji }: { id: string; title: string; emoji: string }) => (
    <button onClick={() => toggle(id)} className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-xl">{emoji}</span>
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <ChevronDown className={cn('w-5 h-5 text-muted-foreground transition-transform', openSections[id] && 'rotate-180')} />
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Acabats</h2>
        <p className="text-sm text-muted-foreground mt-1">Coronament i revestiment de la piscina</p>
      </div>

      {/* ═══ SECTION A: CORONAMENT ═══ */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <SectionHeader id="coronament" title="Coronament" emoji="🧱" />
        {openSections.coronament && (
          <div className="p-4 pt-0 space-y-5 border-t border-border">
            {/* Toggle: include / exclude this section from the budget */}
            <div className="pt-4 flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border">
              <div>
                <div className="text-sm font-medium text-foreground">Inclòs en el pressupost</div>
                <p className="text-xs text-muted-foreground mt-0.5">Desactiva si aquesta obra no porta coronament. No apareixerà al PDF ni a les partides.</p>
              </div>
              <button
                type="button"
                onClick={() => updateDraft({ coronamentInclos: draft.coronamentInclos === false })}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  draft.coronamentInclos !== false ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
                aria-pressed={draft.coronamentInclos !== false}
              >
                <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', draft.coronamentInclos !== false ? 'translate-x-5' : 'translate-x-0.5')} />
              </button>
            </div>
            {draft.coronamentInclos === false ? (
              <div className="text-sm text-muted-foreground italic py-4 text-center">
                Coronament no inclòs en aquest pressupost.
              </div>
            ) : (<>
            {/* A1 — Actuació */}
            <div className="pt-4" ref={registerField('coronamentActuacio')}>
              <label className={labelClass}>Tipus d'actuació</label>
              <div className="flex flex-wrap gap-2">
                {ACTUACIO_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => { updateDraft({ coronamentActuacio: o.value }); clearError('coronamentActuacio'); }}
                    className={cn('px-4 py-2 rounded-full border-2 text-xs font-medium transition-all',
                      draft.coronamentActuacio === o.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40',
                      hasError('coronamentActuacio') && draft.coronamentActuacio !== o.value && fieldErrorClass
                    )}>{o.label}</button>
                ))}
              </div>
              {hasError('coronamentActuacio') && <FieldError message="Selecciona el tipus d'actuació" shakeKey={shakeKey} />}
            </div>

            {/* A2 — Tipus de coronament — NO icon, just name + format badge */}
            <div ref={registerField('coronamentTipus')}>
              <label className={labelClass}>Tipus de coronament</label>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {CORONAMENT_TYPES.map(ct => (
                  <button key={ct.value} onClick={() => { updateCoronament({ coronamentTipus: ct.value }); clearError('coronamentTipus'); }}
                    className={cn('p-3 rounded-xl border-2 text-left transition-all',
                      draft.coronamentTipus === ct.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                      hasError('coronamentTipus') && draft.coronamentTipus !== ct.value && fieldErrorClass
                    )}>
                    <p className="text-xs font-semibold text-foreground leading-tight">{ct.label}</p>
                    {ct.format && <span className="inline-block mt-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium text-muted-foreground">{ct.format}</span>}
                  </button>
                ))}
              </div>
              {hasError('coronamentTipus') && <FieldError message="Selecciona el tipus de coronament" shakeKey={shakeKey} />}
              {coronamentFormat && (
                <div className="mt-2 flex items-center gap-2 text-xs text-primary bg-primary/5 p-2 rounded-lg">
                  <Info className="w-3.5 h-3.5" />
                  <span>Format assignat: <strong>{coronamentFormat}</strong></span>
                </div>
              )}
            </div>

            {/* A3 — Only metres lineals coronament */}
            {coronamentMl > 0 && (
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/20 flex items-center gap-3">
                <span className="text-lg">📐</span>
                <div><p className="text-[10px] text-muted-foreground">Metres lineals coronament</p><p className="text-sm font-bold text-primary">{coronamentMl.toFixed(2)} ml</p></div>
              </div>
            )}

            {/* A4 — Model selector (hidden for Pedra Blanca) */}
            {draft.coronamentTipus && draft.coronamentTipus !== 'pedra_blanca' && (
              <ModelSelector
                category="coronament"
                format={coronamentFormat}
                selectedId={draft.coronamentModelId}
                aDeterminar={draft.coronamentModelADeterminar ?? true}
                onSelect={(id) => updateDraft({ coronamentModelId: id })}
                onSetADeterminar={(v) => updateDraft({ coronamentModelADeterminar: v })}
              />
            )}
            {draft.coronamentTipus === 'pedra_blanca' && (
              <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 p-2.5 rounded-lg">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>ℹ️ Material unitari sense selecció de model</span>
              </div>
            )}

            {/* A5 — Beurada coronament */}
            {draft.coronamentTipus && (
              <GroutSelector
                beurada={draft.coronamentBeurada || 'normal'}
                color={draft.coronamentBeuradaColor || ''}
                onBeurada={(v) => updateDraft({ coronamentBeurada: v })}
                onColor={(v) => updateDraft({ coronamentBeuradaColor: v })}
                hideEpoxi
              />
            )}
            </>)}
          </div>
        )}
      </div>

      {/* ═══ SECTION B: REVESTIMENT ═══ */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <SectionHeader id="revestiment" title="Revestiment" emoji="🔷" />
        {openSections.revestiment && (
          <div className="p-4 pt-0 space-y-5 border-t border-border">
            <div className="pt-4 flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border">
              <div>
                <div className="text-sm font-medium text-foreground">Inclòs en el pressupost</div>
                <p className="text-xs text-muted-foreground mt-0.5">Desactiva si aquesta obra no porta revestiment interior. No apareixerà al PDF ni a les partides.</p>
              </div>
              <button
                type="button"
                onClick={() => updateDraft({ revestimentInclos: draft.revestimentInclos === false })}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  draft.revestimentInclos !== false ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
                aria-pressed={draft.revestimentInclos !== false}
              >
                <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', draft.revestimentInclos !== false ? 'translate-x-5' : 'translate-x-0.5')} />
              </button>
            </div>
            {draft.revestimentInclos === false ? (
              <div className="text-sm text-muted-foreground italic py-4 text-center">
                Revestiment interior no inclòs en aquest pressupost.
              </div>
            ) : (<>
            {/* B1 — Actuació */}
            <div className="pt-4" ref={registerField('revestimentActuacio')}>
              <label className={labelClass}>Tipus d'actuació</label>
              <div className="flex flex-wrap gap-2">
                {ACTUACIO_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => { updateDraft({ revestimentActuacio: o.value }); clearError('revestimentActuacio'); }}
                    className={cn('px-4 py-2 rounded-full border-2 text-xs font-medium transition-all',
                      draft.revestimentActuacio === o.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40',
                      hasError('revestimentActuacio') && draft.revestimentActuacio !== o.value && fieldErrorClass
                    )}>{o.label}</button>
                ))}
              </div>
              {hasError('revestimentActuacio') && <FieldError message="Selecciona el tipus d'actuació" shakeKey={shakeKey} />}
            </div>

            {/* B2 — Tipus */}
            <div ref={registerField('revestimentTipus')}>
              <label className={labelClass}>Tipus de revestiment</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => updateDraft({ revestimentTipus: 'gressite', revestimentFormat: '', revestimentQualitat: '' })}
                  className={cn('p-5 rounded-xl border-2 text-center transition-all',
                    draft.revestimentTipus === 'gressite' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                    hasError('revestimentTipus') && draft.revestimentTipus !== 'gressite' && fieldErrorClass
                  )}>
                  <span className="text-3xl block mb-2">🔵</span>
                  <p className="font-semibold text-foreground">GRESSITE</p>
                </button>
                <button onClick={() => updateDraft({ revestimentTipus: 'porcelanic', revestimentFormat: '', revestimentQualitat: '' })}
                  className={cn('p-5 rounded-xl border-2 text-center transition-all',
                    draft.revestimentTipus === 'porcelanic' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                    hasError('revestimentTipus') && draft.revestimentTipus !== 'porcelanic' && fieldErrorClass
                  )}>
                  <span className="text-3xl block mb-2">⬜</span>
                  <p className="font-semibold text-foreground">PORCELÀNIC</p>
                </button>
              </div>
              {hasError('revestimentTipus') && <FieldError message="Selecciona el tipus de revestiment" shakeKey={shakeKey} />}
            </div>

            {/* B3 — Gressite */}
            {draft.revestimentTipus === 'gressite' && (
              <div className="space-y-4 pl-3 border-l-2 border-primary/20">
                <div>
                  <label className={labelClass}>Format del gressite</label>
                  <div className="flex gap-2">
                    {['2.5x2.5', '5x5'].map(f => (
                      <button key={f} onClick={() => {
                      updateDraft({ revestimentFormat: f, revestimentQualitat: '' });
                      }}
                        className={cn('px-4 py-2 rounded-full border-2 text-xs font-medium transition-all',
                          draft.revestimentFormat === f ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                        )}>{f === '2.5x2.5' ? '2,5 × 2,5 cm' : '5 × 5 cm'}</button>
                    ))}
                  </div>
                </div>

                {/* Quality selector for BOTH formats */}
                {draft.revestimentFormat && (
                  <div>
                    <label className={labelClass}>Qualitat</label>
                    <div className="flex gap-2">
                      {['estandard', 'premium'].map(q => (
                        <button key={q} onClick={() => updateDraft({ revestimentQualitat: q })}
                          className={cn('px-4 py-2 rounded-full border-2 text-xs font-medium transition-all',
                            draft.revestimentQualitat === q ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                          )}>{q === 'estandard' ? 'Estàndard' : 'Premium'}</button>
                      ))}
                    </div>
                  </div>
                )}

                <GroutSelector
                  beurada={draft.revestimentBeurada || ''}
                  color={draft.revestimentBeuradaColor || ''}
                  onBeurada={(v) => updateDraft({ revestimentBeurada: v })}
                  onColor={(v) => updateDraft({ revestimentBeuradaColor: v })}
                />

                {draft.revestimentFormat && (
                  <ModelSelector
                    category="gressite"
                    format={draft.revestimentFormat}
                    quality={draft.revestimentQualitat || undefined}
                    selectedId={draft.revestimentModelId}
                    aDeterminar={draft.revestimentModelADeterminar ?? true}
                    onSelect={(id) => updateDraft({ revestimentModelId: id })}
                    onSetADeterminar={(v) => updateDraft({ revestimentModelADeterminar: v })}
                  />
                )}

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground">Inclou peça de mitja canya?</label>
                  <button onClick={() => updateDraft({ revestimentMigCanya: !draft.revestimentMigCanya })}
                    className={cn('w-12 h-6 rounded-full transition-colors relative', draft.revestimentMigCanya ? 'bg-primary' : 'bg-muted')}>
                    <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform', draft.revestimentMigCanya ? 'translate-x-6' : 'translate-x-0.5')} />
                  </button>
                </div>
                {draft.revestimentMigCanya && (
                  <div className="text-xs text-primary bg-primary/5 p-2 rounded-lg flex items-center gap-2">
                    <Info className="w-3.5 h-3.5" /> Peça mitja canya inclosa al pressupost
                  </div>
                )}
              </div>
            )}

            {/* B4 — Porcelànic */}
            {draft.revestimentTipus === 'porcelanic' && (
              <div className="space-y-4 pl-3 border-l-2 border-primary/20">
                <div>
                  <label className={labelClass}>Format del porcelànic</label>
                  <div className="flex gap-2">
                    {['31x62', '49x98'].map(f => (
                      <button key={f} onClick={() => updateDraft({ revestimentFormat: f })}
                        className={cn('px-4 py-2 rounded-full border-2 text-xs font-medium transition-all',
                          draft.revestimentFormat === f ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                        )}>{f === '31x62' ? '31 × 62 cm' : '49 × 98 cm'}</button>
                    ))}
                  </div>
                </div>

                {draft.revestimentFormat && (
                  <ModelSelector
                    category="porcelanic"
                    format={draft.revestimentFormat}
                    selectedId={draft.revestimentModelId}
                    aDeterminar={draft.revestimentModelADeterminar ?? true}
                    onSelect={(id) => updateDraft({ revestimentModelId: id })}
                    onSetADeterminar={(v) => updateDraft({ revestimentModelADeterminar: v })}
                  />
                )}

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground">Inclou peces especials?</label>
                  <button onClick={() => updateDraft({ revestimentPecesEspecials: !draft.revestimentPecesEspecials })}
                    className={cn('w-12 h-6 rounded-full transition-colors relative', draft.revestimentPecesEspecials ? 'bg-primary' : 'bg-muted')}>
                    <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform', draft.revestimentPecesEspecials ? 'translate-x-6' : 'translate-x-0.5')} />
                  </button>
                </div>
                {draft.revestimentPecesEspecials && (
                  <div className="text-xs text-primary bg-primary/5 p-2 rounded-lg flex items-center gap-2">
                    <Info className="w-3.5 h-3.5" /> Les peces especials es configuraran posteriorment
                  </div>
                )}

                <GroutSelector
                  beurada={draft.revestimentBeurada || ''}
                  color={draft.revestimentBeuradaColor || ''}
                  onBeurada={(v) => updateDraft({ revestimentBeurada: v })}
                  onColor={(v) => updateDraft({ revestimentBeuradaColor: v })}
                />
              </div>
            )}
            </>)}
          </div>
        )}
      </div>

      {/* ═══ B6 — OPCIONAL REVESTIMENT ═══ */}
      {draft.revestimentTipus && (
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 space-y-4">
          {!showOpcional ? (
            <button onClick={() => setShowOpcional(true)} className="flex items-center gap-2 text-sm font-medium text-warning hover:text-warning/80 transition-colors">
              <Plus className="w-4 h-4" /> Afegir opció alternativa al client
              <span className="text-xs text-muted-foreground ml-1">({draft.revestimentTipus === 'gressite' ? 'de porcelànic' : 'de gressite'})</span>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-foreground text-sm">OPCIONAL: Revestiment alternatiu</h4>
                <button onClick={() => { setShowOpcional(false); updateDraft({ opcionalRevestimentTipus: undefined, opcionalRevestimentFormat: undefined, opcionalRevestimentModelId: undefined, opcionalRevestimentBeurada: undefined, opcionalRevestimentBeuradaColor: undefined }); }}
                  className="p-1 rounded hover:bg-destructive/10"><X className="w-4 h-4 text-destructive" /></button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Aquest opcional NO s'inclourà al total del pressupost. S'informarà al client com a alternativa.</span>
              </div>

              <div>
                <label className={labelClass}>Tipus</label>
                <div className="flex gap-2">
                  {['gressite', 'porcelanic'].map(t => (
                    <button key={t} onClick={() => updateDraft({ opcionalRevestimentTipus: t, opcionalRevestimentFormat: '' })}
                      className={cn('flex-1 py-2 rounded-lg border-2 text-xs font-medium transition-all',
                        draft.opcionalRevestimentTipus === t ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                      )}>{t === 'gressite' ? 'Gressite' : 'Porcelànic'}</button>
                  ))}
                </div>
              </div>

              {draft.opcionalRevestimentTipus === 'gressite' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {['2.5x2.5', '5x5'].map(f => (
                      <button key={f} onClick={() => updateDraft({ opcionalRevestimentFormat: f })}
                        className={cn('px-3 py-1.5 rounded-full border text-xs',
                          draft.opcionalRevestimentFormat === f ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'
                        )}>{f}</button>
                    ))}
                  </div>
                  {draft.opcionalRevestimentFormat && (
                    <ModelSelector
                      category="gressite" format={draft.opcionalRevestimentFormat}
                      selectedId={draft.opcionalRevestimentModelId}
                      aDeterminar={!draft.opcionalRevestimentModelId}
                      onSelect={(id) => updateDraft({ opcionalRevestimentModelId: id })}
                      onSetADeterminar={(v) => { if (v) updateDraft({ opcionalRevestimentModelId: undefined }); }}
                    />
                  )}
                </div>
              )}

              {draft.opcionalRevestimentTipus === 'porcelanic' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {['31x62', '49x98'].map(f => (
                      <button key={f} onClick={() => updateDraft({ opcionalRevestimentFormat: f })}
                        className={cn('px-3 py-1.5 rounded-full border text-xs',
                          draft.opcionalRevestimentFormat === f ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'
                        )}>{f}</button>
                    ))}
                  </div>
                  {draft.opcionalRevestimentFormat && (
                    <ModelSelector
                      category="porcelanic" format={draft.opcionalRevestimentFormat}
                      selectedId={draft.opcionalRevestimentModelId}
                      aDeterminar={!draft.opcionalRevestimentModelId}
                      onSelect={(id) => updateDraft({ opcionalRevestimentModelId: id })}
                      onSetADeterminar={(v) => { if (v) updateDraft({ opcionalRevestimentModelId: undefined }); }}
                    />
                  )}
                </div>
              )}

              {draft.opcionalRevestimentTipus && (
                <GroutSelector
                  beurada={draft.opcionalRevestimentBeurada || ''}
                  color={draft.opcionalRevestimentBeuradaColor || ''}
                  onBeurada={(v) => updateDraft({ opcionalRevestimentBeurada: v })}
                  onColor={(v) => updateDraft({ opcionalRevestimentBeuradaColor: v })}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ B7 — REVESTIMENT EXTERIOR ═══ */}
      {/* Reutilitza el motor de càlcul del revestiment interior però treballant amb
          la superfície exterior visible del vas (perímetre × altura vista). Sempre
          porcelànic — no oferim gressite per a l'exterior. Només té sentit amb
          paret vista (semi-enterrada / elevada). */}
      {(draft.poolDisposition === 'semi_enterrada' || draft.poolDisposition === 'elevada') && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-foreground">Revestiment exterior de la piscina</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Aplicable a piscines semi-enterrades o elevades (perímetre × altura vista).</p>
            </div>
            <button
              type="button"
              onClick={() => updateDraft({ revestimentExteriorInclos: !draft.revestimentExteriorInclos })}
              className={cn('w-12 h-6 rounded-full transition-colors relative flex-shrink-0', draft.revestimentExteriorInclos ? 'bg-primary' : 'bg-muted')}
              aria-label="Activar revestiment exterior"
            >
              <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform', draft.revestimentExteriorInclos ? 'translate-x-6' : 'translate-x-0.5')} />
            </button>
          </div>

          {draft.revestimentExteriorInclos && (
            <div className="space-y-4 pl-3 border-l-2 border-primary/20">
              <div className="text-xs text-primary bg-primary/5 p-2 rounded-lg flex items-center gap-2">
                <Info className="w-3.5 h-3.5" /> Sempre porcelànic. Els càlculs es fan sobre perímetre × altura vista.
              </div>

              <div>
                <label className={labelClass}>Format del porcelànic</label>
                <div className="flex gap-2">
                  {['31x62', '49x98'].map(f => (
                    <button key={f} onClick={() => updateDraft({ revestimentExteriorFormat: f, revestimentExteriorModelId: undefined, revestimentExteriorModelADeterminar: true })}
                      className={cn('px-4 py-2 rounded-full border-2 text-xs font-medium transition-all',
                        draft.revestimentExteriorFormat === f ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                      )}>{f === '31x62' ? '31 × 62 cm' : '49 × 98 cm'}</button>
                  ))}
                </div>
              </div>

              {draft.revestimentExteriorFormat && (
                <ModelSelector
                  category="porcelanic"
                  format={draft.revestimentExteriorFormat}
                  selectedId={draft.revestimentExteriorModelId}
                  aDeterminar={draft.revestimentExteriorModelADeterminar ?? true}
                  onSelect={(id) => updateDraft({ revestimentExteriorModelId: id, revestimentExteriorModelADeterminar: false })}
                  onSetADeterminar={(v) => updateDraft({ revestimentExteriorModelADeterminar: v, ...(v ? { revestimentExteriorModelId: undefined } : {}) })}
                />
              )}

              <GroutSelector
                beurada={draft.revestimentExteriorBeurada || ''}
                color={draft.revestimentExteriorBeuradaColor || ''}
                onBeurada={(v) => updateDraft({ revestimentExteriorBeurada: v })}
                onColor={(v) => updateDraft({ revestimentExteriorBeuradaColor: v })}
              />
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button type="button" onClick={() => setStep(3)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" /> Enrere
        </button>
        <button type="button" onClick={handleNext} className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md">
          Següent <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
