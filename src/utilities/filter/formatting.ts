import { OPERATOR_LABELS } from './operators.ts';
import type { FilterCondition, FilterFieldDefinition } from '@/types/filter.ts';

export function fieldLabel(field: FilterFieldDefinition): string {
  return field.label ?? field.key;
}

/**
 * `Array.isArray` doesn't narrow a string array out of a union of value
 * shapes; this guard does, and is shared by every module that branches on
 * multi-values.
 */
export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value);

/** Human-readable value for a token segment; empty for valueless operators. */
export function formatFilterValue(filter: FilterCondition): string {
  const value = filter.value;
  if (value === undefined) return '';
  if (isStringArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    if ('amount' in value) return `${value.amount} ${value.unit}`;
    return `${value.from} and ${value.to}`;
  }
  return String(value);
}

/** The full filter phrase, e.g. "Name starts with M" — used as the token's accessible name. */
export function tokenPhrase(
  filter: FilterCondition,
  field: FilterFieldDefinition | undefined,
): string {
  const label = field ? fieldLabel(field) : filter.fieldKey;
  const value = formatFilterValue(filter);
  return `${label} ${OPERATOR_LABELS[filter.operator]}${value ? ` ${value}` : ''}`;
}
