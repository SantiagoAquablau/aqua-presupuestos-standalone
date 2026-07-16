export type ConditionMode = 'and' | 'or';

/** Supported comparison operators in condition pairs. */
export type ConditionOperator = 'eq' | 'neq' | 'is_true' | 'is_false';

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: '=',
  neq: '≠',
  is_true: 'és true',
  is_false: 'és false',
};

/** Operators that don't need a value input (the value is implicit). */
export function operatorNeedsValue(op: ConditionOperator): boolean {
  return op === 'eq' || op === 'neq';
}

export interface RuleConditionPair {
  field: string;
  value: string;
  op?: ConditionOperator;
}

export interface ParsedRuleConditions {
  mode: ConditionMode;
  pairs: RuleConditionPair[];
}

/** A group of OR conditions. Groups are combined with AND between them. */
export interface RuleConditionGroup {
  pairs: RuleConditionPair[];
}

type RuleConditionSource = {
  condition_field: string | null;
  condition_value: string | null;
};

function normalizeOp(raw: any): ConditionOperator {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'neq' || s === '!=' || s === '≠' || s === 'ne') return 'neq';
  if (s === 'is_true' || s === 'true') return 'is_true';
  if (s === 'is_false' || s === 'false') return 'is_false';
  return 'eq';
}

