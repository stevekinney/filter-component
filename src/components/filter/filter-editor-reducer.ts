import { IDLE_FILTER_EDITOR_STATE } from './filter-editor-state.ts';
import type {
  FilterEditorState,
  IncompleteDraft,
} from './filter-editor-state.ts';
import type { ValueDraft } from '@/utilities/filter/value-drafts.ts';

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

export function incompleteFromEditor(
  editor: FilterEditorState,
): IncompleteDraft | null {
  if (
    editor.stage === 'idle' ||
    editor.stage === 'field' ||
    editor.filterId !== null
  ) {
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

export function filterEditorControllerReducer(
  state: FilterEditorControllerState,
  action: FilterEditorControllerAction,
): FilterEditorControllerState {
  switch (action.type) {
    case 'open':
      return {
        editor: action.editor,
        incompleteDraft: action.preserveCurrent
          ? (incompleteFromEditor(state.editor) ?? state.incompleteDraft)
          : state.incompleteDraft,
      };
    case 'idle': {
      const incompleteDraft = action.preserveCurrent
        ? (incompleteFromEditor(state.editor) ?? state.incompleteDraft)
        : state.incompleteDraft;
      if (
        state.editor.stage === 'idle' &&
        incompleteDraft === state.incompleteDraft
      ) {
        return state;
      }
      return { editor: IDLE_FILTER_EDITOR_STATE, incompleteDraft };
    }
    case 'changeQuery': {
      if (state.editor.stage !== 'field') return state;
      if (
        state.editor.query === action.query &&
        state.editor.activeIndex === 0
      ) {
        return state;
      }
      return {
        ...state,
        editor: {
          ...state.editor,
          query: action.query,
          activeIndex: 0,
        },
      };
    }
    case 'changeActiveIndex':
      return state.editor.stage === 'idle' ||
        state.editor.activeIndex === action.index
        ? state
        : {
            ...state,
            editor: { ...state.editor, activeIndex: action.index },
          };
    case 'changeDraft':
      return state.editor.stage !== 'value' ||
        (state.editor.draft === action.draft && state.editor.error === null)
        ? state
        : {
            ...state,
            editor: { ...state.editor, draft: action.draft, error: null },
          };
    case 'validationError':
      return state.editor.stage !== 'value' ||
        (state.editor.draft === action.draft &&
          state.editor.error === action.error)
        ? state
        : {
            ...state,
            editor: {
              ...state.editor,
              draft: action.draft,
              error: action.error,
            },
          };
    case 'replaceIncomplete':
      return state.incompleteDraft === action.draft
        ? state
        : { ...state, incompleteDraft: action.draft };
    case 'discardIncomplete':
      return state.incompleteDraft === null
        ? state
        : { ...state, incompleteDraft: null };
  }
}
