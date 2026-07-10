import { describe, expect, it } from 'vitest';
import { applyFilters } from './apply-filters.ts';
import type { Deal } from './records.ts';
import type {
  FilterCondition,
  FilterGroup,
} from '@/components/filter/index.ts';

const NOW = new Date('2026-07-13T12:00:00.000Z');

const baseDeal: Deal = {
  id: 1,
  name: 'Acme Corporation',
  dealValue: 42,
  active: true,
  stage: 'Lead',
  closeDate: '2026-07-13',
  lastEmailed: '2026-07-12',
};

function group(
  condition: FilterCondition,
  combinator: FilterGroup['combinator'] = 'and',
): FilterGroup {
  return { combinator, conditions: [condition] };
}

function matches(
  condition: FilterCondition,
  deal: Deal = baseDeal,
  now: Date = NOW,
): boolean {
  return applyFilters([deal], group(condition), now).length === 1;
}

describe('applyFilters string conditions', () => {
  it.each([
    ['equals', 'acme corporation', true],
    ['equals', 'Globex', false],
    ['notEquals', 'Globex', true],
    ['contains', 'ME CORP', true],
    ['notContains', 'Globex', true],
    ['startsWith', 'acme', true],
    ['endsWith', 'RATION', true],
  ] as const)('%s compares case-insensitively', (operator, value, expected) => {
    expect(
      matches({
        fieldKey: 'name',
        type: 'string',
        operator,
        value,
      } as FilterCondition<'string'>),
    ).toBe(expected);
  });
});

describe('applyFilters number conditions', () => {
  it.each([
    ['equals', 42, true],
    ['notEquals', 41, true],
    ['greaterThan', 41, true],
    ['greaterThanOrEqual', 42, true],
    ['lessThan', 43, true],
    ['lessThanOrEqual', 42, true],
  ] as const)('supports %s', (operator, value, expected) => {
    expect(
      matches({ fieldKey: 'dealValue', type: 'number', operator, value }),
    ).toBe(expected);
  });

  it('uses inclusive range endpoints', () => {
    expect(
      matches({
        fieldKey: 'dealValue',
        type: 'number',
        operator: 'between',
        value: { from: 42, to: 42 },
      }),
    ).toBe(true);
    expect(
      matches({
        fieldKey: 'dealValue',
        type: 'number',
        operator: 'between',
        value: { from: 43, to: 50 },
      }),
    ).toBe(false);
  });
});

describe('applyFilters boolean and enum conditions', () => {
  it('compares boolean values', () => {
    expect(
      matches({
        fieldKey: 'active',
        type: 'boolean',
        operator: 'equals',
        value: true,
      }),
    ).toBe(true);
    expect(
      matches({
        fieldKey: 'active',
        type: 'boolean',
        operator: 'equals',
        value: false,
      }),
    ).toBe(false);
  });

  it.each([
    ['equals', 'Lead', true],
    ['notEquals', 'Closed won', true],
  ] as const)('supports enum %s', (operator, value, expected) => {
    expect(matches({ fieldKey: 'stage', type: 'enum', operator, value })).toBe(
      expected,
    );
  });

  it.each([
    ['in', ['Lead', 'Contacted'], true],
    ['notIn', ['Closed won', 'Closed lost'], true],
  ] as const)('supports enum %s', (operator, value, expected) => {
    expect(
      matches({ fieldKey: 'stage', type: 'enum', operator, value: [...value] }),
    ).toBe(expected);
  });
});

