import { describe, expect, it } from 'vitest';

import type { FilterFieldDefinition } from '@filter/types.ts';

import {
  booleanChoicesForField,
  getValueEditorKind,
  isValuelessOperator,
  OPERATORS_BY_TYPE,
  operatorsForField,
} from './operators.ts';

describe('operator helpers', () => {
  it('uses defaults or a field-specific narrowed operator set', () => {
    const defaultField: FilterFieldDefinition = {
      key: 'name',
      type: 'string',
    };
    const narrowedField: FilterFieldDefinition = {
      key: 'name',
      type: 'string',
      operators: ['equals'],
    };
    expect(operatorsForField(defaultField)).toBe(OPERATORS_BY_TYPE.string);
    expect(operatorsForField(narrowedField)).toBe(narrowedField.operators);
  });

  it('uses cardinality-specific enum operator sets', () => {
    const scalarField: FilterFieldDefinition<'enum'> = {
      key: 'stage',
      type: 'enum',
      options: ['Lead'],
    };
    const multipleField: FilterFieldDefinition<'enum'> = {
      key: 'assignedTo',
      type: 'enum',
      valueCardinality: 'multiple',
      options: [{ value: 'person-1', label: 'Alex Rivera' }],
    };

    expect(operatorsForField(scalarField)).toEqual([
      'equals',
      'notEquals',
      'in',
      'notIn',
      'isEmpty',
      'isNotEmpty',
    ]);
    expect(operatorsForField(multipleField)).toEqual([
      'containsAny',
      'containsAll',
      'containsNone',
      'isEmpty',
      'isNotEmpty',
    ]);
  });

  it('filters collapsed boolean choices through the allowed operators', () => {
    const allChoices = [
      { value: 'true', label: 'is true' },
      { value: 'false', label: 'is false' },
      { value: 'isEmpty', label: 'is empty' },
      { value: 'isNotEmpty', label: 'is not empty' },
    ];
    const defaultField: FilterFieldDefinition<'boolean'> = {
      key: 'active',
      type: 'boolean',
    };
    expect(booleanChoicesForField(defaultField)).toEqual(allChoices);
    expect(
      booleanChoicesForField({
        ...defaultField,
        operators: ['isEmpty'],
      }),
    ).toEqual([{ value: 'isEmpty', label: 'is empty' }]);
    expect(booleanChoicesForField({ ...defaultField, operators: ['equals'] })).toEqual(
      allChoices.slice(0, 2),
    );
  });

  it('recognizes valueless operators', () => {
    expect(isValuelessOperator('isEmpty')).toBe(true);
    expect(isValuelessOperator('isNotEmpty')).toBe(true);
    expect(isValuelessOperator('equals')).toBe(false);
  });
});

describe('getValueEditorKind', () => {
  it.each([
    ['string', 'isEmpty', 'none'],
    ['string', 'contains', 'text'],
    ['number', 'equals', 'number'],
    ['number', 'between', 'numberRange'],
    ['boolean', 'equals', 'boolean'],
    ['enum', 'equals', 'enumSingle'],
    ['enum', 'in', 'enumMulti'],
    ['enum', 'notIn', 'enumMulti'],
    ['enum', 'containsAny', 'enumMulti'],
    ['enum', 'containsAll', 'enumMulti'],
    ['enum', 'containsNone', 'enumMulti'],
    ['date', 'on', 'date'],
    ['date', 'between', 'dateRange'],
    ['date', 'withinLast', 'duration'],
  ] as const)('maps %s + %s to %s', (type, operator, kind) => {
    expect(getValueEditorKind(type, operator)).toBe(kind);
  });
});
