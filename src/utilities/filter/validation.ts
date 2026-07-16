import { z } from 'zod';

import type {
  FilterCondition,
  FilterFieldDefinition,
  FilterOperator,
  RangeValue,
  WithinLastUnit,
} from '@/types/filter.ts';

import type { FilterEntry } from './filter-entry.ts';
import { filterConditionSchema } from './filter-schema.ts';
import { getValueEditorKind, operatorsForField } from './operators.ts';
import type { ValueEditorKind } from './operators.ts';
import type { ValueDraft } from './value-drafts.ts';

export const WITHIN_LAST_UNITS: WithinLastUnit[] = ['days', 'weeks', 'months'];

type DraftValidation = { ok: true; value: FilterCondition['value'] } | { ok: false; error: string };

function invalid(error: string): DraftValidation {
  return { ok: false, error };
}

function valid(value: FilterCondition['value']): DraftValidation {
  return { ok: true, value };
}

function parseNumber(text: string): number | null {
  const trimmed = text.trim();

  if (trimmed === '') return null;
  const parsed = Number(trimmed);

  return Number.isFinite(parsed) ? parsed : null;
}

type DraftValidator = (
  field: FilterFieldDefinition,
  operator: FilterOperator,
  draft: ValueDraft,
) => DraftValidation;

const validateNoValue: DraftValidator = () => valid(undefined);

const validateTextDraft: DraftValidator = (_field, _operator, draft) => {
  if (draft.kind !== 'scalar') return invalid('Enter a value');
  const text = draft.input.trim();

  return text === '' ? invalid('Enter a value') : valid(text);
};

const validateNumberDraft: DraftValidator = (_field, _operator, draft) => {
  if (draft.kind !== 'scalar') return invalid('Enter a number');
  const parsed = parseNumber(draft.input);

  return parsed === null ? invalid('Enter a number') : valid(parsed);
};

const validateNumberRangeDraft: DraftValidator = (_field, _operator, draft) => {
  if (draft.kind !== 'range') return invalid('Enter both numbers');

  const from = parseNumber(draft.fromInput);
  const to = parseNumber(draft.toInput);

  if (from === null || to === null) return invalid('Enter both numbers');
  if (from > to) return invalid('First value must not exceed the second');

  return valid({ from, to });
};

const validateBooleanDraft: DraftValidator = (_field, _operator, draft) => {
  if (draft.kind !== 'scalar' || (draft.input !== 'true' && draft.input !== 'false')) {
    return invalid('Choose a value');
  }

  return valid(draft.input === 'true');
};

const validateSingleEnumDraft: DraftValidator = (field, _operator, draft) => {
  if (draft.kind !== 'scalar' || draft.input === '') return invalid('Choose a value');
  if (!(field.options ?? []).includes(draft.input)) return invalid('Choose a listed option');

  return valid(draft.input);
};

const validateMultipleEnumDraft: DraftValidator = (field, _operator, draft) => {
  if (draft.kind !== 'multiSelection' || draft.selectedOptions.length === 0) {
    return invalid('Choose at least one option');
  }

  const options = field.options ?? [];

  if (draft.selectedOptions.some((option) => !options.includes(option))) {
    return invalid('Choose listed options');
  }

  return valid([...draft.selectedOptions]);
};

const validateDateDraft: DraftValidator = (field, operator, draft) => {
  if (draft.kind !== 'scalar' || draft.input === '') {
    return invalid('Choose a date');
  }

  const candidate = filterConditionSchema.safeParse({
    fieldKey: field.key,
    type: 'date',
    operator,
    value: draft.input,
  });

  return candidate.success ? valid(draft.input) : invalid('Choose a valid date');
};

const validateDateRangeDraft: DraftValidator = (field, operator, draft) => {
  if (draft.kind !== 'range' || draft.fromInput === '' || draft.toInput === '') {
    return invalid('Choose both dates');
  }

  const value = { from: draft.fromInput, to: draft.toInput };
  const candidate = filterConditionSchema.safeParse({
    fieldKey: field.key,
    type: 'date',
    operator,
    value,
  });

  if (candidate.success) return valid(value);

  return draft.fromInput > draft.toInput
    ? invalid('Start must not be after end')
    : invalid('Choose valid dates');
};

const validateDurationDraft: DraftValidator = (_field, _operator, draft) => {
  if (draft.kind !== 'duration') {
    return invalid('Enter a positive whole number');
  }
  const amount = parseNumber(draft.amountInput);

  if (amount === null || !Number.isInteger(amount) || amount < 1) {
    return invalid('Enter a positive whole number');
  }
  const unit = WITHIN_LAST_UNITS.find((candidate) => candidate === draft.unit);

  return unit ? valid({ amount, unit }) : invalid('Choose a unit');
};

const DRAFT_VALIDATORS: Record<ValueEditorKind, DraftValidator> = {
  none: validateNoValue,
  text: validateTextDraft,
  number: validateNumberDraft,
  numberRange: validateNumberRangeDraft,
  boolean: validateBooleanDraft,
  enumSingle: validateSingleEnumDraft,
  enumMulti: validateMultipleEnumDraft,
  date: validateDateDraft,
  dateRange: validateDateRangeDraft,
  duration: validateDurationDraft,
};