describe('applyFilters date conditions', () => {
  it.each([
    ['on', '2026-07-13', true],
    ['notOn', '2026-07-12', true],
    ['before', '2026-07-14', true],
    ['onOrBefore', '2026-07-13', true],
    ['after', '2026-07-12', true],
    ['onOrAfter', '2026-07-13', true],
  ] as const)('supports %s', (operator, value, expected) => {
    expect(
      matches({ fieldKey: 'closeDate', type: 'date', operator, value }),
    ).toBe(expected);
  });

  it('uses inclusive date ranges', () => {
    expect(
      matches({
        fieldKey: 'closeDate',
        type: 'date',
        operator: 'between',
        value: { from: '2026-07-01', to: '2026-07-13' },
      }),
    ).toBe(true);
    expect(
      matches({
        fieldKey: 'closeDate',
        type: 'date',
        operator: 'between',
        value: { from: '2026-07-14', to: '2026-07-31' },
      }),
    ).toBe(false);
  });

  it.each([
    ['days', 2],
    ['weeks', 1],
    ['months', 1],
  ] as const)('supports within-last %s', (unit, amount) => {
    expect(
      matches({
        fieldKey: 'lastEmailed',
        type: 'date',
        operator: 'withinLast',
        value: { amount, unit },
      }),
    ).toBe(true);
  });

  it('does not treat a future date as within the past window', () => {
    expect(
      matches(
        {
          fieldKey: 'lastEmailed',
          type: 'date',
          operator: 'withinLast',
          value: { amount: 7, unit: 'days' },
        },
        { ...baseDeal, lastEmailed: '2026-07-14' },
      ),
    ).toBe(false);
  });
});

describe('empty values and groups', () => {
  it('distinguishes null, undefined, and empty-string values from present values', () => {
    const nullValue = { ...baseDeal, dealValue: null };
    const emptyString = { ...baseDeal, name: '' };

    expect(
      matches(
        { fieldKey: 'dealValue', type: 'number', operator: 'isEmpty' },
        nullValue,
      ),
    ).toBe(true);
    expect(
      matches({ fieldKey: 'missing', type: 'string', operator: 'isEmpty' }),
    ).toBe(true);
    expect(
      matches(
        { fieldKey: 'name', type: 'string', operator: 'isEmpty' },
        emptyString,
      ),
    ).toBe(true);
    expect(
      matches({ fieldKey: 'name', type: 'string', operator: 'isNotEmpty' }),
    ).toBe(true);
    expect(
      matches(
        { fieldKey: 'name', type: 'string', operator: 'isNotEmpty' },
        emptyString,
      ),
    ).toBe(false);
    expect(
      matches(
        {
          fieldKey: 'dealValue',
          type: 'number',
          operator: 'equals',
          value: 0,
        },
        nullValue,
      ),
    ).toBe(false);
  });

  it('returns the input unchanged for an empty root group', () => {
    const deals = [baseDeal];
    expect(
      applyFilters(deals, { combinator: 'and', conditions: [] }, NOW),
    ).toBe(deals);
  });

  it('treats a nested empty group as matching', () => {
    expect(
      applyFilters(
        [baseDeal],
        {
          combinator: 'and',
          conditions: [{ combinator: 'or', conditions: [] }],
        },
        NOW,
      ),
    ).toEqual([baseDeal]);
  });

  it('evaluates nested and/or groups recursively', () => {
    const matchingName: FilterCondition = {
      fieldKey: 'name',
      type: 'string',
      operator: 'contains',
      value: 'Acme',
    };
    const missingStage: FilterCondition = {
      fieldKey: 'stage',
      type: 'enum',
      operator: 'equals',
      value: 'Closed lost',
    };
    const active: FilterCondition = {
      fieldKey: 'active',
      type: 'boolean',
      operator: 'equals',
      value: true,
    };
    const nested: FilterGroup = {
      combinator: 'and',
      conditions: [
        active,
        { combinator: 'or', conditions: [missingStage, matchingName] },
      ],
    };
    expect(applyFilters([baseDeal], nested, NOW)).toEqual([baseDeal]);
    expect(
      applyFilters(
        [baseDeal],
        {
          combinator: 'and',
          conditions: [missingStage, matchingName],
        },
        NOW,
      ),
    ).toEqual([]);
    expect(
      applyFilters(
        [baseDeal],
        { combinator: 'or', conditions: [missingStage] },
        NOW,
      ),
    ).toEqual([]);
  });

  it('uses the current time when no clock is injected', () => {
    const deals = [baseDeal];
    expect(
      applyFilters(
        deals,
        group({ fieldKey: 'name', type: 'string', operator: 'isNotEmpty' }),
      ),
    ).toEqual(deals);
  });
});
