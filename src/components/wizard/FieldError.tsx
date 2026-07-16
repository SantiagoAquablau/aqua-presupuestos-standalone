import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FieldError({ message, shakeKey, className }: { message?: string; shakeKey?: number; className?: string }) {
  if (!message) return null;
  return (
    <div
      key={shakeKey}
      className={cn(
        'flex items-center gap-1.5 mt-1.5 text-xs font-medium text-destructive animate-shake',
        className
      )}
    >
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}