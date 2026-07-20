import { useState, useMemo } from 'react';
import { useBudgetStore } from '@/stores/budgetStore';
import { ArrowLeft, ArrowRight, Check, ZoomIn, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import aerisAsset from '@/assets/finishes/AERIS.webp';
import argentiumAsset from '@/assets/finishes/ARGENTIUM.webp';
import nacreAsset from '@/assets/finishes/NACRE.webp';
import sabbiaAsset from '@/assets/finishes/SABBIA.webp';
import stelaArticAsset from '@/assets/finishes/STELA_ARTIC.webp';
import varaderoAsset from '@/assets/finishes/VARADERO.webp';
import menorcaAsset from '@/assets/finishes/MENORCA.webp';
import gr3000Asset from '@/assets/finishes/gresite/3000.webp';
import gr3002Asset from '@/assets/finishes/gresite/3002.webp';
import gr3057Asset from '@/assets/finishes/gresite/3057.webp';
import grNC7723Asset from '@/assets/finishes/gresite/NC7723.webp';
import grNC7733Asset from '@/assets/finishes/gresite/NC7733.webp';
import grNC7734Asset from '@/assets/finishes/gresite/NC7734.webp';
import gr3003Asset from '@/assets/finishes/gresite/3003.webp';
import gr3004Asset from '@/assets/finishes/gresite/3004.webp';
import gr3800Asset from '@/assets/finishes/gresite/3800.webp';
import gr3802Asset from '@/assets/finishes/gresite/3802.webp';
import gr3807Asset from '@/assets/finishes/gresite/3807.webp';

const porcImages: Record<string, string> = {
  AERIS: aerisAsset,
  ARGENTIUM: argentiumAsset,
  NACRE: nacreAsset,
  SABBIA: sabbiaAsset,
  STELA_ARTIC: stelaArticAsset,
  'STELA ARTIC': stelaArticAsset,
  VARADERO: varaderoAsset,
  MENORCA: menorcaAsset,
};

const gresiteImages: Record<string, string> = {
  '3000': gr3000Asset,
  '3002': gr3002Asset,
  '3003': gr3003Asset,
  '3004': gr3004Asset,
  '3057': gr3057Asset,
  NC7723: grNC7723Asset,
  NC7733: grNC7733Asset,
  NC7734: grNC7734Asset,
  '3800': gr3800Asset,
  '3802': gr3802Asset,
  '3807': gr3807Asset,
};

type ModelKey = 'line_confort' | 'line_luxe' | 'line_luxe_plus';

interface FinishOption {
  key: string;
  name: string;
  family: string;
  models: ModelKey[];
  swatch: string; // fallback gradient while images no estan carregades
  image?: string; // real photo url (pendent de pujar)
}

// ---------- Catàleg d'acabats per model ----------
// Coronació
//  · CONFORT + LUXE + LUXE PLUS: AERIS, ARGENTIUM, NACRE, SABBIA (porcelànic)
const CORONA_PORCELANIC = ['AERIS', 'ARGENTIUM', 'NACRE', 'SABBIA'] as const;

const coronaSwatch: Record<string, string> = {
  AERIS: 'linear-gradient(135deg,#e8e4dc,#b8b1a3)',
  ARGENTIUM: 'linear-gradient(135deg,#c9c6c2,#7a7772)',
  NACRE: 'linear-gradient(135deg,#f2ede2,#d6cbb3)',
  SABBIA: 'linear-gradient(135deg,#e2cfa8,#b09570)',
  STELA_ARTIC: 'linear-gradient(135deg,#f5f5f2,#c8c6bf)',
  VARADERO: 'linear-gradient(135deg,#c9b998,#8a7758)',
  MENORCA: 'linear-gradient(135deg,#e5dccb,#a8967a)',
};

const coronaOptions: FinishOption[] = CORONA_PORCELANIC.map((name) => ({
  key: `corona_porc_${name.toLowerCase()}`,
  name,
  family: 'Porcelànic',
  models: ['line_confort', 'line_luxe', 'line_luxe_plus'],
  swatch: coronaSwatch[name],
  image: porcImages[name],
}));

// Revestiment interior per model
const gresiteSwatch: Record<string, string> = {
  '3000': 'linear-gradient(135deg,#a8d8e8,#6fb4d0)',
  '3002': 'linear-gradient(135deg,#7fc6d8,#3a8ca8)',
  '3003': 'linear-gradient(135deg,#4aa4c0,#1f6a8a)',
  '3004': 'linear-gradient(135deg,#2f7fa8,#134a70)',
  '3057': 'linear-gradient(135deg,#c8e2ea,#8fb8c8)',
  NC7733: 'linear-gradient(135deg,#e6f0ee,#b8ccc8)',
  NC7723: 'linear-gradient(135deg,#bcd8d0,#7ba59a)',
  NC7734: 'linear-gradient(135deg,#8fb8d0,#4a7a94)',
  '3800': 'linear-gradient(135deg,#a0c8b8,#5a8a78)',
  '3802': 'linear-gradient(135deg,#8ac0d8,#4a86a4)',
  '3807': 'linear-gradient(135deg,#c2d8cc,#7ea394)',
};

const revestimentOptions: FinishOption[] = [
  // CONFORT — Gresite estàndard
  ...['3000', '3004', '3057', '3003', '3002'].map<FinishOption>((n) => ({
    key: `rev_confort_${n}`,
    name: n,
    family: 'Gresite',
    models: ['line_confort'],
    swatch: gresiteSwatch[n],
    image: gresiteImages[n],
  })),
  // LUXE — Gresite premium
  ...['NC7733', 'NC7723', 'NC7734', '3802', '3800', '3807'].map<FinishOption>((n) => ({
    key: `rev_luxe_${n.toLowerCase()}`,
    name: n,
    family: 'Gresite',
    models: ['line_luxe'],
    swatch: gresiteSwatch[n],
    image: gresiteImages[n],
  })),
  // LUXE PLUS — Porcelànic (mateixos que corona + 3 exclusius)
  ...CORONA_PORCELANIC.map<FinishOption>((n) => ({
    key: `rev_plus_porc_${n.toLowerCase()}`,
    name: n,
    family: 'Porcelànic',
    models: ['line_luxe_plus'],
    swatch: coronaSwatch[n],
    image: porcImages[n],
  })),
  ...(['STELA_ARTIC', 'VARADERO', 'MENORCA'] as const).map<FinishOption>((n) => ({
    key: `rev_plus_porc_${n.toLowerCase()}`,
    name: n === 'STELA_ARTIC' ? 'STELA ARTIC' : n,
    family: 'Porcelànic',
    models: ['line_luxe_plus'],
    swatch: coronaSwatch[n],
    image: porcImages[n],
  })),
];

const morterColors: { key: 'blanc' | 'beige' | 'gris'; name: string; swatch: string }[] = [
  { key: 'blanc', name: 'Blanc', swatch: 'linear-gradient(135deg,#ffffff,#ececec)' },
  { key: 'beige', name: 'Beige', swatch: 'linear-gradient(135deg,#e8dcc4,#c9b58a)' },
  { key: 'gris', name: 'Gris', swatch: 'linear-gradient(135deg,#c8c8c8,#8f8f8f)' },
];

function groupByFamily(options: FinishOption[]) {
  const groups: Record<string, FinishOption[]> = {};
  for (const o of options) {
    if (!groups[o.family]) groups[o.family] = [];
    groups[o.family].push(o);
  }
  return groups;
}

interface FinishGridProps {
  title: string;
  options: FinishOption[];
  selectedKey?: string;
  onSelect: (key: string) => void;
  onZoom: (opt: FinishOption) => void;
}

function FinishGrid({ title, options, selectedKey, onSelect, onZoom }: FinishGridProps) {
  const groups = useMemo(() => groupByFamily(options), [options]);
  const families = Object.keys(groups);

  if (options.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic p-4 rounded-lg border border-dashed border-border bg-muted/30">
        No hi ha opcions per aquest model.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {families.map((family) => (
        <div key={family} className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{family}</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
            {groups[family].map((opt) => {
              const isSelected = selectedKey === opt.key;
              return (
                <div
                  key={opt.key}
                  className={cn(
                    'group relative rounded-xl border-2 bg-card overflow-hidden transition-all',
                    isSelected
                      ? 'border-primary shadow-elevated ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/40 hover:shadow-md'
                  )}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(opt.key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(opt.key);
                      }
                    }}
                    className="w-full text-left cursor-pointer"
                    aria-label={`Seleccionar ${opt.name}`}
                  >
                    <div className="relative aspect-square" style={{ background: opt.swatch }}>
                      {opt.image && (
                        <img src={opt.image} alt={opt.name} className="w-full h-full object-cover" />
                      )}
                      {isSelected && (
                        <div className="absolute top-1.5 left-1.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground shadow-md">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onZoom(opt);
                        }}
                        className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-6 h-6 rounded-lg bg-background/90 backdrop-blur border border-border text-foreground hover:bg-background shadow-sm"
                        aria-label={`Ampliar ${opt.name}`}
                      >
                        <ZoomIn className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="p-2">
                      <div className="text-xs font-medium text-foreground truncate">{opt.name}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StepAcabatsAutoportant() {
  const { draft, updateDraft, setStep } = useBudgetStore();
  const [zoom, setZoom] = useState<FinishOption | null>(null);
  const model = draft.autoportantModel as ModelKey | undefined;

  const availableCorona = useMemo(
    () => (model ? coronaOptions.filter((o) => o.models.includes(model)) : []),
    [model]
  );
  const availableRev = useMemo(
    () => (model ? revestimentOptions.filter((o) => o.models.includes(model)) : []),
    [model]
  );

  const selectedCorona = availableCorona.find((o) => o.key === draft.autoportantCoronaKey);

  if (!model) {
    return (
      <div className="space-y-4">
        <div className="p-6 rounded-xl border-2 border-dashed border-border bg-muted/30 text-center">
          <p className="text-sm text-muted-foreground">
            Primer selecciona un model de piscina al pas anterior.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStep(3)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" /> Enrere
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Acabats de la piscina</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tria la coronació i el revestiment interior. Les opcions es filtren segons el model seleccionat.
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 shadow-card">
        <FinishGrid
          title="Coronació"
          options={availableCorona}
          selectedKey={draft.autoportantCoronaKey}
          onSelect={(key) => updateDraft({ autoportantCoronaKey: key })}
          onZoom={setZoom}
        />
      </div>

      {/* Revestiment exterior — informatiu o triable segons model */}
      {model === 'line_confort' && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Revestiment exterior</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Morter acrílic texturat. Tria el color:
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-md">
            {morterColors.map((c) => {
              const isSel = draft.autoportantMorterColor === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => updateDraft({ autoportantMorterColor: c.key })}
                  className={cn(
                    'rounded-xl border-2 overflow-hidden transition-all bg-card',
                    isSel ? 'border-primary shadow-elevated ring-2 ring-primary/20' : 'border-border hover:border-primary/40'
                  )}
                >
                  <div className="aspect-[3/2]" style={{ background: c.swatch }} />
                  <div className="p-2 text-xs font-medium text-foreground text-center">{c.name}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(model === 'line_luxe' || model === 'line_luxe_plus') && (
        <div className="bg-primary/5 rounded-xl border border-primary/20 p-4">
          <div className="text-sm text-foreground">
            <span className="font-semibold">Revestiment exterior:</span>{' '}
            {selectedCorona
              ? <>s'aplica el mateix acabat que la coronació — <strong>{selectedCorona.name}</strong> ({selectedCorona.family}).</>
              : <>s'aplica el mateix acabat que la coronació. Tria primer la coronació.</>}
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-5 shadow-card">
        <FinishGrid
          title="Revestiment interior"
          options={availableRev}
          selectedKey={draft.autoportantRevestimentKey}
          onSelect={(key) => updateDraft({ autoportantRevestimentKey: key })}
          onZoom={setZoom}
        />
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep(3)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" /> Enrere
        </button>
        <button
          type="button"
          onClick={() => setStep(5)}
          className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md min-h-[44px]"
        >
          Següent <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <Dialog open={!!zoom} onOpenChange={(open) => !open && setZoom(null)}>
        <DialogContent hideCloseButton className="max-w-2xl p-0 overflow-hidden bg-background border-border">
          {zoom && (
            <div className="relative">
              <div
                className="w-full aspect-square"
                style={{ background: zoom.swatch }}
              >
                {zoom.image && (
                  <img src={zoom.image} alt={zoom.name} className="w-full h-full object-cover" />
                )}
              </div>
              <button
                type="button"
                onClick={() => setZoom(null)}
                className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-background/90 backdrop-blur border border-border text-foreground hover:bg-background shadow-md"
                aria-label="Tancar"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="p-4 bg-card border-t border-border">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{zoom.family}</div>
                <div className="text-lg font-semibold text-foreground">{zoom.name}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}