import { IDLE_FILTER_EDITOR_STATE } from './filter-editor-state.ts';
import type {
  FilterEditorState,
  IncompleteDraft,
} from './filter-editor-state.ts';
import type { FilterFieldRegistry } from '@/utilities/filter/field-registry.ts';
import { createEmptyValueDraft } from '@/utilities/filter/value-drafts.ts';
import type { ValueDraft } from '@/utilities/filter/value-drafts.ts';
import {
  booleanChoicesForField,
  getValueEditorKind,
  operatorsForField,
} from '@/utilities/filter/operators.ts';
import type { ValueEditorKind } from '@/utilities/filter/operators.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';

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

/** Removes choices that no longer exist in the current enum definition. */
export function reconcileValueDraftForField(
  draft: ValueDraft,
  field: FilterFieldDefinition,
): ValueDraft {
  return field.type === 'enum'
    ? reconcileEnumDraft(draft, field.options)
    : draft;
}

/** Reconciles an open editor against the latest checked field registry. */
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

/** Keeps resumable drafts safe when the parent changes field content in place. */
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
