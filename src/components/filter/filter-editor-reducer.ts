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
    case 'idle':
      return {
        editor: IDLE_FILTER_EDITOR_STATE,
        incompleteDraft: action.preserveCurrent
          ? (incompleteFromEditor(state.editor) ?? state.incompleteDraft)
          : state.incompleteDraft,
      };
    case 'changeQuery':
      return state.editor.stage === 'field'
        ? {
            ...state,
            editor: {
              ...state.editor,
              query: action.query,
              activeIndex: 0,
            },
          }
        : state;
    case 'changeActiveIndex':
      return state.editor.stage === 'idle'
        ? state
        : {
            ...state,
            editor: { ...state.editor, activeIndex: action.index },
          };
    case 'changeDraft':
      return state.editor.stage === 'value'
        ? {
            ...state,
            editor: { ...state.editor, draft: action.draft, error: null },
          }
        : state;
    case 'validationError':
      return state.editor.stage === 'value'
        ? {
            ...state,
            editor: {
              ...state.editor,
              draft: action.draft,
              error: action.error,
            },
          }
        : state;
    case 'replaceIncomplete':
      return { ...state, incompleteDraft: action.draft };
    case 'discardIncomplete':
      return { ...state, incompleteDraft: null };
  }
}
