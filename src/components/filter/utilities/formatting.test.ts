import { describe, expect, it } from 'vitest';

import type { FilterCondition, FilterFieldDefinition } from '@filter/types.ts';

import { fieldLabel, formatFilterValue, tokenPhrase } from './formatting.ts';

const nameField: FilterFieldDefinition = {
  key: 'name',
  label: 'Name',
  type: 'string',
};

describe('formatFilterValue', () => {
  it('formats scalars, lists, ranges, and durations', () => {
    const scalar: FilterCondition = {
      fieldKey: 'name',
      type: 'string',
      operator: 'startsWith',
      value: 'M',
    };
    const list: FilterCondition = {
      fieldKey: 'stage',
      type: 'enum',
      operator: 'in',
      value: ['Lead', 'Contacted'],
    };
    const range: FilterCondition = {
      fieldKey: 'dealValue',
      type: 'number',
      operator: 'between',
      value: { from: 1, to: 9 },
    };
    const duration: FilterCondition = {
      fieldKey: 'lastEmailed',
      type: 'date',
      operator: 'withinLast',
      value: { amount: 7, unit: 'days' },
    };
    const valueless: FilterCondition = {
      fieldKey: 'name',
      type: 'string',
      operator: 'isEmpty',
    };
    expect(formatFilterValue(scalar)).toBe('M');
    expect(formatFilterValue(list)).toBe('Lead, Contacted');
    expect(formatFilterValue(range)).toBe('1 and 9');
    expect(formatFilterValue(duration)).toBe('7 days');
    expect(formatFilterValue(valueless)).toBe('');
  });
});

describe('tokenPhrase', () => {
  it('builds the full filter phrase from field, operator, and value', () => {
    const filter: FilterCondition = {
      fieldKey: 'name',
      type: 'string',
      operator: 'startsWith',
      value: 'M',
    };
    expect(tokenPhrase(filter, nameField)).toBe('Name starts with M');
  });

  it('uses a field key when its optional label is absent', () => {
    expect(fieldLabel({ key: 'name', type: 'string' })).toBe('name');
  });

  it('falls back to the field key when the field is gone and omits empty values', () => {
    const filter: FilterCondition = {
      fieldKey: 'ghost',
      type: 'string',
      operator: 'isEmpty',
    };
    expect(tokenPhrase(filter, undefined)).toBe('ghost is empty');
  });
});
