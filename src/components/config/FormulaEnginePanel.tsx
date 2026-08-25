import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  buildVariablesContext, DEFAULT_SIM_VALUES, ruleApplies, evaluateFormulaRuleWithContext,
  type FormulaRule, type FormulaVariable,
} from '@/lib/formulaEngine';
import {
  parseRuleConditionGroups,
  serializeRuleConditionGroups,
  summarizeRuleConditions,
  formatPair,
  operatorNeedsValue,
  OPERATOR_LABELS,
  type RuleConditionPair,
  type RuleConditionGroup,
  type ConditionOperator,
} from '@/lib/formulaConditions';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Trash2, Pencil, GripVertical, Loader2, Play, ChevronDown,
  AlertTriangle, Check, X, ToggleLeft, ToggleRight, Zap,
} from 'lucide-react';

// ── Phase structure ────────────────────────────────
const BUDGET_TYPES = [
  {
    id: 'obra_nova', label: 'Obra Nova',
    phases: [
      { id: 'estructura', label: 'Estructura' },
      { id: 'acabats', label: 'Acabats' },
      { id: 'instalacions', label: 'Instal·lacions' },
      { id: 'accessoris', label: 'Accessoris' },
      { id: 'annex', label: 'Annex' },
    ],
  },
  { id: 'rehabilitacio', label: 'Rehabilitació', phases: [] },
  { id: 'manteniment', label: 'Manteniment', phases: [] },
];

const SUB_PHASES: Record<string, string[]> = {
  estructura: ['vas', 'escala', 'jacuzzi', 'general'],
  acabats: ['coronament', 'revestiment', 'revestiment_jacuzzi', 'general'],
  instalacions: ['depuracio', 'bomba', 'dosificacio', 'fontaneria', 'electrica', 'caseta', 'jacuzzi', 'general'],
  accessoris: ['impulsors', 'skimmers', 'embornal', 'focus_led', 'mini_led', 'control_rgb', 'netejafons', 'escala', 'dutxa', 'cascada', 'salvavides', 'general'],
  annex: ['projecte', 'excavacio', 'paviment', 'gespa', 'caseta', 'cobertor', 'robot', 'bomba_calor', 'netejafons', 'general'],
};

