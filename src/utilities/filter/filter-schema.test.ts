import { describe, expect, it } from 'vitest';
import { filterConditionSchema, filterGroupSchema, parseFilterGroup } from './filter-schema.ts';

const valuedConditions: unknown[] = [
  {
    fieldKey: 'name',
    type: 'string',
    operator: 'contains',
    value: 'Acme',
  },
  { fieldKey: 'value', type: 'number', operator: 'equals', value: 42 },
  {
    fieldKey: 'value',
    type: 'number',
    operator: 'between',
    value: { from: 1, to: 42 },
  },
  { fieldKey: 'active', type: 'boolean', operator: 'equals', value: true },
  { fieldKey: 'stage', type: 'enum', operator: 'equals', value: 'Lead' },
  {
    fieldKey: 'stage',
    type: 'enum',
    operator: 'in',
    value: ['Lead', 'Won'],
  },
  {
    fieldKey: 'closeDate',
    type: 'date',
    operator: 'on',
    value: '2024-02-29',
  },
  {
    fieldKey: 'closeDate',
    type: 'date',
    operator: 'between',
    value: { from: '2026-01-01', to: '2026-12-31' },
  },
  {
    fieldKey: 'lastEmailed',
    type: 'date',
    operator: 'withinLast',
    value: { amount: 2, unit: 'weeks' },
  },
];

describe('filterConditionSchema', () => {
  it('accepts every valued condition family', () => {
    for (const condition of valuedConditions) {
      expect(filterConditionSchema.safeParse(condition).success).toBe(true);
    }
  });

  it('validates four-digit years without Date.UTC remapping years below 100', () => {
    expect(
      filterConditionSchema.safeParse({
        fieldKey: 'historicDate',
        type: 'date',
        operator: 'on',
        value: '0099-07-13',
      }).success,
    ).toBe(true);
  });

  it('accepts valueless conditions for every field family', () => {
    for (const type of ['string', 'number', 'boolean', 'enum', 'date']) {
      expect(
        filterConditionSchema.safeParse({
          fieldKey: `${type}Field`,
          type,
          operator: 'isNotEmpty',
        }).success,
      ).toBe(true);
    }
  });

  it.each([
    {
      label: 'blank field keys',
      condition: {
        fieldKey: ' ',
        type: 'string',
        operator: 'equals',
        value: 'Acme',
      },
    },
    {
      label: 'blank scalar strings',
      condition: {
        fieldKey: 'name',
        type: 'string',
        operator: 'equals',
        value: ' ',
      },
    },
    {
      label: 'non-finite numbers',
      condition: {
        fieldKey: 'value',
        type: 'number',
        operator: 'equals',
        value: Number.POSITIVE_INFINITY,
      },
    },
    {
      label: 'inverted number ranges',
      condition: {
        fieldKey: 'value',
        type: 'number',
        operator: 'between',
        value: { from: 2, to: 1 },
      },
    },
    {
      label: 'empty enum selections',
      condition: {
        fieldKey: 'stage',
        type: 'enum',
        operator: 'in',
        value: [],
      },
    },
    {
      label: 'blank enum selections',
      condition: {
        fieldKey: 'stage',
        type: 'enum',
        operator: 'in',
        value: [''],
      },
    },
    {
      label: 'duplicate enum selections',
      condition: {
        fieldKey: 'stage',
        type: 'enum',
        operator: 'in',
        value: ['Lead', 'Lead'],
      },
    },
    {
      label: 'incorrectly formatted dates',
      condition: {
        fieldKey: 'closeDate',
        type: 'date',
        operator: 'on',
        value: '07/13/2026',
      },
    },
    {
      label: 'impossible calendar dates',
      condition: {
        fieldKey: 'closeDate',
        type: 'date',
        operator: 'on',
        value: '2026-02-29',
      },
    },
    {
      label: 'inverted date ranges',
      condition: {
        fieldKey: 'closeDate',
        type: 'date',
        operator: 'between',
        value: { from: '2026-07-14', to: '2026-07-13' },
      },
    },
    {
      label: 'fractional durations',
      condition: {
        fieldKey: 'lastEmailed',
        type: 'date',
        operator: 'withinLast',
        value: { amount: 1.5, unit: 'days' },
      },
    },
    {
      label: 'zero-length durations',
      condition: {
        fieldKey: 'lastEmailed',
        type: 'date',
        operator: 'withinLast',
        value: { amount: 0, unit: 'days' },
      },
    },
    {
      label: 'unknown duration units',
      condition: {
        fieldKey: 'lastEmailed',
        type: 'date',
        operator: 'withinLast',
        value: { amount: 1, unit: 'years' },
      },
    },
    {
      label: 'values on valueless operators',
      condition: {
        fieldKey: 'name',
        type: 'string',
        operator: 'isEmpty',
        value: 'unexpected',
      },
    },
    {
      label: 'unknown condition properties',
      condition: {
        fieldKey: 'name',
        type: 'string',
        operator: 'equals',
        value: 'Acme',
        identifier: 'private',
      },
    },
  ])('rejects $label', ({ condition }) => {
    expect(filterConditionSchema.safeParse(condition).success).toBe(false);
  });
});

describe('filterGroupSchema', () => {
  it('accepts recursive groups and parseFilterGroup returns checked data', () => {
    const group = {
      combinator: 'or',
      conditions: [valuedConditions[0], { combinator: 'and', conditions: [valuedConditions[1]] }],
    };

    expect(filterGroupSchema.safeParse(group).success).toBe(true);
    expect(parseFilterGroup(group, 'initialFilters')).toEqual(group);
  });

  it('reports root and nested paths with the requested source name', () => {
    expect(() => parseFilterGroup(null)).toThrow(/^Invalid filter group:/);
    expect(() =>
      parseFilterGroup(
        {
          combinator: 'and',
          conditions: [
            {
              fieldKey: 'name',
              type: 'string',
              operator: 'equals',
              value: '',
            },
          ],
        },
        'initialFilters',
      ),
    ).toThrow(/Invalid initialFilters:[\s\S]*→ at conditions\[0\]\.value/);
  });
});
