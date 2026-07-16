import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/integrations/supabase/client';
import { Search, X, Package, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectedArticle {
  id: string;
  name: string;
  reference?: string | null;
  image_url?: string | null;
  supplierName?: string | null;
}

interface EquipmentSelectorProps {
  label: string;
  placeholder?: string;
  categoryFilter: string | string[];
  subtipusFilter?: string;
  formatFilter?: string;
  excludeReferencePrefix?: string;
  value: SelectedArticle | null;
  onChange: (article: SelectedArticle | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
  quantity?: number;
  onQuantityChange?: (qty: number) => void;
}

export function EquipmentSelector({
  label,
  placeholder = 'Cercar equip...',
  categoryFilter,
  subtipusFilter,
  formatFilter,
  excludeReferencePrefix,
  value,
  onChange,
  allowNone = true,
  noneLabel = "Sense equip / No s'inclou",
  quantity = 1,
  onQuantityChange,
}: EquipmentSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SelectedArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Calculate dropdown position
  useEffect(() => {
    if (!open || !containerRef.current) {
      setDropdownPos(null);
      return;
    }
    const updatePos = () => {
      const inputWrapper = containerRef.current?.querySelector('[data-input-wrapper]') as HTMLElement;
      if (!inputWrapper) return;
      const rect = inputWrapper.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const fetchArticles = async () => {
      setLoading(true);
      let query = supabase
        .from('articles')
        .select('id, name, reference, image_url, suppliers:supplier_id(name)')
        .limit(20);

      if (Array.isArray(categoryFilter)) {
        query = query.in('category', categoryFilter);
      } else {
        query = query.eq('category', categoryFilter);
      }

      if (subtipusFilter) {
        query = query.eq('subtipus', subtipusFilter);
      }

      if (formatFilter) {
        query = query.eq('format', formatFilter);
      }

      if (search.trim()) {
        query = query.ilike('name', `%${search.trim()}%`);
      }

      const { data } = await query;
      const mapped = (data || [])
        .filter((a: any) => !excludeReferencePrefix || !(a.reference || '').startsWith(excludeReferencePrefix))
        .map((a: any) => ({
        id: a.id,
        name: a.name,
        reference: a.reference,
        image_url: a.image_url,
        supplierName: a.suppliers?.name || null,
      }));
      setResults(mapped);
      setLoading(false);
    };
    const timer = setTimeout(fetchArticles, 200);
    return () => clearTimeout(timer);
  }, [open, search, categoryFilter, subtipusFilter, formatFilter, excludeReferencePrefix]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        // Also check if click is inside portal dropdown
        const portal = document.getElementById('equipment-dropdown-portal');
        if (portal && portal.contains(target)) return;
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (article: SelectedArticle | null) => {
    onChange(article);
    setOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    onChange(null);
    setSearch('');
    setTimeout(() => {
      inputRef.current?.focus();
      setOpen(true);
    }, 50);
  };

  if (value) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
          {value.image_url ? (
            <img src={value.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground line-clamp-2">{value.name}</p>
            {value.supplierName && (
              <p className="text-xs text-muted-foreground truncate">{value.supplierName}{value.reference ? ` · ${value.reference}` : ''}</p>
            )}
            {/* Quantity control */}
            {onQuantityChange && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-muted-foreground">Quantitat:</span>
                <button
                  type="button"
                  onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                  className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Minus className="w-3 h-3 text-muted-foreground" />
                </button>
                <span className="text-sm font-medium text-foreground w-6 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => onQuantityChange(Math.min(10, quantity + 1))}
                  className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Plus className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-primary hover:text-primary/80 font-medium flex-shrink-0"
          >
            Canviar
          </button>
        </div>
      </div>
    );
  }

  const dropdown = open && dropdownPos && createPortal(
    <div
      id="equipment-dropdown-portal"
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 999,
      }}
      className="bg-popover border border-border rounded-lg shadow-lg max-h-[280px] overflow-y-auto"
    >
      {allowNone && (
        <button
          type="button"
          onClick={() => handleSelect(null)}
          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left border-b border-border"
        >
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </div>
          <span className="text-sm text-muted-foreground italic">{noneLabel}</span>
        </button>
      )}
      {loading && (
        <div className="px-3 py-4 text-center text-xs text-muted-foreground">Cercant...</div>
      )}
      {!loading && results.length === 0 && (
        <div className="px-3 py-4 text-center text-xs text-muted-foreground">No s'han trobat articles</div>
      )}
      {!loading && results.map((article) => (
        <button
          key={article.id}
          type="button"
          onClick={() => handleSelect(article)}
          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left"
        >
          {article.image_url ? (
            <img src={article.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate">{article.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {[article.supplierName, article.reference].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        </button>
      ))}
    </div>,
    document.body
  );

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative" data-input-wrapper>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={search}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!open) setOpen(true);
            }}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground"
          />
        </div>
        {dropdown}
      </div>
    </div>
  );
}
