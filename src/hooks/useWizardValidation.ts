import { useState, useCallback, useRef } from 'react';

export type ValidationRule = {
  field: string;
  isValid: boolean;
  message: string;
};

export function useWizardValidation() {
  const [shownErrors, setShownErrors] = useState<Set<string>>(new Set());
  const [shakeKey, setShakeKey] = useState(0);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  const registerField = useCallback((field: string) => (el: HTMLElement | null) => {
    fieldRefs.current[field] = el;
  }, []);

  /**
   * Validates rules. If any fail, shows errors, scrolls to first invalid field,
   * triggers shake animation, and returns false. Otherwise returns true.
   */
  const validate = useCallback((rules: ValidationRule[]): boolean => {
    const invalid = rules.filter((r) => !r.isValid);
    if (invalid.length === 0) {
      setShownErrors(new Set());
      return true;
    }
    const errorFields = new Set(invalid.map((r) => r.field));
    setShownErrors(errorFields);
    setShakeKey((k) => k + 1);

    // Scroll to first invalid field
    setTimeout(() => {
      const first = invalid[0];
      const el = fieldRefs.current[first.field];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
    return false;
  }, []);

  const clearError = useCallback((field: string) => {
    setShownErrors((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }, []);

  const hasError = useCallback((field: string) => shownErrors.has(field), [shownErrors]);

  return { validate, hasError, clearError, registerField, shakeKey };
}

/**
 * Helper component prop set for wrapping a field with validation feedback.
 */
export const fieldErrorClass = 'border-destructive ring-2 ring-destructive/30';