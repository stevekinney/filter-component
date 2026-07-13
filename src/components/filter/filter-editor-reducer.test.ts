import { describe, expect, it } from 'vitest';
import {
  filterEditorControllerReducer,
  incompleteFromEditor,
} from './filter-editor-reducer.ts';
import type { FilterEditorControllerState } from './filter-editor-reducer.ts';
import {
  IDLE_FILTER_EDITOR_STATE,
  activeEditorSegment,
  findEditingFilter,
} from './filter-editor-state.ts';
import type { FilterEditorState } from './filter-editor-state.ts';
import { createFilterEntry } from '@/utilities/filter/filter-entry.ts';

const scalarDraft = { kind: 'scalar', input: 'Maria' } as const;

describe('incompleteFromEditor', () => {
  it('keeps only new operator and value compositions', () => {
    expect(incompleteFromEditor(IDLE_FILTER_EDITOR_STATE)).toBeNull();
    expect(
      incompleteFromEditor({
        stage: 'field',
        filterId: null,
        query: 'na',
        activeIndex: 0,
      }),
    ).toBeNull();
    expect(
      incompleteFromEditor({
        stage: 'operator',
        filterId: 'existing',
        fieldKey: 'name',
        fieldType: 'string',
        activeIndex: 0,
      }),
    ).toBeNull();
    expect(
      incompleteFromEditor({
        stage: 'operator',
        filterId: null,
        fieldKey: 'name',
        fieldType: 'string',
        activeIndex: 0,
      }),
    ).toEqual({
      stage: 'operator',
      fieldKey: 'name',
      fieldType: 'string',
    });
    expect(
      incompleteFromEditor({
        stage: 'value',
        filterId: null,
        fieldKey: 'name',
        fieldType: 'string',
        operator: 'equals',
        draft: scalarDraft,
        error: null,
        activeIndex: 0,
      }),
    ).toEqual({
      stage: 'value',
      fieldKey: 'name',
      fieldType: 'string',
      operator: 'equals',
      draft: scalarDraft,
    });
  });
});

describe('editor-state selectors', () => {
  it('maps every active stage to its semantic token segment', () => {
    expect(
      activeEditorSegment({
        stage: 'field',
        filterId: 'filter',
        query: '',
        activeIndex: 0,
      }),
    ).toBe('field');
    expect(
      activeEditorSegment({
        stage: 'operator',
        filterId: 'filter',
        fieldKey: 'name',
        fieldType: 'string',
        activeIndex: 0,
      }),
    ).toBe('operator');
    expect(
      activeEditorSegment({
        stage: 'operator',
        filterId: 'filter',
        fieldKey: 'name',
        fieldType: 'string',
        activeIndex: 0,
        sourceSegment: 'value',
      }),
    ).toBe('value');
    expect(
      activeEditorSegment({
        stage: 'value',
        filterId: 'filter',
        fieldKey: 'name',
        fieldType: 'string',
        operator: 'equals',
        draft: scalarDraft,
        error: null,
        activeIndex: 0,
      }),
    ).toBe('value');
  });

  it('finds only an existing condition selected by an active editor', () => {
    const filter = createFilterEntry(
      {
        fieldKey: 'name',
        type: 'string',
        operator: 'equals',
        value: 'Maria',
      },
      'filter',
    );
    expect(findEditingFilter(IDLE_FILTER_EDITOR_STATE, [filter])).toBeNull();
    expect(
      findEditingFilter(
        {
          stage: 'field',
          filterId: null,
          query: '',
          activeIndex: 0,
        },
        [filter],
      ),
    ).toBeNull();
    expect(
      findEditingFilter(
        {
          stage: 'field',
          filterId: 'filter',
          query: '',
          activeIndex: 0,
        },
        [filter],
      ),
    ).toBe(filter);
    expect(
      findEditingFilter(
        {
          stage: 'field',
          filterId: 'missing',
          query: '',
          activeIndex: 0,
        },
        [filter],
      ),
    ).toBeNull();
  });
});

