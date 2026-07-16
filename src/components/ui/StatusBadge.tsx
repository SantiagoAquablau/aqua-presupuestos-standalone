import { cn } from '@/lib/utils';
import type { BudgetStatus } from '@/stores/budgetStore';

const statusConfig: Record<BudgetStatus, { label: string; className: string }> = {
  borrador: { label: 'Esborrany', className: 'bg-muted text-muted-foreground' },
  enviat: { label: 'Enviat', className: 'bg-info/15 text-info' },
  acceptat: { label: 'Acceptat', className: 'bg-success/15 text-success' },
  rebutjat: { label: 'Rebutjat', className: 'bg-destructive/15 text-destructive' },
};

export function StatusBadge({ status }: { status: BudgetStatus }) {
  const config = statusConfig[status];
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}
