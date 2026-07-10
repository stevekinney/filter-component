import { describe, expect, it } from 'vitest';
import {
  BOOLEAN_CHOICES,
  booleanChoicesForField,
  findField,
  getValueEditorKind,
  isValuelessOperator,
  OPERATORS_BY_TYPE,
  operatorsForField,
  usesBooleanChoiceStage,
} from './operators.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';

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

  it('filters collapsed boolean choices through the allowed operators', () => {
    const defaultField: FilterFieldDefinition<'boolean'> = {
      key: 'active',
      type: 'boolean',
    };
    expect(booleanChoicesForField(defaultField)).toEqual(BOOLEAN_CHOICES);
    expect(
      booleanChoicesForField({
        ...defaultField,
        operators: ['isEmpty'],
      }),
    ).toEqual([{ value: 'isEmpty', label: 'is empty' }]);
    expect(
      booleanChoicesForField({ ...defaultField, operators: ['equals'] }),
    ).toEqual(BOOLEAN_CHOICES.slice(0, 2));
  });

  it('recognizes valueless operators and boolean-stage fields', () => {
    expect(isValuelessOperator('isEmpty')).toBe(true);
    expect(isValuelessOperator('isNotEmpty')).toBe(true);
    expect(isValuelessOperator('equals')).toBe(false);
    expect(usesBooleanChoiceStage({ key: 'active', type: 'boolean' })).toBe(
      true,
    );
    expect(usesBooleanChoiceStage({ key: 'name', type: 'string' })).toBe(false);
  });

  it('finds fields by key and reports misses', () => {
    const fields: readonly FilterFieldDefinition[] = [
      { key: 'name', type: 'string' },
      { key: 'value', type: 'number' },
    ];
    expect(findField(fields, 'value')).toBe(fields[1]);
    expect(findField(fields, 'missing')).toBeUndefined();
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
    ['date', 'on', 'date'],
    ['date', 'between', 'dateRange'],
    ['date', 'withinLast', 'duration'],
  ] as const)('maps %s + %s to %s', (type, operator, kind) => {
    expect(getValueEditorKind(type, operator)).toBe(kind);
  });
});
