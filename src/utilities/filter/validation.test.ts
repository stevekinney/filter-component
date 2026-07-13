import { describe, expect, it } from 'vitest';
import type { ValueDraft } from './value-drafts.ts';
import { parseFilterGroup } from './filter-schema.ts';
import { createFilterCondition, getFilterValidationIssue, validateDraft } from './validation.ts';
import type { FilterEntry } from './filter-entry.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';

const nameField: FilterFieldDefinition = {
  key: 'name',
  label: 'Name',
  type: 'string',
};
const valueField: FilterFieldDefinition = {
  key: 'dealValue',
  label: 'Deal value',
  type: 'number',
};
const stageField: FilterFieldDefinition = {
  key: 'stage',
  label: 'Stage',
  type: 'enum',
  options: ['Lead', 'Contacted', 'Closed won'],
};
const closeDateField: FilterFieldDefinition = {
  key: 'closeDate',
  label: 'Close date',
  type: 'date',
};
const lastEmailedField: FilterFieldDefinition = {
  key: 'lastEmailed',
  label: 'Last emailed',
  type: 'date',
};

const scalarDraft = (input = ''): ValueDraft => ({ kind: 'scalar', input });
const rangeDraft = (fromInput = '', toInput = ''): ValueDraft => ({
  kind: 'range',
  fromInput,
  toInput,
});
const selectionDraft = (...selectedOptions: string[]): ValueDraft => ({
  kind: 'multiSelection',
  selectedOptions,
});
const durationDraft = (amountInput: string): ValueDraft => ({
  kind: 'duration',
  amountInput,
  unit: 'days',
});