function tryParseJson(raw: string | null): any {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * Parse rule conditions. Supports four storage formats (back-compat):
 * 1. Single condition: condition_field="X", condition_value="Y"
 * 2. Legacy AND array: condition_field='["a","b"]', condition_value='["1","2"]'
 * 3. Mode-aware flat:  condition_field='{"mode":"or","fields":[...]}'
 * 4. Groups (NEW):     condition_field='{"version":2,"groups":[{"fields":[...]},...]}'
 *                      condition_value='{"version":2,"groups":[{"values":[...]},...]}'
 */
export function parseRuleConditions(rule: RuleConditionSource): RuleConditionPair[] {
  return parseRuleConditionsWithMode(rule).pairs;
}

export function parseRuleConditionsWithMode(rule: RuleConditionSource): ParsedRuleConditions {
  const groups = parseRuleConditionGroups(rule);
  // Flat view for back-compat callers (summary etc): flatten all pairs.
  // Mode is derived: if there's a single group with >1 pair it's OR; otherwise AND.
  if (groups.length === 1 && groups[0].pairs.length > 1) {
    return { mode: 'or', pairs: groups[0].pairs };
  }
  const flat = groups.flatMap((g) => g.pairs);
  return { mode: 'and', pairs: flat };
}

/**
 * Parse rule conditions as groups. Each group is a set of OR pairs;
 * groups are combined with AND. Always returns at least an empty array.
 */
export function parseRuleConditionGroups(rule: RuleConditionSource): RuleConditionGroup[] {
  const fieldRaw = rule.condition_field;
  const valueRaw = rule.condition_value;

  const fieldParsed = tryParseJson(fieldRaw);
  const valueParsed = tryParseJson(valueRaw);

  // Format 4: groups
  if (
    fieldParsed && !Array.isArray(fieldParsed) &&
    fieldParsed.version === 2 && Array.isArray(fieldParsed.groups)
  ) {
    const fieldGroups: any[] = fieldParsed.groups;
    const valueGroups: any[] = (valueParsed && Array.isArray(valueParsed.groups)) ? valueParsed.groups : [];
    const groups: RuleConditionGroup[] = fieldGroups.map((fg, gi) => {
      const fields: string[] = Array.isArray(fg?.fields) ? fg.fields.map((v: any) => String(v ?? '').trim()) : [];
      const ops: ConditionOperator[] = Array.isArray(fg?.ops)
        ? fg.ops.map((o: any) => normalizeOp(o))
        : [];
      const vg = valueGroups[gi];
      const values: string[] = Array.isArray(vg?.values) ? vg.values.map((v: any) => String(v ?? '').trim()) : [];
      const pairs = fields
        .map((field, i) => {
          const op: ConditionOperator = ops[i] ?? 'eq';
          return { field, value: values[i] ?? '', op };
        })
        .filter((p) => p.field && (operatorNeedsValue(p.op!) ? p.value !== '' : true));
      return { pairs };
    }).filter((g) => g.pairs.length > 0);
    return groups;
  }

  // Format 3: mode-aware flat (legacy)
  if (fieldParsed && !Array.isArray(fieldParsed) && Array.isArray(fieldParsed.fields)) {
    const mode: ConditionMode = fieldParsed.mode === 'or' ? 'or' : 'and';
    const fields: string[] = fieldParsed.fields.map((v: any) => String(v ?? '').trim());
    const values: string[] = (valueParsed && Array.isArray(valueParsed.values))
      ? valueParsed.values.map((v: any) => String(v ?? '').trim())
      : [];
    const pairs = fields
      .map((field, i) => ({ field, value: values[i] ?? '' }))
      .filter((p) => p.field && p.value);
    if (pairs.length === 0) return [];
    if (mode === 'or') return [{ pairs }];
    // AND: each pair becomes its own (single-element OR) group
    return pairs.map((p) => ({ pairs: [p] }));
  }

  // Format 2: legacy AND array
  if (Array.isArray(fieldParsed) && Array.isArray(valueParsed) && fieldParsed.length === valueParsed.length) {
    const pairs = fieldParsed
      .map((field: any, i: number) => ({
        field: String(field ?? '').trim(),
        value: String(valueParsed[i] ?? '').trim(),
      }))
      .filter((p) => p.field && p.value);
    return pairs.map((p) => ({ pairs: [p] }));
  }

  // Format 1: single
  if (!fieldRaw || !valueRaw) return [];
  return [{ pairs: [{ field: fieldRaw.trim(), value: valueRaw.trim() }] }];
}

/**
 * Serialize a flat list of conditions (legacy entry point).
 * mode='and' → one pair per group; mode='or' → single group.
 */
export function serializeRuleConditions(
  conditions: RuleConditionPair[],
  mode: ConditionMode = 'and'
): RuleConditionSource {
  const valid = conditions
    .map((c) => ({ field: c.field.trim(), value: c.value.trim() }))
    .filter((c) => c.field && c.value);

  if (valid.length === 0) return { condition_field: null, condition_value: null };

  if (valid.length === 1) {
    return { condition_field: valid[0].field, condition_value: valid[0].value };
  }

  const groups: RuleConditionGroup[] = mode === 'or'
    ? [{ pairs: valid }]
    : valid.map((p) => ({ pairs: [p] }));

  return serializeRuleConditionGroups(groups);
}

/** Serialize groups (AND of OR) using the v2 storage format. */
export function serializeRuleConditionGroups(groups: RuleConditionGroup[]): RuleConditionSource {
  const cleanGroups = groups
    .map((g) => ({
      pairs: g.pairs
        .map((p) => ({
          field: p.field.trim(),
          value: p.value.trim(),
          op: (p.op ?? 'eq') as ConditionOperator,
        }))
        .filter((p) => p.field && (operatorNeedsValue(p.op) ? p.value !== '' : true)),
    }))
    .filter((g) => g.pairs.length > 0);

  if (cleanGroups.length === 0) return { condition_field: null, condition_value: null };

  // Whether any pair uses a non-default operator. If so we MUST use the v2 JSON format.
  const hasCustomOp = cleanGroups.some((g) => g.pairs.some((p) => p.op !== 'eq'));

  // Optimization: a single eq pair → store as plain strings (back-compat).
  if (!hasCustomOp && cleanGroups.length === 1 && cleanGroups[0].pairs.length === 1) {
    const p = cleanGroups[0].pairs[0];
    return { condition_field: p.field, condition_value: p.value };
  }

  return {
    condition_field: JSON.stringify({
      version: 2,
      groups: cleanGroups.map((g) => ({
        fields: g.pairs.map((p) => p.field),
        ops: g.pairs.map((p) => p.op),
      })),
    }),
    condition_value: JSON.stringify({
      version: 2,
      groups: cleanGroups.map((g) => ({ values: g.pairs.map((p) => p.value) })),
    }),
  };
}

export function summarizeRuleConditions(
  rule: RuleConditionSource,
  fieldLabels: Record<string, string> = {}
): string {
  const groups = parseRuleConditionGroups(rule);
  if (groups.length === 0) return '';
  const parts = groups.map((g) => {
    const inner = g.pairs.map((c) => formatPair(c, fieldLabels)).join(' O ');
    return g.pairs.length > 1 ? `(${inner})` : inner;
  });
  return parts.join(' Y ');
}

/** Human-readable rendering of a single condition pair. */
export function formatPair(
  pair: RuleConditionPair,
  fieldLabels: Record<string, string> = {}
): string {
  const label = fieldLabels[pair.field] ?? pair.field;
  const op = pair.op ?? 'eq';
  if (op === 'is_true') return `${label} és true`;
  if (op === 'is_false') return `${label} és false`;
  if (op === 'neq') return `${label} ≠ ${pair.value}`;
  return `${label} = ${pair.value}`;
}
