import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number | undefined | null;
  onChange: (value: number | undefined) => void;
  /** Allow decimal values. Default: true */
  allowDecimals?: boolean;
  /** Number of decimal places to format on blur. Default: 2 when allowDecimals, 0 otherwise */
  decimals?: number;
}

/**
 * NumberInput — a friendly numeric input that:
 *  - Uses type="text" + inputMode so it never shows browser spinner arrows.
 *  - Allows the user to clear the field completely (no forced 0).
 *  - Never produces values like "050" because it works with the local string buffer.
 *  - Supports both integers and decimals (with comma or dot as separator).
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, allowDecimals = true, decimals, className, onBlur, onFocus, ...rest }, ref) => {
    const formatForDisplay = React.useCallback(
      (v: number | undefined | null): string => {
        if (v === undefined || v === null || Number.isNaN(v)) return '';
        return String(v);
      },
      [],
    );

    const [text, setText] = React.useState<string>(() => formatForDisplay(value));
    const focusedRef = React.useRef(false);

    // Sync external changes only when the input is not focused, to avoid
    // disrupting the user while they type (e.g., clearing the field).
    React.useEffect(() => {
      if (!focusedRef.current) {
        setText(formatForDisplay(value));
      }
    }, [value, formatForDisplay]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value.replace(',', '.');

      // Allow empty string (cleared field)
      if (raw === '') {
        setText('');
        onChange(undefined);
        return;
      }

      // Filter to allowed characters
      const pattern = allowDecimals ? /^-?\d*\.?\d*$/ : /^-?\d*$/;
      if (!pattern.test(raw)) return;

      // Strip leading zeros like "050" → "50" (but keep "0" and "0.x")
      if (/^-?0\d/.test(raw)) {
        raw = raw.replace(/^(-?)0+(\d)/, '$1$2');
      }

      setText(raw);

      if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
        onChange(undefined);
        return;
      }
      const parsed = parseFloat(raw);
      onChange(Number.isNaN(parsed) ? undefined : parsed);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      focusedRef.current = true;
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      focusedRef.current = false;
      if (text === '' || text === '-' || text === '.' || text === '-.') {
        setText('');
        onChange(undefined);
      } else {
        const parsed = parseFloat(text);
        if (!Number.isNaN(parsed)) {
          const fixed =
            decimals !== undefined
              ? parsed.toFixed(decimals)
              : allowDecimals
                ? String(parsed)
                : String(Math.trunc(parsed));
          setText(fixed);
          onChange(parseFloat(fixed));
        }
      }
      onBlur?.(e);
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        value={text}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        {...rest}
      />
    );
  },
);
NumberInput.displayName = 'NumberInput';
