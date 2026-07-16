import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FilterFieldDefinition } from '@/types/filter.ts';
import { EMPTY_FILTER_EXPRESSION } from '@/utilities/filter/expression.ts';
import type { FilterExpression } from '@/utilities/filter/expression.ts';
import { createFilterFieldRegistry } from '@/utilities/filter/field-registry.ts';
import { createFilterEntry } from '@/utilities/filter/filter-entry.ts';
import type { FilterEntry } from '@/utilities/filter/filter-entry.ts';
import { filterHistoryReducer } from '@/utilities/filter/history.ts';
import type { FilterHistory, FilterHistoryAction } from '@/utilities/filter/history.ts';

import * as filterEditorReducerModule from '../filter-editor-reducer.ts';
import { useFilterEditor } from '../use-filter-editor.ts';
import type { FocusTarget } from '../use-filter-focus.ts';

const FIELDS: readonly FilterFieldDefinition[] = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'amount', label: 'Amount', type: 'number' },
  { key: 'active', label: 'Active', type: 'boolean' },
  {
    key: 'stage',
    label: 'Stage',
    type: 'enum',
    options: ['Lead', 'Won'],
  },
  { key: 'date', label: 'Date', type: 'date' },
];

const nameEntry = (value = 'Maria', id = 'name') =>
  createFilterEntry(
    {
      fieldKey: 'name',
      type: 'string',
      operator: 'equals',
      value,
    },
    id,
  );

const expression = (
  conditions: FilterEntry[],
  joiners: ('and' | 'or')[] = [],
): FilterExpression => ({ conditions, joiners });

function setupEditor(
  fields: readonly FilterFieldDefinition[] = FIELDS,
  initialExpression: FilterExpression = EMPTY_FILTER_EXPRESSION,
) {
  let history: FilterHistory = {
    past: [],
    present: initialExpression,
    future: [],
  };
  let acceptActions = true;
  let nextId = 0;
  const applyFilterHistoryAction = vi.fn((action: FilterHistoryAction): boolean => {
    if (!acceptActions) return false;
    const next = filterHistoryReducer(history, action);
    if (next === history) return false;
    history = next;
    return true;
  });
  const scheduleFocus = vi.fn<(target: FocusTarget) => void>();
  const announce = vi.fn<(message: string) => void>();
  const fieldset = document.createElement('fieldset');
  const resumeButton = document.createElement('button');
  fieldset.append(resumeButton);
  document.body.append(fieldset);
  const popoverAnchorRef = { current: null as HTMLElement | null };
  const initialRegistry = createFilterFieldRegistry(fields);
  const hook = renderHook(
    ({
      fieldRegistry,
      disabled,
    }: {
      fieldRegistry: ReturnType<typeof createFilterFieldRegistry>;
      disabled: boolean;
    }) =>
      useFilterEditor({
        fieldRegistry,
        popoverAnchorRef,
        getCurrentHistory: () => history,
        applyFilterHistoryAction,
        createConditionId: () => `new-${++nextId}`,
        disabled,
        scheduleFocus,
        announce,
      }),
    { initialProps: { fieldRegistry: initialRegistry, disabled: false } },
  );
  return {
    ...hook,
    scheduleFocus,
    announce,
    applyFilterHistoryAction,
    fieldset,
    resumeButton,
    popoverAnchorRef,
    initialRegistry,
    getHistory: () => history,
    rejectActions: () => {
      acceptActions = false;
    },
  };
}

