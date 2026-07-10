import { describe, expect, it } from 'vitest';
import {
  convertCommittedValueToDraft,
  createEmptyValueDraft,
  createValueDraftFromCommittedValue,
} from './value-drafts.ts';

describe('createEmptyValueDraft', () => {
  it('creates the discriminated shape for each editor kind', () => {
    expect(createEmptyValueDraft('duration')).toEqual({
      kind: 'duration',
      amountInput: '',
      unit: 'days',
    });
    expect(createEmptyValueDraft('text')).toEqual({
      kind: 'scalar',
      input: '',
    });
    expect(createEmptyValueDraft('numberRange')).toEqual({
      kind: 'range',
      fromInput: '',
      toInput: '',
    });
    expect(createEmptyValueDraft('enumMulti')).toEqual({
      kind: 'multiSelection',
      selectedOptions: [],
    });
    expect(createEmptyValueDraft('none')).toEqual({
      kind: 'scalar',
      input: '',
    });
  });
});

describe('createValueDraftFromCommittedValue', () => {
  it('rebuilds scalar drafts', () => {
    expect(createValueDraftFromCommittedValue('Maria', 'text')).toEqual({
      kind: 'scalar',
      input: 'Maria',
    });
    expect(createValueDraftFromCommittedValue(42, 'number')).toEqual({
      kind: 'scalar',
      input: '42',
    });
    expect(createValueDraftFromCommittedValue(true, 'boolean')).toEqual({
      kind: 'scalar',
      input: 'true',
    });
  });

  it('rebuilds multi-select drafts', () => {
    expect(
      createValueDraftFromCommittedValue(['Lead', 'Contacted'], 'enumMulti'),
    ).toEqual({
      kind: 'multiSelection',
      selectedOptions: ['Lead', 'Contacted'],
    });
    expect(createValueDraftFromCommittedValue('Lead', 'enumMulti')).toEqual({
      kind: 'multiSelection',
      selectedOptions: [],
    });
  });

  it('rebuilds range drafts', () => {
    expect(
      createValueDraftFromCommittedValue({ from: 1, to: 9 }, 'numberRange'),
    ).toEqual({ kind: 'range', fromInput: '1', toInput: '9' });
    expect(createValueDraftFromCommittedValue(1, 'numberRange')).toEqual({
      kind: 'range',
      fromInput: '',
      toInput: '',
    });
  });

  it('rebuilds duration drafts', () => {
    expect(
      createValueDraftFromCommittedValue(
        { amount: 7, unit: 'weeks' },
        'duration',
      ),
    ).toEqual({ kind: 'duration', amountInput: '7', unit: 'weeks' });
    expect(createValueDraftFromCommittedValue(7, 'duration')).toEqual({
      kind: 'duration',
      amountInput: '',
      unit: 'days',
    });
  });

  it('does not coerce structured values into scalar drafts', () => {
    expect(
      createValueDraftFromCommittedValue({ amount: 7, unit: 'days' }, 'text'),
    ).toEqual({ kind: 'scalar', input: '' });
  });
});

describe('convertCommittedValueToDraft', () => {
  it('carries a single enum value into a multi selection (pre-checked)', () => {
    expect(
      convertCommittedValueToDraft('Lead', 'enumSingle', 'enumMulti'),
    ).toEqual({ kind: 'multiSelection', selectedOptions: ['Lead'] });
  });

  it('carries the first multi value back to a single selection', () => {
    expect(
      convertCommittedValueToDraft(
        ['Lead', 'Contacted'],
        'enumMulti',
        'enumSingle',
      ),
    ).toEqual({ kind: 'scalar', input: 'Lead' });
    expect(convertCommittedValueToDraft([], 'enumMulti', 'enumSingle')).toEqual(
      { kind: 'scalar', input: '' },
    );
  });

  it('carries a number into a range start and a range back to its start', () => {
    expect(convertCommittedValueToDraft(100, 'number', 'numberRange')).toEqual({
      kind: 'range',
      fromInput: '100',
      toInput: '',
    });
    expect(
      convertCommittedValueToDraft({ from: 3, to: 9 }, 'numberRange', 'number'),
    ).toEqual({ kind: 'scalar', input: '3' });
  });

  it('carries dates across scalar ↔ range changes', () => {
    expect(
      convertCommittedValueToDraft('2026-07-01', 'date', 'dateRange'),
    ).toEqual({ kind: 'range', fromInput: '2026-07-01', toInput: '' });
    expect(
      convertCommittedValueToDraft(
        { from: '2026-07-01', to: '2026-08-01' },
        'dateRange',
        'date',
      ),
    ).toEqual({ kind: 'scalar', input: '2026-07-01' });
  });

  it('falls back to an empty draft for incompatible shapes', () => {
    expect(
      convertCommittedValueToDraft(
        { amount: 7, unit: 'days' },
        'duration',
        'date',
      ),
    ).toEqual({ kind: 'scalar', input: '' });
  });
});
