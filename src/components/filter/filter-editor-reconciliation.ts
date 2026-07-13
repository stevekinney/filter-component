import { IDLE_FILTER_EDITOR_STATE } from './filter-editor-state.ts';
import type {
  FilterEditorState,
  IncompleteDraft,
} from './filter-editor-state.ts';
import type { FilterFieldRegistry } from '@/utilities/filter/field-registry.ts';
import { createFilterEntry } from '@/utilities/filter/filter-entry.ts';
import type { FilterEntry } from '@/utilities/filter/filter-entry.ts';
import {
  createFilterCondition,
  getFilterValidationIssue,
} from '@/utilities/filter/validation.ts';
import type { TokenSegment } from '@/utilities/filter/validation.ts';
import {
  convertCommittedValueToDraft,
  createEmptyValueDraft,
  createValueDraftFromCommittedValue,
} from '@/utilities/filter/value-drafts.ts';
import type { ValueDraft } from '@/utilities/filter/value-drafts.ts';
import {
  booleanChoicesForField,
  getValueEditorKind,
  operatorsForField,
} from '@/utilities/filter/operators.ts';
import type { ValueEditorKind } from '@/utilities/filter/operators.ts';
import type {
  FilterCondition,
  FilterFieldDefinition,
  FilterOperator,
} from '@/types/filter.ts';

export function fieldActiveIndex(
  registry: FilterFieldRegistry,
  key: string,
): number {
  return Math.max(
    0,
    registry.fields.findIndex((field) => field.key === key),
  );
}

export function enumActiveIndex(
  options: readonly string[] | undefined,
  draft: ValueDraft,
  kind: ValueEditorKind,
): number {
  return kind === 'enumSingle' && draft.kind === 'scalar'
    ? Math.max(0, (options ?? []).indexOf(draft.input))
    : 0;
}

export function booleanActiveIndex(
  field: FilterFieldDefinition<'boolean'>,
  operator: string,
  value: unknown,
): number {
  return Math.max(
    0,
    booleanChoicesForField(field).findIndex((choice) =>
      operator === 'equals'
        ? choice.value === String(value)
        : choice.value === operator,
    ),
  );
}

function draftMatchesKind(draft: ValueDraft, kind: ValueEditorKind): boolean {
  if (kind === 'numberRange' || kind === 'dateRange') {
    return draft.kind === 'range';
  }
  if (kind === 'duration') return draft.kind === 'duration';
  if (kind === 'enumMulti') return draft.kind === 'multiSelection';
  return draft.kind === 'scalar';
}

function reconcileEnumDraft(
  draft: ValueDraft,
  options: readonly string[],
): ValueDraft {
  if (draft.kind === 'multiSelection') {
    const selectedOptions = draft.selectedOptions.filter((option) =>
      options.includes(option),
    );
    return selectedOptions.length === draft.selectedOptions.length
      ? draft
      : { ...draft, selectedOptions };
  }
  if (
    draft.kind === 'scalar' &&
    draft.input !== '' &&
    !options.includes(draft.input)
  ) {
    return { ...draft, input: '' };
  }
  return draft;
}

/** Preserves enum selections that still exist after field definitions change. */
function reconcileValueDraftForField(
  draft: ValueDraft,
  field: FilterFieldDefinition,
): ValueDraft {
  return field.type === 'enum'
    ? reconcileEnumDraft(draft, field.options)
    : draft;
}

type OperatorSelectionResolution =
  | { type: 'commit'; value: NonNullable<FilterCondition['value']> }
  | { type: 'edit'; draft: ValueDraft };

/** Reuses a compatible committed value or prepares a draft for an operator change. */
export function resolveOperatorSelection(
  field: FilterFieldDefinition,
  operator: FilterOperator,
  token: FilterEntry | undefined,
  fields: readonly FilterFieldDefinition[],
): OperatorSelectionResolution {
  const kind = getValueEditorKind(field.type, operator);
  const emptyDraft = createEmptyValueDraft(kind);
  if (
    !token ||
    token.fieldKey !== field.key ||
    token.type !== field.type ||
    token.value === undefined
  ) {
    return { type: 'edit', draft: emptyDraft };
  }

  const previousKind = getValueEditorKind(field.type, token.operator);
  if (previousKind === kind) {
    const candidate = createFilterEntry(
      createFilterCondition(field, operator, token.value),
      token.id,
    );
    if (getFilterValidationIssue(candidate, fields) === null) {
      return { type: 'commit', value: token.value };
    }
  }

  const draft = convertCommittedValueToDraft(token.value, kind);
  return { type: 'edit', draft: reconcileValueDraftForField(draft, field) };
}