describe('validateDraft', () => {
  it('accepts valueless operators with no value', () => {
    expect(validateDraft(nameField, 'isEmpty', scalarDraft())).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it('rejects empty and whitespace-only text', () => {
    expect(validateDraft(nameField, 'contains', scalarDraft('  '))).toEqual({
      ok: false,
      error: 'Enter a value',
    });
    expect(validateDraft(nameField, 'contains', rangeDraft('a', 'b'))).toEqual({
      ok: false,
      error: 'Enter a value',
    });
  });

  it('trims committed text', () => {
    expect(validateDraft(nameField, 'contains', scalarDraft(' Maria '))).toEqual({
      ok: true,
      value: 'Maria',
    });
  });

  it('rejects non-numeric numbers', () => {
    expect(validateDraft(valueField, 'greaterThan', scalarDraft('12abc'))).toEqual({
      ok: false,
      error: 'Enter a number',
    });
    expect(validateDraft(valueField, 'greaterThan', rangeDraft('1', '2'))).toEqual({
      ok: false,
      error: 'Enter a number',
    });
  });

  it('accepts zero as a valid number', () => {
    expect(validateDraft(valueField, 'equals', scalarDraft('0'))).toEqual({
      ok: true,
      value: 0,
    });
  });

  it('parses numbers', () => {
    expect(validateDraft(valueField, 'lessThan', scalarDraft(' 41.5 '))).toEqual({
      ok: true,
      value: 41.5,
    });
  });

  it('requires both ends of a number range', () => {
    expect(validateDraft(valueField, 'between', rangeDraft('1'))).toEqual({
      ok: false,
      error: 'Enter both numbers',
    });
    expect(validateDraft(valueField, 'between', scalarDraft('1'))).toEqual({
      ok: false,
      error: 'Enter both numbers',
    });
  });

  it('rejects inverted number ranges', () => {
    expect(validateDraft(valueField, 'between', rangeDraft('9', '2'))).toEqual({
      ok: false,
      error: 'First value must not exceed the second',
    });
  });

  it('accepts an ordered number range', () => {
    expect(validateDraft(valueField, 'between', rangeDraft('2', '9'))).toEqual({
      ok: true,
      value: { from: 2, to: 9 },
    });
  });

  it('requires a listed option for single enum values', () => {
    expect(validateDraft(stageField, 'equals', scalarDraft())).toEqual({
      ok: false,
      error: 'Choose a value',
    });
    expect(validateDraft(stageField, 'equals', selectionDraft('Lead'))).toEqual({
      ok: false,
      error: 'Choose a value',
    });
    expect(validateDraft(stageField, 'equals', scalarDraft('Bogus'))).toEqual({
      ok: false,
      error: 'Choose a listed option',
    });
    expect(validateDraft(stageField, 'equals', scalarDraft('Lead'))).toEqual({
      ok: true,
      value: 'Lead',
    });
    expect(
      validateDraft(
        { key: 'stage', type: 'enum' } as unknown as FilterFieldDefinition,
        'equals',
        scalarDraft('Lead'),
      ),
    ).toEqual({ ok: false, error: 'Choose a listed option' });
  });

  it('requires at least one option for multi enum values', () => {
    expect(validateDraft(stageField, 'in', scalarDraft('Lead'))).toEqual({
      ok: false,
      error: 'Choose at least one option',
    });
    expect(validateDraft(stageField, 'in', selectionDraft())).toEqual({
      ok: false,
      error: 'Choose at least one option',
    });
    expect(validateDraft(stageField, 'in', selectionDraft('Lead', 'Contacted'))).toEqual({
      ok: true,
      value: ['Lead', 'Contacted'],
    });
    expect(
      validateDraft(
        { key: 'stage', type: 'enum' } as unknown as FilterFieldDefinition,
        'in',
        selectionDraft('Lead'),
      ),
    ).toEqual({ ok: false, error: 'Choose listed options' });
  });

  it('rejects unknown options in multi enum values', () => {
    expect(validateDraft(stageField, 'in', selectionDraft('Lead', 'Bogus'))).toEqual({
      ok: false,
      error: 'Choose listed options',
    });
  });

  it('requires a date', () => {
    expect(validateDraft(closeDateField, 'on', scalarDraft())).toEqual({
      ok: false,
      error: 'Choose a date',
    });
    expect(validateDraft(closeDateField, 'on', scalarDraft('2026-07-01'))).toEqual({
      ok: true,
      value: '2026-07-01',
    });
    expect(validateDraft(closeDateField, 'on', scalarDraft('2026-02-31'))).toEqual({
      ok: false,
      error: 'Choose a valid date',
    });
  });

  it('rejects inverted date ranges', () => {
    expect(
      validateDraft(closeDateField, 'between', rangeDraft('2026-08-01', '2026-07-01')),
    ).toEqual({ ok: false, error: 'Start must not be after end' });
    expect(
      validateDraft(closeDateField, 'between', rangeDraft('2026-02-31', '2026-03-01')),
    ).toEqual({ ok: false, error: 'Choose valid dates' });
  });

  it('requires two dates in a date-range draft', () => {
    expect(validateDraft(closeDateField, 'between', scalarDraft('2026-07-01'))).toEqual({
      ok: false,
      error: 'Choose both dates',
    });
    expect(validateDraft(closeDateField, 'between', rangeDraft('', '2026-07-02'))).toEqual({
      ok: false,
      error: 'Choose both dates',
    });
    expect(validateDraft(closeDateField, 'between', rangeDraft('2026-07-01', ''))).toEqual({
      ok: false,
      error: 'Choose both dates',
    });
    expect(
      validateDraft(closeDateField, 'between', rangeDraft('2026-07-01', '2026-07-02')),
    ).toEqual({
      ok: true,
      value: { from: '2026-07-01', to: '2026-07-02' },
    });
  });

  it('validates boolean picks', () => {
    const activeField: FilterFieldDefinition = {
      key: 'active',
      label: 'Active',
      type: 'boolean',
    };
    expect(validateDraft(activeField, 'equals', scalarDraft('true'))).toEqual({
      ok: true,
      value: true,
    });
    expect(validateDraft(activeField, 'equals', scalarDraft('false'))).toEqual({
      ok: true,
      value: false,
    });
    expect(validateDraft(activeField, 'equals', selectionDraft())).toEqual({
      ok: false,
      error: 'Choose a value',
    });
    expect(validateDraft(activeField, 'equals', scalarDraft())).toEqual({
      ok: false,
      error: 'Choose a value',
    });
  });

  it('rejects operators excluded by a narrowed boolean field', () => {
    const activeField: FilterFieldDefinition = {
      key: 'active',
      label: 'Active',
      type: 'boolean',
      operators: ['equals'],
    };
    expect(validateDraft(activeField, 'isEmpty', scalarDraft())).toEqual({
      ok: false,
      error: 'Choose a supported operator',
    });
  });

  it('requires a positive whole number and known unit for durations', () => {
    expect(validateDraft(lastEmailedField, 'withinLast', scalarDraft('7'))).toEqual({
      ok: false,
      error: 'Enter a positive whole number',
    });
    expect(validateDraft(lastEmailedField, 'withinLast', durationDraft('0'))).toEqual({
      ok: false,
      error: 'Enter a positive whole number',
    });
    expect(validateDraft(lastEmailedField, 'withinLast', durationDraft('1.5'))).toEqual({
      ok: false,
      error: 'Enter a positive whole number',
    });
    expect(
      validateDraft(lastEmailedField, 'withinLast', {
        kind: 'duration',
        amountInput: '7',
        unit: 'fortnights',
      } as unknown as ValueDraft),
    ).toEqual({ ok: false, error: 'Choose a unit' });
    expect(validateDraft(lastEmailedField, 'withinLast', durationDraft('7'))).toEqual({
      ok: true,
      value: { amount: 7, unit: 'days' },
    });
  });
});

describe('createFilterCondition', () => {
  it('omits value for valueless operators and includes it otherwise', () => {
    expect(createFilterCondition(nameField, 'isEmpty', undefined)).toEqual({
      fieldKey: 'name',
      type: 'string',
      operator: 'isEmpty',
    });
    expect(createFilterCondition(valueField, 'between', { from: 1, to: 2 })).toEqual({
      fieldKey: 'dealValue',
      type: 'number',
      operator: 'between',
      value: { from: 1, to: 2 },
    });
  });

  it('rejects an operator excluded by the field definition', () => {
    expect(() => createFilterCondition(nameField, 'between', { from: 1, to: 2 })).toThrow(
      'Operator "between" is not allowed for field "name"',
    );
  });

  it('rejects a malformed value after the operator check', () => {
    expect(() => createFilterCondition(valueField, 'equals', Number.POSITIVE_INFINITY)).toThrow(
      'Invalid condition for field "dealValue":',
    );
  });
});

describe('parseFilterGroup', () => {
  it.each([
    {
      label: 'unknown condition keys',
      group: {
        combinator: 'and',
        conditions: [
          {
            id: 'public-identifiers-are-forbidden',
            fieldKey: 'name',
            type: 'string',
            operator: 'equals',
            value: 'Maria',
          },
        ],
      },
    },
    {
      label: 'invalid operator and value pairings',
      group: {
        combinator: 'and',
        conditions: [
          {
            fieldKey: 'active',
            type: 'boolean',
            operator: 'between',
            value: { from: false, to: true },
          },
        ],
      },
    },
    {
      label: 'invalid calendar dates',
      group: {
        combinator: 'and',
        conditions: [
          {
            fieldKey: 'closeDate',
            type: 'date',
            operator: 'on',
            value: '2026-02-31',
          },
        ],
      },
    },
    {
      label: 'inverted ranges',
      group: {
        combinator: 'and',
        conditions: [
          {
            fieldKey: 'dealValue',
            type: 'number',
            operator: 'between',
            value: { from: 10, to: 1 },
          },
        ],
      },
    },
  ])('rejects $label in initialFilters', ({ group }) => {
    expect(() => parseFilterGroup(group, 'initialFilters')).toThrow(/^Invalid initialFilters:/);
  });
});

describe('getFilterValidationIssue', () => {
  const fields = [nameField, valueField, stageField];
  const stageFilter: FilterEntry = {
    id: 's',
    fieldKey: 'stage',
    type: 'enum',
    operator: 'in',
    value: ['Lead', 'Contacted'],
  };

  it('returns null for a valid filter', () => {
    expect(getFilterValidationIssue(stageFilter, fields)).toBeNull();
  });

  it('flags a removed field at the field segment', () => {
    expect(getFilterValidationIssue(stageFilter, [nameField, valueField])).toEqual({
      segment: 'field',
      reason: 'This field is no longer available',
    });
  });

  it('flags a field whose type changed at the field segment', () => {
    const retyped: FilterFieldDefinition = {
      key: 'stage',
      label: 'Stage',
      type: 'string',
    };
    expect(getFilterValidationIssue(stageFilter, [retyped])?.segment).toBe('field');
    expect(getFilterValidationIssue(stageFilter, [{ key: 'stage', type: 'string' }])).toEqual({
      segment: 'field',
      reason: 'stage is now a string field',
    });
  });

  it('flags an operator outside the narrowed set at the operator segment', () => {
    const narrowed: FilterFieldDefinition = {
      key: 'stage',
      label: 'Stage',
      type: 'enum',
      options: ['Lead', 'Contacted'],
      operators: ['equals', 'notEquals'],
    };
    expect(getFilterValidationIssue(stageFilter, [narrowed])).toEqual({
      segment: 'operator',
      reason: 'This operator is no longer supported for Stage',
    });
  });

  it('flags vanished enum options at the value segment', () => {
    const shrunk: FilterFieldDefinition = {
      key: 'stage',
      label: 'Stage',
      type: 'enum',
      options: ['Lead'],
    };
    expect(getFilterValidationIssue(stageFilter, [shrunk])).toEqual({
      segment: 'value',
      reason: 'Contacted is no longer a valid option',
    });
    expect(
      getFilterValidationIssue(stageFilter, [
        {
          key: 'stage',
          type: 'enum',
          options: ['Closed won'],
        },
      ]),
    ).toEqual({
      segment: 'value',
      reason: 'Lead, Contacted are no longer a valid option',
    });
    expect(
      getFilterValidationIssue(
        {
          id: 'single',
          fieldKey: 'stage',
          type: 'enum',
          operator: 'equals',
          value: 'Contacted',
        },
        [shrunk],
      ),
    ).toEqual({
      segment: 'value',
      reason: 'Contacted is no longer a valid option',
    });
    expect(
      getFilterValidationIssue(stageFilter, [
        { key: 'stage', type: 'enum' } as unknown as FilterFieldDefinition,
      ]),
    ).toEqual({
      segment: 'value',
      reason: 'Lead, Contacted are no longer a valid option',
    });
  });
});

describe('seeded value shapes', () => {
  it('flags value shapes the editors could never produce', () => {
    const fields = [valueField, stageField, lastEmailedField];
    expect(
      getFilterValidationIssue(
        {
          id: 'a',
          fieldKey: 'stage',
          type: 'enum',
          operator: 'in',
          value: [],
        } as FilterEntry,
        fields,
      ),
    ).toEqual({
      segment: 'value',
      reason: 'Choose at least one valid option',
    });
    expect(
      getFilterValidationIssue(
        {
          id: 'b',
          fieldKey: 'dealValue',
          type: 'number',
          operator: 'between',
          value: { from: 10, to: 1 },
        } as FilterEntry,
        fields,
      ),
    ).toEqual({ segment: 'value', reason: 'Start must not exceed end' });
    expect(
      getFilterValidationIssue(
        {
          id: 'c',
          fieldKey: 'lastEmailed',
          type: 'date',
          operator: 'withinLast',
          value: { amount: 0, unit: 'days' },
        } as FilterEntry,
        fields,
      ),
    ).toEqual({
      segment: 'value',
      reason: 'Duration needs a positive whole number of days, weeks, or months',
    });
  });

  it.each([
    {
      filter: {
        id: 'range-shape',
        fieldKey: 'dealValue',
        type: 'number',
        operator: 'between',
        value: 5,
      },
      reason: 'Choose both valid ends of the range',
    },
    {
      filter: {
        id: 'range-ends',
        fieldKey: 'dealValue',
        type: 'number',
        operator: 'between',
        value: { from: Number.NaN, to: 2 },
      },
      reason: 'Choose both valid ends of the range',
    },
    {
      filter: {
        id: 'date-range',
        fieldKey: 'closeDate',
        type: 'date',
        operator: 'between',
        value: { from: '2026-08-01', to: '2026-07-01' },
      },
      reason: 'Start must not exceed end',
    },
    {
      filter: {
        id: 'number',
        fieldKey: 'dealValue',
        type: 'number',
        operator: 'equals',
        value: Number.POSITIVE_INFINITY,
      },
      reason: 'Enter a finite number',
    },
    {
      filter: {
        id: 'date',
        fieldKey: 'closeDate',
        type: 'date',
        operator: 'on',
        value: '2026-02-31',
      },
      reason: 'Choose a valid date',
    },
    {
      filter: {
        id: 'boolean',
        fieldKey: 'active',
        type: 'boolean',
        operator: 'equals',
        value: 'true',
      },
      reason: 'Choose true or false',
    },
    {
      filter: {
        id: 'string',
        fieldKey: 'name',
        type: 'string',
        operator: 'equals',
        value: '',
      },
      reason: 'Enter a value',
    },
    {
      filter: {
        id: 'enum-shape',
        fieldKey: 'stage',
        type: 'enum',
        operator: 'equals',
        value: 1,
      },
      reason: 'Enter a value',
    },
  ])('explains intrinsic invalid values as $reason', ({ filter, reason }) => {
    const fields: readonly FilterFieldDefinition[] = [
      nameField,
      valueField,
      stageField,
      closeDateField,
      { key: 'active', type: 'boolean' },
    ];
    expect(getFilterValidationIssue(filter as unknown as FilterEntry, fields)).toEqual({
      segment: 'value',
      reason,
    });
  });
});
