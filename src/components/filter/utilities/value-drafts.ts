import type {
  FilterCondition,
  RangeValue,
  WithinLastUnit,
  WithinLastValue,
} from '@filter/types.ts';

import type { ValueEditorKind } from './operators.ts';

export type ScalarValueDraft = {
  kind: 'scalar';
  input: string;
};

export type RangeValueDraft = {
  kind: 'range';
  fromInput: string;
  toInput: string;
};

export type DurationValueDraft = {
  kind: 'duration';
  amountInput: string;
  unit: WithinLastUnit;
};

type MultiSelectionValueDraft = {
  kind: 'multiSelection';
  selectedOptionValues: string[];
};

/** Discriminated transient state that keeps incompatible editor value shapes separate. */
export type ValueDraft =
  ScalarValueDraft | RangeValueDraft | DurationValueDraft | MultiSelectionValueDraft;

export function createEmptyValueDraft(kind: ValueEditorKind): ValueDraft {
  switch (kind) {
    case 'numberRange':
    case 'dateRange':
      return { kind: 'range', fromInput: '', toInput: '' };
    case 'duration':
      return { kind: 'duration', amountInput: '', unit: 'days' };
    case 'enumMulti':
      return { kind: 'multiSelection', selectedOptionValues: [] };
    case 'none':
    case 'text':
    case 'number':
    case 'boolean':
    case 'enumSingle':
    case 'date':
      return { kind: 'scalar', input: '' };
  }
}

type CommittedValue = NonNullable<FilterCondition['value']>;

function isRange(value: CommittedValue): value is RangeValue<string> | RangeValue<number> {
  return typeof value === 'object' && 'from' in value;
}

function isDuration(value: CommittedValue): value is WithinLastValue {
  return typeof value === 'object' && 'amount' in value;
}

export function createValueDraftFromCommittedValue(
  value: CommittedValue,
  kind: ValueEditorKind,
): ValueDraft {
  const emptyDraft = createEmptyValueDraft(kind);

  if (emptyDraft.kind === 'multiSelection') {
    return {
      ...emptyDraft,
      selectedOptionValues: Array.isArray(value) ? value.map(String) : [],
    };
  }

  if (emptyDraft.kind === 'duration') {
    return isDuration(value)
      ? {
          ...emptyDraft,
          amountInput: String(value.amount),
          unit: value.unit,
        }
      : emptyDraft;
  }

  if (emptyDraft.kind === 'range') {
    return isRange(value)
      ? {
          ...emptyDraft,
          fromInput: String(value.from),
          toInput: String(value.to),
        }
      : emptyDraft;
  }

  if (typeof value === 'object') return emptyDraft;

  return { ...emptyDraft, input: String(value) };
}

/**
 * Carries a committed value across compatible editor-shape changes; otherwise
 * returns a fresh draft.
 */
export function convertCommittedValueToDraft(
  value: CommittedValue,
  nextEditorKind: ValueEditorKind,
): ValueDraft {
  const emptyDraft = createEmptyValueDraft(nextEditorKind);

  switch (nextEditorKind) {
    case 'enumMulti':
      return typeof value === 'string'
        ? { kind: 'multiSelection', selectedOptionValues: [value] }
        : emptyDraft;
    case 'enumSingle': {
      if (!Array.isArray(value)) return emptyDraft;

      const firstValue = value[0];

      return {
        kind: 'scalar',
        input: firstValue === undefined ? '' : String(firstValue),
      };
    }
    case 'numberRange':
    case 'dateRange':
      return typeof value === 'number' || typeof value === 'string'
        ? { kind: 'range', fromInput: String(value), toInput: '' }
        : emptyDraft;
    case 'number':
    case 'date':
      return isRange(value) ? { kind: 'scalar', input: String(value.from) } : emptyDraft;
    case 'none':
    case 'text':
    case 'boolean':
    case 'duration':
      return emptyDraft;
  }
}
