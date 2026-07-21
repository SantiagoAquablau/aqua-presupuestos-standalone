/**
 * Central source of truth for the default "Condicions de Pagament" text per
 * budget type. Consumed by the wizard (defaulting `draft.paymentConditions`)
 * and by the PDF (`PageResum.tsx` fallback when no value was ever saved).
 */

export const AUTOPORTANT_PAYMENT_CONDITIONS = "60 % acceptació de l'obra\n40 % finalització de l'obra";

export const DEFAULT_OBRA_NUEVA_PAYMENT_CONDITIONS = [
  "20 % acceptació de l'obra",
  "25 % inici d'obra",
  "25 % gunitat",
  "25 % revestiment",
  "5 % finalització de l'obra",
].join("\n");