/**
 * Validates a transient draft against the editor kind for a field + operator
 * pair. Returns the committed value shape on success and a user-facing error
 * on failure — invalid input never reaches the reducer.
 */
export function validateDraft(
  field: FilterFieldDefinition,
  operator: FilterOperator,
  draft: ValueDraft,
): DraftValidation {
  if (!operatorsForField(field).includes(operator)) {
    return invalid('Choose a supported operator');
  }
  const kind = getValueEditorKind(field.type, operator);

  return DRAFT_VALIDATORS[kind](field, operator, draft);
}

/**
 * Builds a committed filter from dynamic editor parts. The allowed-operator
 * check applies the live field contract, then the shared condition schema
 * verifies the complete field/operator/value pairing.
 */
export function createFilterCondition(
  field: FilterFieldDefinition,
  operator: FilterOperator,
  value: FilterCondition['value'],
): FilterCondition {
  if (!operatorsForField(field).includes(operator)) {
    throw new TypeError(`Operator "${operator}" is not allowed for field "${field.key}"`);
  }

  const candidate = {
    fieldKey: field.key,
    type: field.type,
    operator,
    ...(value !== undefined ? { value } : {}),
  };

  const result = filterConditionSchema.safeParse(candidate);

  if (result.success) return result.data;
  throw new TypeError(
    `Invalid condition for field "${field.key}":\n${z.prettifyError(result.error)}`,
  );
}

export type TokenSegment = 'field' | 'operator' | 'value';

export type FilterValidationIssue = {
  segment: TokenSegment;
  reason: string;
};

function enumFilterValues(value: FilterEntry['value']): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  return [];
}

function getEnumValueIssue(
  field: FilterFieldDefinition,
  filter: FilterEntry,
): FilterValidationIssue | null {
  if (field.type !== 'enum' || filter.value === undefined) return null;
  const options = field.options ?? [];
  const missing = enumFilterValues(filter.value).filter((value) => !options.includes(value));

  if (missing.length === 0) return null;
  const verb = missing.length === 1 ? 'is' : 'are';

  return {
    segment: 'value',
    reason: `${missing.join(', ')} ${verb} no longer a valid option`,
  };
}

/**
 * Re-validates a committed filter against the current field definitions.
 * Fields can disappear or change type, operator sets can narrow, and enum
 * options can vanish — the broken segment and a human-readable reason come
 * back so the UI can flag the token and reopen the right stage. Returns null
 * when valid.
 */
export function getFilterValidationIssue(
  filter: FilterEntry,
  fields: readonly FilterFieldDefinition[],
): FilterValidationIssue | null {
  const field = fields.find((candidate) => candidate.key === filter.fieldKey);

  if (!field) {
    return { segment: 'field', reason: 'This field is no longer available' };
  }

  const label = field.label ?? field.key;

  if (field.type !== filter.type) {
    return {
      segment: 'field',
      reason: `${label} is now a ${field.type} field`,
    };
  }

  if (!operatorsForField(field).includes(filter.operator)) {
    return {
      segment: 'operator',
      reason: `This operator is no longer supported for ${label}`,
    };
  }

  const enumValueIssue = getEnumValueIssue(field, filter);

  if (enumValueIssue) return enumValueIssue;

  const { id: _id, ...condition } = filter;
  const intrinsic = filterConditionSchema.safeParse(condition);

  if (intrinsic.success) return null;
  return { segment: 'value', reason: intrinsicValueReason(filter) };
}

/**
 * Intrinsic value-shape checks for committed conditions. The component's own
 * editors can never produce these shapes (`validateDraft` rejects them), but
 * conditions seeded through the public `initialFilters` prop bypass
 * `validateDraft`, and the `onChange` contract promises valid, executable
 * conditions only.
 */
function isRangeValue(
  value: FilterEntry['value'],
): value is RangeValue<string> | RangeValue<number> {
  return typeof value === 'object' && value !== null && 'from' in value && 'to' in value;
}

function isInvertedRange(value: RangeValue<string> | RangeValue<number>): boolean {
  if (typeof value.from === 'number' && typeof value.to === 'number') {
    return value.from > value.to;
  }
  return String(value.from) > String(value.to);
}

function intrinsicRangeReason(value: FilterEntry['value']): string {
  if (!isRangeValue(value)) return 'Choose both valid ends of the range';
  if (isInvertedRange(value)) return 'Start must not exceed end';
  return 'Choose both valid ends of the range';
}

function intrinsicValueReason(filter: FilterEntry): string {
  if (filter.operator === 'in' || filter.operator === 'notIn')
    return 'Choose at least one valid option';
  if (filter.operator === 'between') return intrinsicRangeReason(filter.value);
  if (filter.operator === 'withinLast')
    return 'Duration needs a positive whole number of days, weeks, or months';
  if (filter.type === 'number') return 'Enter a finite number';
  if (filter.type === 'date') return 'Choose a valid date';
  if (filter.type === 'boolean') return 'Choose true or false';

  return 'Enter a value';
}
