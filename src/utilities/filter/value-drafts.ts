import type { ValueEditorKind } from './operators.ts';
import type {
  FilterCondition,
  RangeValue,
  WithinLastUnit,
  WithinLastValue,
} from '@/types/filter.ts';

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

export type MultiSelectionValueDraft = {
  kind: 'multiSelection';
  selectedOptions: string[];
};

/**
 * Transient value state. The discriminator keeps impossible combinations out
 * of the editor: a range cannot accidentally carry enum selections, and a
 * duration always has a valid unit shape before validation begins.
 */
export type ValueDraft =
  | ScalarValueDraft
  | RangeValueDraft
  | DurationValueDraft
  | MultiSelectionValueDraft;

export function createEmptyValueDraft(kind: ValueEditorKind): ValueDraft {
  switch (kind) {
    case 'numberRange':
    case 'dateRange':
      return { kind: 'range', fromInput: '', toInput: '' };
    case 'duration':
      return { kind: 'duration', amountInput: '', unit: 'days' };
    case 'enumMulti':
      return { kind: 'multiSelection', selectedOptions: [] };
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

function isRange(
  value: CommittedValue,
): value is RangeValue<string> | RangeValue<number> {
  return typeof value === 'object' && 'from' in value;
}

function isDuration(value: CommittedValue): value is WithinLastValue {
  return typeof value === 'object' && 'amount' in value;
}

/** Rebuilds the draft a committed value was edited from. */
export function createValueDraftFromCommittedValue(
  value: CommittedValue,
  kind: ValueEditorKind,
): ValueDraft {
  const emptyDraft = createEmptyValueDraft(kind);
  if (emptyDraft.kind === 'multiSelection') {
    return {
      ...emptyDraft,
      selectedOptions: Array.isArray(value) ? value.map(String) : [],
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
 * Carries a committed value across a compatible operator-shape change.
 * Incompatible shapes fall back to a fresh draft for the next editor.
 */
export function convertCommittedValueToDraft(
  value: CommittedValue,
  previousEditorKind: ValueEditorKind,
  nextEditorKind: ValueEditorKind,
): ValueDraft {
  const emptyDraft = createEmptyValueDraft(nextEditorKind);
  if (
    emptyDraft.kind === 'multiSelection' &&
    previousEditorKind === 'enumSingle' &&
    typeof value === 'string'
  ) {
    return { ...emptyDraft, selectedOptions: [value] };
  }
  if (
    emptyDraft.kind === 'scalar' &&
    nextEditorKind === 'enumSingle' &&
    previousEditorKind === 'enumMulti' &&
    Array.isArray(value)
  ) {
    return {
      ...emptyDraft,
      input: value[0] === undefined ? '' : String(value[0]),
    };
  }
  if (
    emptyDraft.kind === 'scalar' &&
    (nextEditorKind === 'number' || nextEditorKind === 'date') &&
    (previousEditorKind === 'numberRange' ||
      previousEditorKind === 'dateRange') &&
    isRange(value)
  ) {
    return { ...emptyDraft, input: String(value.from) };
  }
  if (
    emptyDraft.kind === 'range' &&
    (nextEditorKind === 'numberRange' || nextEditorKind === 'dateRange') &&
    (previousEditorKind === 'number' || previousEditorKind === 'date') &&
    (typeof value === 'number' || typeof value === 'string')
  ) {
    return { ...emptyDraft, fromInput: String(value) };
  }
  return emptyDraft;
}
