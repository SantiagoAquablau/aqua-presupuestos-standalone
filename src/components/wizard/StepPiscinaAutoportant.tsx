import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { computeTransportPricing, type AutoportantTransportConfig } from '@/lib/autoportantOptions';
import { RefreshCw } from 'lucide-react';
import { useBudgetStore } from '@/stores/budgetStore';
import { ArrowLeft, ArrowRight, Check, ZoomIn, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import confortAsset from '@/assets/autoportant-line-confort.png.asset.json';
import luxeAsset from '@/assets/autoportant-line-luxe.png.asset.json';
import luxePlusAsset from '@/assets/autoportant-line-luxe-plus.png.asset.json';

type ModelKey = 'line_confort' | 'line_luxe' | 'line_luxe_plus';

interface ModelDef {
  key: ModelKey;
  name: string;
  tagline: string;
  image: string;
  features: string[];
}

const commonMeasures = {
  amples: ['2,30 m', '2,50 m', '3,00 m'],
  llargs: ['2,90 m', '3,90 m', '4,90 m', '5,90 m', '6,90 m'],
  altures: [
    '0,60 m (total 0,80 m)',
    '1,00 m (total 1,20 m)',
    '1,20 m (total 1,40 m)',
  ],
};

const models: ModelDef[] = [
  {
    key: 'line_confort',
    name: 'LINE CONFORT',
    tagline: "L'essencial del sistema Desingpool",
    image: confortAsset.url,
    features: [
      'Estructura autoportant amb sistema patentat Desingpool',
      'Piscina prefabricada provada en fàbrica (estanqueïtat garantida)',
      'Construcció industrialitzada amb maquinària CNC',
      'Sistema modular amb aïllament en poliestirè hidròfug',
      'Mòduls prefabricats amb accessoris i passamurs preinstal·lats',
      'Escala interior i exterior',
      'Revestiment interior en gresite estàndard',
      'Acabat exterior en morter acrílic texturat (blanc, beige o gris)',
      'Coronació en porcelànic DEKTON',
      'Mini focus LED blanc',
      'Filtre cartutx + bomba vel. variable + electròlisi salina',
      'Garantia de 10 anys sobre el vas',
    ],
  },
  {
    key: 'line_luxe',
    name: 'LINE LUXE',
    tagline: 'Disseny premium amb cristall panoràmic',
    image: luxeAsset.url,
    features: [
      'Totes les característiques estructurals del sistema Desingpool',
      'Escala interior amb banc integrat en tot el llarg',
      'Escala exterior',
      'Revestiment interior a triar: gresite, gresite nacarat, gresite digital o porcelànic',
      'Revestiment exterior i coronació en porcelànic DEKTON',
      'Cristall panoràmic de 1,40 × 0,40 m',
      'Mini focus LED blanc',
      'Preinstal·lació de calefacció',
      'Filtre cartutx + bomba vel. variable + electròlisi salina',
      'Garantia de 10 anys sobre el vas',
    ],
  },
  {
    key: 'line_luxe_plus',
    name: 'LINE LUXE PLUS',
    tagline: 'La màxima expressió: cristall LARGE i cascada LED',
    image: luxePlusAsset.url,
    features: [
      'Totes les característiques estructurals del sistema Desingpool',
      'Escala interior amb banc integrat en tot el llarg',
      'Escala exterior',
      'Revestiment interior, exterior i coronació en porcelànic DEKTON o ALTOGLASS 15 × 15 cm',
      'Cristall panoràmic LARGE de 2,00 × 0,40 m',
      'Cascada encastada LED de 60 cm',
      'Mini focus LED blanc',
      'Preinstal·lació de calefacció',
      'Filtre cartutx + bomba vel. variable + electròlisi salina',
      'Garantia de 10 anys sobre el vas',
    ],
  },
];

export function StepPiscinaAutoportant() {
  const { draft, updateDraft, setStep } = useBudgetStore();
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const selected = draft.autoportantModel;

  const labelClass = 'block text-xs font-medium text-muted-foreground mb-1.5';
  const selectClass =
    'w-full px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 min-h-[44px]';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Model de Piscina Autoportant</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tria el model que millor s'adapti al client. Pots ampliar la imatge per veure els detalls.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {models.map((m) => {
          const isSelected = selected === m.key;
          return (
            <div
              key={m.key}
              className={cn(
                'group relative flex flex-col rounded-2xl border-2 bg-card overflow-hidden transition-all duration-200',
                isSelected
                  ? 'border-primary shadow-elevated ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/40 hover:shadow-md'
              )}
            >
              <div className="relative aspect-[16/10] bg-muted overflow-hidden">
                <img
                  src={m.image}
                  alt={m.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <button
                  type="button"
                  onClick={() => setZoomImage(m.image)}
                  className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background/90 backdrop-blur border border-border text-xs font-medium text-foreground hover:bg-background transition-colors shadow-sm"
                  aria-label={`Ampliar imatge de ${m.name}`}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  Ampliar
                </button>
                {isSelected && (
                  <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-md">
                    <Check className="w-3 h-3" /> Seleccionat
                  </div>
                )}
              </div>

              <div className="flex flex-col flex-1 p-5 gap-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground tracking-tight">{m.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.tagline}</p>
                </div>

                <ul className="space-y-1.5 text-xs text-foreground/80 flex-1">
                  {m.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => updateDraft({ autoportantModel: m.key })}
                  className={cn(
                    'mt-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-all min-h-[44px]',
                    isSelected
                      ? 'gradient-primary text-primary-foreground shadow-md'
                      : 'border-2 border-border text-foreground hover:border-primary/60 hover:bg-primary/5'
                  )}
                >
                  {isSelected ? 'Model seleccionat' : 'Seleccionar model'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Configuració del model</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Selecciona les mides desitjades per al model {models.find((m) => m.key === selected)?.name}.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Ample</label>
              <select
                className={selectClass}
                value={draft.autoportantAmple || ''}
                onChange={(e) => updateDraft({ autoportantAmple: e.target.value || undefined })}
              >
                <option value="">Selecciona...</option>
                {commonMeasures.amples.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Llarg</label>
              <select
                className={selectClass}
                value={draft.autoportantLlarg || ''}
                onChange={(e) => updateDraft({ autoportantLlarg: e.target.value || undefined })}
              >
                <option value="">Selecciona...</option>
                {commonMeasures.llargs.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Altura d'aigua</label>
              <select
                className={selectClass}
                value={draft.autoportantAlturaAigua || ''}
                onChange={(e) => updateDraft({ autoportantAlturaAigua: e.target.value || undefined })}
              >
                <option value="">Selecciona...</option>
                {commonMeasures.altures.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <TransportPanel />
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" /> Enrere
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() => setStep(4)}
          className={cn(
            'px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-opacity shadow-md min-h-[44px]',
            selected
              ? 'gradient-primary text-primary-foreground hover:opacity-90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          Següent <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <Dialog open={!!zoomImage} onOpenChange={(open) => !open && setZoomImage(null)}>
        <DialogContent hideCloseButton className="max-w-5xl p-0 overflow-hidden bg-background border-border">
          {zoomImage && (
            <div className="relative">
              <img src={zoomImage} alt="Model ampliat" className="w-full h-auto object-contain max-h-[85vh]" />
              <button
                type="button"
                onClick={() => setZoomImage(null)}
                className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-background/90 backdrop-blur border border-border text-foreground hover:bg-background shadow-md"
                aria-label="Tancar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TransportPanel() {
  const { draft, updateDraft } = useBudgetStore();
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const { data: cfg } = useQuery<AutoportantTransportConfig | null>({
    queryKey: ['autoportant-transport-config'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('autoportant_transport_config').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data || null;
    },
  });

  const km = Number(draft.autoportantTransportKm || 0);
  const preview = computeTransportPricing(draft, cfg || undefined);
  const _addr = (draft.clientAddress || '').trim();
  const _town = (draft.clientTown || '').trim();
  const _obra = (draft.obraLocation || '').trim();
  const _base = _obra || _addr;
  const destination = _town && _base && !_base.toLowerCase().includes(_town.toLowerCase())
    ? `${_base}, ${_town}`
    : (_base || _town);

  const recalc = async () => {
    if (!cfg?.provider_address || !destination) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('compute-transport-km', {
        body: { provider_address: cfg.provider_address, destination_address: destination },
      });
      if (error) throw error;
      const nextKm = Number((data as any)?.km);
      if (Number.isFinite(nextKm) && nextKm > 0) {
        updateDraft({ autoportantTransportKm: nextKm, autoportantTransportKmOverride: false });
      }
    } catch (e) {
      console.warn('[transport-km] refresh failed', e);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-semibold text-foreground inline-flex items-center gap-2"
        >
          Transport
          <span className="text-xs text-muted-foreground">{open ? '(amagar)' : '(mostrar detalls)'}</span>
        </button>
        {open && (
          <button type="button" onClick={recalc} disabled={refreshing || !destination}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50">
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            Recalcular km
          </button>
        )}
      </div>
      {open && !destination && (
        <p className="text-xs text-muted-foreground">Introdueix l'adreça del client per calcular la distància.</p>
      )}
      {open && (
      <>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="block text-muted-foreground mb-1">Distància (km)</span>
          <input type="number" min={0} step={1} value={km || ''}
            onChange={(e) => updateDraft({
              autoportantTransportKm: Number(e.target.value) || 0,
              autoportantTransportKmOverride: true,
            })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </label>
        <div className="text-sm">
          <span className="block text-muted-foreground mb-1">Coste estimat</span>
          <div className="px-3 py-2 rounded-lg bg-muted/50 text-foreground font-medium">
            {preview.cost.toFixed(2)} €
          </div>
        </div>
        <div className="text-sm">
          <span className="block text-muted-foreground mb-1">Venda estimada</span>
          <div className="px-3 py-2 rounded-lg bg-muted/50 text-foreground font-medium">
            {preview.sale.toFixed(2)} €
          </div>
        </div>
      </div>
      {cfg && (
        <p className="text-xs text-muted-foreground">
          Base {(Number(cfg.base_fee_cents) / 100).toFixed(2)} € · {preview.ratePerKm.toFixed(2)} €/km segons ample seleccionat.
        </p>
      )}
      </>
      )}
    </div>
  );
}