describe('filterEditorControllerReducer', () => {
  const idle: FilterEditorControllerState = {
    editor: IDLE_FILTER_EDITOR_STATE,
    incompleteDraft: null,
  };
  const newOperator: FilterEditorState = {
    stage: 'operator',
    filterId: null,
    fieldKey: 'name',
    fieldType: 'string',
    activeIndex: 0,
  };

  it('opens and idles while optionally preserving the current draft', () => {
    const opened = filterEditorControllerReducer(
      { ...idle, editor: newOperator },
      {
        type: 'open',
        preserveCurrent: true,
        editor: {
          stage: 'field',
          filterId: null,
          query: '',
          activeIndex: 0,
        },
      },
    );
    expect(opened.incompleteDraft).toEqual({
      stage: 'operator',
      fieldKey: 'name',
      fieldType: 'string',
    });
    expect(
      filterEditorControllerReducer(
        { ...idle, editor: newOperator },
        {
          type: 'open',
          preserveCurrent: false,
          editor: {
            stage: 'field',
            filterId: null,
            query: '',
            activeIndex: 0,
          },
        },
      ).incompleteDraft,
    ).toBeNull();

    const existingIncomplete = {
      stage: 'operator' as const,
      fieldKey: 'active',
      fieldType: 'boolean' as const,
    };
    expect(
      filterEditorControllerReducer(
        {
          editor: IDLE_FILTER_EDITOR_STATE,
          incompleteDraft: existingIncomplete,
        },
        {
          type: 'open',
          preserveCurrent: true,
          editor: newOperator,
        },
      ).incompleteDraft,
    ).toBe(existingIncomplete);
    expect(
      filterEditorControllerReducer(
        { editor: newOperator, incompleteDraft: null },
        { type: 'idle', preserveCurrent: true },
      ),
    ).toEqual({
      editor: IDLE_FILTER_EDITOR_STATE,
      incompleteDraft: {
        stage: 'operator',
        fieldKey: 'name',
        fieldType: 'string',
      },
    });
    expect(
      filterEditorControllerReducer(
        { editor: newOperator, incompleteDraft: existingIncomplete },
        { type: 'idle', preserveCurrent: false },
      ),
    ).toEqual({
      editor: IDLE_FILTER_EDITOR_STATE,
      incompleteDraft: existingIncomplete,
    });
    expect(
      filterEditorControllerReducer(
        {
          editor: IDLE_FILTER_EDITOR_STATE,
          incompleteDraft: existingIncomplete,
        },
        { type: 'idle', preserveCurrent: true },
      ).incompleteDraft,
    ).toBe(existingIncomplete);
  });

  it('updates only the state owned by the active stage', () => {
    const fieldState: FilterEditorControllerState = {
      ...idle,
      editor: {
        stage: 'field',
        filterId: null,
        query: '',
        activeIndex: 4,
      },
    };
    const queried = filterEditorControllerReducer(fieldState, {
      type: 'changeQuery',
      query: 'sta',
    });
    expect(queried.editor).toMatchObject({ query: 'sta', activeIndex: 0 });
    expect(
      filterEditorControllerReducer(idle, {
        type: 'changeQuery',
        query: 'ignored',
      }),
    ).toBe(idle);

    const moved = filterEditorControllerReducer(
      { ...idle, editor: newOperator },
      { type: 'changeActiveIndex', index: 3 },
    );
    expect(moved.editor).toMatchObject({ activeIndex: 3 });
    expect(
      filterEditorControllerReducer(idle, {
        type: 'changeActiveIndex',
        index: 1,
      }),
    ).toBe(idle);

    const valueState: FilterEditorControllerState = {
      ...idle,
      editor: {
        stage: 'value',
        filterId: null,
        fieldKey: 'name',
        fieldType: 'string',
        operator: 'equals',
        draft: { kind: 'scalar', input: '' },
        error: 'old',
        activeIndex: 0,
      },
    };
    expect(
      filterEditorControllerReducer(valueState, {
        type: 'changeDraft',
        draft: scalarDraft,
      }).editor,
    ).toMatchObject({ draft: scalarDraft, error: null });
    expect(
      filterEditorControllerReducer(idle, {
        type: 'changeDraft',
        draft: scalarDraft,
      }),
    ).toBe(idle);
    expect(
      filterEditorControllerReducer(valueState, {
        type: 'validationError',
        draft: scalarDraft,
        error: 'Required',
      }).editor,
    ).toMatchObject({ draft: scalarDraft, error: 'Required' });
    expect(
      filterEditorControllerReducer(idle, {
        type: 'validationError',
        draft: scalarDraft,
        error: 'ignored',
      }),
    ).toBe(idle);
  });

  it('preserves identity for redundant semantic actions', () => {
    const existingIncomplete = {
      stage: 'operator' as const,
      fieldKey: 'active',
      fieldType: 'boolean' as const,
    };
    const idleWithDraft: FilterEditorControllerState = {
      editor: IDLE_FILTER_EDITOR_STATE,
      incompleteDraft: existingIncomplete,
    };
    expect(
      filterEditorControllerReducer(idleWithDraft, {
        type: 'idle',
        preserveCurrent: true,
      }),
    ).toBe(idleWithDraft);
    expect(
      filterEditorControllerReducer(idle, { type: 'discardIncomplete' }),
    ).toBe(idle);
    expect(
      filterEditorControllerReducer(idleWithDraft, {
        type: 'replaceIncomplete',
        draft: existingIncomplete,
      }),
    ).toBe(idleWithDraft);

    const fieldEditor = {
      stage: 'field',
      filterId: null,
      query: 'name',
      activeIndex: 0,
    } satisfies Extract<FilterEditorState, { stage: 'field' }>;
    const fieldState = {
      ...idle,
      editor: fieldEditor,
    };
    expect(
      filterEditorControllerReducer(fieldState, {
        type: 'changeQuery',
        query: 'name',
      }),
    ).toBe(fieldState);
    const movedFieldState = {
      ...fieldState,
      editor: { ...fieldEditor, activeIndex: 2 },
    };
    expect(
      filterEditorControllerReducer(movedFieldState, {
        type: 'changeQuery',
        query: 'name',
      }).editor,
    ).toMatchObject({ query: 'name', activeIndex: 0 });
    expect(
      filterEditorControllerReducer(fieldState, {
        type: 'changeActiveIndex',
        index: 0,
      }),
    ).toBe(fieldState);

    const valueEditor = {
      stage: 'value',
      filterId: null,
      fieldKey: 'name',
      fieldType: 'string',
      operator: 'equals',
      draft: scalarDraft,
      error: null,
      activeIndex: 0,
    } satisfies Extract<FilterEditorState, { stage: 'value' }>;
    const valueState = {
      ...idle,
      editor: valueEditor,
    };
    expect(
      filterEditorControllerReducer(valueState, {
        type: 'changeDraft',
        draft: scalarDraft,
      }),
    ).toBe(valueState);

    const invalidValueState = {
      ...valueState,
      editor: { ...valueEditor, error: 'Required' },
    };
    expect(
      filterEditorControllerReducer(invalidValueState, {
        type: 'validationError',
        draft: scalarDraft,
        error: 'Required',
      }),
    ).toBe(invalidValueState);
    expect(
      filterEditorControllerReducer(invalidValueState, {
        type: 'changeDraft',
        draft: scalarDraft,
      }).editor,
    ).toMatchObject({ draft: scalarDraft, error: null });
    expect(
      filterEditorControllerReducer(invalidValueState, {
        type: 'validationError',
        draft: scalarDraft,
        error: 'Still required',
      }).editor,
    ).toMatchObject({ draft: scalarDraft, error: 'Still required' });
  });

  it('replaces and discards resumable drafts explicitly', () => {
    const draft = {
      stage: 'operator' as const,
      fieldKey: 'name',
      fieldType: 'string' as const,
    };
    const replaced = filterEditorControllerReducer(idle, {
      type: 'replaceIncomplete',
      draft,
    });
    expect(replaced.incompleteDraft).toBe(draft);
    expect(
      filterEditorControllerReducer(replaced, { type: 'discardIncomplete' })
        .incompleteDraft,
    ).toBeNull();
  });
});
