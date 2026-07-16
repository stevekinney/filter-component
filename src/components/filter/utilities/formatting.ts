import type { FilterCondition, FilterFieldDefinition } from '@filter/types.ts';

import { enumOptionsForField } from './field-registry.ts';
import { OPERATOR_LABELS } from './operators.ts';

export function fieldLabel(field: FilterFieldDefinition): string {
  return field.label ?? field.key;
}

export function enumValueLabel(field: FilterFieldDefinition | undefined, value: string): string {
  if (field?.type !== 'enum') return value;

  return enumOptionsForField(field).find((option) => option.value === value)?.label ?? value;
}

export function formatFilterValue(filter: FilterCondition, field?: FilterFieldDefinition): string {
  const value = filter.value;

  if (value === undefined) return '';
  if (Array.isArray(value)) return value.map((item) => enumValueLabel(field, item)).join(', ');
  if (typeof value === 'object') {
    if ('amount' in value) return `${value.amount} ${value.unit}`;
    return `${value.from} and ${value.to}`;
  }

  const scalar = String(value);
  return filter.type === 'enum' ? enumValueLabel(field, scalar) : scalar;
}

/** The full filter phrase, e.g. "Name starts with M" — used as the token's accessible name. */
export function tokenPhrase(
  filter: FilterCondition,
  field: FilterFieldDefinition | undefined,
): string {
  const label = field ? fieldLabel(field) : filter.fieldKey;
  const value = formatFilterValue(filter, field);

  return `${label} ${OPERATOR_LABELS[filter.operator]}${value ? ` ${value}` : ''}`;
}