const CONDITION_FIELDS: { value: string; label: string; options: string[] }[] = [
  { value: 'waterproofing_system', label: 'Sistema impermeabilización', options: ['impertot', 'hidrofix', 'lamina_proof'] },
  { value: 'construction_system', label: 'Sistema constructivo', options: ['gunite', 'bloc_encofrat'] },
  { value: 'pool_disposition', label: 'Disposició piscina', options: ['enterrada', 'semi_enterrada', 'elevada'] },
  { value: 'has_jacuzzi', label: 'Té jacuzzi', options: ['true', 'false'] },
  { value: 'jacuzzi_type', label: 'Tipus de jacuzzi', options: ['interior', 'independent'] },
  { value: 'jacuzzi_position', label: 'Posició jacuzzi independent', options: ['dins_estructura', 'parcialment_fora'] },
  { value: 'interior_stair_type', label: 'Tipo escalera interior', options: ['estandard', 'plataforma', 'banc', 'tot_ample', 'sense'] },
  { value: 'has_exterior_stair', label: 'Tiene escalera exterior', options: ['true', 'false'] },
  { value: 'coronament_actuacio', label: 'Actuación coronamiento', options: ['suministre_col', 'suministre', 'col'] },
  { value: 'revestiment_actuacio', label: 'Actuación revestimiento', options: ['suministre_col', 'suministre', 'col'] },
  { value: 'coronament_tipus', label: 'Tipo coronamiento', options: ['gres_31x62', 'gres_31x98', 'gres_50x62', 'gres_98x50', 'pedra_blanca', 'breinco'] },
  { value: 'revestiment_tipus', label: 'Tipo revestimiento', options: ['gressite', 'porcelanic'] },
  { value: 'revestiment_format', label: 'Formato revestimiento', options: ['2.5x2.5', '5x5', '31x31', '31x62', '49x98'] },
  { value: 'coronament_beurada', label: 'Beurada coronamiento', options: ['normal', 'epoxi'] },
  { value: 'revestiment_beurada', label: 'Beurada revestimiento', options: ['normal', 'epoxi'] },
  // ── Instal·lacions: secciones activadas ──
  { value: 'instal_depuracio_enabled', label: 'Depuració activada', options: ['true', 'false'] },
  { value: 'instal_bomba_enabled', label: 'Bomba activada', options: ['true', 'false'] },
  { value: 'instal_dosificacio_enabled', label: 'Dosificació activada', options: ['true', 'false'] },
  { value: 'instal_quadre_enabled', label: 'Quadre elèctric activat', options: ['true', 'false'] },
  { value: 'instal_fontaneria_enabled', label: 'Fontaneria activada', options: ['true', 'false'] },
  { value: 'instal_electrica_enabled', label: 'Inst. elèctrica activada', options: ['true', 'false'] },
  { value: 'instal_caseta_enabled', label: 'Caseta activada', options: ['true', 'false'] },
  { value: 'instal_fontaneria_local_tecnic', label: 'Tipus de local tècnic', options: ['existent', 'nou', 'determinar'] },
  { value: 'instal_fontaneria_caseta_tipus', label: 'Tipus de caseta (local nou)', options: ['caseta_elevada', 'caseta_soterrada', 'caseta_obra'] },
  { value: 'instal_caseta_obra_portes', label: 'Caseta d\'obra: portes', options: ['frontal', 'frontal_superior'] },
  { value: 'instal_caseta_obra_llarg', label: 'Caseta d\'obra: llarg (m)', options: [] },
  { value: 'instal_caseta_obra_ample', label: 'Caseta d\'obra: ample (m)', options: [] },
  { value: 'instal_caseta_obra_alt', label: 'Caseta d\'obra: alt (m)', options: [] },
  { value: 'instal_afm_enabled', label: 'AFM activat', options: ['true', 'false'] },
  { value: 'instal_wifi_enabled', label: 'Wi-Fi activat', options: ['true', 'false'] },
  { value: 'instal_canvi_medi_enabled', label: 'Canvi sorra/vidre activat', options: ['true', 'false'] },
  // ── Instal·lacions: artículos seleccionados (incluido vs opcional) ──
  { value: 'instal_filtre_polies_enabled', label: 'Filtre polièster inclòs', options: ['true', 'false'] },
  { value: 'instal_filtre_polies_opcional', label: 'Filtre polièster opcional', options: ['true', 'false'] },
  { value: 'instal_filtre_especial_enabled', label: 'Filtre especial inclòs', options: ['true', 'false'] },
  { value: 'instal_filtre_especial_opcional', label: 'Filtre especial opcional', options: ['true', 'false'] },
  { value: 'instal_bomba_onoff_enabled', label: 'Bomba ON/OFF inclosa', options: ['true', 'false'] },
  { value: 'instal_bomba_onoff_opcional', label: 'Bomba ON/OFF opcional', options: ['true', 'false'] },
  { value: 'instal_bomba_variable_enabled', label: 'Bomba variable inclosa', options: ['true', 'false'] },
  { value: 'instal_bomba_variable_opcional', label: 'Bomba variable opcional', options: ['true', 'false'] },
  { value: 'instal_dosificacio_std_enabled', label: 'Dosificació estàndard inclosa', options: ['true', 'false'] },
  { value: 'instal_dosificacio_std_opcional', label: 'Dosificació estàndard opcional', options: ['true', 'false'] },
  { value: 'instal_dosificacio_std_is_hc', label: 'Model dosificació estàndard és HC', options: ['true', 'false'] },
  { value: 'instal_dosificacio_hc_option', label: 'Opció HC: Redox / Kit Clor Lliure', options: ['redox', 'kit_clor'] },
  { value: 'instal_hidrolisi_enabled', label: 'Hidròlisi sal inclosa', options: ['true', 'false'] },
  { value: 'instal_hidrolisi_opcional', label: 'Hidròlisi sal opcional', options: ['true', 'false'] },
  // ── Accessoris ──
  { value: 'acc_escala_enabled', label: 'Escala accessori inclosa', options: ['true', 'false'] },
  { value: 'acc_dutxa_enabled', label: 'Dutxa inclosa', options: ['true', 'false'] },
  { value: 'acc_plat_dutxa_enabled', label: 'Plat dutxa inclòs', options: ['true', 'false'] },
  { value: 'acc_cascada_enabled', label: 'Cascada inclosa', options: ['true', 'false'] },
  { value: 'acc_cascada_encastada', label: 'Cascada encastada', options: ['true', 'false'] },
  { value: 'acc_salvavides_enabled', label: 'Salvavides inclòs', options: ['true', 'false'] },
  { value: 'acc_focus_led_variant', label: 'Variant focus LED', options: ['blanc', 'rgb'] },
  // ── Annex: estados (3-state) ──
  { value: 'annex_excavacio_estat', label: 'Annex excavació', options: ['inclos', 'opcional', 'no_aplica'] },
  { value: 'annex_paviment_estat', label: 'Annex paviment', options: ['inclos', 'opcional', 'no_aplica'] },
  { value: 'annex_gespa_estat', label: 'Annex gespa', options: ['inclos', 'opcional', 'no_aplica'] },
  { value: 'annex_cobertor_estat', label: 'Annex cobertor', options: ['inclos', 'opcional', 'no_aplica'] },
  { value: 'annex_cobertor_tipus', label: 'Annex cobertor — tipus', options: ['fora_aigua', 'submergit'] },
  { value: 'annex_cobertor_model_code', label: 'Annex cobertor — model', options: ['e-basic', 'e-classic', 'e-classic-lux', 'e-spark', 'e-solar', 'e-playa-classic', 'e-playa-dsign', 's-premium', 's-premium-cs', 's-lux'] },
  { value: 'annex_cobertor_lames', label: 'Annex cobertor — lames', options: ['pvc', 'policarbonat'] },
  { value: 'annex_cobertor_mur_nou', label: 'Annex cobertor — mur nou (s-Lux)', options: ['true', 'false'] },
  { value: 'annex_robot_estat', label: 'Annex robot', options: ['inclos', 'opcional', 'no_aplica'] },
  { value: 'annex_bomba_calor_estat', label: 'Annex bomba de calor', options: ['inclos', 'opcional', 'no_aplica'] },
  { value: 'annex_netejafons_estat', label: 'Annex netejafons', options: ['inclos', 'opcional', 'no_aplica'] },
  { value: 'annex_projecte_estat', label: 'Annex projecte', options: ['inclos', 'opcional', 'no_aplica'] },
  { value: 'annex_paviment_material', label: 'Annex paviment material', options: ['aplacat', 'fusta'] },
  // ── Annex: paviment perimetral toggles ──
  { value: 'annex_paviment_reforma_enabled', label: 'Paviment: reforma existent', options: ['true', 'false'] },
  { value: 'annex_paviment_nou_enabled', label: 'Paviment: nou', options: ['true', 'false'] },
  { value: 'annex_paviment_retirada_enabled', label: 'Paviment: retirada ceràmica existent', options: ['true', 'false'] },
  { value: 'annex_paviment_regularitzacio_enabled', label: 'Paviment: regularització llosa existent', options: ['true', 'false'] },
  { value: 'annex_paviment_formigo_enabled', label: 'Paviment: incloure formigó de base', options: ['true', 'false'] },
  { value: 'annex_paviment_actuacio', label: 'Paviment nou: actuació', options: ['suministre_col', 'col', 'suministre'] },
  { value: 'annex_paviment_format', label: 'Paviment nou: format aplacat', options: ['31 × 62 cm', '48 × 98 cm', '98 × 98 cm'] },
  { value: 'annex_paviment_model_a_determinar', label: 'Paviment: model a determinar', options: ['true', 'false'] },
  { value: 'annex_bomba_calor_coberta', label: 'Bomba calor amb coberta', options: ['true', 'false'] },
];

const CONDITION_FIELD_LABELS = Object.fromEntries(CONDITION_FIELDS.map((field) => [field.value, field.label]));

const UNITS = ['m²', 'ml', 'ud', '€', 'sacs', 'kg', 'l', 'm³'];

// ── Variable categories for display (Spanish) ──────
const VAR_CATEGORIES: Record<string, string> = {
  pool_dimensions: 'Dimensiones piscina',
  stairs: 'Escaleras',
  construction: 'Construcción',
  acabats: 'Acabados',
  instalacions: 'Instalaciones',
  accessoris: 'Accesorios',
};

// ── Functions list (Spanish) ───────────────────────
const FUNCTIONS_LIST = [
  { name: 'articlePrice', syntax: "articlePrice('nombre-articulo')", desc: 'Busca un artículo por nombre/referencia → devuelve { sale, cost, supplyOnly }', example: "articlePrice('mano-obra-estructura').sale", insert: "articlePrice('').sale" },
  { name: 'modelPrice', syntax: "modelPrice('coronament' | 'revestiment' | 'opcional_revestiment')", desc: 'Lee el modelo seleccionado por el usuario en el wizard. Si no hay modelo o se marca "a determinar", usa un placeholder (CORONA_TBD / GRESITE_25_TBD / GRESITE_5_TBD / PORCELANIC_TBD). Devuelve { sale, cost, supplyOnly }', example: "modelPrice('coronament').sale", insert: "modelPrice('coronament').sale" },
  { name: 'roundUp', syntax: 'roundUp(valor, decimales)', desc: 'Redondear hacia arriba (como REDONDEAR.MAS en Excel)', example: 'roundUp(pool_surface * 0.23)', insert: 'roundUp()' },
  { name: 'roundDown', syntax: 'roundDown(valor, decimales)', desc: 'Redondear hacia abajo', example: 'roundDown(25.8)', insert: 'roundDown()' },
  { name: 'round', syntax: 'round(valor, decimales)', desc: 'Redondear al decimal especificado (2 por defecto)', example: 'round(123.456, 2)', insert: 'round()' },
  { name: 'maxVal', syntax: 'maxVal(a, b)', desc: 'El mayor de dos valores', example: 'maxVal(50, pool_surface)', insert: 'maxVal()' },
  { name: 'minVal', syntax: 'minVal(a, b)', desc: 'El menor de dos valores', example: 'minVal(100, pool_surface)', insert: 'minVal()' },
  { name: 'ifVal', syntax: 'ifVal(condición, siTrue, siFalse)', desc: 'Condicional (como SI() en Excel)', example: "ifVal(waterproofing_system === 'lamina_proof', 100, 50)", insert: "ifVal(, , )" },
];

