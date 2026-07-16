import { forwardRef, useEffect, useRef, useState } from 'react';

type NativeProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode'
>;

export interface DecimalInputProps extends NativeProps {
  value: number | null | undefined;
  onChange: (value: number | undefined) => void;
  /** Show as integer (no decimals allowed). Defaults to false. */
  integer?: boolean;
}

/**
 * Controlled numeric input that lets the user type decimals naturally.
 * - Preserves the leading zero (`0.60` stays `0.60`, never `.60`).
 * - Accepts both `.` and `,` as decimal separator.
 * - Emits `undefined` for empty / partial values (`""`, `"."`, `","`) so the
 *   caller can distinguish "no value" from actual zero.
 * - Emits the numeric value once the string is a valid number.
 */
export const DecimalInput = forwardRef<HTMLInputElement, DecimalInputProps>(
  function DecimalInput({ value, onChange, integer = false, ...rest }, ref) {
    const toDisplay = (v: number | null | undefined): string =>
      v === undefined || v === null || Number.isNaN(v) ? '' : String(v);

    const [local, setLocal] = useState<string>(() => toDisplay(value));
    const lastEmitted = useRef<number | undefined>(
      value === null ? undefined : (value as number | undefined),
    );

    // Sync when the external value changes and no longer matches what we last
    // emitted (e.g. parent reset the field, or the value was recomputed).
    useEffect(() => {
      const external = value === null ? undefined : (value as number | undefined);
      if (external !== lastEmitted.current) {
        setLocal(toDisplay(external));
        lastEmitted.current = external;
      }
    }, [value]);

    const pattern = integer ? /^-?\d*$/ : /^-?\d*(?:[.,]\d*)?$/;

    return (
      <input
        ref={ref}
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        value={local}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw !== '' && !pattern.test(raw)) return; // reject invalid keystrokes
          setLocal(raw);
          if (raw === '' || raw === '.' || raw === ',' || raw === '-') {
            lastEmitted.current = undefined;
            onChange(undefined);
            return;
          }
          const parsed = parseFloat(raw.replace(',', '.'));
          if (Number.isFinite(parsed)) {
            lastEmitted.current = parsed;
            onChange(parsed);
          }
        }}
        onBlur={(e) => {
          if (local === '' || local === '.' || local === ',' || local === '-') {
            setLocal('');
          }
          rest.onBlur?.(e);
        }}
        {...rest}
      />
    );
  },
);