describe('useFilterEditor stage commands', () => {
  it('reduces each same-event command exactly once against the latest state', () => {
    const reducerSpy = vi.spyOn(filterEditorReducerModule, 'filterEditorControllerReducer');
    const hook = setupEditor();
    reducerSpy.mockClear();

    act(() => {
      hook.result.current.openNewFieldPicker('');
      hook.result.current.selectField('name');
      hook.result.current.changeActiveIndex(2);
    });

    expect(reducerSpy).toHaveBeenCalledTimes(3);
    expect(hook.result.current.editorState).toMatchObject({
      stage: 'operator',
      fieldKey: 'name',
      activeIndex: 2,
    });
    reducerSpy.mockRestore();
  });

  it('ignores commands that do not belong to the current stage', () => {
    const hook = setupEditor();
    act(() => {
      hook.result.current.cancel();
      hook.result.current.selectField('name');
      hook.result.current.selectOperator('equals');
      hook.result.current.selectBooleanChoice('true');
      hook.result.current.commitDraft();
      hook.result.current.resumeIncompleteDraft(hook.resumeButton);
    });
    expect(hook.result.current.editorState).toEqual({ stage: 'idle' });
    expect(hook.scheduleFocus).not.toHaveBeenCalled();
    expect(hook.applyFilterHistoryAction).not.toHaveBeenCalled();
  });

  it('cancels new and existing editors to their semantic anchors', () => {
    const hook = setupEditor(FIELDS, expression([nameEntry()]));
    act(() => hook.result.current.openNewFieldPicker('na'));
    act(() => hook.result.current.cancel());
    expect(hook.scheduleFocus).toHaveBeenLastCalledWith({ type: 'addInput' });

    const connected = document.createElement('button');
    hook.fieldset.append(connected);
    act(() => hook.result.current.openTokenSegment(nameEntry(), 'field', connected));
    act(() => hook.result.current.cancel());
    expect(hook.scheduleFocus).toHaveBeenLastCalledWith({
      type: 'element',
      element: connected,
    });

    const detached = document.createElement('button');
    act(() => hook.result.current.openTokenSegment(nameEntry(), 'operator', detached));
    act(() => hook.result.current.cancel());
    expect(hook.scheduleFocus).toHaveBeenLastCalledWith({
      type: 'segment',
      id: 'name',
      segment: 'operator',
    });
  });

  it('preserves only new in-progress editors on browser dismissal or replacement', () => {
    const hook = setupEditor();
    act(() => {
      hook.result.current.openNewFieldPicker('');
      hook.result.current.browserDismiss();
    });
    expect(hook.result.current.incompleteDraft).toBeNull();

    act(() => {
      hook.result.current.openNewFieldPicker('');
      hook.result.current.selectField('name');
      hook.result.current.openNewFieldPicker('stage');
    });
    expect(hook.result.current.incompleteDraft).toMatchObject({
      stage: 'operator',
      fieldKey: 'name',
    });
    expect(hook.announce).toHaveBeenCalledWith('Filter incomplete — kept for later');

    act(() => hook.result.current.browserDismiss());
    expect(hook.result.current.editorState).toEqual({ stage: 'idle' });
  });

  it('selects fields, guards unknown keys, and cancels same-key edits', () => {
    const hook = setupEditor(FIELDS, expression([nameEntry()]));
    act(() => {
      hook.result.current.openNewFieldPicker('');
      hook.result.current.selectField('missing');
    });
    expect(hook.result.current.editorState.stage).toBe('field');
    act(() => hook.result.current.selectField('name'));
    expect(hook.result.current.editorState).toMatchObject({
      stage: 'operator',
      fieldKey: 'name',
    });

    const anchor = document.createElement('button');
    hook.fieldset.append(anchor);
    act(() => hook.result.current.openTokenSegment(nameEntry(), 'field', anchor));
    act(() => hook.result.current.selectField('name'));
    expect(hook.result.current.editorState).toEqual({ stage: 'idle' });

    act(() => hook.result.current.openTokenSegment(nameEntry(), 'field', anchor));
    act(() => hook.result.current.selectField('amount'));
    expect(hook.result.current.editorState).toMatchObject({
      stage: 'operator',
      fieldKey: 'amount',
      fieldType: 'number',
    });
  });
});