// ── Autocomplete hook ──────────────────────────────
function useFormulaAutocomplete(
  variables: FormulaVariable[],
  articles: any[],
) {
  const allSuggestions = useMemo(() => {
    const items: { label: string; insert: string; detail: string; type: 'variable' | 'function' | 'article' }[] = [];
    variables.forEach((v) => {
      items.push({ label: v.variable_name, insert: v.variable_name, detail: v.label, type: 'variable' });
    });
    FUNCTIONS_LIST.forEach((f) => {
      items.push({ label: f.name, insert: f.insert, detail: f.desc, type: 'function' });
    });
    articles.forEach((a: any) => {
      const name = a.name || '';
      items.push({
        label: `articlePrice('${name}')`,
        insert: `articlePrice('${name}').sale`,
        detail: `${name} — Precio venta: ${((a.sale_price ?? 0) / 100).toFixed(2)}€`,
        type: 'article',
      });
    });
    return items;
  }, [variables, articles]);

  return allSuggestions;
}

// ── FormulaTextarea with autocomplete ──────────────
function FormulaTextarea({
  value,
  onChange,
  placeholder,
  suggestions,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  suggestions: { label: string; insert: string; detail: string; type: string }[];
  className?: string;
}) {
  const [showAC, setShowAC] = useState(false);
  const [acFilter, setAcFilter] = useState('');
  const [acIndex, setAcIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filtered = useMemo(() => {
    if (!acFilter || acFilter.length < 2) return [];
    const lower = acFilter.toLowerCase();
    return suggestions.filter((s) =>
      s.label.toLowerCase().includes(lower) || s.detail.toLowerCase().includes(lower)
    ).slice(0, 12);
  }, [acFilter, suggestions]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart || 0;
    onChange(val);
    setCursorPos(pos);

    // Extract current word being typed
    const before = val.slice(0, pos);
    const match = before.match(/[\w']+$/);
    const word = match ? match[0] : '';
    setAcFilter(word);
    setShowAC(word.length >= 2);
    setAcIndex(0);
  };

  const insertSuggestion = (suggestion: { insert: string }) => {
    const before = value.slice(0, cursorPos);
    const after = value.slice(cursorPos);
    const match = before.match(/[\w']+$/);
    const wordStart = match ? cursorPos - match[0].length : cursorPos;
    const newVal = value.slice(0, wordStart) + suggestion.insert + after;
    onChange(newVal);
    setShowAC(false);
    setAcFilter('');
    // Focus back
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = wordStart + suggestion.insert.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showAC || filtered.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setAcIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAcIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filtered[acIndex]) { e.preventDefault(); insertSuggestion(filtered[acIndex]); }
    }
    else if (e.key === 'Escape') { setShowAC(false); }
  };

  const typeColor = (type: string) => {
    if (type === 'variable') return 'text-blue-600';
    if (type === 'function') return 'text-green-600';
    return 'text-amber-600';
  };

  const typeBadge = (type: string) => {
    if (type === 'variable') return 'VAR';
    if (type === 'function') return 'FN';
    return 'ART';
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setShowAC(false), 200)}
        className={className}
        placeholder={placeholder}
        spellCheck={false}
      />
      {showAC && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.map((s, i) => (
            <button
              key={s.label + s.insert}
              onMouseDown={(e) => { e.preventDefault(); insertSuggestion(s); }}
              className={cn(
                'w-full text-left px-3 py-2 flex items-center gap-2 text-xs hover:bg-muted transition-colors',
                i === acIndex && 'bg-muted'
              )}
            >
              <span className={cn('font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted font-bold', typeColor(s.type))}>
                {typeBadge(s.type)}
              </span>
              <span className="font-mono font-medium text-foreground truncate">{s.label}</span>
              <span className="text-muted-foreground truncate ml-auto text-[11px]">{s.detail}</span>
            </button>
          ))}
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border bg-muted/30">
            ↑↓ navegar · Tab/Enter insertar · Esc cerrar
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Panel Component ───────────────────────────
export function FormulaEnginePanel() {
  const [selectedType, setSelectedType] = useState('obra_nova');
  const [selectedPhase, setSelectedPhase] = useState('estructura');
  const [editRule, setEditRule] = useState<FormulaRule | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [simOpen, setSimOpen] = useState(false);
  const [simValues, setSimValues] = useState<Record<string, any>>({ ...DEFAULT_SIM_VALUES });

  const queryClient = useQueryClient();
  const budgetType = BUDGET_TYPES.find((t) => t.id === selectedType);
  const phases = budgetType?.phases || [];

  // ── Queries ──────────────────────────────────────
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['formula-rules', selectedType, selectedPhase],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formula_rules')
        .select('*')
        .eq('budget_type', selectedType)
        .eq('phase', selectedPhase)
        .order('order_index');
      if (error) throw error;
      return data as FormulaRule[];
    },
  });

  const { data: variables = [] } = useQuery({
    queryKey: ['formula-variables'],
    queryFn: async () => {
      const { data, error } = await supabase.from('formula_variables').select('*').order('category').order('variable_name');
      if (error) throw error;
      return data as FormulaVariable[];
    },
  });

  const { data: articles = [] } = useQuery({
    queryKey: ['articles-for-formulas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('articles').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // ── Simulation context ───────────────────────────
  const simContext = useMemo(
    () => buildVariablesContext(simValues, articles),
    [simValues, articles]
  );

  const simulateRule = useCallback(
    (rule: FormulaRule, defaultCostRatio?: number) => evaluateFormulaRuleWithContext(rule, simContext, { defaultCostRatio }),
    [simContext]
  );

  // ── Mutations ────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (rule: Partial<FormulaRule> & { id?: string }) => {
      if (rule.id && !isNew) {
        const { error } = await supabase.from('formula_rules').update({
          name: rule.name, description: rule.description, sub_phase: rule.sub_phase,
          order_index: rule.order_index, formula_sale: rule.formula_sale, formula_cost: rule.formula_cost,
          formula_quantity: rule.formula_quantity,
          unit: rule.unit, article_ref: rule.article_ref, is_active: rule.is_active,
          is_conditional: rule.is_conditional, condition_field: rule.condition_field,
          condition_value: rule.condition_value, notes: rule.notes,
        } as any).eq('id', rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('formula_rules').insert({
          budget_type: selectedType, phase: selectedPhase,
          name: rule.name, description: rule.description, sub_phase: rule.sub_phase,
          order_index: rule.order_index ?? rules.length, formula_sale: rule.formula_sale ?? '0',
          formula_cost: rule.formula_cost, formula_quantity: rule.formula_quantity,
          unit: rule.unit, article_ref: rule.article_ref,
          is_active: rule.is_active ?? true, is_conditional: rule.is_conditional ?? false,
          condition_field: rule.condition_field, condition_value: rule.condition_value,
          notes: rule.notes,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formula-rules'] });
      toast.success('Regla guardada');
      setEditRule(null);
      setIsNew(false);
    },
    onError: (err: any) => toast.error(err.message || 'Error guardant'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('formula_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formula-rules'] });
      toast.success('Regla eliminada');
      setDeleteId(null);
    },
    onError: () => toast.error('Error eliminant'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('formula_rules').update({ is_active: active } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['formula-rules'] }),
  });

  // ── Helpers ──────────────────────────────────────
  const openNew = () => {
    setIsNew(true);
    setEditRule({
      id: crypto.randomUUID(),
      budget_type: selectedType,
      phase: selectedPhase,
      sub_phase: null,
      order_index: rules.length,
      name: '',
      description: null,
      formula_sale: '0',
      formula_cost: null,
      formula_quantity: null,
      unit: 'ud',
      article_ref: null,
      is_active: true,
      is_conditional: false,
      condition_field: null,
      condition_value: null,
      notes: null,
    });
  };

  const phaseLabel = phases.find((p) => p.id === selectedPhase)?.label || selectedPhase;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Motor de Càlcul</h2>
          <p className="text-sm text-muted-foreground">Configura les fórmules de càlcul de cada fase del pressupost</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* ── Left sidebar: type/phase nav ────────── */}
        <div className="lg:w-56 flex-shrink-0 space-y-1">
          {BUDGET_TYPES.map((bt) => (
            <div key={bt.id}>
              <button
                onClick={() => { setSelectedType(bt.id); if (bt.phases.length > 0) setSelectedPhase(bt.phases[0].id); }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors',
                  selectedType === bt.id ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                )}
              >
                {bt.label}
              </button>
              {selectedType === bt.id && bt.phases.length > 0 && (
                <div className="ml-4 mt-1 space-y-0.5">
                  {bt.phases.map((ph) => (
                    <button
                      key={ph.id}
                      onClick={() => setSelectedPhase(ph.id)}
                      className={cn(
                        'w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors',
                        selectedPhase === ph.id ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {ph.label}
                    </button>
                  ))}
                </div>
              )}
              {selectedType === bt.id && bt.phases.length === 0 && (
                <p className="ml-4 mt-1 text-xs text-muted-foreground italic px-3 py-2">Pròximament</p>
              )}
            </div>
          ))}
        </div>

        {/* ── Main content ───────────────────────── */}
        <div className="flex-1 min-w-0">
          {phases.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Pròximament — Les fórmules per {budgetType?.label} s'habilitaran aviat.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  {phaseLabel} · {budgetType?.label}
                </h3>
                <div className="flex gap-2">
                  <button onClick={() => setSimOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
                    <Play className="w-4 h-4" /> Simular pressupost
                  </button>
                  <button onClick={openNew}
                    className="gradient-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 shadow-md">
                    <Plus className="w-4 h-4" /> Nova partida
                  </button>
                </div>
              </div>

              {/* Rules table */}
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : rules.length === 0 ? (
                <div className="bg-card rounded-xl border border-border p-12 text-center">
                  <p className="text-muted-foreground mb-3">Encara no hi ha partides configurades per a {phaseLabel}.</p>
                  <button onClick={openNew} className="text-primary font-medium hover:underline text-sm">+ Afegir primera partida</button>
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed text-sm">
                      <colgroup>
                        <col className="w-7" />
                        <col className="w-[150px]" />
                        <col className="w-[70px]" />
                        <col className="w-[140px]" />
                        <col className="w-[210px]" />
                        <col className="w-[90px]" />
                        <col className="w-[55px]" />
                        <col className="w-[70px]" />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-1 py-2.5"></th>
                          <th className="text-left px-2 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Nom</th>
                          <th className="text-left px-2 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Subfase</th>
                          <th className="text-left px-2 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Condició</th>
                          <th className="text-left px-2 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Fórmula venda</th>
                          <th className="text-right px-2 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Resultat (sim.)</th>
                          <th className="text-center px-1 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Activa</th>
                          <th className="text-right px-1 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Accions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {rules.map((rule) => {
                          const simResult = simulateRule(rule);
                          const conditionSummary = summarizeRuleConditions(rule, CONDITION_FIELD_LABELS);
                          return (
                            <tr key={rule.id} className={cn('hover:bg-muted/30 transition-colors', !rule.is_active && 'opacity-50')}>
                              <td className="px-1 py-2"><GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" /></td>
                              <td className="px-2 py-2 font-medium text-foreground truncate" title={rule.name}>{rule.name}</td>
                              <td className="px-2 py-2 overflow-hidden">
                                {rule.sub_phase && (
                                  <span
                                    className="inline-block max-w-full truncate align-bottom px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground font-medium capitalize"
                                    title={rule.sub_phase}
                                  >
                                    {rule.sub_phase}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-2 overflow-hidden">
                                {rule.is_conditional && conditionSummary && (
                                  <span
                                    className="inline-block max-w-full truncate align-bottom px-2 py-0.5 rounded-full text-xs bg-warning/15 text-warning font-medium"
                                    title={`si ${conditionSummary}`}
                                  >
                                    si {conditionSummary}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-2 overflow-hidden">
                                <code
                                  className="text-xs bg-muted px-2 py-0.5 rounded font-mono truncate block"
                                  title={rule.formula_sale}
                                >
                                  {rule.formula_sale}
                                </code>
                              </td>
                              <td className="px-2 py-2 text-right">
                                {!simResult ? (
                                  <span className="text-muted-foreground text-xs">No aplica</span>
                                ) : simResult.error ? (
                                  <span className="text-destructive text-xs flex items-center justify-end gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Error
                                  </span>
                                ) : (
                                  <span className="text-primary font-medium text-xs">
                                    {simResult.sale.toLocaleString('ca-ES', { minimumFractionDigits: 2 })} €
                                  </span>
                                )}
                              </td>
                              <td className="px-1 py-2 text-center">
                                <button onClick={() => toggleActiveMutation.mutate({ id: rule.id, active: !rule.is_active })}>
                                  {rule.is_active
                                    ? <ToggleRight className="w-5 h-5 text-success" />
                                    : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                                </button>
                              </td>
                              <td className="px-1 py-2">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => { setIsNew(false); setEditRule(rule); }} className="p-1.5 rounded-md hover:bg-muted"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                                  <button onClick={() => setDeleteId(rule.id)} className="p-1.5 rounded-md hover:bg-destructive/10"><Trash2 className="w-4 h-4 text-destructive" /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Phase simulation total */}
                  <div className="border-t border-border bg-muted/30 px-4 py-3 flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">TOTAL {phaseLabel.toUpperCase()} (simulació)</span>
                    <span className="text-base font-bold text-primary">
                      {rules
                        .filter((r) => r.is_active)
                        .reduce((sum, r) => sum + (simulateRule(r)?.sale || 0), 0)
                        .toLocaleString('ca-ES', { minimumFractionDigits: 2 })} €
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit / Create modal ──────────────────── */}
      {editRule && (
        <RuleEditModal
          rule={editRule}
          isNew={isNew}
          variables={variables}
          simContext={simContext}
          subPhases={SUB_PHASES[selectedPhase] || ['general']}
          articles={articles}
          onSave={(rule) => saveMutation.mutate(rule)}
          onClose={() => { setEditRule(null); setIsNew(false); }}
          saving={saveMutation.isPending}
        />
      )}

      {/* ── Simulator modal ──────────────────────── */}
      <Dialog open={simOpen} onOpenChange={setSimOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Simulador de pressupost</DialogTitle>
          </DialogHeader>
          <SimulatorPanel simValues={simValues} setSimValues={setSimValues} />
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ──────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar partida?</AlertDialogTitle>
            <AlertDialogDescription>Aquesta acció no es pot desfer.</AlertDialogDescription>
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

// ── Rule Edit Modal ────────────────────────────────
function RuleEditModal({
  rule, isNew, variables, simContext, subPhases, articles, onSave, onClose, saving,
}: {
  rule: FormulaRule;
  isNew: boolean;
  variables: FormulaVariable[];
  simContext: Record<string, any>;
  subPhases: string[];
  articles: any[];
  onSave: (rule: FormulaRule) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormulaRule>({ ...rule });
  const [useSeparateCost, setUseSeparateCost] = useState(!!rule.formula_cost);
  const [costRatio, setCostRatio] = useState(0.65);
  const [varsOpen, setVarsOpen] = useState(false);
  const [funcsOpen, setFuncsOpen] = useState(false);
  const [conditionGroups, setConditionGroups] = useState<RuleConditionGroup[]>(() => {
    const parsed = parseRuleConditionGroups(rule);
    return parsed.length > 0 ? parsed : [{ pairs: [{ field: '', value: '', op: 'eq' }] }];
  });

  const previewRule = useMemo(
    () => ({
      ...form,
      formula_cost: useSeparateCost ? form.formula_cost : null,
    }),
    [form, useSeparateCost]
  );

  const appliesInSimulation = useMemo(
    () => ruleApplies(previewRule, simContext),
    [previewRule, simContext]
  );

  const previewResult = useMemo(
    () => appliesInSimulation ? evaluateFormulaRuleWithContext(previewRule, simContext, { defaultCostRatio: costRatio }) : null,
    [appliesInSimulation, previewRule, simContext, costRatio]
  );

  const quantityPreview = previewResult?.quantity ?? 0;
  const unitSalePreview = previewResult ? (form.formula_quantity ? previewResult.unitSale : previewResult.sale) : 0;
  const unitCostPreview = previewResult ? (form.formula_quantity ? previewResult.unitCost : previewResult.cost) : 0;

  const update = (patch: Partial<FormulaRule>) => setForm((f) => ({ ...f, ...patch }));

  const updatePair = (groupIndex: number, pairIndex: number, patch: Partial<RuleConditionPair>) => {
    setConditionGroups((groups) =>
      groups.map((g, gi) =>
        gi !== groupIndex
          ? g
          : { pairs: g.pairs.map((p, pi) => (pi === pairIndex ? { ...p, ...patch } : p)) }
      )
    );
  };

  const addPair = (groupIndex: number) => {
    setConditionGroups((groups) =>
      groups.map((g, gi) => (gi !== groupIndex ? g : { pairs: [...g.pairs, { field: '', value: '', op: 'eq' }] }))
    );
  };

  const removePair = (groupIndex: number, pairIndex: number) => {
    setConditionGroups((groups) =>
      groups
        .map((g, gi) => (gi !== groupIndex ? g : { pairs: g.pairs.filter((_, pi) => pi !== pairIndex) }))
        .map((g) => (g.pairs.length === 0 ? { pairs: [{ field: '', value: '', op: 'eq' }] } : g))
    );
  };

  const addGroup = () =>
    setConditionGroups((groups) => [...groups, { pairs: [{ field: '', value: '', op: 'eq' }] }]);

  const removeGroup = (groupIndex: number) =>
    setConditionGroups((groups) => {
      const next = groups.filter((_, gi) => gi !== groupIndex);
      return next.length > 0 ? next : [{ pairs: [{ field: '', value: '', op: 'eq' }] }];
    });

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("El nom és obligatori"); return; }
    const serializedConditions = form.is_conditional
      ? serializeRuleConditionGroups(conditionGroups)
      : { condition_field: null, condition_value: null };
    if (form.is_conditional && !serializedConditions.condition_field) {
      toast.error('Define al menos una condición válida');
      return;
    }
    onSave({
      ...form,
      ...serializedConditions,
      formula_cost: useSeparateCost ? form.formula_cost : null,
    });
  };

  const suggestions = useFormulaAutocomplete(variables, articles);

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20';
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

  const grouped = useMemo(() => {
    const groups: Record<string, FormulaVariable[]> = {};
    variables.forEach((v) => {
      const cat = v.category || 'altres';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(v);
    });
    return groups;
  }, [variables]);

  const conditionPreview = useMemo(() => {
    const parts = conditionGroups
      .map((g) => {
        const valid = g.pairs.filter((p) => p.field && (operatorNeedsValue(p.op ?? 'eq') ? p.value : true));
        if (valid.length === 0) return '';
        const inner = valid
          .map((p) => formatPair(p, CONDITION_FIELD_LABELS))
          .join(' O ');
        return valid.length > 1 ? `(${inner})` : inner;
      })
      .filter(Boolean);
    return parts.join(' Y ');
  }, [conditionGroups]);

  // When an article ref is selected, auto-fill both sale and cost formulas
  const handleArticleRefChange = (articleName: string) => {
    if (!articleName) {
      update({ article_ref: null });
      return;
    }
    const patch: Partial<FormulaRule> = { article_ref: articleName };
    const saleEmpty = !form.formula_sale || form.formula_sale === '0';
    const costEmpty = !form.formula_cost;
    if (saleEmpty) {
      patch.formula_sale = `articlePrice('${articleName}').sale`;
    }
    if (costEmpty) {
      patch.formula_cost = `articlePrice('${articleName}').cost`;
      setUseSeparateCost(true);
    }
    update(patch);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Nova partida' : `Editar: ${rule.name}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Section 1: Identification */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">Identificació</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Nom de la partida *</label>
                <input value={form.name} onChange={(e) => update({ name: e.target.value })} className={inputClass} placeholder="Ex: Mà d'obra estructura" />
              </div>
              <div>
                <label className={labelClass}>Subfase</label>
                <select value={form.sub_phase || ''} onChange={(e) => update({ sub_phase: e.target.value || null })} className={inputClass}>
                  <option value="">— Cap —</option>
                  {subPhases.map((sp) => <option key={sp} value={sp} className="capitalize">{sp}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Unitat</label>
                <select value={form.unit || 'ud'} onChange={(e) => update({ unit: e.target.value })} className={inputClass}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Ordre</label>
                <input type="number" value={form.order_index} onChange={(e) => update({ order_index: parseInt(e.target.value) || 0 })} className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Descripció</label>
                <textarea value={form.description || ''} onChange={(e) => update({ description: e.target.value || null })} className={cn(inputClass, 'min-h-[60px]')} placeholder="Explicació del càlcul..." />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Artículo de referencia</label>
                <select value={form.article_ref || ''} onChange={(e) => handleArticleRefChange(e.target.value)} className={inputClass}>
                  <option value="">— Ninguno —</option>
                  {articles.map((a: any) => (
                    <option key={a.id} value={a.name}>{a.name} {a.reference ? `(${a.reference})` : ''} — {((a.sale_price ?? 0) / 100).toFixed(2)}€</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Si eliges un artículo de referencia y además defines una <strong>fórmula de cantidad</strong>, el sistema usará automáticamente el
                  <strong> precio unitario de venta y coste</strong> del artículo para evitar duplicar cálculos.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Condition */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">Condición</h4>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_conditional} onChange={(e) => {
                const isConditional = e.target.checked;
                update({ is_conditional: isConditional });
                if (isConditional && conditionGroups.length === 0) {
                  setConditionGroups([{ pairs: [{ field: '', value: '', op: 'eq' }] }]);
                }
              }}
                className="w-4 h-4 rounded border-input" />
              <span className="text-sm text-foreground">Esta partida es condicional</span>
            </label>
            <p className="text-xs text-muted-foreground pl-6">
              Crea uno o varios <strong>grupos</strong>. Dentro de un mismo grupo las condiciones se combinan con <strong>O (cualquiera)</strong>.
              Entre grupos se combinan con <strong>Y (todos los grupos deben cumplirse)</strong>.
            </p>
            {form.is_conditional && (
              <div className="space-y-4 pl-6">
                {conditionGroups.map((group, groupIndex) => (
                  <div key={groupIndex} className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        Grupo {groupIndex + 1}
                        <span className="ml-2 text-muted-foreground font-normal">
                          (cualquiera de las siguientes condiciones)
                        </span>
                      </span>
                      {conditionGroups.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeGroup(groupIndex)}
                          className="text-xs text-destructive hover:underline"
                        >
                          Eliminar grupo
                        </button>
                      )}
                    </div>

                    {group.pairs.map((pair, pairIndex) => {
                      const selectedField = CONDITION_FIELDS.find((field) => field.value === pair.field);
                      const op: ConditionOperator = (pair.op ?? 'eq') as ConditionOperator;
                      const needsValue = operatorNeedsValue(op);
                      return (
                        <div key={pairIndex} className="grid grid-cols-1 md:grid-cols-[1fr_120px_1fr_auto] gap-3 items-end">
                          <div>
                            <label className={labelClass}>Campo del presupuesto</label>
                            <select
                              value={pair.field}
                              onChange={(e) => updatePair(groupIndex, pairIndex, { field: e.target.value, value: '' })}
                              className={inputClass}
                            >
                              <option value="">— Seleccionar —</option>
                              {CONDITION_FIELDS.map((field) => (
                                <option key={field.value} value={field.value}>{field.label} ({field.value})</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelClass}>Operador</label>
                            <select
                              value={op}
                              onChange={(e) => {
                                const nextOp = e.target.value as ConditionOperator;
                                updatePair(groupIndex, pairIndex, {
                                  op: nextOp,
                                  // Clear value when switching to is_true / is_false
                                  value: operatorNeedsValue(nextOp) ? pair.value : '',
                                });
                              }}
                              className={inputClass}
                            >
                              <option value="eq">{OPERATOR_LABELS.eq} (igual)</option>
                              <option value="neq">{OPERATOR_LABELS.neq} (diferent)</option>
                              <option value="is_true">{OPERATOR_LABELS.is_true}</option>
                              <option value="is_false">{OPERATOR_LABELS.is_false}</option>
                            </select>
                          </div>
                          <div>
                            <label className={labelClass}>Valor que activa la partida</label>
                            {!needsValue ? (
                              <div className={cn(inputClass, 'flex items-center text-muted-foreground italic')}>
                                — sense valor —
                              </div>
                            ) : selectedField && selectedField.options.length > 0 ? (
                              <select
                                value={pair.value}
                                onChange={(e) => updatePair(groupIndex, pairIndex, { value: e.target.value })}
                                className={inputClass}
                              >
                                <option value="">— Seleccionar valor —</option>
                                {selectedField.options.map((option) => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                value={pair.value}
                                onChange={(e) => updatePair(groupIndex, pairIndex, { value: e.target.value })}
                                className={inputClass}
                                placeholder="Ej: gunite, true..."
                              />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removePair(groupIndex, pairIndex)}
                            className="h-11 px-3 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
                            disabled={group.pairs.length === 1}
                            title="Eliminar condición"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => addPair(groupIndex)}
                      className="text-xs text-primary font-medium hover:underline w-fit"
                    >
                      + Añadir condición O a este grupo
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addGroup}
                  className="text-xs font-semibold text-primary hover:underline w-fit border border-dashed border-primary/40 px-3 py-2 rounded-lg"
                >
                  + Añadir grupo (Y otra condición obligatoria)
                </button>

                {conditionPreview && (
                  <p className="text-xs text-muted-foreground bg-warning/10 px-3 py-1.5 rounded">
                    ✅ Esta partida se aplica cuando <code className="font-mono font-bold">{conditionPreview}</code>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Sale formula */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">Fórmula de venta</h4>
            <p className="text-xs text-muted-foreground">
              Escribe la fórmula usando variables y funciones. Empieza a escribir y aparecerá un autocompletado con las opciones disponibles (mínimo 2 caracteres).
            </p>
            <FormulaTextarea
              value={form.formula_sale}
              onChange={(val) => update({ formula_sale: val })}
              placeholder="Ej: pool_surface * articlePrice('mano-obra').sale"
              suggestions={suggestions}
              className={cn(inputClass, 'min-h-[80px] font-mono text-xs bg-muted/50')}
            />

            {/* Variables chips */}
            <div>
              <button onClick={() => setVarsOpen(!varsOpen)} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <ChevronDown className={cn('w-3 h-3 transition-transform', varsOpen && 'rotate-180')} />
                Variables disponibles (clic para insertar)
              </button>
              {varsOpen && (
                <div className="mt-2 space-y-2 bg-muted/30 rounded-lg p-3">
                  {Object.entries(grouped).map(([cat, vars]) => (
                    <div key={cat}>
                      <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{VAR_CATEGORIES[cat] || cat}</p>
                      <div className="flex flex-wrap gap-1">
                        {vars.map((v) => (
                          <button
                            key={v.variable_name}
                            onClick={() => update({ formula_sale: form.formula_sale + v.variable_name })}
                            className="group relative px-2 py-0.5 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20 font-mono"
                          >
                            {v.variable_name}
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-foreground text-background text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                              {v.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Functions list */}
            <div>
              <button onClick={() => setFuncsOpen(!funcsOpen)} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <ChevronDown className={cn('w-3 h-3 transition-transform', funcsOpen && 'rotate-180')} />
                Funciones disponibles
              </button>
              {funcsOpen && (
                <div className="mt-2 space-y-2 bg-muted/30 rounded-lg p-3">
                  {FUNCTIONS_LIST.map((fn) => (
                    <div key={fn.name} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-start gap-2 text-xs">
                        <code className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded whitespace-nowrap font-bold">{fn.syntax}</code>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 ml-1">{fn.desc}</p>
                      <p className="text-[11px] text-foreground/70 mt-0.5 ml-1">
                        📝 Ejemplo: <code className="font-mono bg-muted px-1 rounded">{fn.example}</code>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Cost formula */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">Fórmula de coste</h4>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={useSeparateCost} onChange={(e) => setUseSeparateCost(e.target.checked)}
                className="w-4 h-4 rounded border-input" />
              <span className="text-sm text-foreground">Usar fórmula de coste independiente</span>
            </label>
            {useSeparateCost ? (
              <FormulaTextarea
                value={form.formula_cost || ''}
                onChange={(val) => update({ formula_cost: val || null })}
                placeholder="Fórmula de coste..."
                suggestions={suggestions}
                className={cn(inputClass, 'min-h-[60px] font-mono text-xs bg-muted/50')}
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Coste = Venta ×</span>
                <input type="number" step="0.01" value={costRatio} onChange={(e) => setCostRatio(parseFloat(e.target.value) || 0.65)}
                  className="w-20 px-2 py-1 rounded border border-input bg-background text-sm text-center" />
                <span className="text-xs">(por defecto 0.65 = 65%)</span>
              </div>
            )}
          </div>

          {/* Section 4b: Quantity formula */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">Fórmula de cantidad (opcional)</h4>
            <p className="text-xs text-muted-foreground">
              Si defines una fórmula de cantidad, la venta y el coste se interpretan como importes <strong>unitarios</strong>.
              Si además hay artículo de referencia, esos importes unitarios se toman automáticamente del artículo y aquí solo necesitas escribir la cantidad.
            </p>
            <FormulaTextarea
              value={form.formula_quantity || ''}
              onChange={(val) => update({ formula_quantity: val || null })}
              placeholder="Ej: total_surface, coronament_ml, acc_impulsors_qty..."
              suggestions={suggestions}
              className={cn(inputClass, 'min-h-[50px] font-mono text-xs bg-muted/50')}
            />
            {appliesInSimulation && previewResult && form.formula_quantity && !previewResult.error && (
              <p className="text-xs text-primary">Cantidad calculada: <strong>{quantityPreview}</strong> → Total venta: {previewResult.sale.toLocaleString('ca-ES', { minimumFractionDigits: 2 })} €</p>
            )}
          </div>

          {/* Section 5: Live simulation */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">Simulación en tiempo real</h4>
            {!appliesInSimulation ? (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                Esta partida no aplica con la simulación actual.
              </div>
            ) : form.formula_quantity && previewResult && !previewResult.error ? (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-2">
                <p className="text-xs text-muted-foreground mb-1">Cantidad × Precio unitario</p>
                <p className="text-sm font-medium text-foreground">
                  {quantityPreview} × {unitSalePreview.toLocaleString('ca-ES', { minimumFractionDigits: 2 })} € = <strong className="text-primary">{previewResult.sale.toLocaleString('ca-ES', { minimumFractionDigits: 2 })} €</strong>
                </p>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className={cn('rounded-lg p-3', previewResult?.error ? 'bg-destructive/10 border border-destructive/30' : 'bg-success/10 border border-success/30')}>
                <p className="text-xs text-muted-foreground mb-1">{form.formula_quantity ? 'Precio unitario venta' : 'Resultado venta'}</p>
                {!appliesInSimulation ? (
                  <p className="text-sm text-muted-foreground font-medium">No aplica</p>
                ) : previewResult?.error ? (
                  <p className="text-sm text-destructive font-medium">Error: {previewResult.error}</p>
                ) : (
                  <p className="text-lg font-bold text-success">{unitSalePreview.toLocaleString('ca-ES', { minimumFractionDigits: 2 })} €</p>
                )}
              </div>
              <div className={cn('rounded-lg p-3', previewResult?.error ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted border border-border')}>
                <p className="text-xs text-muted-foreground mb-1">{form.formula_quantity ? 'Precio unitario coste' : 'Resultado coste'}</p>
                {!appliesInSimulation ? (
                  <p className="text-sm text-muted-foreground font-medium">No aplica</p>
                ) : previewResult?.error ? (
                  <p className="text-sm text-destructive font-medium">Error: {previewResult.error}</p>
                ) : (
                  <p className="text-lg font-bold text-foreground">{unitCostPreview.toLocaleString('ca-ES', { minimumFractionDigits: 2 })} €</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 6: Notes */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">Notas internas</h4>
            <textarea
              value={form.notes || ''}
              onChange={(e) => update({ notes: e.target.value || null })}
              className={cn(inputClass, 'min-h-[60px]')}
              placeholder="Notas para el administrador..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="gradient-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 shadow-md disabled:opacity-60">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Simulator Panel ────────────────────────────────
function SimulatorPanel({
  simValues, setSimValues,
}: {
  simValues: Record<string, any>;
  setSimValues: (v: Record<string, any>) => void;
}) {
  const fields = [
    { key: 'pool_length', label: 'Largo piscina (m)', type: 'number' },
    { key: 'pool_width', label: 'Ancho piscina (m)', type: 'number' },
    { key: 'pool_depth_min', label: 'Prof. mínima (m)', type: 'number' },
    { key: 'pool_depth_max', label: 'Prof. máxima (m)', type: 'number' },
    { key: 'ext_stair_length', label: 'Largo esc. exterior (m)', type: 'number' },
    { key: 'ext_stair_width', label: 'Ancho esc. exterior (m)', type: 'number' },
    { key: 'stairs_width', label: 'Ancho escalera (m)', type: 'number' },
    { key: 'stairs_length', label: 'Largo escalera (m)', type: 'number' },
    { key: 'stairs_height', label: 'Altura escalera (m)', type: 'number' },
    { key: 'platform_length', label: 'Largo plataforma (m)', type: 'number' },
    { key: 'platform_width', label: 'Ancho plataforma (m)', type: 'number' },
    { key: 'platform_height', label: 'Altura plataforma (m)', type: 'number' },
    { key: 'bench_length', label: 'Largo banco (m)', type: 'number' },
    { key: 'bench_width', label: 'Ancho banco (m)', type: 'number' },
    { key: 'bench_height', label: 'Altura banco (m)', type: 'number' },
    { key: 'acc_impulsors_qty', label: 'Impulsores (qty)', type: 'number' },
    { key: 'acc_skimmers_qty', label: 'Skimmers (qty)', type: 'number' },
    { key: 'acc_focus_led_qty', label: 'Focos LED (qty)', type: 'number' },
  ];

  const selects = [
    { key: 'waterproofing_system', label: 'Impermeabilización', options: ['impertot', 'hidrofix', 'lamina_proof'] },
    { key: 'construction_system', label: 'Sistema constructivo', options: ['gunite', 'bloc_encofrat'] },
    { key: 'interior_stair_type', label: 'Escalera interior', options: ['estandard', 'plataforma', 'banc', 'tot_ample', 'sense'] },
    { key: 'has_exterior_stair', label: 'Escalera exterior', options: ['true', 'false'] },
    { key: 'coronament_actuacio', label: 'Actuación coronamiento', options: ['suministre_col', 'suministre', 'col'] },
    { key: 'coronament_tipus', label: 'Tipo coronamiento', options: ['gres_31x62', 'gres_31x98', 'gres_50x62', 'gres_98x50', 'pedra_blanca', 'breinco'] },
    { key: 'revestiment_actuacio', label: 'Actuación revestimiento', options: ['suministre_col', 'suministre', 'col'] },
    { key: 'revestiment_tipus', label: 'Tipo revestimiento', options: ['gressite', 'porcelanic'] },
    { key: 'revestiment_format', label: 'Formato revestimiento', options: ['2.5x2.5', '5x5', '31x31', '31x62', '49x98'] },
    { key: 'revestiment_qualitat', label: 'Calidad revestimiento', options: ['estandard', 'premium'] },
  ];

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20';

  // Recalculate derived values (same formula as wizard StepAcabats)
  useEffect(() => {
    const l = Number(simValues.pool_length || 0);
    const w = Number(simValues.pool_width || 0);
    const dMin = Number(simValues.pool_depth_min || 0);
    const dMax = Number(simValues.pool_depth_max || 0);
    const avg = (dMin + dMax) / 2;
    const floorSurface = l * w;
    const perimeter = 2 * (l + w);
    const wallSurface = perimeter * avg;
    const totalPoolSurface = floorSurface + wallSurface;
    const hasExtStair = simValues.has_exterior_stair === 'true' || simValues.has_exterior_stair === true;
    const extStairLen = Number(simValues.ext_stair_length || 0);
    const extStairWid = Number(simValues.ext_stair_width || 0);
    const extStairSurface = hasExtStair ? extStairLen * extStairWid : 0;

    // Coronament ML: same formula as StepAcabats
    // base = (((LARGO+0.3)*2)+2) + (((ANCHO+0.3)*2)+2)
    // if exterior stairs: + (((LARGO_ESCALERA*2)+0.6)+2)
    let coronamentMl = 0;
    if (l > 0 || w > 0) {
      coronamentMl = (((l + 0.3) * 2) + 2) + (((w + 0.3) * 2) + 2);
      if (hasExtStair && extStairLen > 0) {
        coronamentMl += ((extStairLen * 2) + 0.6) + 2;
      }
      coronamentMl = Math.round(coronamentMl * 100) / 100;
    }

    setSimValues({
      ...simValues,
      pool_depth_avg: avg,
      pool_floor_surface: floorSurface,
      pool_wall_surface: wallSurface,
      pool_surface: totalPoolSurface,
      pool_perimeter: perimeter,
      pool_volume_liters: l * w * avg * 1000,
      total_surface: Math.ceil(totalPoolSurface + extStairSurface),
      ext_stair_surface: extStairSurface,
      coronament_ml: coronamentMl,
    });
  }, [simValues.pool_length, simValues.pool_width, simValues.pool_depth_min, simValues.pool_depth_max, simValues.has_exterior_stair, simValues.ext_stair_length, simValues.ext_stair_width]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Modifica los valores para ver cómo cambian los resultados de las fórmulas en tiempo real.</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-foreground mb-1">{f.label}</label>
            <input type="number" step="0.1" value={simValues[f.key] ?? 0}
              onChange={(e) => setSimValues({ ...simValues, [f.key]: parseFloat(e.target.value) || 0 })}
              className={inputClass} />
          </div>
        ))}
        {selects.map((s) => (
          <div key={s.key}>
            <label className="block text-xs font-medium text-foreground mb-1">{s.label}</label>
            <select value={typeof simValues[s.key] === 'boolean' ? String(simValues[s.key]) : (simValues[s.key] ?? '')} onChange={(e) => setSimValues({ ...simValues, [s.key]: e.target.value })} className={inputClass}>
              <option value="">— Sin seleccionar —</option>
              {s.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="bg-muted/30 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div><span className="text-muted-foreground">Sup. vaso:</span> <strong>{(simValues.pool_surface || 0).toFixed(1)} m²</strong></div>
        <div><span className="text-muted-foreground">Suelo:</span> <strong>{(simValues.pool_floor_surface || 0).toFixed(1)} m²</strong></div>
        <div><span className="text-muted-foreground">Paredes:</span> <strong>{(simValues.pool_wall_surface || 0).toFixed(1)} m²</strong></div>
        <div><span className="text-muted-foreground">Sup. total (↑):</span> <strong>{(simValues.total_surface || 0)} m²</strong></div>
        <div><span className="text-muted-foreground">Perímetro:</span> <strong>{(simValues.pool_perimeter || 0).toFixed(1)} ml</strong></div>
        <div><span className="text-muted-foreground">Coronamiento:</span> <strong>{(simValues.coronament_ml || 0).toFixed(2)} ml</strong></div>
        <div><span className="text-muted-foreground">Volumen:</span> <strong>{(simValues.pool_volume_liters || 0).toLocaleString('ca-ES')} L</strong></div>
        <div><span className="text-muted-foreground">Prof. media:</span> <strong>{(simValues.pool_depth_avg || 0).toFixed(2)} m</strong></div>
      </div>
    </div>
  );
}
