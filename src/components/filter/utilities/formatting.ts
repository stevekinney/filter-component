import type { FilterCondition, FilterFieldDefinition } from '@filter/types.ts';

import { OPERATOR_LABELS } from './operators.ts';

export function fieldLabel(field: FilterFieldDefinition): string {
  return field.label ?? field.key;
}

export function formatFilterValue(filter: FilterCondition): string {
  const value = filter.value;

  if (value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
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