describe('useFilterEditor commit commands', () => {
  it('shows validation errors, clears them on change, and commits a valid new value', () => {
    const hook = setupEditor();
    act(() => {
      hook.result.current.openNewFieldPicker('');
      hook.result.current.selectField('name');
      hook.result.current.selectOperator('equals');
      hook.result.current.commitDraft();
    });
    expect(hook.result.current.editorState).toMatchObject({
      stage: 'value',
      error: 'Enter a value',
    });
    act(() => hook.result.current.changeDraft({ kind: 'scalar', input: 'Maria' }));
    expect(hook.result.current.editorState).toMatchObject({ error: null });
    act(() => hook.result.current.commitDraft());
    expect(hook.result.current.editorState).toEqual({ stage: 'idle' });
    expect(hook.getHistory().present.conditions[0]).toMatchObject({
      id: 'new-1',
      value: 'Maria',
    });
    expect(hook.announce).toHaveBeenCalledWith('Filter added: Name is Maria');
  });

  it('commits valueless and boolean choices while honoring narrowed operators', () => {
    const hook = setupEditor([
      {
        key: 'active',
        label: 'Active',
        type: 'boolean',
        operators: ['equals', 'isEmpty'],
      },
      { key: 'name', label: 'Name', type: 'string' },
    ]);
    act(() => {
      hook.result.current.openNewFieldPicker('');
      hook.result.current.selectField('active');
      hook.result.current.selectBooleanChoice('isNotEmpty');
    });
    expect(hook.applyFilterHistoryAction).not.toHaveBeenCalled();

    act(() => hook.result.current.selectBooleanChoice('true'));
    expect(hook.getHistory().present.conditions[0]).toMatchObject({
      operator: 'equals',
      value: true,
    });

    act(() => {
      hook.result.current.openNewFieldPicker('');
      hook.result.current.selectField('active');
      hook.result.current.selectBooleanChoice('false');
    });
    expect(hook.getHistory().present.conditions[1]).toMatchObject({
      operator: 'equals',
      value: false,
    });

    act(() => {
      hook.result.current.openNewFieldPicker('');
      hook.result.current.selectField('active');
      hook.result.current.selectBooleanChoice('isEmpty');
    });
    expect(hook.getHistory().present.conditions[2]).toMatchObject({
      operator: 'isEmpty',
    });
    expect(hook.getHistory().present.conditions[2]).not.toHaveProperty('value');

    act(() => {
      hook.result.current.openNewFieldPicker('');
      hook.result.current.selectField('name');
      hook.result.current.selectOperator('isEmpty');
    });
    expect(hook.getHistory().present.conditions[3]).toMatchObject({
      fieldKey: 'name',
      operator: 'isEmpty',
    });
  });

  it('does not announce reducer-rejected add or update commits', () => {
    const existing = nameEntry();
    const hook = setupEditor(FIELDS, expression([existing]));
    hook.rejectActions();
    act(() => {
      hook.result.current.openNewFieldPicker('');
      hook.result.current.selectField('name');
      hook.result.current.selectOperator('equals');
      hook.result.current.changeDraft({ kind: 'scalar', input: 'New' });
      hook.result.current.commitDraft();
    });
    expect(hook.announce).not.toHaveBeenCalled();

    const anchor = document.createElement('button');
    act(() => hook.result.current.openTokenSegment(existing, 'value', anchor));
    act(() => {
      hook.result.current.changeDraft({ kind: 'scalar', input: 'Updated' });
      hook.result.current.commitDraft();
    });
    expect(hook.announce).not.toHaveBeenCalled();
  });

  it('commits same-shape operator changes immediately and converts changed shapes', () => {
    const existing = nameEntry();
    const number = createFilterEntry(
      {
        fieldKey: 'amount',
        type: 'number',
        operator: 'equals',
        value: 5,
      },
      'amount',
    );
    const hook = setupEditor(FIELDS, expression([existing, number], ['and']));
    const anchor = document.createElement('button');

    act(() => hook.result.current.openTokenSegment(existing, 'operator', anchor));
    act(() => hook.result.current.selectOperator('contains'));
    expect(hook.getHistory().present.conditions[0]).toMatchObject({
      operator: 'contains',
      value: 'Maria',
    });
    expect(hook.announce).toHaveBeenCalledWith('Filter updated: Name contains Maria');

    act(() => hook.result.current.openTokenSegment(number, 'operator', anchor));
    act(() => hook.result.current.selectOperator('between'));
    expect(hook.result.current.editorState).toMatchObject({
      stage: 'value',
      draft: { kind: 'range', fromInput: '5', toInput: '' },
    });
  });

  it('repairs a same-shape enum value that is no longer in the field schema', () => {
    const invalid = createFilterEntry(
      {
        fieldKey: 'stage',
        type: 'enum',
        operator: 'equals',
        value: 'Removed',
      },
      'stage',
    );
    const hook = setupEditor(FIELDS, expression([invalid]));
    act(() =>
      hook.result.current.openTokenSegment(invalid, 'operator', document.createElement('button')),
    );
    act(() => hook.result.current.selectOperator('notEquals'));
    expect(hook.result.current.editorState).toMatchObject({
      stage: 'value',
      operator: 'notEquals',
      draft: { kind: 'scalar', input: '' },
    });
  });

  it('guards operator and boolean commands after their stage or schema changes', () => {
    const hook = setupEditor();
    act(() => {
      hook.result.current.openNewFieldPicker('');
      hook.result.current.selectField('name');
      hook.result.current.selectOperator('on');
    });
    expect(hook.result.current.editorState.stage).toBe('operator');

    act(() => hook.result.current.selectBooleanChoice('true'));
    expect(hook.applyFilterHistoryAction).not.toHaveBeenCalled();
  });

  it('guards every commit against the synchronously current registry', () => {
    const activeField: FilterFieldDefinition<'boolean'> = {
      key: 'active',
      label: 'Active',
      type: 'boolean',
    };
    class FirstReadThenMissingMap extends Map<string, FilterFieldDefinition> {
      reads = 0;

      override get(key: string): FilterFieldDefinition | undefined {
        this.reads += 1;
        return this.reads === 1 ? super.get(key) : undefined;
      }
    }

    const missingDuringCommit = setupEditor([activeField]);
    act(() => {
      missingDuringCommit.result.current.openNewFieldPicker('');
      missingDuringCommit.result.current.selectField('active');
    });
    missingDuringCommit.initialRegistry.byKey = new FirstReadThenMissingMap([
      ['active', activeField],
    ]);
    act(() => missingDuringCommit.result.current.selectBooleanChoice('true'));
    expect(missingDuringCommit.applyFilterHistoryAction).not.toHaveBeenCalled();

    const conflictingEnum = setupEditor([
      {
        key: 'stage',
        type: 'enum',
        options: ['Lead'],
        operators: ['equals'],
      },
    ]);
    act(() => {
      conflictingEnum.result.current.openNewFieldPicker('');
      conflictingEnum.result.current.selectField('stage');
      conflictingEnum.result.current.selectOperator('equals');
    });
    conflictingEnum.initialRegistry.byKey = new Map([
      [
        'stage',
        {
          key: 'stage',
          type: 'enum',
          options: ['Removed'],
          operators: ['equals'],
        },
      ],
    ]);
    act(() => conflictingEnum.result.current.pickSingleValue('Removed'));
    expect(conflictingEnum.applyFilterHistoryAction).not.toHaveBeenCalled();
    expect(conflictingEnum.result.current.editorState.stage).toBe('value');

    const missingDraftField = setupEditor([{ key: 'name', type: 'string' }]);
    act(() => {
      missingDraftField.result.current.openNewFieldPicker('');
      missingDraftField.result.current.selectField('name');
      missingDraftField.result.current.selectOperator('equals');
      missingDraftField.result.current.changeDraft({
        kind: 'scalar',
        input: 'Maria',
      });
    });
    missingDraftField.initialRegistry.byKey = new Map();
    act(() => missingDraftField.result.current.commitDraft());
    expect(missingDraftField.applyFilterHistoryAction).not.toHaveBeenCalled();
  });
});

