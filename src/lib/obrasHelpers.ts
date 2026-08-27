import { supabase } from '@/integrations/supabase/client';

export type ObraStatus = 'activa' | 'pausada' | 'finalitzada';
export type ObraPhaseStatus = 'pendent' | 'en_curs' | 'completada';

export interface Obra {
  id: string;
  budget_id: string;
  budget_number: string;
  client_name: string;
  client_town: string;
  comercial_id: string | null;
  status: ObraStatus;
  start_date: string | null;
  end_date_estimated: string | null;
  end_date_real: string | null;
  total_sale_estimated: number;
  total_cost_estimated: number;
  total_cost_real: number;
  margin_estimated_pct: number;
  margin_real_pct: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObraPhase {
  id: string;
  obra_id: string;
  phase_name: string;
  sale_estimated: number;
  cost_estimated: number;
  cost_real: number;
  status: ObraPhaseStatus;
  order_index: number;
}

export interface ObraCostItem {
  id: string;
  obra_id: string;
  phase_id: string;
  description: string;
  article_id: string | null;
  estimated_qty: number | null;
  estimated_unit_cost: number | null;
  estimated_total_cost: number | null;
  real_qty: number | null;
  real_unit_cost: number | null;
  real_total_cost: number | null;
  invoice_ref: string | null;
  invoice_date: string | null;
  supplier_name: string | null;
  notes: string | null;
  is_extra: boolean;
  sort_order: number | null;
  sub_phase: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObraActivity {
  id: string;
  obra_id: string;
  user_id: string | null;
  user_name: string | null;
  kind: string;
  message: string;
  created_at: string;
}

// Budget amounts are stored in cents. Format from cents to euros.
export const fmtCents = (cents: number | null | undefined) => {
  const n = (cents ?? 0) / 100;
  return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
};

// Same as fmtCents but keeps the decimals — needed for per-unit prices
// (e.g. 0,57 €), which fmtCents' maximumFractionDigits: 0 would round to
// the nearest euro (0,57 -> "1 €").
export const fmtCentsPrecise = (cents: number | null | undefined) => {
  const n = (cents ?? 0) / 100;
  return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};

export const fmtPct = (pct: number | null | undefined) =>
  `${(pct ?? 0).toFixed(1)}%`;

export const marginColorClass = (pct: number) => {
  if (pct > 28) return 'text-success';
  if (pct >= 20) return 'text-warning';
  return 'text-destructive';
};

export const obraStatusBadge: Record<ObraStatus, { label: string; className: string }> = {
  activa: { label: 'Activa', className: 'bg-info/15 text-info' },
  pausada: { label: 'Pausada', className: 'bg-warning/15 text-warning' },
  finalitzada: { label: 'Finalitzada', className: 'bg-success/15 text-success' },
};

export const phaseStatusBadge: Record<ObraPhaseStatus, { label: string; className: string }> = {
  pendent: { label: 'Pendent', className: 'bg-muted text-muted-foreground' },
  en_curs: { label: 'En curs', className: 'bg-info/15 text-info' },
  completada: { label: 'Completada', className: 'bg-success/15 text-success' },
};

export async function logObraActivity(obra_id: string, kind: string, message: string, userId?: string | null, userName?: string | null) {
  await supabase.from('obra_activity' as any).insert({
    obra_id, kind, message, user_id: userId ?? null, user_name: userName ?? null,
  } as any);
}