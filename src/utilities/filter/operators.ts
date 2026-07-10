import type {
  FilterFieldDefinition,
  FilterFieldType,
  FilterOperator,
  FilterOperatorsByFieldType,
} from '@/types/filter.ts';

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

/** True only when `A` and `B` contain exactly the same members. */
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

/** Human-readable operator labels, sentence case. */
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

/**
 * Boolean fields collapse the operator and value stages into one pick:
 * `true`/`false` commit `equals` with that value; the rest commit valueless
 * operators directly.
 */
export type BooleanChoice = 'true' | 'false' | 'isEmpty' | 'isNotEmpty';

export const BOOLEAN_CHOICES: { value: BooleanChoice; label: string }[] = [
  { value: 'true', label: 'is true' },
  { value: 'false', label: 'is false' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
];

/** Boolean choices allowed by a field's narrowed operator contract. */
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

/** Operators that take no value and commit immediately on selection. */
export function isValuelessOperator(
  operator: FilterOperator,
): operator is 'isEmpty' | 'isNotEmpty' {
  return operator === 'isEmpty' || operator === 'isNotEmpty';
}

/** The operators a specific field offers: its narrowed set, or the type default. */
export function operatorsForField(
  field: FilterFieldDefinition,
): readonly FilterOperator[] {
  return field.operators ?? OPERATORS_BY_TYPE[field.type];
}

/** The single field-definition lookup every module shares. */
export function findField(
  fields: readonly FilterFieldDefinition[],
  key: string,
): FilterFieldDefinition | undefined {
  return fields.find((candidate) => candidate.key === key);
}

/**
 * Whether a field collapses the operator and value stages into one list
 * (`BOOLEAN_CHOICES`). Today that is exactly the boolean type; every call
 * site that special-cases the collapsed flow branches through this predicate
 * rather than on `field.type` directly.
 */
export function usesBooleanChoiceStage(
  field: FilterFieldDefinition,
): field is FilterFieldDefinition<'boolean'> {
  return field.type === 'boolean';
}

/**
 * Which editor a field type + operator pair needs. Determines the value
 * shape's UI: text, number, ranges, single/multi enum lists, date pickers,
 * or the `withinLast` duration editor.
 */
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
      return operator === 'in' || operator === 'notIn'
        ? 'enumMulti'
        : 'enumSingle';
    case 'date':
      if (operator === 'withinLast') return 'duration';
      return operator === 'between' ? 'dateRange' : 'date';
  }
}