function fieldEditorForToken(
  token: FilterEntry,
  registry: FilterFieldRegistry,
): Exclude<FilterEditorState, { stage: 'idle' }> {
  return {
    stage: 'field',
    filterId: token.id,
    query: '',
    activeIndex: fieldActiveIndex(registry, token.fieldKey),
  };
}

function operatorEditorForToken(
  token: FilterEntry,
  segment: TokenSegment,
  field: FilterFieldDefinition,
): Exclude<FilterEditorState, { stage: 'idle' }> {
  const activeIndex =
    field.type === 'boolean'
      ? booleanActiveIndex(field, token.operator, token.value)
      : Math.max(0, operatorsForField(field).indexOf(token.operator));
  return {
    stage: 'operator',
    filterId: token.id,
    fieldKey: field.key,
    fieldType: field.type,
    activeIndex,
    sourceSegment: segment === 'value' ? 'value' : 'operator',
  };
}

function valueEditorForToken(
  token: FilterEntry,
  field: FilterFieldDefinition,
): Exclude<FilterEditorState, { stage: 'idle' }> | null {
  const kind = getValueEditorKind(field.type, token.operator);
  if (kind === 'none') return null;
  const draft =
    token.value === undefined
      ? createEmptyValueDraft(kind)
      : createValueDraftFromCommittedValue(token.value, kind);
  const reconciledDraft = reconcileValueDraftForField(draft, field);
  return {
    stage: 'value',
    filterId: token.id,
    fieldKey: field.key,
    fieldType: field.type,
    operator: token.operator,
    draft: reconciledDraft,
    error: null,
    activeIndex: enumActiveIndex(field.options, reconciledDraft, kind),
  };
}

/** Builds the editor state for a token segment after checking current field definitions. */
export function editorForTokenSegment(
  token: FilterEntry,
  segment: TokenSegment,
  registry: FilterFieldRegistry,
): Exclude<FilterEditorState, { stage: 'idle' }> | null {
  const field = registry.byKey.get(token.fieldKey);
  if (segment === 'field' || !field || field.type !== token.type) {
    return fieldEditorForToken(token, registry);
  }
  if (
    !operatorsForField(field).includes(token.operator) ||
    segment === 'operator' ||
    field.type === 'boolean'
  ) {
    return operatorEditorForToken(token, segment, field);
  }
  return valueEditorForToken(token, field);
}

/** Repairs or closes an open editor after field definitions change. */
export function reconcileFilterEditor(
  editor: FilterEditorState,
  registry: FilterFieldRegistry,
): FilterEditorState {
  if (editor.stage !== 'operator' && editor.stage !== 'value') return editor;
  const field = registry.byKey.get(editor.fieldKey);
  if (!field) return IDLE_FILTER_EDITOR_STATE;
  if (field.type !== editor.fieldType) {
    return {
      stage: 'field',
      filterId: editor.filterId,
      query: '',
      activeIndex: fieldActiveIndex(registry, editor.fieldKey),
    };
  }
  if (editor.stage === 'operator') return editor;
  if (!operatorsForField(field).includes(editor.operator)) {
    return {
      stage: 'operator',
      filterId: editor.filterId,
      fieldKey: field.key,
      fieldType: field.type,
      activeIndex: 0,
    };
  }
  const kind = getValueEditorKind(field.type, editor.operator);
  let draft = draftMatchesKind(editor.draft, kind)
    ? editor.draft
    : createEmptyValueDraft(kind);
  draft = reconcileValueDraftForField(draft, field);
  return draft === editor.draft
    ? editor
    : { ...editor, draft, error: null, activeIndex: 0 };
}

/** Reconciles a resumable draft with changed field definitions. */
export function reconcileIncompleteDraft(
  incomplete: IncompleteDraft | null,
  registry: FilterFieldRegistry,
): IncompleteDraft | null {
  if (!incomplete) return null;
  const field = registry.byKey.get(incomplete.fieldKey);
  if (!field) return null;
  if (field.type !== incomplete.fieldType || incomplete.stage === 'operator') {
    return incomplete;
  }
  if (!operatorsForField(field).includes(incomplete.operator)) {
    return {
      stage: 'operator',
      fieldKey: field.key,
      fieldType: field.type,
    };
  }
  const draft = reconcileValueDraftForField(incomplete.draft, field);
  return draft === incomplete.draft ? incomplete : { ...incomplete, draft };
}