describe('useFilterEditor token and incomplete-draft flows', () => {
  it('opens field, operator, boolean, and value segments with the right context', () => {
    const name = nameEntry();
    const active = createFilterEntry(
      {
        fieldKey: 'active',
        type: 'boolean',
        operator: 'equals',
        value: true,
      },
      'active',
    );
    const stage = createFilterEntry(
      {
        fieldKey: 'stage',
        type: 'enum',
        operator: 'equals',
        value: 'Won',
      },
      'stage',
    );
    const valueless = createFilterEntry(
      {
        fieldKey: 'name',
        type: 'string',
        operator: 'isEmpty',
      },
      'empty',
    );
    const hook = setupEditor(
      FIELDS,
      expression([name, active, stage, valueless], ['and', 'and', 'and']),
    );
    const anchor = document.createElement('button');

    act(() =>
      hook.result.current.openTokenSegment({ ...name, fieldKey: 'removed' }, 'operator', anchor),
    );
    expect(hook.result.current.editorState).toMatchObject({ stage: 'field' });

    act(() => hook.result.current.openTokenSegment(name, 'operator', anchor));
    expect(hook.result.current.editorState).toMatchObject({
      stage: 'operator',
      sourceSegment: 'operator',
    });

    act(() => hook.result.current.openTokenSegment(active, 'value', anchor));
    expect(hook.result.current.editorState).toMatchObject({
      stage: 'operator',
      sourceSegment: 'value',
      activeIndex: 0,
    });

    act(() => hook.result.current.openTokenSegment(stage, 'value', anchor));
    expect(hook.result.current.editorState).toMatchObject({
      stage: 'value',
      activeIndex: 1,
      draft: { kind: 'scalar', input: 'Won' },
    });

    act(() => hook.result.current.resetEditor());
    act(() => hook.result.current.openTokenSegment(valueless, 'value', anchor));
    expect(hook.result.current.editorState).toEqual({ stage: 'idle' });

    const missingValue = nameEntry('Temporary', 'missing-value');
    Reflect.deleteProperty(missingValue, 'value');
    act(() => hook.result.current.openTokenSegment(missingValue, 'value', anchor));
    expect(hook.result.current.editorState).toMatchObject({
      stage: 'value',
      draft: { kind: 'scalar', input: '' },
    });
  });

  it('announces when opening a token preserves a new draft', () => {
    const name = nameEntry();
    const hook = setupEditor(FIELDS, expression([name]));
    act(() => {
      hook.result.current.openNewFieldPicker('');
      hook.result.current.selectField('stage');
      hook.result.current.openTokenSegment(name, 'field', document.createElement('button'));
    });
    expect(hook.result.current.incompleteDraft).toMatchObject({
      stage: 'operator',
      fieldKey: 'stage',
    });
    expect(hook.announce).toHaveBeenCalledWith('Filter incomplete — kept for later');
  });

  it('resumes operator and value drafts and can discard them', () => {
    const hook = setupEditor();
    const incompleteElement = document.createElement('button');
    hook.fieldset.append(incompleteElement);

    act(() => {
      hook.result.current.openNewFieldPicker('');
      hook.result.current.selectField('name');
      hook.result.current.browserDismiss();
      hook.result.current.resumeIncompleteDraft(incompleteElement);
    });
    expect(hook.result.current.editorState).toMatchObject({
      stage: 'operator',
      fieldKey: 'name',
    });

    act(() => {
      hook.result.current.selectOperator('equals');
      hook.result.current.changeDraft({ kind: 'scalar', input: 'Maria' });
      hook.result.current.browserDismiss();
      hook.result.current.resumeIncompleteDraft(incompleteElement);
    });
    expect(hook.result.current.editorState).toMatchObject({
      stage: 'value',
      draft: { kind: 'scalar', input: 'Maria' },
    });
    expect(hook.popoverAnchorRef.current).toBe(incompleteElement);

    act(() => {
      hook.result.current.browserDismiss();
      hook.result.current.discardIncompleteDraft();
    });
    expect(hook.result.current.incompleteDraft).toBeNull();
    expect(hook.announce).toHaveBeenCalledWith('Incomplete filter discarded');
  });

  it('restarts a changed-type incomplete draft at field selection', () => {
    const hook = setupEditor([{ key: 'flex', type: 'string' }]);
    act(() => {
      hook.result.current.openNewFieldPicker('');
      hook.result.current.selectField('flex');
      hook.result.current.selectOperator('equals');
      hook.result.current.browserDismiss();
    });
    const changedRegistry = createFilterFieldRegistry([{ key: 'flex', type: 'number' }]);
    hook.rerender({ fieldRegistry: changedRegistry, disabled: false });
    act(() => hook.result.current.resumeIncompleteDraft(hook.resumeButton));
    expect(hook.result.current.editorState).toMatchObject({
      stage: 'field',
      filterId: null,
    });
    expect(hook.scheduleFocus).toHaveBeenLastCalledWith({ type: 'addInput' });
  });

  it('backs a removed-operator draft up to operator selection on resume', () => {
    const hook = setupEditor([
      {
        key: 'stage',
        type: 'enum',
        options: ['Lead'],
        operators: ['equals', 'in'],
      },
    ]);
    act(() => {
      hook.result.current.openNewFieldPicker('');
      hook.result.current.selectField('stage');
      hook.result.current.selectOperator('in');
      hook.result.current.browserDismiss();
    });
    hook.rerender({
      fieldRegistry: createFilterFieldRegistry([
        {
          key: 'stage',
          type: 'enum',
          options: ['Lead'],
          operators: ['equals'],
        },
      ]),
      disabled: false,
    });
    act(() => hook.result.current.resumeIncompleteDraft(hook.resumeButton));
    expect(hook.result.current.editorState).toMatchObject({
      stage: 'operator',
      fieldKey: 'stage',
    });
  });

  it('discards a draft whose field disappears before resume', () => {
    const hook = setupEditor([{ key: 'name', type: 'string' }]);
    act(() => {
      hook.result.current.openNewFieldPicker('');
      hook.result.current.selectField('name');
      hook.result.current.browserDismiss();
    });
    hook.initialRegistry.byKey = new Map();
    act(() => hook.result.current.resumeIncompleteDraft(hook.resumeButton));
    expect(hook.result.current.editorState).toEqual({ stage: 'idle' });
    expect(hook.result.current.incompleteDraft).toBeNull();
  });

  it('restores focus to an existing token when its open editor is reconciled away', () => {
    const existing = nameEntry();
    const hook = setupEditor([{ key: 'name', type: 'string' }], expression([existing]));
    act(() =>
      hook.result.current.openTokenSegment(existing, 'operator', document.createElement('button')),
    );
    hook.rerender({
      fieldRegistry: createFilterFieldRegistry([{ key: 'active', type: 'boolean' }]),
      disabled: false,
    });
    expect(hook.result.current.editorState).toEqual({ stage: 'idle' });
    expect(hook.scheduleFocus).toHaveBeenLastCalledWith({
      type: 'token',
      id: 'name',
    });
  });

  it('preserves a new draft but not an existing edit when disabled', () => {
    const existing = nameEntry();
    const hook = setupEditor(FIELDS, expression([existing]));
    act(() => {
      hook.result.current.openNewFieldPicker('');
      hook.result.current.selectField('name');
    });
    hook.rerender({
      fieldRegistry: createFilterFieldRegistry(FIELDS),
      disabled: true,
    });
    expect(hook.result.current.incompleteDraft).toMatchObject({
      stage: 'operator',
      fieldKey: 'name',
    });

    hook.rerender({
      fieldRegistry: createFilterFieldRegistry(FIELDS),
      disabled: false,
    });
    act(() => {
      hook.result.current.openTokenSegment(existing, 'field', document.createElement('button'));
    });
    hook.rerender({
      fieldRegistry: createFilterFieldRegistry(FIELDS),
      disabled: true,
    });
    expect(hook.result.current.editorState).toEqual({ stage: 'idle' });
  });
});
