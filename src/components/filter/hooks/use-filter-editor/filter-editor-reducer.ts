import type { ValueDraft } from '@filter/utilities/value-drafts.ts';

import { IDLE_FILTER_EDITOR_STATE } from './filter-editor-state.ts';
import type { FilterEditorState, IncompleteDraft } from './filter-editor-state.ts';

export type FilterEditorControllerState = {
  editor: FilterEditorState;
  incompleteDraft: IncompleteDraft | null;
};

export type FilterEditorControllerAction =
  | {
      type: 'open';
      editor: Exclude<FilterEditorState, { stage: 'idle' }>;
      preserveCurrent: boolean;
    }
  | { type: 'idle'; preserveCurrent: boolean }
  | { type: 'changeQuery'; query: string }
  | { type: 'changeActiveIndex'; index: number }
  | { type: 'changeDraft'; draft: ValueDraft }
  | { type: 'validationError'; draft: ValueDraft; error: string }
  | { type: 'replaceIncomplete'; draft: IncompleteDraft | null }
  | { type: 'discardIncomplete' };

export function incompleteFromEditor(editor: FilterEditorState): IncompleteDraft | null {
  if (editor.stage === 'idle' || editor.stage === 'field' || editor.filterId !== null) {
    return null;
  }

  return editor.stage === 'operator'
    ? {
        stage: 'operator',
        fieldKey: editor.fieldKey,
        fieldType: editor.fieldType,
      }
    : {
        stage: 'value',
        fieldKey: editor.fieldKey,
        fieldType: editor.fieldType,
        operator: editor.operator,
        draft: editor.draft,
      };
}

function preservedIncompleteDraft(
  state: FilterEditorControllerState,
  preserveCurrent: boolean,
): IncompleteDraft | null {
  if (!preserveCurrent) return state.incompleteDraft;
  return incompleteFromEditor(state.editor) ?? state.incompleteDraft;
}

function idleEditor(
  state: FilterEditorControllerState,
  preserveCurrent: boolean,
): FilterEditorControllerState {
  const incompleteDraft = preservedIncompleteDraft(state, preserveCurrent);

  if (state.editor.stage === 'idle' && incompleteDraft === state.incompleteDraft) {
    return state;
  }

  return { editor: IDLE_FILTER_EDITOR_STATE, incompleteDraft };
}

function changeQuery(
  state: FilterEditorControllerState,
  query: string,
): FilterEditorControllerState {
  if (state.editor.stage !== 'field') return state;

  if (state.editor.query === query && state.editor.activeIndex === 0) {
    return state;
  }

  return {
    ...state,
    editor: {
      ...state.editor,
      query,
      activeIndex: 0,
    },
  };
}

function changeDraft(
  state: FilterEditorControllerState,
  draft: ValueDraft,
): FilterEditorControllerState {
  if (state.editor.stage !== 'value') return state;
  if (state.editor.draft === draft && state.editor.error === null) return state;

  return {
    ...state,
    editor: { ...state.editor, draft, error: null },
  };
}

function setValidationError(
  state: FilterEditorControllerState,
  draft: ValueDraft,
  error: string,
): FilterEditorControllerState {
  if (state.editor.stage !== 'value') return state;
  if (state.editor.draft === draft && state.editor.error === error) return state;
  return {
    ...state,
    editor: { ...state.editor, draft, error },
  };
}

export function filterEditorControllerReducer(
  state: FilterEditorControllerState,
  action: FilterEditorControllerAction,
): FilterEditorControllerState {
  switch (action.type) {
    case 'open':
      return {
        editor: action.editor,
        incompleteDraft: preservedIncompleteDraft(state, action.preserveCurrent),
      };
    case 'idle':
      return idleEditor(state, action.preserveCurrent);
    case 'changeQuery':
      return changeQuery(state, action.query);
    case 'changeActiveIndex':
      if (state.editor.stage === 'idle' || state.editor.activeIndex === action.index) {
        return state;
      }
      return {
        ...state,
        editor: { ...state.editor, activeIndex: action.index },
      };
    case 'changeDraft':
      return changeDraft(state, action.draft);
    case 'validationError':
      return setValidationError(state, action.draft, action.error);
    case 'replaceIncomplete':
      if (state.incompleteDraft === action.draft) return state;
      return { ...state, incompleteDraft: action.draft };
    case 'discardIncomplete':
      if (state.incompleteDraft === null) return state;
      return { ...state, incompleteDraft: null };
  }
}
