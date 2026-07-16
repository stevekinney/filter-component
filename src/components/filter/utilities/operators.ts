import type {
  FilterFieldDefinition,
  FilterFieldType,
  FilterOperator,
  FilterOperatorsByFieldType,
} from '@filter/types.ts';

/** Default operator set per field type, in menu order. */
export const OPERATORS_BY_TYPE = {
  string: [
    'equals',
    'notEquals',
    'contains',
    'notContains',
    'startsWith',
    'endsWith',
    'isEmpty',
    'isNotEmpty',
  ],
  number: [
    'equals',
    'notEquals',
    'greaterThan',
    'greaterThanOrEqual',
    'lessThan',
    'lessThanOrEqual',
    'between',
    'isEmpty',
    'isNotEmpty',
  ],
  boolean: ['equals', 'isEmpty', 'isNotEmpty'],
  enum: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  date: [
    'on',
    'notOn',
    'before',
    'onOrBefore',
    'after',
    'onOrAfter',
    'between',
    'withinLast',
    'isEmpty',
    'isNotEmpty',
  ],
} as const satisfies {
  [T in FilterFieldType]: readonly FilterOperatorsByFieldType[T][];
};

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// Element typing alone catches an extra operator in a menu above but not a
// missing one, so this set-equality check closes that gap: it fails to
// compile — naming the drifted field type — the moment a menu and
// `FilterOperatorsByFieldType` disagree on the exact operator set.
type MISSING_OR_EXTRA_OPERATOR_FOR<
  Completeness extends Record<FilterFieldType, true> = {
    [T in FilterFieldType]: Equal<
      (typeof OPERATORS_BY_TYPE)[T][number],
      FilterOperatorsByFieldType[T]
    >;
  },
> = Completeness;

declare const _operatorMenuCompletenessCheck: MISSING_OR_EXTRA_OPERATOR_FOR;

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: 'is',
  notEquals: 'is not',
  contains: 'contains',
  notContains: "doesn't contain",
  startsWith: 'starts with',
  endsWith: 'ends with',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
  greaterThan: 'greater than',
  greaterThanOrEqual: 'at least',
  lessThan: 'less than',
  lessThanOrEqual: 'at most',
  between: 'between',
  in: 'is any of',
  notIn: 'is none of',
  on: 'is on',
  notOn: 'is not on',
  before: 'is before',
  onOrBefore: 'on or before',
  after: 'is after',
  onOrAfter: 'on or after',
  withinLast: 'within last',
};

const BOOLEAN_CHOICES = [
  { value: 'true', label: 'is true' },
  { value: 'false', label: 'is false' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
] as const;

/** Choice used by the collapsed boolean operator/value stage. */
export type BooleanChoice = (typeof BOOLEAN_CHOICES)[number]['value'];

export function booleanChoicesForField(
  field: FilterFieldDefinition<'boolean'>,
): readonly { value: BooleanChoice; label: string }[] {
  const operators = operatorsForField(field);

  return BOOLEAN_CHOICES.filter(({ value }) =>
    value === 'true' || value === 'false'
      ? operators.includes('equals')
      : operators.includes(value),
  );
}

export function isValuelessOperator(
  operator: FilterOperator,
): operator is 'isEmpty' | 'isNotEmpty' {
  return operator === 'isEmpty' || operator === 'isNotEmpty';
}

export function operatorsForField(field: FilterFieldDefinition): readonly FilterOperator[] {
  return field.operators ?? OPERATORS_BY_TYPE[field.type];
}

/** Editor shape selected by a field/operator pair. */
export type ValueEditorKind =
  | 'none'
  | 'text'
  | 'number'
  | 'numberRange'
  | 'boolean'
  | 'enumSingle'
  | 'enumMulti'
  | 'date'
  | 'dateRange'
  | 'duration';

export function getValueEditorKind(
  type: FilterFieldType,
  operator: FilterOperator,
): ValueEditorKind {
  if (isValuelessOperator(operator)) return 'none';

  switch (type) {
    case 'string':
      return 'text';
    case 'number':
      return operator === 'between' ? 'numberRange' : 'number';
    case 'boolean':
      return 'boolean';
    case 'enum':
      return operator === 'in' || operator === 'notIn' ? 'enumMulti' : 'enumSingle';
    case 'date':
      if (operator === 'withinLast') return 'duration';
      return operator === 'between' ? 'dateRange' : 'date';
  }
}
